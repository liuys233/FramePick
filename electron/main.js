const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const sharp = require('sharp')
const {
  analyzePhoto,
  analyzeBatch,
} = require('./services/image-analyzer')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: '摄影选片助手',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => { mainWindow = null })
}

const SUPPORTED_EXTS = [
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
  '.tiff', '.tif', '.raw', '.cr2', '.nef', '.arw',
  '.dng', '.orf', '.rw2',
]

const WEB_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']

function scanPhotos(dirPath) {
  const results = []
  const stack = [dirPath]

  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (err) {
      console.error('扫描目录出错:', dir, err.message)
      continue
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (SUPPORTED_EXTS.includes(ext)) {
          let stat
          try {
            stat = fs.statSync(fullPath)
          } catch {
            continue
          }
          results.push({
            path: fullPath,
            name: entry.name,
            size: stat.size,
            mtime: stat.mtimeMs,
          })
        }
      }
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name))
}

// ── Dialog IPC ───────────────────────────────────────────────────
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择照片文件夹',
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const dirPath = result.filePaths[0]
  const files = scanPhotos(dirPath)
  return { dirPath, files }
})

ipcMain.handle('dialog:selectFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: '图片文件',
        extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'raw', 'cr2', 'nef', 'arw', 'dng', 'orf', 'rw2'],
      },
    ],
    title: '选择照片',
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths
})

ipcMain.handle('dialog:selectExportDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择导出目录',
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

// ── Thumbnail ────────────────────────────────────────────────────
// 生成缩略图并保存到临时文件，返回文件路径（避免 base64 大对象 IPC）
const THUMB_DIR = path.join(app.getPath('temp'), 'photo-selector-thumbs')
if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true })

 ipcMain.handle('file:thumbnail', async (_event, filePath) => {
  try {
    console.log('[Main] thumbnail request', filePath)

    // 验证文件是否存在
    if (!fs.existsSync(filePath)) {
      console.error('[Main] file not found:', filePath)
      return { error: '文件不存在: ' + filePath }
    }

    // 使用完整路径的 base64 作为缓存键（不截断）
    const cacheKey = Buffer.from(filePath).toString('base64').replace(/[/+=]/g, '_')
    const cachedPath = path.join(THUMB_DIR, cacheKey + '.jpg')
    if (fs.existsSync(cachedPath)) {
      try {
        const stat = fs.statSync(cachedPath)
        if (stat.size > 100) {
          console.log('[Main] thumbnail cache hit', cachedPath, stat.size)
          return cachedPath
        }
      } catch {}
      try { fs.unlinkSync(cachedPath) } catch {}
    }

    const ext = path.extname(filePath).toLowerCase()
    const isWeb = WEB_EXTS.includes(ext)

    const RAW_EXTS = ['.cr2', '.nef', '.arw', '.dng', '.orf', '.rw2', '.raf', '.pef', '.srw', '.3fr', '.rwl', '.x3f', '.raw', '.cr3', '.mrf']
    const isRaw = RAW_EXTS.includes(ext)

    if (isWeb) {
      const stat = fs.statSync(filePath)
      console.log('[Main] web image ext', ext, 'size', stat.size)
      if (stat.size < 3 * 1024 * 1024 && ext === '.jpg') {
        fs.copyFileSync(filePath, cachedPath)
        return cachedPath
      }
    }

    // RAW 文件使用 ImageMagick 处理
    if (isRaw) {
      console.log('[Main] processing RAW through ImageMagick:', filePath)
      try {
        const { execSync } = require('child_process')
        const magickPath = 'magick'
        execSync(`"${magickPath}" convert -auto-orient -resize 400x300 "^" -gravity center -extent 400x300 -quality 75 "${filePath}" "${cachedPath}"`, { encoding: 'utf-8', timeout: 30000 })
        console.log('[Main] generated RAW thumbnail', cachedPath)
        return cachedPath
      } catch (magickErr) {
        console.error('[Main] ImageMagick failed:', magickErr.message)
        return { error: 'RAW 文件处理失败: ' + magickErr.message }
      }
    }

    // RAW / large / non-JPEG → process through Sharp
    console.log('[Main] processing through Sharp:', filePath)
    await sharp(filePath, { failOn: 'error' })
      .rotate()
      .resize(400, 300, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toFile(cachedPath)
    console.log('[Main] generated thumbnail', cachedPath)

    return cachedPath
  } catch (err) {
    console.error('[Main] thumbnail generation error:', filePath, err.message)
    return { error: err.message }
  }
})

// 读取缩略图文件并返回 base64（仅在前端需要显示时调用）
ipcMain.handle('file:thumbnailData', async (_event, thumbPath) => {
  try {
    const data = fs.readFileSync(thumbPath)
    console.log('[Main] thumbnailData length', data.length)
    return `data:image/jpeg;base64,${data.toString('base64')}`
  } catch {
    return null
  }
})

// ── Analysis IPC ─────────────────────────────────────────────────
ipcMain.handle('analysis:photo', async (_event, filePath) => {
  return await analyzePhoto(filePath)
})

ipcMain.handle('analysis:batch', async (event, { photos }) => {
  const { results, similarityGroups } = await analyzeBatch(photos, (progress) => {
    // 推送进度到渲染进程
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('analysis:progress', progress)
    }
  })
  return { results, similarityGroups }
})

// ── Export IPC ───────────────────────────────────────────────────
ipcMain.handle('export:copyFiles', async (_event, { files, destDir, naming, format }) => {
  let successCount = 0
  let failCount = 0
  const errors = []
  const overwritten = []

  for (let i = 0; i < files.length; i++) {
    try {
      const file = files[i]
      const srcExt = path.extname(file.path)
      const newExt = format === 'original' ? srcExt : `.${format}`
      let newName
      if (naming === 'original') {
        newName = file.name.replace(srcExt, newExt)
      } else if (naming === 'numbered') {
        newName = `photo_${String(i + 1).padStart(4, '0')}${newExt}`
      } else if (naming === 'rated') {
        newName = `${file.rating || 0}_${file.name.replace(srcExt, newExt)}`
      }
      const destPath = path.join(destDir, newName)
      
      // 检测文件是否已存在
      if (fs.existsSync(destPath)) {
        overwritten.push(newName)
      }
      
      await fs.promises.copyFile(file.path, destPath)
      successCount++
    } catch (err) {
      failCount++
      errors.push({ file: files[i].name, error: err.message })
    }
  }

  return { total: files.length, successCount, failCount, errors, overwritten }
})

ipcMain.handle('export:gradeFolders', async (_event, { files, destDir, grades, naming }) => {
  const GRADE_DIRS = { selected: '精选', alternative: '备选', reject: '不推荐' }
  let copied = 0
  let failed = 0
  const reportRows = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const grade = file.grade || 'reject'
    if (!grades.includes(grade)) continue

    try {
      const targetDir = path.join(destDir, GRADE_DIRS[grade] || '其他')
      fs.mkdirSync(targetDir, { recursive: true })

      const ext = path.extname(file.path)
      let newName
      if (naming === 'original') {
        newName = file.name
      } else if (naming === 'numbered') {
        newName = `${GRADE_DIRS[grade]}_${String(i + 1).padStart(4, '0')}${ext}`
      } else {
        newName = file.name
      }

      const destPath = path.join(targetDir, newName)
      await fs.promises.copyFile(file.path, destPath)
      copied++
      reportRows.push({ name: file.name, grade, totalScore: file.totalScore || 0, destPath })
    } catch (err) {
      failed++
    }
  }

  // CSV 报告
  const csvHeader = '文件名,分级,评分,路径'
  const csvLines = reportRows.map(r => `"${r.name}",${r.grade},${r.totalScore},"${r.destPath}"`)
  const csv = [csvHeader, ...csvLines].join('\n')
  const csvPath = path.join(destDir, '评分报告.csv')
  fs.writeFileSync(csvPath, '﻿' + csv, 'utf-8')

  return { copied, failed, csvPath }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectFiles: () => ipcRenderer.invoke('dialog:selectFiles'),
  selectExportDir: () => ipcRenderer.invoke('dialog:selectExportDir'),

  getThumbnail: (filePath) => ipcRenderer.invoke('file:thumbnail', filePath),
  getThumbnailData: (thumbPath) => ipcRenderer.invoke('file:thumbnailData', thumbPath),

  analyzePhoto: (filePath) => ipcRenderer.invoke('analysis:photo', filePath),
  analyzeBatch: (params) => ipcRenderer.invoke('analysis:batch', params),

  exportCopyFiles: (params) => ipcRenderer.invoke('export:copyFiles', params),
  exportGradeFolders: (params) => ipcRenderer.invoke('export:gradeFolders', params),

  // 分析进度监听
  onAnalysisProgress: (callback) => {
    const handler = (_event, progress) => callback(progress)
    ipcRenderer.on('analysis:progress', handler)
    // 返回 handler 引用以便后续精准移除
    return handler
  },
  removeAnalysisProgress: () => {
    ipcRenderer.removeAllListeners('analysis:progress')
  },
  removeAnalysisProgressListener: (handler) => {
    ipcRenderer.removeListener('analysis:progress', handler)
  },
})

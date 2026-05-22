import { useState, useRef } from 'react'
import { Modal, Button, Space, Typography, message, Tag } from 'antd'
import { FileImageOutlined, FolderOpenOutlined, UsbOutlined, CloudUploadOutlined } from '@ant-design/icons'
import type { PhotoInfo } from '../types'

const { Text } = Typography

interface PendingFile {
  path: string
  name: string
  size?: number
  mtime?: number
}

interface ImportDialogProps {
  onClose: () => void
  onImport: (files: PhotoInfo[]) => void
  importing: boolean
  setImporting: (v: boolean) => void
  existingPaths: Set<string>
}

const mockPhotos = [
  { path: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop', name: '风景照片1.jpg', size: 1234567, mtime: Date.now() },
  { path: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop', name: '风景照片2.jpg', size: 2345678, mtime: Date.now() - 1000 },
  { path: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop', name: '人物照片1.jpg', size: 3456789, mtime: Date.now() - 2000 },
  { path: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=400&h=300&fit=crop', name: '风景照片3.jpg', size: 4567890, mtime: Date.now() - 3000 },
  { path: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=300&fit=crop', name: '静物照片.jpg', size: 5678901, mtime: Date.now() - 4000 },
]

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

export default function ImportDialog({ onClose, onImport, importing, setImporting, existingPaths }: ImportDialogProps) {
  const [files, setFiles] = useState<PendingFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = (newFiles: PendingFile[]) => {
    const skipped: string[] = []
    const toAdd: PendingFile[] = []
    for (const f of newFiles) {
      if (existingPaths.has(f.path)) {
        skipped.push(f.name)
      } else {
        toAdd.push(f)
      }
    }
    if (skipped.length > 0) {
      message.warning(`已跳过 ${skipped.length} 张重复照片`)
    }
    setFiles(prev => {
      const current = new Set(prev.map(f => f.path))
      return [...prev, ...toAdd.filter(f => !current.has(f.path))]
    })
  }

  const handleBrowserSelectFiles = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    const newFiles: PendingFile[] = []
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      const base64Data = await fileToBase64(file)
      newFiles.push({ path: base64Data, name: file.name, size: file.size, mtime: file.lastModified })
    }
    addFiles(newFiles)
    e.target.value = ''
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleSelectFiles = async () => {
    if (isElectron) {
      try {
        const result = await window.electronAPI?.selectFiles()
        if (!result) return
        const paths = Array.isArray(result) ? result as string[] : (result as any).files?.map((f: any) => ({ path: f.path, name: f.name }))
        if (!paths || paths.length === 0) return
        if (typeof paths[0] === 'string') {
          addFiles((paths as string[]).map((p: string) => ({ path: p, name: p.split(/[/\\]/).pop() || p })))
        } else {
          addFiles(paths as PendingFile[])
        }
      } catch (err) {
        message.error('选择文件失败，请重试')
        console.error('Select files error:', err)
      }
    } else {
      handleBrowserSelectFiles()
    }
  }

  const handleSelectDir = async () => {
    if (isElectron) {
      try {
        const result = await window.electronAPI?.selectDirectory()
        if (result && result.files) {
          addFiles(result.files as PendingFile[])
        } else {
          message.warning('未选择文件夹')
        }
      } catch (err) {
        message.error('选择文件夹失败，请重试')
        console.error('Select directory error:', err)
      }
    } else {
      addFiles(mockPhotos)
    }
  }

  const handleRemoveFile = (path: string) => {
    setFiles(prev => prev.filter(f => f.path !== path))
  }

  const handleImport = async () => {
    if (files.length === 0) return
    setImporting(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      onImport(files as PhotoInfo[])
      message.success('导入成功')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal
      title="导入照片"
      open={true}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose} disabled={importing}>取消</Button>
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={handleImport} loading={importing} disabled={files.length === 0}>
            导入 {files.length > 0 && `(${files.length})`}
          </Button>
        </Space>
      }
      width={560}
    >
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileInputChange} />

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space style={{ width: '100%' }}>
          <Button icon={<FileImageOutlined />} onClick={handleSelectFiles} block size="large">
            选择文件
          </Button>
          <Button icon={<FolderOpenOutlined />} onClick={handleSelectDir} block size="large">
            {isElectron ? '选择文件夹' : '添加模拟照片'}
          </Button>
          <Button icon={<UsbOutlined />} disabled block size="large" title="即将支持">
            USB 导入
          </Button>
        </Space>

        {files.length > 0 && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              预览 <Tag color="blue">{files.length} 张</Tag>
            </Text>
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {files.map(f => (
                <Tag
                  key={f.path}
                  closable
                  onClose={() => handleRemoveFile(f.path)}
                  style={{ margin: 0, padding: '4px 8px' }}
                >
                  {f.name}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </Space>
    </Modal>
  )
}

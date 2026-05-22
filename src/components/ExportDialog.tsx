import { useState, useMemo, useEffect } from 'react'
import { Modal, Select, Button, Space, Typography, message, Checkbox, Input } from 'antd'
import { FolderOpenOutlined, ExportOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { GRADE_LABELS, GRADE_COLORS } from '../scoring'
import type { PhotoInfo, GradeKey, ExportResult } from '../types'

const { Text } = Typography

interface ExportDialogProps {
  photos: PhotoInfo[]
  onClose: () => void
}

export default function ExportDialog({ photos, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState('original')
  const [naming, setNaming] = useState('original')
  const [exportGrades, setExportGrades] = useState<GradeKey[]>(['selected', 'alternative'])
  const [exportDir, setExportDir] = useState('')
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [useGradeFolders, setUseGradeFolders] = useState(true)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, exporting])

  const gradeKeys = Object.keys(GRADE_LABELS) as GradeKey[]

  const exportablePhotos = useMemo(() => {
    return photos.filter(p => p.grade && exportGrades.includes(p.grade))
  }, [photos, exportGrades])

  const toggleGrade = (key: GradeKey) => {
    setExportGrades(prev =>
      prev.includes(key) ? prev.filter(g => g !== key) : [...prev, key]
    )
  }

  const handleSelectDir = async () => {
    if (window.electronAPI) {
      try {
        const dir = await window.electronAPI.selectExportDir()
        if (dir) setExportDir(dir)
        else message.warning('未选择导出目录')
      } catch (err) {
        message.error('选择目录失败，请重试')
        console.error('Select export dir error:', err)
      }
    } else {
      const dir = prompt('请输入导出目录路径（浏览器模式限制，仅作演示）：')
      if (dir) setExportDir(dir)
    }
  }

  const handleExport = async () => {
    if (exportablePhotos.length === 0 || !exportDir) return
    setExporting(true)
    setResult(null)

    try {
      let res: ExportResult

      if (!window.electronAPI) {
        await new Promise(resolve => setTimeout(resolve, 800))
        setResult({ total: exportablePhotos.length, copied: exportablePhotos.length, failCount: 0 })
        message.success(`导出完成，成功 ${exportablePhotos.length} 张`)
        return
      }

      const params = {
        files: exportablePhotos.map(p => ({
          path: p.path,
          name: p.name,
          grade: p.grade!,
          totalScore: p.totalScore || 0,
        })),
        destDir: exportDir,
        grades: exportGrades,
        naming,
      }

      if (useGradeFolders) {
        res = await window.electronAPI.exportGradeFolders(params) as ExportResult
      } else {
        res = await window.electronAPI.exportCopyFiles({
          ...params,
          files: exportablePhotos.map(p => ({ path: p.path, name: p.name, rating: p.totalScore || 0 })),
          format,
        }) as ExportResult
      }
      setResult(res)
      if (res.failed === 0 || res.failCount === 0) {
        message.success(`导出完成，成功 ${res.copied || res.successCount || 0} 张`)
      }
    } catch {
      setResult({ total: exportablePhotos.length, copied: 0, failed: exportablePhotos.length })
      message.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal
      title="导出照片"
      open={true}
      onCancel={() => !exporting && onClose()}
      maskClosable={!exporting}
      footer={
        <Space>
          <Text type="secondary" style={{ fontSize: 11, flex: 1 }}>
            将导出 {exportablePhotos.length} 张照片
          </Text>
          <Button onClick={onClose} disabled={exporting}>取消</Button>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            disabled={exportablePhotos.length === 0 || !exportDir || exporting}
            loading={exporting}
            onClick={handleExport}
          >
            开始导出
          </Button>
        </Space>
      }
      width={560}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>选择分级</Text>
          <Space wrap>
            {gradeKeys.map(key => (
              <Checkbox
                key={key}
                checked={exportGrades.includes(key)}
                onChange={() => toggleGrade(key)}
              >
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: GRADE_COLORS[key],
                  display: 'inline-block',
                  marginRight: 4,
                }} />
                {GRADE_LABELS[key]}
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                  ({photos.filter(p => p.grade === key).length})
                </Text>
              </Checkbox>
            ))}
          </Space>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text style={{ width: 80 }}>导出模式</Text>
          <Select
            style={{ flex: 1 }}
            value={useGradeFolders ? 'folders' : 'flat'}
            onChange={v => setUseGradeFolders(v === 'folders')}
            options={[
              { value: 'folders', label: '按等级分文件夹（精选/备选/不推荐）' },
              { value: 'flat', label: '统一导出到根目录' },
            ]}
          />
        </div>

        {!useGradeFolders && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text style={{ width: 80 }}>导出格式</Text>
            <Select
              style={{ flex: 1 }}
              value={format}
              onChange={setFormat}
              options={[
                { value: 'original', label: '原始格式' },
                { value: 'jpg', label: 'JPG' },
                { value: 'png', label: 'PNG' },
                { value: 'webp', label: 'WebP' },
              ]}
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text style={{ width: 80 }}>命名规则</Text>
          <Select
            style={{ flex: 1 }}
            value={naming}
            onChange={setNaming}
            options={[
              { value: 'original', label: '原始文件名' },
              { value: 'numbered', label: '序号 (photo_0001)' },
              { value: 'rated', label: '分级+文件名' },
            ]}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text style={{ width: 80 }}>保存路径</Text>
          <Input
            value={exportDir}
            readOnly
            placeholder="点击右侧按钮选择目录"
            style={{ flex: 1 }}
            suffix={
              <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSelectDir}>
                选择
              </Button>
            }
          />
        </div>

        {result && (
          <div style={{
            textAlign: 'center',
            padding: 12,
            borderRadius: 6,
            background: (result.failed === 0 || result.failCount === 0) ? 'rgba(82,196,26,0.1)' : 'rgba(255,77,79,0.1)',
          }}>
            {(result.failed === 0 || result.failCount === 0) ? (
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16, marginRight: 8 }} />
            ) : (
              <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16, marginRight: 8 }} />
            )}
            <Text type={(result.failed === 0 || result.failCount === 0) ? 'success' : 'danger'}>
              导出完成 ✓ 成功 {result.copied || result.successCount || 0} 张
              {(result.failed || result.failCount) ? `，失败 ${result.failed || result.failCount} 张` : ''}
            </Text>
          </div>
        )}
      </Space>
    </Modal>
  )
}

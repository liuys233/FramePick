import { Button, Divider, Space, Typography } from 'antd'
import { ImportOutlined, SettingOutlined, ExportOutlined, ThunderboltOutlined } from '@ant-design/icons'

const { Text } = Typography

interface TopNavProps {
  stats: { total: number; selected: number; alternative: number; reject: number; ungraded: number }
  activeScene: string | null
  importing: boolean
  onImportClick: () => void
  onRulesClick: () => void
  onExportClick: () => void
  onGradeAll: () => void
  gradeDisabled: boolean
  exportDisabled: boolean
}

export default function TopNav({
  stats, activeScene, importing,
  onImportClick, onRulesClick, onExportClick,
  onGradeAll, gradeDisabled, exportDisabled,
}: TopNavProps) {
  const exportCount = stats.selected + stats.alternative

  return (
    <header className="topnav">
      <Text strong style={{ color: '#fff', fontSize: 15, marginRight: 12 }}>摄影选片助手</Text>
      <Divider type="vertical" style={{ height: 24, margin: '0 8px' }} />

      <Button
        type="primary"
        icon={<ImportOutlined />}
        onClick={onImportClick}
        disabled={importing}
        size="small"
      >
        导入照片
      </Button>

      <Divider type="vertical" style={{ height: 24, margin: '0 8px' }} />

      <Button
        icon={<SettingOutlined />}
        onClick={onRulesClick}
        size="small"
        title="自定义分级规则"
      >
        自定义规则
      </Button>

      <Divider type="vertical" style={{ height: 24, margin: '0 8px' }} />

      <Button
        icon={<ThunderboltOutlined />}
        onClick={onGradeAll}
        disabled={gradeDisabled}
        size="small"
      >
        执行分级
      </Button>

      <div style={{ flex: 1 }} />

      <Space size="middle">
        {activeScene && <Text type="secondary" style={{ fontSize: 11 }}>{activeScene}</Text>}
        <Text type="secondary" style={{ fontSize: 11 }}>{stats.total} 张</Text>
      </Space>

      <Divider type="vertical" style={{ height: 24, margin: '0 8px' }} />

      <Button
        type="primary"
        icon={<ExportOutlined />}
        onClick={onExportClick}
        disabled={exportDisabled || exportCount === 0}
        size="small"
      >
        导出{exportCount > 0 ? ` (${exportCount})` : ''}
      </Button>
    </header>
  )
}

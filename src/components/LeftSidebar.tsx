import { Menu, Badge, Typography, Divider } from 'antd'
import {
  CheckOutlined,
  FilterOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import { SCENES, GRADE_LABELS, GRADE_COLORS } from '../scoring'
import type { SceneId, GradeFilter } from '../types'

const { Text } = Typography

interface LeftSidebarProps {
  activeScene: SceneId | null
  onSceneChange: (scene: SceneId) => void
  filterGrade: GradeFilter
  onFilterGradeChange: (grade: GradeFilter) => void
  stats: { total: number; selected: number; alternative: number; reject: number; ungraded: number }
}

export default function LeftSidebar({
  activeScene, onSceneChange,
  filterGrade, onFilterGradeChange,
  stats,
}: LeftSidebarProps) {

  const sceneItems = (Object.entries(SCENES) as [string, { id: string; icon: string; label: string }][]).map(([id, scene]) => ({
    key: id,
    icon: <span style={{ fontSize: 16 }}>{scene.icon}</span>,
    label: (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{scene.label}</span>
        {activeScene === id && <CheckOutlined style={{ color: '#4096ff', fontSize: 12 }} />}
      </div>
    ),
  }))

  return (
    <aside className="left-sidebar">
      <Text strong style={{ fontSize: 11, color: '#888', padding: '8px 12px 6px', display: 'block' }}>
        场景选择
      </Text>
      <Menu
        mode="inline"
        selectedKeys={activeScene ? [activeScene] : []}
        items={sceneItems}
        onClick={({ key }) => onSceneChange(key as SceneId)}
        style={{ borderRight: 'none', background: 'transparent' }}
      />

      <Divider style={{ margin: '8px 12px', borderColor: '#3a3a5c' }} />

      <Text strong style={{ fontSize: 11, color: '#888', padding: '0 12px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <FilterOutlined style={{ fontSize: 10 }} /> 分级筛选
      </Text>

      <div style={{ padding: '0 8px' }}>
        <div
          className={`grade-filter-item ${filterGrade === null ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4 }}
          onClick={() => onFilterGradeChange(null)}
        >
          <span className="gf-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#888', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12 }}>全部</span>
          <span style={{ color: '#888', fontSize: 11 }}>{stats.total}</span>
        </div>

        {(Object.entries(GRADE_LABELS) as [string, string][]).map(([key, label]) => {
          const count = stats[key as keyof typeof stats] || 0
          return (
            <div
              key={key}
              className={`grade-filter-item ${filterGrade === key ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4 }}
              onClick={() => onFilterGradeChange(key as GradeFilter)}
            >
              <span className="gf-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: GRADE_COLORS[key], flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12 }}>{label}</span>
              <Badge count={count} style={{ backgroundColor: count > 0 ? GRADE_COLORS[key] : 'transparent', fontSize: 10 }} />
            </div>
          )
        })}

        {stats.ungraded > 0 && (
          <div
            className={`grade-filter-item ${filterGrade === 'ungraded' ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', marginTop: 4 }}
            onClick={() => onFilterGradeChange('ungraded')}
          >
            <span className="gf-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#555', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12 }}>未分级</span>
            <span style={{ color: '#888', fontSize: 11 }}>{stats.ungraded}</span>
          </div>
        )}
      </div>

      <Divider style={{ margin: '12px', borderColor: '#3a3a5c' }} />

      <Text strong style={{ fontSize: 11, color: '#888', padding: '0 12px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <BulbOutlined style={{ fontSize: 10 }} /> 快捷键
      </Text>
      <div style={{ padding: '0 12px', fontSize: 11, color: '#888', lineHeight: 2 }}>
        <kbd>←↑↓→</kbd> 导航<br />
        <kbd>G</kbd> 执行分级<br />
        <kbd>E</kbd> 导出<br />
        <kbd>1/2/3</kbd> 评级
      </div>
    </aside>
  )
}

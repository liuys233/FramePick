import { Typography } from 'antd'
import { GRADE_LABELS } from '../scoring'
import type { PhotoInfo, GradeKey } from '../types'

const { Text } = Typography

interface StatusBarProps {
  stats: { total: number; selected: number; alternative: number; reject: number; ungraded: number }
  displayCount: number
  showEmpty: boolean
  focusedIndex: number
  currentPhoto: PhotoInfo | null
  activeScene: string | null
  getDisplayGrade: (photo: PhotoInfo) => GradeKey | null
}

export default function StatusBar({ stats, displayCount, showEmpty, focusedIndex, currentPhoto, activeScene, getDisplayGrade }: StatusBarProps) {
  const grade = currentPhoto ? getDisplayGrade(currentPhoto) : null

  return (
    <footer className="status-bar">
      <Text style={{ fontSize: 11 }}>
        共 {stats.total} 张
        {stats.selected > 0 && <Text style={{ color: '#52c41a', marginLeft: 8 }}>精选 {stats.selected}</Text>}
        {stats.alternative > 0 && <Text style={{ color: '#faad14', marginLeft: 8 }}>备选 {stats.alternative}</Text>}
        {stats.reject > 0 && <Text style={{ color: '#ff4d4f', marginLeft: 8 }}>不推荐 {stats.reject}</Text>}
        {stats.ungraded > 0 && <Text type="secondary" style={{ marginLeft: 8 }}>未分级 {stats.ungraded}</Text>}
      </Text>
      <Text type="secondary" style={{ fontSize: 11 }}>
        <kbd>←↑↓→</kbd> 导航 &nbsp;
        <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 评级 &nbsp;
        <kbd>G</kbd> 分级 &nbsp;
        <kbd>E</kbd> 导出
      </Text>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {currentPhoto
          ? `${focusedIndex + 1} / ${displayCount} · ${currentPhoto.name}${currentPhoto.totalScore !== undefined ? ` · ${currentPhoto.totalScore}分` : ''}${grade ? ` · ${GRADE_LABELS[grade]}` : ''}`
          : showEmpty ? '请导入照片' : activeScene ? '选择照片查看详情' : '请选择场景'}
      </Text>
    </footer>
  )
}

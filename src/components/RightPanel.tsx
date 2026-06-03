import { Button, Progress, Typography, Divider, Empty } from 'antd'
import { EyeOutlined, ArrowLeftOutlined, ArrowRightOutlined, ZoomInOutlined } from '@ant-design/icons'
import { GRADE_LABELS, GRADE_COLORS } from '../scoring'
import { useThumbnails } from '../hooks/useThumbnails'
import type { PhotoInfo, GradeKey } from '../types'

const { Text } = Typography

interface RightPanelProps {
  photo: PhotoInfo | null
  allPhotos: PhotoInfo[]
  index: number
  onNavigate: (i: number) => void
  getDisplayGrade: (photo: PhotoInfo) => GradeKey | null
  onManualGrade: (photoId: string, grade: GradeKey) => void
  onPreview: () => void
}

const GRADE_OPTIONS: { key: GradeKey; label: string; color: string; shortcut: string }[] = [
  { key: 'selected', label: '精选', color: '#52c41a', shortcut: '1' },
  { key: 'alternative', label: '备选', color: '#faad14', shortcut: '2' },
  { key: 'reject', label: '不推荐', color: '#ff4d4f', shortcut: '3' },
]

function getEyeSideLabel(status?: 'open' | 'closed' | 'unknown') {
  if (status === 'open') return '睁开'
  if (status === 'closed') return '闭合'
  return '未知'
}

export default function RightPanel({
  photo, allPhotos, index, onNavigate, getDisplayGrade, onManualGrade, onPreview,
}: RightPanelProps) {
  const thumbnails = useThumbnails(photo ? [photo] : [], { enabled: !!photo })

  if (!photo) {
    return (
      <aside className="right-panel">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary">点击照片查看详情</Text>}
        />
      </aside>
    )
  }

  const grade = getDisplayGrade(photo)
  const scores = photo.detailScores
  const totalScore = photo.totalScore ?? 0
  const thumb = thumbnails[photo.id] || photo.thumbnail
  const supportsEyeCheck = photo.scene === 'portrait' || photo.scene === 'street'
  const eyeDetection = supportsEyeCheck ? photo.analysis?.eyeDetection : undefined
  const eyeStatusMeta = eyeDetection
    ? eyeDetection.issueLevel === 'critical'
      ? { label: eyeDetection.summary || '存在眼部风险', color: '#ff4d4f' }
      : eyeDetection.issueLevel === 'warning'
        ? { label: eyeDetection.summary || '建议复核', color: '#faad14' }
        : { label: eyeDetection.summary || '眼部状态正常', color: '#52c41a' }
    : null

  const barMeta = [
    { key: 'exposure' as const, label: '曝光', color: '#4096ff' },
    { key: 'sharpness' as const, label: '清晰度', color: '#52c41a' },
    { key: 'color' as const, label: '色彩', color: '#faad14' },
    { key: 'eye' as const, label: '人像', color: '#ff4d4f' },
    { key: 'uniqueness' as const, label: '独特性', color: '#ab47bc' },
  ]

  return (
    <aside className="right-panel">
      <div className="detail-header" onClick={onPreview} style={{ cursor: 'pointer' }}>
        <div className="detail-thumb">
          {thumb ? (
            <img src={thumb} alt={photo.name} />
          ) : (
            <div className="detail-thumb-placeholder">
              <EyeOutlined style={{ fontSize: 24, color: '#888' }} />
            </div>
          )}
        </div>
        <div className="detail-file-info">
          <Text strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff' }} title={photo.name}>
            {photo.name}
          </Text>
          <div style={{ marginTop: 4 }}>
            {photo.size > 0 && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{(photo.size / 1024 / 1024).toFixed(1)} MB</Text>}
            {photo.mtime > 0 && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{new Date(photo.mtime).toLocaleString()}</Text>}
          </div>
        </div>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 8 }}>等级评定</Text>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {GRADE_OPTIONS.map(opt => (
            <Button
              key={opt.key}
              size="small"
              style={{
                flex: 1,
                borderColor: grade === opt.key ? opt.color : undefined,
                background: grade === opt.key ? `${opt.color}20` : undefined,
                color: grade === opt.key ? opt.color : undefined,
              }}
              onClick={(e) => { e.stopPropagation(); onManualGrade(photo.id, opt.key) }}
              title={`快捷键: ${opt.shortcut}`}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, display: 'inline-block', marginRight: 4 }} />
              {opt.label}
            </Button>
          ))}
        </div>
        <Button
          size="small"
          icon={<ZoomInOutlined />}
          onClick={onPreview}
          block
        >
          放大查看
        </Button>
      </div>

      {grade && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            textAlign: 'center',
            padding: 12,
            borderRadius: 6,
            background: `${GRADE_COLORS[grade]}15`,
            border: `1px solid ${GRADE_COLORS[grade]}40`,
          }}>
            <Text strong style={{ fontSize: 14, color: GRADE_COLORS[grade] }}>
              {GRADE_LABELS[grade] || grade}
            </Text>
            <Progress
              percent={totalScore}
              showInfo={false}
              strokeColor={GRADE_COLORS[grade]}
              trailColor="rgba(255,255,255,0.08)"
              style={{ marginTop: 8 }}
              size="small"
            />
          </div>
        </div>
      )}

      {scores && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 8 }}>评分详情</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {barMeta.map(({ key, label, color }) => {
              const val = scores[key] || 0
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <Text type="secondary" style={{ width: 40, fontSize: 11 }}>{label}</Text>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${val}%`, background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
                  </div>
                  <Text style={{ width: 24, textAlign: 'right', fontSize: 11, fontWeight: 600 }}>{val}</Text>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {eyeDetection && eyeStatusMeta && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 8 }}>人像眼部状态检查</Text>
          <div style={{ padding: 10, borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>检查结论</Text>
              <Text strong style={{ fontSize: 12, color: eyeStatusMeta.color }}>{eyeStatusMeta.label}</Text>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>主脸数量</Text>
                <Text style={{ fontSize: 12 }}>{eyeDetection.hasFace ? `${eyeDetection.faceCount} 张` : '未检测到'}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>置信度</Text>
                <Text style={{ fontSize: 12 }}>{Math.round(eyeDetection.confidence * 100)}%</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>左眼</Text>
                <Text style={{ fontSize: 12 }}>{getEyeSideLabel(eyeDetection.leftEye?.status)}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>右眼</Text>
                <Text style={{ fontSize: 12 }}>{getEyeSideLabel(eyeDetection.rightEye?.status)}</Text>
              </div>
              {eyeDetection.detector && (
                <div>
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>检测器</Text>
                  <Text style={{ fontSize: 12 }}>MediaPipe</Text>
                </div>
              )}
            </div>
            {eyeDetection.suggestion && (
              <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
                {eyeDetection.suggestion}
              </Text>
            )}
          </div>
        </div>
      )}

      {supportsEyeCheck && !eyeDetection && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 8 }}>人像眼部状态检查</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>尚未执行眼部状态检查</Text>
        </div>
      )}

      {!scores && !grade && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 8 }}>评分详情</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>请在左侧选择场景后执行分级，或手动标记等级</Text>
        </div>
      )}

      {allPhotos.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 8 }}>导航</Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              size="small"
              icon={<ArrowLeftOutlined />}
              disabled={index <= 0}
              onClick={() => onNavigate(Math.max(0, index - 1))}
            >
              上一张
            </Button>
            <Text type="secondary" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
              {index + 1} / {allPhotos.length}
            </Text>
            <Button
              size="small"
              disabled={index >= allPhotos.length - 1}
              onClick={() => onNavigate(Math.min(allPhotos.length - 1, index + 1))}
            >
              下一张
              <ArrowRightOutlined />
            </Button>
          </div>
        </div>
      )}

      <Divider style={{ margin: '12px 0' }} />

      <div style={{ fontSize: 10, color: '#888', lineHeight: 2 }}>
        <kbd>1</kbd> 精选 &nbsp;
        <kbd>2</kbd> 备选 &nbsp;
        <kbd>3</kbd> 不推荐
      </div>
      <div style={{ fontSize: 10, color: '#888', lineHeight: 2, marginTop: 2 }}>
        <kbd>←</kbd><kbd>→</kbd> 切换 &nbsp;
        <kbd>G</kbd> 分级
      </div>
    </aside>
  )
}

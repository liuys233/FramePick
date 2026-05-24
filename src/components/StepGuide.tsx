import ImportDialog from './ImportDialog'
import RulesDialog from './RulesDialog'
import { useWizard } from '../contexts/WizardContext'
import { useThumbnails } from '../hooks/useThumbnails'
import { Button, Progress, Typography, Space, Result, Card } from 'antd'
import { CameraOutlined, AimOutlined, ThunderboltOutlined, CloudUploadOutlined, SettingOutlined } from '@ant-design/icons'
import type { SceneId, PhotoInfo } from '../types'

const { Text, Title } = Typography

const STEPS = [
  { key: 'import', title: '导入照片', desc: '选择图片或整个文件夹' },
  { key: 'scene', title: '选择场景', desc: '选择拍摄场景以调整检测侧重点' },
  { key: 'grade', title: '智能分级', desc: '系统将自动分析并评分每张照片' },
  { key: 'complete', title: '完成', desc: '查看分级结果并导出照片' },
] as const

const SCENES = [
  { id: 'street' as SceneId, label: '街拍', icon: '🏙️', desc: '抓拍、纪实、人文' },
  { id: 'portrait' as SceneId, label: '人像', icon: '👤', desc: '人物特写、表情' },
  { id: 'landscape' as SceneId, label: '风光', icon: '🌄', desc: '自然、建筑、大景' },
  { id: 'stillLife' as SceneId, label: '静物', icon: '🏺', desc: '产品、细节、构图' },
]

function GradePreviewGrid({ photos, analyzedCount }: { photos: PhotoInfo[]; analyzedCount: number }) {
  const displayedPhotos = photos.slice(0, 8)
  const thumbnails = useThumbnails(displayedPhotos, {
    onError: (photo, error) => {
      console.error('Thumbnail load failed:', photo.name, error)
    }
  })

  return (
    <div className="grade-preview-grid">
      {displayedPhotos.map((photo, index) => {
        const thumb = thumbnails[photo.id]
        const isAnalyzed = index < analyzedCount
        const hasThumb = typeof thumb === 'string' && thumb.length > 0

        return (
          <div
            key={photo.id}
            className={`grade-preview-item ${isAnalyzed ? 'analyzed' : ''}`}
            style={{
              position: 'relative',
              aspectRatio: '4/3',
              borderRadius: 6,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.05)',
            }}
          >
            {hasThumb ? (
              <img src={thumb} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CameraOutlined style={{ fontSize: 24, opacity: 0.3 }} />
              </div>
            )}
            <div className={`grade-preview-status ${isAnalyzed ? 'done' : ''}`}>
              {isAnalyzed ? '✓' : '⋯'}
            </div>
            <div className="grade-preview-name" title={photo.name}>
              {photo.name}
            </div>
          </div>
        )
      })}
      {photos.length > 8 && (
        <div
          className="grade-preview-more"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(64,150,255,0.1)',
            borderRadius: 6,
            fontSize: 13,
            color: '#4096ff',
          }}
        >
          还有 {photos.length - 8} 张照片...
        </div>
      )}
    </div>
  )
}

export default function StepGuide() {
  const w = useWizard()
  const currentIdx = STEPS.findIndex(s => s.key === w.step)
  const progressPct = w.analyzeProgress.total > 0
    ? Math.round((w.analyzeProgress.current / w.analyzeProgress.total) * 100)
    : 0

  return (
    <div className="step-guide-root">
      <Card className="step-guide-card">
        <Title level={4} style={{ textAlign: 'center', margin: 0 }}>帧选-一个面向摄影师的智能挑图工具</Title>

        <div className="step-progress">
          {STEPS.map((s, i) => {
            const isDone = i < currentIdx
            const isActive = i === currentIdx
            const canClick = isDone || (s.key === 'import' && w.hasPhotos)

            return (
              <div
                key={s.key}
                className={`step-progress-item ${isDone ? 'done' : ''} ${isActive ? 'active' : ''} ${canClick ? 'clickable' : ''}`}
                onClick={canClick ? () => w.onStepChange(s.key as typeof w.step) : undefined}
                title={canClick ? `回到「${s.title}」` : undefined}
              >
                <div className="step-circle">{isDone ? '✓' : i + 1}</div>
                <div className="step-label">{s.title}</div>
              </div>
            )
          })}
        </div>

        <div className="step-content">
          {w.step === 'import' && (
            <div className="step-body">
              <CameraOutlined className="step-icon" />
              <Title level={3}>开始导入照片</Title>
              <Text type="secondary">
                支持 JPG，PNG，TIFF（后续将支持 RAW 文件）
              </Text>
              <Button type="primary" size="large" icon={<CloudUploadOutlined />} onClick={w.onStartImport}>
                导入照片
              </Button>
              {w.hasPhotos && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  已导入 {w.stats.total} 张照片
                </Text>
              )}
            </div>
          )}

          {w.step === 'scene' && (
            <div className="step-body">
              <AimOutlined className="step-icon" />
              <Title level={3}>选择拍摄场景</Title>
              <Text type="secondary">
                不同场景有不同的检测侧重点，选择后系统将自动优化分级参数
              </Text>
              <div className="step-scenes">
                {SCENES.map(scene => (
                  <Card
                    key={scene.id}
                    hoverable
                    size="small"
                    className="step-scene-card"
                    onClick={() => w.onSelectScene(scene.id)}
                  >
                    <span className="step-scene-icon">{scene.icon}</span>
                    <Text strong className="step-scene-label">{scene.label}</Text>
                    <Text type="secondary" className="step-scene-desc">{scene.desc}</Text>
                  </Card>
                ))}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                已导入 {w.stats.total} 张照片
              </Text>
            </div>
          )}

          {w.step === 'grade' && (
            <div className="step-body">
              <ThunderboltOutlined className="step-icon" />
              <Title level={3}>执行智能分级</Title>

              {!w.analyzing ? (
                <>
                  <Text type="secondary">
                    系统将从曝光、清晰度、色彩、人眼检测、相似度等多维度分析 {w.stats.total} 张照片
                  </Text>
                  <Space direction="vertical" style={{ width: '100%' }} align="center">
                    <Button type="primary" size="large" icon={<ThunderboltOutlined />} onClick={w.onStartGrade}>
                      开始分级
                    </Button>
                    <Button size="small" icon={<SettingOutlined />} onClick={w.onOpenRules}>
                      自定义规则
                    </Button>
                    <Text type="secondary" className="step-hint">
                      你也可以先调整检测权重和分级区间
                    </Text>
                  </Space>
                </>
              ) : (
                <>
                  <div className="analyze-progress">
                    <Progress
                      percent={progressPct}
                      strokeColor={{ '0%': '#4096ff', '100%': '#7c4dff' }}
                      trailColor="rgba(255,255,255,0.08)"
                    />
                    <Text style={{ fontSize: 13, fontWeight: 500, marginTop: 8 }}>
                      正在分析 {w.analyzeProgress.current} / {w.analyzeProgress.total} 张 ({progressPct}%)
                    </Text>
                  </div>
                  <GradePreviewGrid photos={w.photos} analyzedCount={w.analyzeProgress.current} />
                </>
              )}
            </div>
          )}

          {w.step === 'complete' && (
            <div className="step-body">
              <Result
                status="success"
                title="分级完成"
                subTitle="照片已按场景智能分级，你可以筛选查看或导出结果"
                extra={
                  <Button type="primary" size="large" onClick={w.onEnterMainView}>
                    进入主界面
                  </Button>
                }
              >
                <div className="step-complete-info">
                  <span>精选 <strong style={{ color: '#52c41a' }}>{w.stats.selected}</strong></span>
                  <span>备选 <strong style={{ color: '#faad14' }}>{w.stats.alternative}</strong></span>
                  <span>不推荐 <strong style={{ color: '#ff4d4f' }}>{w.stats.reject}</strong></span>
                </div>
              </Result>
              <Text type="secondary" style={{ fontSize: 11 }}>
                之后可随时回到顶部导航栏操作
              </Text>
            </div>
          )}
        </div>

        <div className="step-footer">
          步骤 {currentIdx + 1} / {STEPS.length}
        </div>
      </Card>

      {w.showImportDialog && (
        <ImportDialog
          onClose={w.onCloseImport}
          onImport={w.onImport}
          importing={w.importing}
          setImporting={w.setImporting}
          existingPaths={w.existingPaths}
        />
      )}

      {w.showRulesDialog && (
        <RulesDialog
          onClose={w.onCloseRules}
          currentRules={w.customRules}
          onSave={w.onSaveRules}
        />
      )}
    </div>
  )
}

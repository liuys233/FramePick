import { useRef, memo, useMemo } from 'react'
import { Empty, Spin } from 'antd'
import { CameraOutlined, SearchOutlined, AimOutlined } from '@ant-design/icons'
import { GRADE_LABELS } from '../scoring'
import { useThumbnails } from '../hooks/useThumbnails'
import type { PhotoInfo, GradeKey } from '../types'

interface MainContentProps {
  photos: PhotoInfo[]
  focusedIndex: number
  onFocusChange: (index: number) => void
  showEmpty: boolean
  activeScene: string | null
  getDisplayGrade: (photo: PhotoInfo) => GradeKey | null
}

export default function MainContent({
  photos, focusedIndex, onFocusChange, showEmpty, activeScene, getDisplayGrade,
}: MainContentProps) {
  if (showEmpty) {
    return (
      <div className="main-content">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <CameraOutlined style={{ fontSize: 48, opacity: 0.5, color: '#888' }} />
              <h2 style={{ fontSize: 18, color: '#e0e0e0', margin: '8px 0 4px' }}>导入照片开始智能选片</h2>
              <p style={{ fontSize: 13, color: '#888' }}>点击顶部「导入照片」按钮，支持 JPG / RAW 等格式</p>
            </div>
          }
        />
      </div>
    )
  }

  if (!activeScene) {
    return (
      <div className="main-content">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <AimOutlined style={{ fontSize: 48, opacity: 0.5, color: '#888' }} />
              <h2 style={{ fontSize: 18, color: '#e0e0e0', margin: '8px 0 4px' }}>请选择拍摄场景</h2>
              <p style={{ fontSize: 13, color: '#888' }}>在左侧选择场景后，系统将自动进行智能分级</p>
            </div>
          }
        />
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="main-content">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <SearchOutlined style={{ fontSize: 48, opacity: 0.5, color: '#888' }} />
              <h2 style={{ fontSize: 18, color: '#e0e0e0', margin: '8px 0 4px' }}>当前筛选条件下无照片</h2>
              <p style={{ fontSize: 13, color: '#888' }}>尝试调整分级筛选条件</p>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="main-content">
      <PhotoGrid
        photos={photos}
        focusedIndex={focusedIndex}
        onFocusChange={onFocusChange}
        getDisplayGrade={getDisplayGrade}
      />
    </div>
  )
}

// Memoized PhotoCard - 避免单个缩略图加载时全量重渲染
const PhotoCard = memo(function PhotoCard({ photo, index, isFocused, grade, thumb, onSelect }: {
  photo: PhotoInfo
  index: number
  isFocused: boolean
  grade: GradeKey | null
  thumb: string | undefined
  onSelect: () => void
}) {
  const hasThumb = typeof thumb === 'string' && thumb.length > 0

  return (
    <div
      className={'photo-card' + (isFocused ? ' focused' : '') + (grade ? ' grade-' + grade : '')}
      data-index={index}
      onClick={onSelect}
      onDoubleClick={e => e.stopPropagation()}
    >
      <div className="photo-img-wrap">
        {hasThumb ? (
          <img
            src={thumb}
            alt={photo.name}
            loading="lazy"
            draggable={false}
            className="photo-thumb"
            onLoad={e => e.currentTarget.classList.add('loaded')}
          />
        ) : (
          <div className="photo-placeholder">
            <Spin size="small" />
          </div>
        )}
      </div>
      {grade && (
        <div className={'photo-grade-badge ' + grade}>
          {GRADE_LABELS[grade] || grade}
        </div>
      )}
      {photo.totalScore !== undefined && (
        <div className="photo-score">{photo.totalScore}</div>
      )}
      <div className="photo-info">
        <span className="photo-name" title={photo.name}>{photo.name}</span>
      </div>
    </div>
  )
})

function PhotoGrid({ photos, focusedIndex, onFocusChange, getDisplayGrade }: {
  photos: PhotoInfo[]
  focusedIndex: number
  onFocusChange: (i: number) => void
  getDisplayGrade: (photo: PhotoInfo) => GradeKey | null
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const thumbnails = useThumbnails(photos)

  // 避免每次 thumbnails 更新时重建所有子元素
  const cardItems = useMemo(() => photos.map((photo, i) => ({
    photo,
    index: i,
    isFocused: i === focusedIndex,
    grade: getDisplayGrade(photo),
    thumb: thumbnails[photo.id],
  })), [photos, focusedIndex, getDisplayGrade, thumbnails])

  return (
    <div className="photo-grid" ref={gridRef}>
      {cardItems.map(({ photo, index, isFocused, grade, thumb }) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          index={index}
          isFocused={isFocused}
          grade={grade}
          thumb={thumb}
          onSelect={() => onFocusChange(index)}
        />
      ))}
    </div>
  )
}

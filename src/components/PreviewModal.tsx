import { useState, useEffect } from 'react'
import { GRADE_LABELS } from '../scoring'
import type { PhotoInfo, GradeKey } from '../types'

interface PreviewModalProps {
  photo: PhotoInfo
  getDisplayGrade: (photo: PhotoInfo) => GradeKey | null
  onClose: () => void
}

export default function PreviewModal({ photo, getDisplayGrade, onClose }: PreviewModalProps) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  useEffect(() => {
    const loadPreview = async () => {
      const electron = typeof window !== 'undefined' && !!window.electronAPI
      if (electron && !photo.thumbnail?.startsWith('data:')) {
        try {
          const api = window.electronAPI
          const thumbPath = await api.getThumbnail(photo.path)
          if (typeof thumbPath === 'string') {
            const data = await api.getThumbnailData(thumbPath)
            if (data) {
              setPreviewSrc(data)
              return
            }
          }
        } catch {}
      }
      const src = photo.thumbnail || photo.path
      const isWebPath = src.startsWith('http') || src.startsWith('blob:') || src.startsWith('data:')
      setPreviewSrc(isWebPath ? src : null)
    }

    loadPreview()
  }, [photo])

  const grade = getDisplayGrade(photo)

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-container" onClick={e => e.stopPropagation()}>
        <button className="preview-close" onClick={onClose}>×</button>
        {previewSrc ? (
          <img
            className="preview-image"
            src={previewSrc}
            alt={photo.name}
          />
        ) : (
          <div className="preview-image" style={{ width: 400, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 14 }}>
            <div className="photo-spinner" />
          </div>
        )}
        <div className="preview-info">
          <span>{photo.name}</span>
          {photo.totalScore !== undefined && (
            <span className="preview-score">{photo.totalScore} 分</span>
          )}
          {grade && (
            <span className={`preview-grade ${grade}`}>
              {GRADE_LABELS[grade]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
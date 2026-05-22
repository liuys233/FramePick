import { useEffect, useRef, useCallback } from 'react'
import type { PhotoInfo, GradeKey } from '../types'

interface UseKeyboardOptions {
  photos: PhotoInfo[]
  focusedIndex: number
  onFocusChange: (index: number) => void
  onManualGrade: (photoId: string, grade: GradeKey) => void
  onGradeAll: () => void
  onExport: () => void
  disabled: boolean
  analyzing: boolean
}

export function useKeyboard({
  photos,
  focusedIndex,
  onFocusChange,
  onManualGrade,
  onGradeAll,
  onExport,
  disabled,
  analyzing,
}: UseKeyboardOptions) {
  const onGradeAllRef = useRef(onGradeAll)
  const onExportRef = useRef(onExport)

  onGradeAllRef.current = onGradeAll
  onExportRef.current = onExport

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled) return

    if (e.key === 'g' || e.key === 'G') {
      if (!analyzing && photos.length > 0) {
        e.preventDefault()
        onGradeAllRef.current()
      }
      return
    }

    if (e.key === 'e' || e.key === 'E') {
      const hasSelected = photos.filter(p => p.grade === 'selected' || p.grade === 'alternative').length > 0
      if (hasSelected) {
        e.preventDefault()
        onExportRef.current()
      }
      return
    }

    const gridEl = document.querySelector('.photo-grid')
    let cols = 4
    if (gridEl) {
      const gridStyle = getComputedStyle(gridEl)
      const template = gridStyle.gridTemplateColumns
      if (template.startsWith('repeat')) {
        const match = template.match(/repeat\((\d+)/)
        cols = match ? parseInt(match[1], 10) : 4
      } else {
        cols = template.split(' ').length
      }
    }
    const len = photos.length
    let idx = focusedIndex

    switch (e.key) {
      case 'ArrowLeft': idx = Math.max(0, idx - 1); break
      case 'ArrowRight': idx = Math.min(len - 1, idx + 1); break
      case 'ArrowUp': idx = Math.max(0, idx - cols); break
      case 'ArrowDown': idx = Math.min(len - 1, idx + cols); break
      case '1':
      case '2':
      case '3': {
        const gradeKeys: GradeKey[] = ['selected', 'alternative', 'reject']
        const photo = photos[focusedIndex]
        if (photo) {
          e.preventDefault()
          onManualGrade(photo.id, gradeKeys[Number(e.key) - 1])
        }
        return
      }
      default: return
    }

    if (idx >= 0 && idx < len && idx !== focusedIndex) {
      e.preventDefault()
      onFocusChange(idx)
      const card = document.querySelector(`.photo-card[data-index="${idx}"]`)
      if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [photos, focusedIndex, onFocusChange, onManualGrade, disabled, analyzing])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
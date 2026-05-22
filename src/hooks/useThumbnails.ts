import { useState, useEffect, useRef, useCallback } from 'react'
import type { PhotoInfo } from '../types'

const isElectron = typeof window !== 'undefined' && !!window.electronAPI
const MAX_CONCURRENT = 5  // 最大并发缩略图加载数

interface UseThumbnailsOptions {
  enabled?: boolean
  onError?: (photo: PhotoInfo, error: unknown) => void
}

export function useThumbnails(
  photos: PhotoInfo[],
  options: UseThumbnailsOptions = {}
) {
  const { enabled = true, onError } = options
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const processedRef = useRef<Set<string>>(new Set())
  const loadedRef = useRef<Set<string>>(new Set())
  const loadingRef = useRef<Set<string>>(new Set())
  const queueRef = useRef<PhotoInfo[]>([])
  const abortRef = useRef(false)
  const onErrorRef = useRef(onError)

  onErrorRef.current = onError

  // 处理单个缩略图
  const processPhoto = useCallback(async (photo: PhotoInfo) => {
    const api = window.electronAPI
    const thumbResult = await api.getThumbnail(photo.path)

    if (abortRef.current) return
    if (typeof thumbResult !== 'string') return

    const base64 = await api.getThumbnailData(thumbResult)
    if (abortRef.current) return
    if (!base64 || !base64.startsWith('data:')) return

    setThumbnails(prev => {
      if (prev[photo.id]) return prev
      return { ...prev, [photo.id]: base64 }
    })
  }, [])

  // 调度器：控制并发
  const processQueue = useCallback(async () => {
    while (queueRef.current.length > 0 && !abortRef.current) {
      const running = loadingRef.current.size
      if (running >= MAX_CONCURRENT) break

      const photo = queueRef.current.shift()
      if (!photo) break

      loadingRef.current.add(photo.id)
      processPhoto(photo)
        .catch(err => onErrorRef.current?.(photo, err))
        .finally(() => {
          loadingRef.current.delete(photo.id)
          processQueue()
        })
    }
  }, [processPhoto])

  useEffect(() => {
    if (!enabled) return
    abortRef.current = false

    const currentIds = new Set(photos.map(p => p.id))

    // 清理已消失的照片
    setThumbnails(prev => {
      const next: Record<string, string> = {}
      let changed = false
      for (const [id, url] of Object.entries(prev)) {
        if (currentIds.has(id)) {
          next[id] = url
          loadedRef.current.add(id)
        } else {
          changed = true
        }
      }
      // 清理 refs
      processedRef.current = new Set([...processedRef.current].filter(id => currentIds.has(id)))
      loadingRef.current = new Set([...loadingRef.current].filter(id => currentIds.has(id)))
      return changed ? next : prev
    })

    // 过滤出需要加载的照片
    const toLoad = photos.filter(p => {
      if (processedRef.current.has(p.id)) return false
      if (loadedRef.current.has(p.id)) return false
      return true
    })

    // 直接可用的缩略图（data URL / http）
    for (const photo of toLoad) {
      const thumbSrc = photo.thumbnail || photo.path
      if (thumbSrc && (thumbSrc.startsWith('data:') || thumbSrc.startsWith('http') || thumbSrc.startsWith('blob:'))) {
        processedRef.current.add(photo.id)
        loadedRef.current.add(photo.id)
        setThumbnails(prev => {
          if (prev[photo.id]) return prev
          return { ...prev, [photo.id]: thumbSrc }
        })
      }
    }

    // 需要 Electron IPC 的加入队列
    const needsIpc = toLoad.filter(p => {
      if (processedRef.current.has(p.id)) return false
      if (loadedRef.current.has(p.id)) return false
      const thumbSrc = p.thumbnail || p.path
      return !(thumbSrc?.startsWith('data:') || thumbSrc?.startsWith('http') || thumbSrc?.startsWith('blob:'))
    })

    if (!isElectron) return

    queueRef.current = [...queueRef.current, ...needsIpc.filter(p => !queueRef.current.includes(p))]
    needsIpc.forEach(p => processedRef.current.add(p.id))
    processQueue()
  }, [photos, enabled, processQueue])

  // 组件卸载时中止
  useEffect(() => {
    return () => {
      abortRef.current = true
    }
  }, [])

  return thumbnails
}
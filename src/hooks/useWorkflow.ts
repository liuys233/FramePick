import { useState, useEffect, useCallback, useRef } from 'react'
import type { PhotoInfo, SceneId, CustomRules, AnalysisResult } from '../types'
import { computeGrade } from '../scoring'
import { useAntdToast } from './useToast'

type WorkflowStep = 'import' | 'scene' | 'grade' | 'complete'

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

// 浏览器模式下的模拟分析函数
const mockAnalyzePhoto = async (_path: string): Promise<AnalysisResult> => {
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))
  return {
    eye: { score: 50 + Math.random() * 50 },
    exposure: { score: 40 + Math.random() * 60 },
    sharpness: { score: 30 + Math.random() * 70 },
    color: { score: 45 + Math.random() * 55 },
    similarity: 60 + Math.random() * 40,
  }
}

export function useWorkflow() {
  const [photos, setPhotos] = useState<PhotoInfo[]>([])
  const [activeScene, setActiveScene] = useState<SceneId | null>(null)
  const [customRules, setCustomRules] = useState<CustomRules | null>(null)

  // 工作流状态
  const [step, setStep] = useState<WorkflowStep>('import')
  const [workflowDone, setWorkflowDone] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0 })
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null)
  const [activeDialog, setActiveDialog] = useState<string | null>(null)

  const startTimeRef = useRef<number | null>(null)
  const lastProgressRef = useRef(0)

  const toast = useAntdToast()

  // 监听分析进度
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.onAnalysisProgress) return
    const progressHandler = (progress: { current: number; total: number }) => {
      setAnalyzeProgress(progress)
      
      // 计算 ETA
      if (progress.current > 3 && progress.total > 0) {
        if (!startTimeRef.current || lastProgressRef.current < progress.current - 1) {
          startTimeRef.current = Date.now()
          lastProgressRef.current = progress.current
        }
        
        const elapsed = Date.now() - startTimeRef.current
        if (elapsed < 500) return // 等待至少 500ms 再计算
        
        const rate = progress.current / elapsed
        const remaining = progress.total - progress.current
        
        if (rate > 0 && remaining > 0) {
          setEtaSeconds(Math.ceil(remaining / rate / 1000))
        }
        
        lastProgressRef.current = progress.current
      }
      
      // 重置进度时清除 ETA
      if (progress.current === 0 && progress.total === 0) {
        startTimeRef.current = null
        setEtaSeconds(null)
      }
    }
    window.electronAPI.onAnalysisProgress(progressHandler)
    return () => {
      window.electronAPI.removeAnalysisProgressListener?.(progressHandler)
    }
  }, [])

  // 导入
  const handleImport = useCallback((newPhotos: PhotoInfo[]) => {
    setPhotos(prev => {
      const existing = new Set(prev.map(p => p.path))
      const unique = newPhotos.filter(p => !existing.has(p.path))
      return [...prev, ...unique.map((p, i) => {
        const id = `photo-${Date.now()}-${i}`
        // If path is a data URL or HTTP URL, use it directly as thumbnail
        const isDataUrl = p.path.startsWith('data:')
        const isHttpUrl = p.path.startsWith('http')
        const thumbnail = (isDataUrl || isHttpUrl) ? p.path : null
        return {
          ...p,
          id,
          scene: null,
          thumbnail,
        }
      })]
    })
    setActiveDialog(null)
    setStep('scene')
  }, [])

  // 场景切换
  const handleSceneChange = useCallback((scene: SceneId) => {
    setActiveScene(scene)
    setPhotos(prev => prev.map(p => {
      if (!p.detailScores) return { ...p, scene }
      const { totalScore, grade } = computeGrade(
        {
          eye: { score: p.detailScores.eye },
          exposure: { score: p.detailScores.exposure },
          sharpness: { score: p.detailScores.sharpness },
          color: { score: p.detailScores.color },
          similarity: p.detailScores.uniqueness,
        },
        scene,
        customRules,
      )
      return { ...p, scene, totalScore, grade }
    }))
    if (!workflowDone) setStep('grade')
  }, [customRules, workflowDone])

  // 批量分级
  const handleGradeAll = useCallback(async () => {
    if (!activeScene || photos.length === 0) return
    setAnalyzing(true)
    setEtaSeconds(null)
    startTimeRef.current = null
    lastProgressRef.current = 0

    const photoPaths = photos.map(p => p.path)

    try {
      let analysisByPath = new Map<string, AnalysisResult>()

      if (isElectron) {
        const { results: electronResults } = await window.electronAPI.analyzeBatch({
          photos: photos.map(p => ({ path: p.path })),
        })
        const typedResults = electronResults as AnalysisResult[]
        typedResults.forEach((r, i) => {
          analysisByPath.set(photoPaths[i], r)
        })
      } else {
        const mockResults: AnalysisResult[] = []
        for (let i = 0; i < photos.length; i++) {
          const result = await mockAnalyzePhoto(photos[i].path)
          mockResults.push(result)
          setAnalyzeProgress({ current: i + 1, total: photos.length })
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        mockResults.forEach((r, i) => {
          analysisByPath.set(photoPaths[i], r)
        })
      }

      setPhotos(prev => prev.map(photo => {
        const detail = analysisByPath.get(photo.path)
        if (!detail) return photo
        const { totalScore, grade, detailScores } = computeGrade(detail, activeScene, customRules)
        return { ...photo, totalScore, grade, detailScores }
      }))

      if (!workflowDone) setStep('complete')
    } catch (err) {
      console.error('分级失败:', err)
      toast.error('分级失败，请重试')
    } finally {
      setAnalyzing(false)
      setEtaSeconds(null)
      startTimeRef.current = null
    }
  }, [activeScene, photos, customRules, workflowDone, toast])

  // 自定义规则
  const handleRulesChange = useCallback((rules: CustomRules) => {
    setCustomRules(rules)
    if (activeScene) {
      setPhotos(prev => prev.map(p => {
        if (!p.detailScores) return p
        const { totalScore, grade, detailScores } = computeGrade(
          {
            eye: { score: p.detailScores.eye },
            exposure: { score: p.detailScores.exposure },
            sharpness: { score: p.detailScores.sharpness },
            color: { score: p.detailScores.color },
            similarity: p.detailScores.uniqueness,
          },
          activeScene,
          rules,
        )
        return { ...p, totalScore, grade, detailScores }
      }))
    }
  }, [activeScene])

  // 进入主界面
  const enterMainView = useCallback(() => {
    setWorkflowDone(true)
  }, [])

  // 派生统计数据
  const stats = {
    total: photos.length,
    selected: photos.filter(p => p.grade === 'selected').length,
    alternative: photos.filter(p => p.grade === 'alternative').length,
    reject: photos.filter(p => p.grade === 'reject').length,
    ungraded: photos.filter(p => !p.grade).length,
  }

  return {
    // 数据
    photos,
    activeScene,
    customRules,
    // 工作流状态
    step,
    workflowDone,
    analyzing,
    importing,
    analyzeProgress,
    etaSeconds,
    activeDialog,
    stats,
    // 操作
    setPhotos,
    setStep,
    setImporting,
    setActiveDialog,
    handleImport,
    handleSceneChange,
    handleGradeAll,
    handleRulesChange,
    enterMainView,
  }
}

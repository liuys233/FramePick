import type { SceneConfig, GradeRule, GradeKey, DetailScores, AnalysisResult, CustomRules } from './types'

export const SCENES: Record<string, SceneConfig> = {
  street: { id: 'street', name: 'street', icon: '🏙️', label: '街拍', weights: { eye: 0.10, exposure: 0.25, similarity: 0.20, sharpness: 0.15, color: 0.30 } },
  portrait: { id: 'portrait', name: 'portrait', icon: '👤', label: '人像', weights: { eye: 0.45, exposure: 0.15, similarity: 0.10, sharpness: 0.10, color: 0.20 } },
  landscape: { id: 'landscape', name: 'landscape', icon: '🌄', label: '风光', weights: { eye: 0.05, exposure: 0.30, similarity: 0.20, sharpness: 0.25, color: 0.20 } },
  stillLife: { id: 'stillLife', name: 'stillLife', icon: '🏺', label: '静物', weights: { eye: 0.05, exposure: 0.20, similarity: 0.15, sharpness: 0.25, color: 0.35 } },
}

export const DEFAULT_GRADES: GradeRule[] = [
  { key: 'selected', name: '精选', minScore: 80, maxScore: 100 },
  { key: 'alternative', name: '备选', minScore: 50, maxScore: 79 },
  { key: 'reject', name: '不推荐', minScore: 0, maxScore: 49 },
]

export const GRADE_LABELS: Record<GradeKey, string> = {
  selected: '精选',
  alternative: '备选',
  reject: '不推荐',
}

export const GRADE_COLORS: Record<string, string> = {
  selected: '#52c41a',
  alternative: '#faad14',
  reject: '#ff4d4f',
}

export function computeGrade(
  analysis: AnalysisResult,
  sceneId: string,
  customRules: CustomRules | null
): { totalScore: number; grade: GradeKey; detailScores: DetailScores } {
  const scene = SCENES[sceneId] || SCENES.portrait
  const baseWeights = scene.weights
  const cw = customRules?.weights
  const w = cw
    ? {
        eye: cw.eye ?? baseWeights.eye,
        exposure: cw.exposure ?? baseWeights.exposure,
        sharpness: cw.sharpness ?? baseWeights.sharpness,
        color: cw.color ?? baseWeights.color,
        similarity: cw.similarity ?? baseWeights.similarity,
      }
    : baseWeights

  const weightSum = w.eye + w.exposure + w.sharpness + w.color + w.similarity
  if (Math.abs(weightSum - 1.0) > 0.01) {
    console.warn(`[scoring] 权重总和不等于 1.0: ${weightSum.toFixed(2)}，已自动归一化`)
    const normalizedW = {
      eye: w.eye / weightSum,
      exposure: w.exposure / weightSum,
      sharpness: w.sharpness / weightSum,
      color: w.color / weightSum,
      similarity: w.similarity / weightSum,
    }
    Object.assign(w, normalizedW)
  }

  const scores: DetailScores = {
    eye: analysis.eye?.score ?? 100,
    exposure: analysis.exposure?.score ?? 50,
    sharpness: analysis.sharpness?.score ?? 50,
    color: analysis.color?.score ?? 50,
    uniqueness: analysis.similarity ?? 100,
  }

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

  const total = clamp(
    scores.eye * w.eye +
    scores.exposure * w.exposure +
    scores.sharpness * w.sharpness +
    scores.color * w.color +
    scores.uniqueness * w.similarity
  )

  const grades = customRules?.grades || DEFAULT_GRADES
  let grade: GradeKey = 'reject'
  for (const r of grades) {
    if (total >= r.minScore && total <= r.maxScore) {
      if (r.key === 'selected' || r.key === 'alternative' || r.key === 'reject') {
        grade = r.key
      }
      break
    }
  }

  return { totalScore: total, grade, detailScores: scores }
}

export interface PhotoInfo {
  id: string
  path: string
  name: string
  size: number
  mtime: number
  thumbnail: string | null
  scene: SceneId | null
  totalScore?: number
  grade?: GradeKey
  detailScores?: DetailScores
  manualOverride?: boolean
}

export type SceneId = 'street' | 'portrait' | 'landscape' | 'stillLife'

export type GradeKey = 'selected' | 'alternative' | 'reject'

export interface DetailScores {
  exposure: number
  sharpness: number
  color: number
  eye: number
  uniqueness: number
}

export interface GradeRule {
  key: GradeKey
  name: string
  minScore: number
  maxScore: number
}

export interface SceneConfig {
  id: SceneId
  name: string
  icon: string
  label: string
  weights: Record<string, number>
}

export interface CustomRules {
  grades: GradeRule[]
  weights: {
    exposure: number
    similarity: number
    eye: number
    sharpness: number
    color: number
  }
}

export interface AnalysisResult {
  eye?: { score: number; skinRatio: number; details?: { rgb: number; hsv: number; ycrcb: number } }
  exposure?: { score: number; avgLuminance: number; overexposedRatio: number; underexposedRatio: number; contrastScore?: number }
  sharpness?: { score: number; laplacianVariance: number }
  color?: { score: number; avgSaturation: number; colorDiversity: number }
  similarity?: number
  eyeDetection?: {
    hasFace: boolean
    faceCount: number
    openEyeCount: number
    closedEyeCount: number
    eyeStatus: 'open' | 'closed' | 'unknown'
    confidence: number
  }
}

export type GradeFilter = GradeKey | 'ungraded' | null

export interface ExportResult {
  copied?: number
  failed?: number
  successCount?: number
  failCount?: number
  csvPath?: string
  total?: number
  errors?: Array<{ file: string; error: string }>
}

export interface ElectronAPI {
  platform: string
  selectDirectory: () => Promise<{ dirPath: string; files: Array<{ path: string; name: string; size: number; mtime: number }> } | null>
  selectFiles: () => Promise<string[] | null>
  selectExportDir: () => Promise<string | null>
  getThumbnail: (path: string) => Promise<string | { type: string; name: string; size: number } | { error: string }>
  getThumbnailData: (thumbPath: string) => Promise<string | null>
  analyzePhoto: (path: string) => Promise<unknown>
  analyzeBatch: (params: { photos: Array<{ path: string }> }) => Promise<{ results: unknown[]; similarityGroups: number[][] }>
  onAnalysisProgress: (callback: (progress: { current: number; total: number }) => void) => (handler: any) => void
  removeAnalysisProgress: () => void
  removeAnalysisProgressListener: (handler: any) => void
  exportCopyFiles: (params: unknown) => Promise<unknown>
  exportGradeFolders: (params: unknown) => Promise<unknown>
}

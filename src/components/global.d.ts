import type { PhotoInfo, SceneId, GradeKey, DetailScores, AnalysisResult, CustomRules, GradeFilter } from '../types'

declare global {
  interface Window {
    electronAPI: {
      platform: string
      selectDirectory: () => Promise<{ dirPath: string; files: Array<{ path: string; name: string; size: number; mtime: number }> } | null>
      selectFiles: () => Promise<string[] | null>
      selectExportDir: () => Promise<string | null>
      getThumbnail: (path: string) => Promise<string | { type: string; name: string; size: number } | { error: string }>
      analyzePhoto: (path: string) => Promise<AnalysisResult>
      analyzeBatch: (params: { photos: Array<{ path: string }> }) => Promise<{ results: AnalysisResult[]; similarityGroups: number[][] }>
      computeScore: (params: unknown) => Promise<unknown>
      exportCopyFiles: (params: { files: Array<{ path: string; name: string; rating: number }>; destDir: string; naming: string; format: string }) => Promise<ExportResult>
      exportGradeFolders: (params: { files: Array<{ path: string; name: string; grade: string; totalScore: number }>; destDir: string; grades: string[]; naming: string }) => Promise<ExportResult>
    }
  }
}

export type { PhotoInfo, SceneId, GradeKey, DetailScores, AnalysisResult, CustomRules, GradeFilter }

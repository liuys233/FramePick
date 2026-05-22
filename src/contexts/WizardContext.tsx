import { createContext, useContext, type ReactNode } from 'react'
import type { PhotoInfo, SceneId, CustomRules } from '../types'

export interface WizardState {
  step: 'import' | 'scene' | 'grade' | 'complete'
  hasPhotos: boolean
  hasScene: boolean
  hasGraded: boolean
  stats: { total: number; selected: number; alternative: number; reject: number }
  analyzing: boolean
  importing: boolean
  analyzeProgress: { current: number; total: number }
  showImportDialog: boolean
  showRulesDialog: boolean
  customRules: CustomRules | null
  existingPaths: Set<string>
  photos: PhotoInfo[]

  onStepChange: (step: 'import' | 'scene' | 'grade' | 'complete') => void
  onStartImport: () => void
  onSelectScene: (scene: SceneId) => void
  onStartGrade: () => void
  onEnterMainView: () => void
  onOpenRules: () => void
  onCloseImport: () => void
  onImport: (photos: PhotoInfo[]) => void
  onCloseRules: () => void
  onSaveRules: (rules: CustomRules) => void
  setImporting: (v: boolean) => void
}

const WizardContext = createContext<WizardState | null>(null)

export function WizardProvider({ children, value }: { children: ReactNode; value: WizardState }) {
  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  )
}

export function useWizard(): WizardState {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error('useWizard must be used within WizardProvider')
  return ctx
}

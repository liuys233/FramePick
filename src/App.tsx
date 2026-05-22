import { useState, useCallback, useMemo, useEffect } from 'react'
import TopNav from './components/TopNav'
import LeftSidebar from './components/LeftSidebar'
import MainContent from './components/MainContent'
import RightPanel from './components/RightPanel'
import StatusBar from './components/StatusBar'
import ImportDialog from './components/ImportDialog'
import ExportDialog from './components/ExportDialog'
import RulesDialog from './components/RulesDialog'
import PreviewModal from './components/PreviewModal'
import KeyboardHint from './components/KeyboardHint'
import ErrorBoundary from './components/ErrorBoundary'
import StepGuide from './components/StepGuide'
import { WizardProvider } from './contexts/WizardContext'
import { useWorkflow } from './hooks/useWorkflow'
import { useKeyboard } from './hooks/useKeyboard'
import { SCENES } from './scoring'
import type { GradeFilter, GradeKey, ElectronAPI } from './types'
import type { PhotoInfo } from './types'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

function AppContent() {
  const wf = useWorkflow()
  const [filterGrade, setFilterGrade] = useState<GradeFilter>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [manualGrade, setManualGrade] = useState<Record<string, GradeKey>>({})

  const existingPaths = useMemo(() => {
    return new Set(wf.photos.map(p => p.path))
  }, [wf.photos])

  const displayPhotos = useMemo(() => {
    let result = [...wf.photos]
    if (filterGrade === 'ungraded') {
      result = result.filter(p => !manualGrade[p.id] && !p.grade)
    } else if (filterGrade) {
      result = result.filter(p => (manualGrade[p.id] || p.grade) === filterGrade)
    }
    return result
  }, [wf.photos, filterGrade, manualGrade])

  const currentPhoto = useMemo(() => {
    if (focusedIndex >= 0 && focusedIndex < displayPhotos.length) return displayPhotos[focusedIndex]
    return null
  }, [displayPhotos, focusedIndex])

  useEffect(() => {
    if (displayPhotos.length === 0) {
      setFocusedIndex(-1)
      return
    }
    if (focusedIndex >= displayPhotos.length) {
      const newIndex = displayPhotos.length - 1
      setFocusedIndex(newIndex)
      const card = document.querySelector(`.photo-card[data-index="${newIndex}"]`)
      if (card) (card as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [displayPhotos.length])

  useEffect(() => {
    setFocusedIndex(0)
  }, [filterGrade])

  const getDisplayGrade = useCallback((photo: PhotoInfo) => {
    return manualGrade[photo.id] || photo.grade || null
  }, [manualGrade])

  const handleManualGrade = useCallback((photoId: string, grade: GradeKey) => {
    setManualGrade(prev => ({ ...prev, [photoId]: grade }))
  }, [])

  useKeyboard({
    photos: displayPhotos,
    focusedIndex,
    onFocusChange: setFocusedIndex,
    onManualGrade: handleManualGrade,
    onGradeAll: wf.handleGradeAll,
    onExport: () => wf.setActiveDialog('export'),
    disabled: !!wf.activeDialog || !wf.workflowDone,
    analyzing: wf.analyzing,
  })

  const hasActiveScene = wf.activeScene !== null
  const showEmpty = wf.photos.length === 0

  if (!wf.workflowDone) {
    return (
      <WizardProvider value={{
        step: wf.step,
        hasPhotos: wf.photos.length > 0,
        hasScene: hasActiveScene,
        hasGraded: wf.stats.selected + wf.stats.alternative + wf.stats.reject > 0,
        stats: { total: wf.stats.total, selected: wf.stats.selected, alternative: wf.stats.alternative, reject: wf.stats.reject },
        analyzing: wf.analyzing,
        importing: wf.importing,
        analyzeProgress: wf.analyzeProgress,
        showImportDialog: wf.activeDialog === 'import',
        showRulesDialog: wf.activeDialog === 'rules',
        customRules: wf.customRules,
        existingPaths,
        photos: wf.photos,

        onStepChange: wf.setStep,
        onStartImport: () => wf.setActiveDialog('import'),
        onSelectScene: wf.handleSceneChange,
        onStartGrade: wf.handleGradeAll,
        onEnterMainView: wf.enterMainView,
        onOpenRules: () => wf.setActiveDialog('rules'),
        onCloseImport: () => wf.setActiveDialog(null),
        onImport: wf.handleImport,
        onCloseRules: () => wf.setActiveDialog(null),
        onSaveRules: wf.handleRulesChange,
        setImporting: wf.setImporting,
      }}>
        <StepGuide />
      </WizardProvider>
    )
  }

  return (
    <div className="app-layout" tabIndex={0}>
      <TopNav
        stats={wf.stats}
        activeScene={wf.activeScene ? SCENES[wf.activeScene]?.label || wf.activeScene : null}
        importing={wf.importing || wf.analyzing}
        onImportClick={() => wf.setActiveDialog('import')}
        onRulesClick={() => wf.setActiveDialog('rules')}
        onExportClick={() => wf.setActiveDialog('export')}
        onGradeAll={wf.handleGradeAll}
        gradeDisabled={!hasActiveScene || wf.photos.length === 0}
        exportDisabled={wf.stats.selected + wf.stats.alternative === 0}
      />

      <div className="app-body">
        <LeftSidebar
          activeScene={wf.activeScene}
          onSceneChange={wf.handleSceneChange}
          filterGrade={filterGrade}
          onFilterGradeChange={setFilterGrade}
          stats={wf.stats}
        />

        <MainContent
          photos={displayPhotos}
          focusedIndex={displayPhotos.length > 0 ? focusedIndex : -1}
          onFocusChange={setFocusedIndex}
          showEmpty={showEmpty}
          activeScene={wf.activeScene}
          getDisplayGrade={getDisplayGrade}
        />

        <RightPanel
          photo={currentPhoto}
          allPhotos={displayPhotos}
          index={focusedIndex}
          onNavigate={setFocusedIndex}
          getDisplayGrade={getDisplayGrade}
          onManualGrade={handleManualGrade}
          onPreview={() => wf.setActiveDialog('preview')}
        />
      </div>

      <StatusBar
        stats={wf.stats}
        displayCount={displayPhotos.length}
        showEmpty={showEmpty}
        focusedIndex={focusedIndex}
        currentPhoto={currentPhoto}
        activeScene={wf.activeScene}
        getDisplayGrade={getDisplayGrade}
      />

      {wf.activeDialog === 'export' && (
        <ExportDialog
          photos={wf.photos}
          onClose={() => wf.setActiveDialog(null)}
        />
      )}

      {wf.activeDialog === 'import' && (
        <ImportDialog
          onClose={() => wf.setActiveDialog(null)}
          onImport={wf.handleImport}
          importing={wf.importing}
          setImporting={wf.setImporting}
          existingPaths={existingPaths}
        />
      )}

      {wf.activeDialog === 'rules' && (
        <RulesDialog
          onClose={() => wf.setActiveDialog(null)}
          currentRules={wf.customRules}
          onSave={wf.handleRulesChange}
        />
      )}

      {wf.activeDialog === 'preview' && currentPhoto && (
        <PreviewModal
          photo={currentPhoto}
          getDisplayGrade={getDisplayGrade}
          onClose={() => wf.setActiveDialog(null)}
        />
      )}

      <KeyboardHint />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}
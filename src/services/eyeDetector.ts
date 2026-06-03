import type { EyeIssueLevel, EyeSideCheck, EyeSideStatus, PortraitEyeCheckResult, PortraitEyeCheckStatus } from '../types'
import { detectMediaPipeFace, isMediaPipeFaceLandmarkerLoaded, type MediaPipeLandmark } from './mediaPipeFaceLandmarker'

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

const IMAGE_LOAD_TIMEOUT_MS = 5000
const DETECTION_TIMEOUT_MS = 15000
const DEBUG_LOG_URL = 'http://127.0.0.1:43110/log'
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
const MEDIAPIPE_EYE_OPEN_THRESHOLD = 0.18

async function reportDebug(event: string, payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  try {
    await fetch(DEBUG_LOG_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'eyeDetector', event, payload }),
    })
  } catch {
    // ignore debug transport failures
  }
}

interface Point {
  x: number
  y: number
}

function calculateEyeAspectRatio(eye: Point[]): number {
  const vertical1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y)
  const vertical2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y)
  const horizontal = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y)
  return (vertical1 + vertical2) / (2 * horizontal)
}

function getEyePoints(landmarks: MediaPipeLandmark[], indices: number[]): Point[] | null {
  const points = indices.map((index) => landmarks[index]).filter(Boolean)
  if (points.length !== indices.length) return null
  return points.map((point) => ({ x: point.x, y: point.y }))
}

function createReviewResult(checkStatus: PortraitEyeCheckStatus, summary: string, suggestion: string, issues: string[], issueLevel: EyeIssueLevel = 'warning'): PortraitEyeCheckResult {
  return {
    hasFace: false,
    faceCount: 0,
    openEyeCount: 0,
    closedEyeCount: 0,
    eyeStatus: 'unknown',
    confidence: 0,
    checkStatus,
    issueLevel,
    reviewRequired: true,
    summary,
    suggestion,
    issues,
    scoreImpact: 0,
  }
}

function getEyeSideStatus(isOpen: boolean): EyeSideStatus {
  return isOpen ? 'open' : 'closed'
}

function buildDetectedResult(params: {
  openEyeCount: number
  closedEyeCount: number
  confidence: number
  detector: 'mediapipe'
  leftEye: EyeSideCheck
  rightEye: EyeSideCheck
}): PortraitEyeCheckResult {
  const { openEyeCount, closedEyeCount, confidence, detector, leftEye, rightEye } = params
  const eyeStatus: 'open' | 'closed' | 'unknown' = openEyeCount >= 1 ? 'open' : 'closed'

  if (confidence < 0.35) {
    return {
      hasFace: true,
      faceCount: 1,
      openEyeCount,
      closedEyeCount,
      eyeStatus,
      confidence,
      checkStatus: 'low_confidence',
      issueLevel: 'warning',
      reviewRequired: true,
      summary: '检测到人脸，但置信度较低',
      suggestion: '建议人工复核眼部状态，不直接作为淘汰依据。',
      issues: ['low_confidence'],
      scoreImpact: 0,
      detector,
      leftEye,
      rightEye,
    }
  }

  if (closedEyeCount === 0) {
    return {
      hasFace: true,
      faceCount: 1,
      openEyeCount,
      closedEyeCount,
      eyeStatus,
      confidence,
      checkStatus: 'normal',
      issueLevel: 'none',
      reviewRequired: false,
      summary: '眼部状态正常',
      suggestion: '主脸双眼状态良好，可作为正向选片信号。',
      issues: [],
      scoreImpact: 6,
      detector,
      leftEye,
      rightEye,
    }
  }

  if (closedEyeCount === 1) {
    return {
      hasFace: true,
      faceCount: 1,
      openEyeCount,
      closedEyeCount,
      eyeStatus,
      confidence,
      checkStatus: 'one_eye_closed',
      issueLevel: 'warning',
      reviewRequired: true,
      summary: '疑似单眼闭合',
      suggestion: '建议放大复核，确认是否为眨眼或表情问题。',
      issues: ['one_eye_closed'],
      scoreImpact: -8,
      detector,
      leftEye,
      rightEye,
    }
  }

  return {
    hasFace: true,
    faceCount: 1,
    openEyeCount,
    closedEyeCount,
    eyeStatus,
    confidence,
    checkStatus: 'closed_eye',
    issueLevel: 'critical',
    reviewRequired: true,
    summary: '疑似闭眼',
    suggestion: '主脸双眼疑似闭合，通常不建议作为精选照片。',
    issues: ['closed_eye'],
    scoreImpact: -15,
    detector,
    leftEye,
    rightEye,
  }
}

async function detectWithTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T | 'timeout'> {
  return Promise.race([
    task,
    new Promise<'timeout'>((resolve) => window.setTimeout(() => resolve('timeout'), timeoutMs)),
  ])
}

async function loadImageFromPath(imagePath: string): Promise<HTMLImageElement | null> {
  const img = new Image()
  let src = imagePath

  const isWebSrc = imagePath.startsWith('data:') || imagePath.startsWith('http://') || imagePath.startsWith('https://')
  if (!isWebSrc) {
    if (!isElectron) {
      await reportDebug('load-image-skip-non-electron', { imagePath })
      return null
    }

    try {
      let localPath = imagePath
      if (imagePath.startsWith('file://')) {
        const url = new URL(imagePath)
        localPath = decodeURIComponent(url.pathname)
        if (/^\/[A-Za-z]:/.test(localPath)) localPath = localPath.slice(1)
      }

      const dataUrl = await window.electronAPI.getDetectionImageData(localPath)
      if (dataUrl) {
        src = dataUrl
        await reportDebug('load-image-detection-data-ok', { imagePath, usingDataUrl: true })
      } else {
        await reportDebug('load-image-detection-data-null', { imagePath })
        return null
      }
    } catch (err) {
      await reportDebug('load-image-detection-data-failed', { imagePath, error: err instanceof Error ? err.message : String(err) })
      return null
    }
  }
  
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      void reportDebug('load-image-timeout', { imagePath, srcType: src.startsWith('data:') ? 'data' : 'other' })
      resolve(null)
    }, IMAGE_LOAD_TIMEOUT_MS)

    img.onload = () => {
      window.clearTimeout(timer)
      void reportDebug('load-image-success', { imagePath, width: img.naturalWidth, height: img.naturalHeight, srcType: src.startsWith('data:') ? 'data' : 'other' })
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      void reportDebug('load-image-failed', { imagePath, srcType: src.startsWith('data:') ? 'data' : 'other' })
      resolve(null)
    }
    img.src = src
  })
}

export async function detectEyeState(imagePath: string): Promise<PortraitEyeCheckResult> {
  await reportDebug('detect-start', { imagePath, isElectron, modelsLoaded: isMediaPipeFaceLandmarkerLoaded() })
  if (!isElectron && !imagePath.startsWith('data:') && !imagePath.startsWith('http://') && !imagePath.startsWith('https://')) {
    await reportDebug('detect-skip-non-electron', { imagePath })
    return createReviewResult('unknown', '眼部状态无法判断', '当前环境无法读取本地检测图，建议人工复核。', ['unknown'])
  }

  let img: HTMLImageElement | null
  try {
    img = await loadImageFromPath(imagePath)
    if (!img) {
      await reportDebug('detect-no-image', { imagePath })
      return createReviewResult('unknown', '无法读取检测图', '图片无法载入眼部状态检查流程，建议人工复核。', ['image_load_failed'])
    }
  } catch (err) {
    await reportDebug('detect-image-exception', { imagePath, error: err instanceof Error ? err.message : String(err) })
    return createReviewResult('unknown', '无法读取检测图', '图片载入检测流程时出现异常，建议人工复核。', ['image_load_failed'])
  }

  try {
    const startedAt = Date.now()
    await reportDebug('detect-before-mediapipe', { imagePath, modelsLoaded: isMediaPipeFaceLandmarkerLoaded() })
    const detection = await detectWithTimeout(
      detectMediaPipeFace(img),
      DETECTION_TIMEOUT_MS,
    )

    if (detection === 'timeout') {
      await reportDebug('detect-timeout', { imagePath, detector: 'mediapipe', durationMs: Date.now() - startedAt })
      return createReviewResult('timeout', '眼部状态检查超时', '检测耗时过长，建议人工复核，不直接作为淘汰依据。', ['timeout'])
    }

    if (!detection) {
      await reportDebug('detect-no-face', { imagePath, detector: 'mediapipe', durationMs: Date.now() - startedAt })
      return createReviewResult('no_clear_face', '未检测到清晰人脸', '这张照片可能是背影、侧脸、脸部过小或遮挡，建议人工复核。', ['no_clear_face'])
    }

    const leftEye = getEyePoints(detection.landmarks, LEFT_EYE_INDICES)
    const rightEye = getEyePoints(detection.landmarks, RIGHT_EYE_INDICES)

    if (!leftEye || !rightEye) {
      await reportDebug('detect-eye-landmarks-missing', { imagePath, detector: 'mediapipe', faceCount: detection.faceCount })
      return createReviewResult('unknown', '眼部状态无法判断', '未能读取完整眼部关键点，建议人工复核。', ['eye_landmarks_missing'])
    }

    const leftEAR = calculateEyeAspectRatio(leftEye)
    const rightEAR = calculateEyeAspectRatio(rightEye)

    const isLeftOpen = leftEAR > MEDIAPIPE_EYE_OPEN_THRESHOLD
    const isRightOpen = rightEAR > MEDIAPIPE_EYE_OPEN_THRESHOLD

    const openEyeCount = (isLeftOpen ? 1 : 0) + (isRightOpen ? 1 : 0)
    const closedEyeCount = 2 - openEyeCount

    const leftEyeCheck: EyeSideCheck = { status: getEyeSideStatus(isLeftOpen), ear: Number(leftEAR.toFixed(3)) }
    const rightEyeCheck: EyeSideCheck = { status: getEyeSideStatus(isRightOpen), ear: Number(rightEAR.toFixed(3)) }
    const result = buildDetectedResult({
      openEyeCount,
      closedEyeCount,
      confidence: detection.confidence,
      detector: 'mediapipe',
      leftEye: leftEyeCheck,
      rightEye: rightEyeCheck,
    })

    await reportDebug('detect-success', {
      imagePath,
      faceCount: detection.faceCount,
      openEyeCount,
      closedEyeCount,
      eyeStatus: result.eyeStatus,
      checkStatus: result.checkStatus,
      detector: 'mediapipe',
      confidence: detection.confidence,
      leftEAR,
      rightEAR,
    })

    return result
  } catch (err) {
    await reportDebug('detect-error', { imagePath, error: err instanceof Error ? err.message : String(err) })
    return createReviewResult('unknown', '眼部状态无法判断', '检测过程中出现异常，建议人工复核。', ['unknown'])
  }
}

async function processWithConcurrencyLimit<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++
      try {
        results[currentIndex] = await processor(items[currentIndex])
      } catch (err) {
        console.error(`[EyeDetector] Worker error at index ${currentIndex}:`, err)
      }
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker())

  await Promise.all(workers)
  return results
}

export async function batchDetectEyeState(
  imagePaths: string[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, PortraitEyeCheckResult>> {
  const results = new Map<string, PortraitEyeCheckResult>()
  const CONCURRENCY_LIMIT = 4

  let completed = 0
  await processWithConcurrencyLimit(
    imagePaths,
    CONCURRENCY_LIMIT,
    async (imagePath) => {
      const result = await detectEyeState(imagePath)
      completed++
      onProgress?.(completed, imagePaths.length)
      return { path: imagePath, result }
    }
  ).then((processed) => {
    processed.forEach(({ path, result }) => {
      results.set(path, result)
    })
  })

  return results
}

export function isModelsLoaded(): boolean {
  return isMediaPipeFaceLandmarkerLoaded()
}

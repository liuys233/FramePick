/* eslint-disable @typescript-eslint/no-explicit-any */
import * as faceapi from 'face-api.js'

let modelsLoaded = false
let loadingPromise: Promise<void> | null = null

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models'

export interface EyeDetectionResult {
  hasFace: boolean
  faceCount: number
  openEyeCount: number
  closedEyeCount: number
  eyeStatus: 'open' | 'closed' | 'unknown'
  confidence: number
}

interface Point {
  x: number
  y: number
}

async function loadModels(): Promise<void> {
  if (modelsLoaded) return
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    try {
      await Promise.all([
        (faceapi.nets as any).tinyFaceDetector.loadFromUri(MODEL_URL),
        (faceapi.nets as any).faceLandmark68Net.loadFromUri(MODEL_URL),
      ])
      modelsLoaded = true
      console.log('[EyeDetector] Models loaded successfully')
    } catch (err) {
      console.error('[EyeDetector] Failed to load models:', err)
      throw err
    }
  })()

  return loadingPromise
}

function calculateEyeAspectRatio(eye: Point[]): number {
  const vertical1 = Math.hypot(
    eye[1].x - eye[5].x,
    eye[1].y - eye[5].y
  )
  const vertical2 = Math.hypot(
    eye[2].x - eye[4].x,
    eye[2].y - eye[4].y
  )
  const horizontal = Math.hypot(
    eye[0].x - eye[3].x,
    eye[0].y - eye[3].y
  )
  return (vertical1 + vertical2) / (2 * horizontal)
}

export async function detectEyeState(
  imageElement: HTMLImageElement | HTMLVideoElement | string
): Promise<EyeDetectionResult> {
  await loadModels()

  const detection = await (faceapi as any).detectSingleFace(imageElement)
    .withFaceLandmarks(true)

  if (!detection) {
    return {
      hasFace: false,
      faceCount: 0,
      openEyeCount: 0,
      closedEyeCount: 0,
      eyeStatus: 'unknown',
      confidence: 0,
    }
  }

  const landmarks = detection.landmarks
  const leftEye = landmarks.getLeftEye()
  const rightEye = landmarks.getRightEye()

  const leftEAR = calculateEyeAspectRatio(leftEye)
  const rightEAR = calculateEyeAspectRatio(rightEye)

  const EAR_THRESHOLD = 0.2

  const isLeftOpen = leftEAR > EAR_THRESHOLD
  const isRightOpen = rightEAR > EAR_THRESHOLD

  const openEyeCount = (isLeftOpen ? 1 : 0) + (isRightOpen ? 1 : 0)
  const closedEyeCount = 2 - openEyeCount

  let eyeStatus: 'open' | 'closed' | 'unknown'
  if (openEyeCount >= 1) {
    eyeStatus = 'open'
  } else {
    eyeStatus = 'closed'
  }

  return {
    hasFace: true,
    faceCount: 1,
    openEyeCount,
    closedEyeCount,
    eyeStatus,
    confidence: detection.detection.score,
  }
}

export async function batchDetectEyeState(
  images: string[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, EyeDetectionResult>> {
  await loadModels()

  const results = new Map<string, EyeDetectionResult>()

  for (let i = 0; i < images.length; i++) {
    const imagePath = images[i]

    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = imagePath
      })

      const result = await detectEyeState(img)
      results.set(imagePath, result)
    } catch (err) {
      console.warn(`[EyeDetector] Failed to detect ${imagePath}:`, err)
      results.set(imagePath, {
        hasFace: false,
        faceCount: 0,
        openEyeCount: 0,
        closedEyeCount: 0,
        eyeStatus: 'unknown',
        confidence: 0,
      })
    }

    onProgress?.(i + 1, images.length)
  }

  return results
}

export function isModelsLoaded(): boolean {
  return modelsLoaded
}
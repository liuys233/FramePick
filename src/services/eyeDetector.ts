import * as faceapi from 'face-api.js'

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

interface FaceApiNets {
  tinyFaceDetector: {
    loadFromUri: (uri: string) => Promise<void>
  }
  faceLandmark68Net: {
    loadFromUri: (uri: string) => Promise<void>
  }
}

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
      const nets = faceapi.nets as unknown as FaceApiNets
      await Promise.all([
        nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        nets.faceLandmark68Net.loadFromUri(MODEL_URL),
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
  const vertical1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y)
  const vertical2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y)
  const horizontal = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y)
  return (vertical1 + vertical2) / (2 * horizontal)
}

async function loadImageFromPath(imagePath: string): Promise<HTMLImageElement> {
  const img = new Image()
  
  let src = imagePath
  if (isElectron && imagePath.startsWith('C:')) {
    try {
      const dataUrl = await window.electronAPI.getThumbnailData(imagePath)
      if (dataUrl) {
        src = dataUrl
      }
    } catch (err) {
      console.warn('[EyeDetector] Failed to get thumbnail data:', err)
    }
  }
  
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${imagePath}`))
    img.src = src
  })
}

export async function detectEyeState(imagePath: string): Promise<EyeDetectionResult> {
  await loadModels()

  let img: HTMLImageElement
  try {
    img = await loadImageFromPath(imagePath)
  } catch (err) {
    console.warn('[EyeDetector] Image load failed:', err)
    return {
      hasFace: false,
      faceCount: 0,
      openEyeCount: 0,
      closedEyeCount: 0,
      eyeStatus: 'unknown',
      confidence: 0,
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detection = await (faceapi as any).detectSingleFace(img).withFaceLandmarks(true)

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

    const eyeStatus: 'open' | 'closed' | 'unknown' = openEyeCount >= 1 ? 'open' : 'closed'

    return {
      hasFace: true,
      faceCount: 1,
      openEyeCount,
      closedEyeCount,
      eyeStatus,
      confidence: detection.detection.score,
    }
  } catch (err) {
    console.warn('[EyeDetector] Detection failed:', err)
    return {
      hasFace: false,
      faceCount: 0,
      openEyeCount: 0,
      closedEyeCount: 0,
      eyeStatus: 'unknown',
      confidence: 0,
    }
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
): Promise<Map<string, EyeDetectionResult>> {
  await loadModels()

  const results = new Map<string, EyeDetectionResult>()
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
  return modelsLoaded
}
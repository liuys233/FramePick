import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export interface MediaPipeLandmark {
  x: number
  y: number
  z?: number
}

export interface MediaPipeFaceDetection {
  faceCount: number
  confidence: number
  landmarks: MediaPipeLandmark[]
}

const WASM_URL = '/mediapipe/wasm'
const MODEL_URL = '/mediapipe/face_landmarker.task'

let landmarker: FaceLandmarker | null = null
let loadingPromise: Promise<FaceLandmarker> | null = null

export async function loadMediaPipeFaceLandmarker(): Promise<FaceLandmarker> {
  if (landmarker) return landmarker
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      numFaces: 1,
      minFaceDetectionConfidence: 0.25,
      minFacePresenceConfidence: 0.25,
      minTrackingConfidence: 0.25,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    })
    return landmarker
  })()

  return loadingPromise
}

export async function detectMediaPipeFace(image: HTMLImageElement): Promise<MediaPipeFaceDetection | null> {
  const detector = await loadMediaPipeFaceLandmarker()
  const result = detector.detect(image)
  const landmarks = result.faceLandmarks[0]

  if (!landmarks) return null

  const confidence = result.faceBlendshapes[0]?.categories[0]?.score ?? 1

  return {
    faceCount: result.faceLandmarks.length,
    confidence,
    landmarks,
  }
}

export function isMediaPipeFaceLandmarkerLoaded(): boolean {
  return !!landmarker
}

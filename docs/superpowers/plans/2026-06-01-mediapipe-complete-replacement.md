# MediaPipe Complete Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing `face-api.js` eye-state detection stack with a MediaPipe FaceLandmarker-only implementation.

**Architecture:** Keep `src/services/eyeDetector.ts` as the public business API and move MediaPipe initialization plus landmark extraction into a focused adapter module. The workflow, scoring, and right panel continue consuming `PortraitEyeCheckResult`, while the detector identity changes from Tiny/SSD to MediaPipe.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Electron 41, `@mediapipe/tasks-vision`, local static assets under `public/mediapipe`.

---

## File Map

- Create: `src/services/mediaPipeFaceLandmarker.ts` — owns MediaPipe FilesetResolver, FaceLandmarker lifecycle, timeout-safe detection, and raw face landmark output.
- Modify: `src/services/eyeDetector.ts` — removes `face-api.js`, calls the MediaPipe adapter, computes eye openness from MediaPipe landmarks, and preserves `detectEyeState` / `batchDetectEyeState` exports.
- Modify: `src/types.ts` — changes `PortraitEyeCheckResult.detector` from `'tiny' | 'ssd'` to `'mediapipe'`.
- Modify: `src/components/RightPanel.tsx` — shows MediaPipe detector metadata only when present and avoids Tiny/SSD labels.
- Modify: `package.json` — removes `face-api.js`, adds `@mediapipe/tasks-vision`.
- Modify: `package-lock.json` — refreshes dependency lock after install.
- Delete: `src/types/face-api.d.ts` — removes stale local declarations.
- Delete: `public/models/*` — removes face-api model shards and manifests.
- Create: `public/mediapipe/face_landmarker.task` — local MediaPipe model file.
- Create: `public/mediapipe/wasm/*` — local MediaPipe WASM loader/runtime files copied from `@mediapipe/tasks-vision/wasm`.

## Detection Contract

The public result shape remains compatible with existing consumers:

```ts
export interface PortraitEyeCheckResult {
  hasFace: boolean
  faceCount: number
  openEyeCount: number
  closedEyeCount: number
  eyeStatus: 'open' | 'closed' | 'unknown'
  confidence: number
  checkStatus: PortraitEyeCheckStatus
  issueLevel: EyeIssueLevel
  reviewRequired: boolean
  summary: string
  suggestion: string
  issues: string[]
  scoreImpact: number
  detector?: 'mediapipe'
  leftEye?: EyeSideCheck
  rightEye?: EyeSideCheck
}
```

The adapter returns a compact raw result used only by `eyeDetector.ts`:

```ts
export interface MediaPipeFaceDetection {
  faceCount: number
  confidence: number
  landmarks: Array<{ x: number; y: number; z?: number }>
}
```

## Task 1: Dependency And Asset Setup

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `public/mediapipe/face_landmarker.task`
- Create: `public/mediapipe/wasm/*`
- Delete: `public/models/tiny_face_detector_model-shard1`
- Delete: `public/models/tiny_face_detector_model-weights_manifest.json`
- Delete: `public/models/ssd_mobilenetv1_model-shard1`
- Delete: `public/models/ssd_mobilenetv1_model-shard2`
- Delete: `public/models/ssd_mobilenetv1_model-weights_manifest.json`
- Delete: `public/models/face_landmark_68_model-shard1`
- Delete: `public/models/face_landmark_68_model-weights_manifest.json`

- [ ] **Step 1: Install MediaPipe and remove face-api**

Run:

```bash
npm uninstall face-api.js
npm install @mediapipe/tasks-vision
```

Expected: `package.json` contains `@mediapipe/tasks-vision` and no longer contains `face-api.js`.

- [ ] **Step 2: Copy local MediaPipe WASM assets**

Run in PowerShell from `d:\VBCODE\FramePick`:

```powershell
New-Item -ItemType Directory -Force public\mediapipe\wasm
Copy-Item node_modules\@mediapipe\tasks-vision\wasm\* public\mediapipe\wasm\ -Force
```

Expected: `public/mediapipe/wasm` contains the MediaPipe vision WASM and loader files.

- [ ] **Step 3: Add the FaceLandmarker task model**

Download the MediaPipe face landmarker model into:

```text
public/mediapipe/face_landmarker.task
```

Use the official MediaPipe Tasks Vision face landmarker model asset. The app must load it from `/mediapipe/face_landmarker.task`, not from a network URL.

- [ ] **Step 4: Remove old face-api model assets**

Delete the entire old model directory after confirming it only contains face-api assets:

```text
public/models
```

Expected: no runtime path uses `/models` after Task 3.

- [ ] **Step 5: Verify dependency tree**

Run:

```bash
npm ls @mediapipe/tasks-vision
npm ls face-api.js
```

Expected: first command resolves successfully; second command reports no installed `face-api.js` package.

## Task 2: MediaPipe Adapter

**Files:**
- Create: `src/services/mediaPipeFaceLandmarker.ts`

- [ ] **Step 1: Create adapter with local asset paths**

Create `src/services/mediaPipeFaceLandmarker.ts` with this structure:

```ts
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
```

- [ ] **Step 2: Run typecheck and fix API signature drift**

Run:

```bash
npm run typecheck
```

Expected: if `@mediapipe/tasks-vision` exposes slightly different option names in the installed version, adjust only `mediaPipeFaceLandmarker.ts` until TypeScript accepts the adapter.

## Task 3: Eye Detector Business Logic Replacement

**Files:**
- Modify: `src/services/eyeDetector.ts`

- [ ] **Step 1: Replace face-api import and model state**

Remove:

```ts
import * as faceapi from 'face-api.js'
```

Add:

```ts
import { detectMediaPipeFace, isMediaPipeFaceLandmarkerLoaded, type MediaPipeLandmark } from './mediaPipeFaceLandmarker'
```

Remove `faceApi`, `FaceApiNets`, `FaceDetectionWithLandmarks`, `MODEL_URL`, `modelsLoaded`, `loadingPromise`, and `loadModels()` from `eyeDetector.ts`.

- [ ] **Step 2: Add MediaPipe eye landmark groups**

Add these constants near the existing `Point` interface:

```ts
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
const MEDIAPIPE_EYE_OPEN_THRESHOLD = 0.18
```

- [ ] **Step 3: Convert MediaPipe landmarks to eye points**

Add:

```ts
function getEyePoints(landmarks: MediaPipeLandmark[], indices: number[]): Point[] | null {
  const points = indices.map((index) => landmarks[index]).filter(Boolean)
  if (points.length !== indices.length) return null
  return points.map((point) => ({ x: point.x, y: point.y }))
}
```

- [ ] **Step 4: Update `buildDetectedResult` detector type**

Change the detector parameter to:

```ts
detector: 'mediapipe'
```

and keep all result mapping rules unchanged.

- [ ] **Step 5: Replace the detection block inside `detectEyeState`**

Replace the current `loadModels`, Tiny detector, SSD fallback, and `landmarks.getLeftEye()` block with:

```ts
const startedAt = Date.now()
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
```

- [ ] **Step 6: Update loaded-state export**

Replace:

```ts
export function isModelsLoaded(): boolean {
  return modelsLoaded
}
```

with:

```ts
export function isModelsLoaded(): boolean {
  return isMediaPipeFaceLandmarkerLoaded()
}
```

## Task 4: Type And UI Cleanup

**Files:**
- Modify: `src/types.ts:39-56`
- Modify: `src/components/RightPanel.tsx:169-202`
- Delete: `src/types/face-api.d.ts`

- [ ] **Step 1: Update detector type**

Change `PortraitEyeCheckResult.detector` in `src/types.ts` to:

```ts
detector?: 'mediapipe'
```

- [ ] **Step 2: Remove stale face-api declaration file**

Delete:

```text
src/types/face-api.d.ts
```

- [ ] **Step 3: Add detector display only for MediaPipe**

In `RightPanel.tsx`, inside the eye status card grid, add a detector row when `eyeDetection.detector` exists:

```tsx
{eyeDetection.detector && (
  <div>
    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>检测器</Text>
    <Text style={{ fontSize: 12 }}>{eyeDetection.detector === 'mediapipe' ? 'MediaPipe' : eyeDetection.detector}</Text>
  </div>
)}
```

Expected: the UI never renders `tiny` or `ssd` after the type change.

## Task 5: Verification And Regression Checks

**Files:**
- Read: `src/services/eyeDetector.ts`
- Read: `src/services/mediaPipeFaceLandmarker.ts`
- Read: `src/types.ts`
- Read: `package.json`

- [ ] **Step 1: Search for removed stack references**

Run:

```bash
npm run typecheck
```

Expected: TypeScript passes with no `face-api.js`, `tiny`, or `ssd` detector type errors.

- [ ] **Step 2: Build the Vite app**

Run:

```bash
npm run build:react
```

Expected: Vite build succeeds and includes `/mediapipe` assets as static public files.

- [ ] **Step 3: Confirm face-api references are gone**

Run PowerShell searches:

```powershell
Select-String -Path package.json,package-lock.json,src\**\*,public\**\* -Pattern "face-api|TinyFaceDetector|SsdMobilenet|ssdMobilenet|face_landmark_68|tiny_face_detector" -SimpleMatch
```

Expected: no business source, package, or public asset references remain.

- [ ] **Step 4: Confirm MediaPipe references exist only in expected places**

Run:

```powershell
Select-String -Path package.json,src\**\*,public\**\* -Pattern "mediapipe|MediaPipe|FaceLandmarker" -SimpleMatch
```

Expected: matches appear in `package.json`, `src/services/mediaPipeFaceLandmarker.ts`, `src/services/eyeDetector.ts`, `src/types.ts`, optional UI text, and `public/mediapipe` assets.

- [ ] **Step 5: Manual smoke test in Electron**

Run:

```bash
npm run dev
```

Expected flow: import portrait or street photos, run grading, open the right panel, and see “人像眼部状态检查” with detector `MediaPipe`, confidence, left eye, right eye, and suggestion values.

## Self-Review

- Spec coverage: complete replacement, adapter split, compatible `PortraitEyeCheckResult`, local resource loading, dependency cleanup, UI cleanup, and verification are covered.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: `detector` is consistently narrowed to `'mediapipe'`; the adapter result is consumed only by `eyeDetector.ts`; public workflow and scoring contracts remain unchanged.
- Scope check: implementation is focused on eye-state detection replacement and does not add multiplayer face review, overlay visualization, or scoring redesign.

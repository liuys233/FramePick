# 人像眼部状态检查 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有“人眼检测”升级为在人像和扫街场景启用的“人像眼部状态检查”，提供状态结论、左右眼状态、风险提示和评分影响。

**Architecture:** 保留当前 `analysis.eyeDetection` 数据入口以兼容现有数据流，但扩展其结构。检测层负责生成结构化检查结果，工作流在人像和扫街场景合并结果，评分层只读取 `scoreImpact`，右侧面板负责面向选片的展示。

**Tech Stack:** React 19、TypeScript、Ant Design、Electron IPC、Sharp、face-api.js、Vite、Node.js。

---

## File Map

- Modify `src/types.ts`: 新增眼部检查状态、左右眼、风险等级类型，扩展 `AnalysisResult.eyeDetection`。
- Modify `src/services/eyeDetector.ts`: 返回扩展后的眼部状态检查结果，保留 Tiny + SSD fallback。
- Modify `src/hooks/useWorkflow.ts`: 将眼部检查启用范围扩展到 `portrait` 和 `street`，更新提示文案。
- Modify `src/scoring.ts`: 使用 `eyeDetection.scoreImpact` 调整分数，保留旧字段兜底。
- Modify `src/components/RightPanel.tsx`: 将卡片升级为“人像眼部状态检查”，展示结论、左右眼、建议和风险等级。
- Verify `electron/main.js` and `electron/preload.js`: 确认检测图接口已存在，无需新增 IPC。

## Task 1: Type Model Upgrade

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add eye check types**

In `src/types.ts`, add these exports after `DetailScores`:

```ts
export type PortraitEyeCheckStatus = 'normal' | 'one_eye_closed' | 'closed_eye' | 'no_clear_face' | 'low_confidence' | 'timeout' | 'unknown'

export type EyeSideStatus = 'open' | 'closed' | 'unknown'

export type EyeIssueLevel = 'none' | 'warning' | 'critical'

export interface EyeSideCheck {
  status: EyeSideStatus
  ear?: number
}

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
  detector?: 'tiny' | 'ssd'
  leftEye?: EyeSideCheck
  rightEye?: EyeSideCheck
}
```

- [ ] **Step 2: Replace inline eyeDetection type**

In `AnalysisResult`, replace the existing inline `eyeDetection` object with:

```ts
  eyeDetection?: PortraitEyeCheckResult
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript may fail until `eyeDetector.ts` is updated in Task 2. Do not fix unrelated files in this task.

## Task 2: Detection Result Upgrade

**Files:**
- Modify: `src/services/eyeDetector.ts`

- [ ] **Step 1: Import shared types**

Add this import after the face-api import:

```ts
import type { EyeIssueLevel, EyeSideCheck, EyeSideStatus, PortraitEyeCheckResult, PortraitEyeCheckStatus } from '../types'
```

- [ ] **Step 2: Remove local EyeDetectionResult interface**

Delete the local `export interface EyeDetectionResult` from `eyeDetector.ts` and change public function return types to `PortraitEyeCheckResult`.

- [ ] **Step 3: Replace default result**

Change `DEFAULT_EYE_RESULT` to:

```ts
const DEFAULT_EYE_RESULT: PortraitEyeCheckResult = {
  hasFace: false,
  faceCount: 0,
  openEyeCount: 0,
  closedEyeCount: 0,
  eyeStatus: 'unknown',
  confidence: 0,
  checkStatus: 'unknown',
  issueLevel: 'warning',
  reviewRequired: true,
  summary: '无法完成眼部状态检查',
  suggestion: '建议人工复核这张照片的眼部状态。',
  issues: ['unknown'],
  scoreImpact: 0,
}
```

- [ ] **Step 4: Add result builders**

Add these helpers after `calculateEyeAspectRatio`:

```ts
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
  detector: 'tiny' | 'ssd'
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
```

- [ ] **Step 5: Return specific failure results**

Replace generic `return DEFAULT_EYE_RESULT` branches in image loading, model failure, no face, timeout, and catch blocks with `createReviewResult(...)` where possible:

```ts
return createReviewResult('no_clear_face', '未检测到清晰人脸', '这张照片可能是背影、侧脸、脸部过小或遮挡，建议人工复核。', ['no_clear_face'])
```

For timeout:

```ts
return createReviewResult('timeout', '眼部状态检查超时', '检测耗时过长，建议人工复核，不直接作为淘汰依据。', ['timeout'])
```

For unexpected errors:

```ts
return createReviewResult('unknown', '眼部状态无法判断', '检测过程中出现异常，建议人工复核。', ['unknown'])
```

- [ ] **Step 6: Return detected result**

Replace the final success return with:

```ts
const leftEyeCheck: EyeSideCheck = { status: getEyeSideStatus(isLeftOpen), ear: Number(leftEAR.toFixed(3)) }
const rightEyeCheck: EyeSideCheck = { status: getEyeSideStatus(isRightOpen), ear: Number(rightEAR.toFixed(3)) }

return buildDetectedResult({
  openEyeCount,
  closedEyeCount,
  confidence: detection.detection.score,
  detector: detector as 'tiny' | 'ssd',
  leftEye: leftEyeCheck,
  rightEye: rightEyeCheck,
})
```

- [ ] **Step 7: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS or only downstream UI/scoring errors fixed in later tasks.

## Task 3: Workflow Scene Enablement

**Files:**
- Modify: `src/hooks/useWorkflow.ts`

- [ ] **Step 1: Add supported scene helper**

Near `const isElectron`, add:

```ts
const EYE_CHECK_SCENES: SceneId[] = ['portrait', 'street']

function shouldRunEyeCheck(scene: SceneId | null): scene is SceneId {
  return !!scene && EYE_CHECK_SCENES.includes(scene)
}
```

- [ ] **Step 2: Expand trigger condition**

Replace:

```ts
if (activeScene === 'portrait') {
```

with:

```ts
if (shouldRunEyeCheck(activeScene)) {
```

- [ ] **Step 3: Update progress text**

Replace:

```ts
toast.info('正在检测人眼状态...')
```

with:

```ts
toast.info('正在检查人像眼部状态...')
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS or only scoring/UI errors fixed in later tasks.

## Task 4: Scoring Upgrade

**Files:**
- Modify: `src/scoring.ts`

- [ ] **Step 1: Expand eye status scoring scenes**

Find the current portrait-only eye detection adjustment block and change its scene guard to include street:

```ts
if ((scene === 'portrait' || scene === 'street') && analysis.eyeDetection) {
```

- [ ] **Step 2: Prefer scoreImpact**

Inside that block, first apply `scoreImpact` if present:

```ts
const scoreImpact = analysis.eyeDetection.scoreImpact
if (typeof scoreImpact === 'number') {
  total += scoreImpact
} else if (analysis.eyeDetection.hasFace) {
  if (analysis.eyeDetection.eyeStatus === 'closed') {
    total -= 15
  } else if (analysis.eyeDetection.openEyeCount === 2) {
    total += 10
  } else if (analysis.eyeDetection.openEyeCount === 1) {
    total += 5
  }
}
```

Remove the old duplicate adjustment logic so scoring is applied once.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS or only RightPanel errors fixed in Task 5.

## Task 5: Right Panel UI Upgrade

**Files:**
- Modify: `src/components/RightPanel.tsx`

- [ ] **Step 1: Expand display condition**

Replace portrait-only eye detection selection with:

```ts
const supportsEyeCheck = photo.scene === 'portrait' || photo.scene === 'street'
const eyeDetection = supportsEyeCheck ? photo.analysis?.eyeDetection : undefined
```

- [ ] **Step 2: Add status metadata**

Replace `eyeStatusMeta` with metadata based on `checkStatus` and `issueLevel`:

```ts
const eyeStatusMeta = eyeDetection
  ? eyeDetection.issueLevel === 'critical'
    ? { label: eyeDetection.summary || '存在眼部风险', color: '#ff4d4f' }
    : eyeDetection.issueLevel === 'warning'
      ? { label: eyeDetection.summary || '建议复核', color: '#faad14' }
      : { label: eyeDetection.summary || '眼部状态正常', color: '#52c41a' }
  : null
```

- [ ] **Step 3: Rename card title**

Change the title from:

```tsx
人眼检测
```

to:

```tsx
人像眼部状态检查
```

- [ ] **Step 4: Replace card fields**

In the eye check card, show these fields:

```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
  <div>
    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>主脸数量</Text>
    <Text style={{ fontSize: 12 }}>{eyeDetection.hasFace ? `${eyeDetection.faceCount} 张` : '未检测到'}</Text>
  </div>
  <div>
    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>置信度</Text>
    <Text style={{ fontSize: 12 }}>{Math.round(eyeDetection.confidence * 100)}%</Text>
  </div>
  <div>
    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>左眼</Text>
    <Text style={{ fontSize: 12 }}>{getEyeSideLabel(eyeDetection.leftEye?.status)}</Text>
  </div>
  <div>
    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>右眼</Text>
    <Text style={{ fontSize: 12 }}>{getEyeSideLabel(eyeDetection.rightEye?.status)}</Text>
  </div>
</div>
```

- [ ] **Step 5: Add helper label function**

Add near `GRADE_OPTIONS`:

```ts
function getEyeSideLabel(status?: 'open' | 'closed' | 'unknown') {
  if (status === 'open') return '睁开'
  if (status === 'closed') return '闭合'
  return '未知'
}
```

- [ ] **Step 6: Show suggestion text**

Under the grid, show suggestion if present:

```tsx
{eyeDetection.suggestion && (
  <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
    {eyeDetection.suggestion}
  </Text>
)}
```

- [ ] **Step 7: Show empty supported state**

If `supportsEyeCheck` is true but no `eyeDetection`, show:

```tsx
{supportsEyeCheck && !eyeDetection && (
  <div style={{ marginBottom: 12 }}>
    <Text strong style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 8 }}>人像眼部状态检查</Text>
    <Text type="secondary" style={{ fontSize: 11 }}>尚未执行眼部状态检查</Text>
  </div>
)}
```

- [ ] **Step 8: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

## Task 6: Verification and Cleanup

**Files:**
- Verify: `src/types.ts`
- Verify: `src/services/eyeDetector.ts`
- Verify: `src/hooks/useWorkflow.ts`
- Verify: `src/scoring.ts`
- Verify: `src/components/RightPanel.tsx`

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Start app for manual verification**

Run:

```bash
npm run dev
```

Expected: Vite starts on `http://localhost:5173/` and Electron opens.

- [ ] **Step 3: Verify portrait scene**

In Electron, import a clear portrait photo, select 人像, run grading. Expected: right panel shows “人像眼部状态检查” with conclusion, confidence, left eye, right eye, suggestion.

- [ ] **Step 4: Verify street scene**

In Electron, import a street photo with a visible person, select 扫街, run grading. Expected: eye check also runs and appears in right panel.

- [ ] **Step 5: Verify unsupported scenes**

Select 风光 or 静物 and run grading. Expected: eye check card does not appear.

- [ ] **Step 6: Review debug artifacts**

Keep debug artifacts only if the debugging session is still open. If the user confirms the feature works, remove `debug-eye-detection.md`, `debug-eye-detection-freeze.md`, `trae-debug-log-eye-detection.ndjson`, and temporary debug reporting code in `eyeDetector.ts` and `useWorkflow.ts`.

---

## Self-Review

- Spec coverage: The plan covers type expansion, detection output, portrait/street enablement, scoring, right panel UI, and verification.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: `PortraitEyeCheckResult`, `EyeSideCheck`, `scoreImpact`, `checkStatus`, `issueLevel`, `leftEye`, and `rightEye` are consistently named across tasks.

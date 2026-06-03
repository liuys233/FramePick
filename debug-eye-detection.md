# Debug Session: eye-detection

Status: [OPEN]

## Symptom

人像场景下，人眼检测结果在分级界面显示为“未检测到”，疑似所有照片的人眼检测都不起作用。

## Hypotheses

1. face-api 模型未成功加载，导致检测始终走默认 unknown/no-face 结果。
2. 本地图片或缩略图转换为浏览器可读取图片失败，导致检测输入为空或不可用。
3. 人眼检测只在人像场景触发，但照片的 scene 或 activeScene 状态没有按预期写入 portrait。
4. face-api 检测到了人脸，但 EAR 阈值或 landmark 计算异常，导致眼睛状态被判定为 unknown/closed。
5. 检测结果生成成功，但合并到 analysis.eyeDetection 或 UI 读取时丢失。

## Evidence Plan

- 在人眼检测入口、模型加载、图片加载、检测结果、结果合并处添加最小化运行时日志。
- 收集一次人像场景分级过程日志，按证据确认或排除假设。

## Findings

- 复现日志显示 activeScene 为 portrait，已进入人眼检测分支。
- 图片加载成功，模型 `/models` 加载成功。
- 终端运行时错误为 `SsdMobilenetv1 - load model before inference`。
- 当前代码只加载 `tinyFaceDetector` 和 `faceLandmark68Net`，但 `detectSingleFace(img)` 未传入 TinyFaceDetectorOptions，face-api 默认使用 SSD Mobilenet 检测器。
- 根因：检测调用使用了未加载的默认 SSD 模型，导致人脸检测失败并返回默认“未检测到”。
- 修复后日志显示模型与图片加载成功，但检测输入图像只有 `200x300`，TinyFaceDetector 仍返回 `detect-no-face`。
- 二次根因：人眼检测复用了界面缩略图，分辨率过低，导致人脸在检测输入中占比过小。

## Fix

- 将 `detectSingleFace(img)` 改为 `detectSingleFace(img, new faceApi.TinyFaceDetectorOptions(...))`，与已加载模型保持一致。
- 为 Electron 增加 `file:detectionImageData`，生成最长边 960 的检测图；前端人眼检测改用检测图，不再复用 200x300 缩略图。

## Verification

- TypeScript typecheck passed after both fixes.
- Pending post-fix reproduction with larger detection image.

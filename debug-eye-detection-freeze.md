# Debug Session: eye-detection-freeze [OPEN]

## Symptom

人像分级流程到“人眼检测”阶段仍然卡住。

## Hypotheses

1. `detectEyeState` 进入后卡在 `loadModels()`，本地 `/models` 请求或 face-api 初始化未返回。
2. `loadImageFromPath()` 卡在图片 `onload/onerror`，data URL 或本地路径没有触发任何事件。
3. `faceApi.detectSingleFace(...).withFaceLandmarks(true)` 对某些图片耗时过长，没有超时保护。
4. `useWorkflow` 中人眼检测逐张串行执行，单张卡住导致整个分级流程无法进入完成态。
5. 浏览器预览与 Electron 环境分支判断不符合实际运行环境，导致不该执行的检测路径被执行。

## Instrumentation Plan

在 `useWorkflow.ts` 与 `eyeDetector.ts` 增加临时网络日志上报，记录人眼检测阶段、图片加载、模型加载、单张检测耗时与异常。

## Evidence

用户提供终端日志显示 `thumbnailData length 15594096`，说明人眼检测阶段存在读取 15.6MB 原图作为 data URL 的情况，而不是稳定读取十几 KB 的缩略图。这会导致渲染进程图片解码/face-api 检测显著变慢，表现为卡在人眼检测。

## Fix Applied

`loadImageFromPath()` 对本地路径先调用 `getThumbnail()` 获取/生成缩略图，再用 `getThumbnailData()` 读取缩略图 data URL；同时给图片加载和 `detectSingleFace().withFaceLandmarks()` 增加 5 秒超时，单张失败直接返回默认 unknown，不阻塞整体分级。

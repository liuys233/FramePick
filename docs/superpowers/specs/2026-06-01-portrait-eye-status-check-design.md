# 人像眼部状态检查设计

## 背景

当前 FramePick 在人像场景中已有基于 face-api.js 的人眼检测，但结果语义较粗，只能表达 `open`、`closed`、`unknown`。右侧面板展示为“人眼检测”，容易让用户理解为底层识别结果，而不是选片决策建议。当前检测也只在人像场景启用，扫街场景中的人物照片无法获得眼部风险提示。

本次升级目标是把功能产品化为“人像眼部状态检查”：不只告诉用户检测到了什么，还要告诉用户这张照片是否存在闭眼、单眼闭合、低置信度、未检测到清晰人脸等选片风险。

## 目标

- 在人像和扫街场景启用眼部状态检查。
- 先支持主脸单脸检查，数据结构保留后续多人扩展空间。
- 将检测结果从“睁眼/闭眼/未知”升级为面向选片的状态结论和风险提示。
- 在右侧详情面板显示检查结论、左右眼状态、置信度和复核建议。
- 调整评分逻辑：明确闭眼影响分级，无法判断不直接判坏片。

## 非目标

- 本阶段不实现完整多人合照检查。
- 本阶段不做人脸框、眼睛关键点可视化标注。
- 本阶段不替换 face-api.js 技术栈。
- 本阶段不重做整体评分体系，只调整眼部状态对分数的影响方式。

## 方案

采用“单脸先行 + 状态升级 + 后续多人兼容”的方案。

检测流程继续复用当前 `eyeDetector.ts`：先用 TinyFaceDetector 快速检测，失败或超时后使用 SSD MobilenetV1 兜底。检测输入继续使用 Electron 主进程生成的检测专用图，避免使用 UI 缩略图。

输出结构从简单的 `EyeDetectionResult` 扩展为更清晰的眼部状态检查结果。为了兼容当前数据流，字段仍放在 `analysis.eyeDetection`，但增加 `checkStatus`、`issueLevel`、`reviewRequired`、`leftEye`、`rightEye`、`issues`、`scoreImpact`、`detector` 等字段。后续多人检测可在同一结构中增加 `faces` 数组。

## 状态定义

检查状态使用以下枚举语义：

- `normal`：主脸检测成功，左右眼均判断为睁开。
- `one_eye_closed`：主脸检测成功，疑似一只眼闭合。
- `closed_eye`：主脸检测成功，疑似双眼闭合。
- `no_clear_face`：未检测到清晰人脸。
- `low_confidence`：检测到人脸但置信度低，建议人工复核。
- `timeout`：检测超时，建议人工复核。
- `unknown`：出现无法归类的检测失败。

左右眼状态使用：

- `open`
- `closed`
- `unknown`

风险等级使用：

- `none`
- `warning`
- `critical`

## 数据结构

建议在 `types.ts` 中扩展类型：

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

保留 `hasFace`、`faceCount`、`openEyeCount`、`closedEyeCount`、`eyeStatus`、`confidence`，避免现有展示和评分代码一次性断裂。

## 数据流

1. `useWorkflow.handleGradeAll` 在 `portrait` 和 `street` 场景中触发眼部状态检查。
2. 每张照片调用检测服务，检测服务返回扩展后的 `PortraitEyeCheckResult`。
3. 工作流把结果合并到 `analysis.eyeDetection`。
4. `computeGrade` 根据 `checkStatus` 和 `scoreImpact` 调整总分。
5. `RightPanel` 根据扩展字段展示检查结论、左右眼状态和复核建议。

## UI 设计

右侧详情面板标题从“人眼检测”改为“人像眼部状态检查”。卡片内容包括：

- 检查结论：正常、疑似单眼闭合、疑似闭眼、未检测到清晰人脸、需人工复核。
- 主脸置信度：以百分比展示。
- 左眼状态：睁开、闭合、未知。
- 右眼状态：睁开、闭合、未知。
- 风险提示：展示 `summary` 和 `suggestion`。

颜色规则：

- `none` 使用绿色。
- `warning` 使用黄色。
- `critical` 使用红色。

当没有检测结果但场景支持眼部状态检查时，显示“尚未执行眼部状态检查”。

## 评分规则

眼部状态只作为人像/扫街中的辅助风险信号，不直接替代基础画质评分。

- `normal`：小幅加分，建议 `+6`。
- `one_eye_closed`：轻度扣分，建议 `-8`。
- `closed_eye`：明显扣分，建议 `-15`。
- `low_confidence`：不扣或轻微扣分，建议 `0` 到 `-3`。
- `no_clear_face`：不直接判坏片，建议 `0`。
- `timeout`：不直接判坏片，建议 `0`。
- `unknown`：不直接判坏片，建议 `0`。

最终分数仍限制在 `0` 到 `100`。

## 错误处理

- 模型加载失败：返回 `unknown`，`reviewRequired: true`。
- 图片加载失败：返回 `unknown`，提示无法读取检测图。
- Tiny 检测失败：自动使用 SSD 兜底。
- SSD 仍失败：返回 `no_clear_face` 或 `timeout`。
- landmark 失败：返回 `unknown`，建议人工复核。

## 测试验证

- 类型检查：运行 `npm run typecheck`。
- 人像场景：使用清晰睁眼人像、闭眼人像、侧脸人像验证状态显示。
- 扫街场景：使用有人物和无人脸街拍验证是否启用检查且不误判坏片。
- 回归验证：非人像、非扫街场景不显示眼部状态检查。
- 评分验证：确认闭眼扣分、正常加分、未知不重扣。

## 后续扩展

- 使用 `detectAllFaces` 支持多人合照。
- 在预览图上绘制人脸框和眼睛关键点。
- 添加左侧筛选项：疑似闭眼、需复核、未检测到清晰人脸。
- 清理临时调试日志逻辑，改为开发环境开关。

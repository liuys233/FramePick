# FramePick 摄影选片助手

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/Electron-41-green" alt="Electron">
  <img src="https://img.shields.io/badge/React-19-blue" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-6.0-blue" alt="TypeScript">
</p>

一个基于 AI 的摄影师智能挑图工具，帮助摄影师从大量照片中快速筛选出优质作品。

## ✨ 功能特性

### 🤖 智能分级
- 自动分析照片的 **5 个维度**（曝光、清晰度、色彩、人像、独特性）
- 根据评分自动将照片分为：**精选** / **备选** / **不推荐**
- 支持手动调整分级结果
- **人眼检测**：自动识别睁眼/闭眼状态（人像场景）

### 🎯 场景识别
支持四种摄影场景，每种场景有不同的评分权重：

| 场景 | 曝光 | 清晰度 | 色彩 | 人像 | 独特性 |
|------|------|--------|------|------|--------|
| 👤 人像 | 15% | 10% | 20% | **45%** | 10% |
| 🏙️ 街拍 | 25% | 15% | 30% | 10% | 20% |
| 🌄 风光 | 30% | 25% | 20% | 5% | 20% |
| 🏺 静物 | 20% | 25% | **35%** | 5% | 15% |

### 📷 照片管理
- 支持导入整个文件夹或选择多个文件
- 支持图片格式：JPG、PNG、GIF、BMP、WebP、TIFF、TIF
- 自动生成缩略图缓存，提升加载速度
- 支持键盘快捷键浏览

### 📤 导出功能
- 按原文件格式或指定格式导出
- 按分级自动整理到不同文件夹（精选/备选/不推荐）
- 支持自定义命名规则（原始名称/编号/评分前缀）
- 生成 CSV 评分报告

### ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| 1 | 标记为精选 |
| 2 | 标记为备选 |
| 3 | 标记为不推荐 |
| ← | 切换上一张 |
| → | 切换下一张 |
| G | 批量分级 |
| Esc | 关闭弹窗 |

## 🚀 快速开始

### 一键启动（推荐）

**Windows 用户**：直接双击项目根目录下的 `start.bat` 文件即可启动应用。

**PowerShell 用户**：运行 `start.ps1`
```powershell
.\start.ps1
```

脚本会自动：
1. 检测并安装依赖（首次运行）
2. 启动 React 开发服务器
3. 启动 Electron 桌面应用

### 命令行启动

```bash
# 安装依赖
npm install

# 启动开发模式
npm run dev
```

### 构建生产版本

```bash
npm run build
```

构建完成后，可执行文件位于 `dist` 目录下。

## 🏗️ 项目结构

```
FramePick/
├── electron/                     # Electron 主进程
│   ├── main.js                  # 入口、窗口管理、文件操作、IPC
│   ├── preload.js               # 暴露 API 给前端
│   └── services/
│       └── image-analyzer.js    # 图像分析服务
│
├── src/                         # React 前端
│   ├── components/              # 13 个 UI 组件
│   │   ├── MainContent.tsx      # 主内容区
│   │   ├── LeftSidebar.tsx      # 左侧筛选栏
│   │   ├── RightPanel.tsx       # 右侧详情面板
│   │   ├── TopNav.tsx           # 顶部导航
│   │   ├── ImportDialog.tsx     # 导入对话框
│   │   ├── ExportDialog.tsx     # 导出对话框
│   │   ├── PreviewModal.tsx     # 预览弹窗
│   │   ├── RulesDialog.tsx      # 规则设置
│   │   ├── StepGuide.tsx        # 步骤引导
│   │   ├── KeyboardHint.tsx     # 快捷键提示
│   │   └── StatusBar.tsx        # 状态栏
│   │
│   ├── hooks/                   # 4 个自定义 Hooks
│   │   ├── useWorkflow.ts       # 核心工作流
│   │   ├── useThumbnails.ts     # 缩略图管理
│   │   ├── useKeyboard.ts       # 键盘事件
│   │   └── useToast.ts          # 提示消息
│   │
│   ├── services/
│   │   └── eyeDetector.ts       # 人眼检测服务
│   │
│   ├── contexts/
│   │   └── WizardContext.tsx    # 流程状态管理
│   │
│   ├── config/
│   │   └── scenes.json          # 场景配置
│   │
│   ├── types.ts                 # 类型定义
│   ├── scoring.ts               # 评分算法
│   ├── theme.ts                 # 主题配置
│   ├── styles.css               # 全局样式
│   └── App.tsx                  # 主应用组件
│
├── start.bat                    # Windows 启动脚本
├── start.ps1                    # PowerShell 启动脚本
├── package.json
├── vite.config.js
├── tsconfig.json
└── README.md
```

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 41 |
| 前端框架 | React 19 |
| 语言 | TypeScript 6.0 |
| UI 组件库 | Ant Design 6 |
| 图像处理 | Sharp |
| 构建工具 | Vite 8 |
| 人脸检测 | face-api.js |

## 📊 评分维度说明

系统会根据选定的场景类型，综合以下五个维度进行评分：

| 维度 | 检测方法 | 权重范围 |
|------|---------|---------|
| 曝光 | 直方图分析 + 高斯曲线 + 对比度检测 | 15%-30% |
| 清晰度 | Laplacian 方差算法 | 10%-25% |
| 色彩 | 饱和度 + 色彩多样性检测 | 15%-35% |
| 人像 | 4种肤色检测 + 人脸区域 | 5%-45% |
| 独特性 | pHash 相似度计算 | 10%-20% |

**人眼检测**（人像场景）：
- 闭眼：总分 -15 分
- 双眼睁开：+10 分
- 单眼睁开：+5 分

## ❓ 常见问题

### Q: 支持哪些图片格式？
A: 支持 JPG、JPEG、PNG、GIF、BMP、WebP、TIFF、TIF 等常见图片格式。

### Q: 缩略图缓存位置在哪里？
A: 缩略图会缓存到系统临时目录的 `photo-selector-thumbs` 文件夹中。

### Q: 如何导出分级结果？
A: 点击顶部「导出」按钮，可选择「复制文件」或「按分级导出到文件夹」，并可自定义命名规则。

### Q: 人眼检测需要联网吗？
A: 首次使用需要联网下载 AI 模型（约 3MB），之后会缓存到本地。

## 📄 许可证

ISC License

---

<p align="center">Made with ❤️ for photographers</p>
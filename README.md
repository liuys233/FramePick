# FramePick 摄影选片助手

一个基于 AI 的摄影师智能挑图工具，帮助摄影师从大量照片中快速筛选出优质作品。

## 功能特性

### 智能分级
- 自动分析照片的多个维度（曝光、清晰度、色彩、人像眼神、独特性）
- 根据评分自动将照片分为：精选、备选、不推荐
- 支持手动调整分级结果

### 场景识别
支持四种摄影场景，每种场景有不同的评分权重：
- 👤 人像 - 侧重人像眼神和曝光
- 🏙️ 街拍 - 侧重色彩和曝光
- 🌄 风光 - 侧重曝光和清晰度
- 🏺 静物 - 侧重色彩和清晰度

### 照片管理
- 支持导入整个文件夹或选择多个文件
- 支持多种图片格式：JPG、PNG、GIF、BMP、WebP、TIFF、RAW（CR2/NEF/ARW/DNG 等）
- 自动生成缩略图缓存

### 导出功能
- 按原文件格式或指定格式导出
- 按分级自动整理到不同文件夹
- 支持自定义命名规则
- 生成 CSV 评分报告

### 用户友好
- 键盘快捷键支持
- 新手引导流程
- 实时进度显示

## 技术栈

- **前端框架**: React 19 + TypeScript
- **UI 组件库**: Ant Design 6
- **桌面框架**: Electron 41
- **图像处理**: Sharp
- **构建工具**: Vite

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

同时启动 React 开发服务器和 Electron 应用。

### 构建生产版本

```bash
npm run build
```

## 项目结构

```
FramePick/
├── electron/              # Electron 主进程
│   ├── main.js           # 主进程入口
│   ├── preload.js        # 预加载脚本
│   └── services/         # 服务模块
│       └── image-analyzer.js
├── src/                  # React 前端源码
│   ├── components/       # React 组件
│   ├── contexts/         # React Context
│   ├── hooks/            # 自定义 Hooks
│   ├── App.tsx           # 主应用组件
│   ├── scoring.ts        # 评分逻辑
│   └── types.ts          # 类型定义
├── package.json
└── vite.config.js
```

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| 1 | 标记为精选 |
| 2 | 标记为备选 |
| 3 | 标记为不推荐 |
| ← → | 切换上一张/下一张 |
| G | 批量分级 |

## 许可证

ISC
import { useState } from 'react'

export default function KeyboardHint() {
  const [visible, setVisible] = useState(false)

  if (!visible) {
    return (
      <button
        className="keyboard-hint-toggle"
        onClick={() => setVisible(true)}
        title="显示快捷键"
      >
        ?
      </button>
    )
  }

  return (
    <div className="keyboard-hint-overlay" onClick={() => setVisible(false)}>
      <div className="keyboard-hint-panel" onClick={e => e.stopPropagation()}>
        <h3>快捷键</h3>
        <div className="keyboard-hint-list">
          <div className="keyboard-hint-item">
            <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd>
            <span>浏览照片</span>
          </div>
          <div className="keyboard-hint-item">
            <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>
            <span>快速分级（精选/备选/不推荐）</span>
          </div>
          <div className="keyboard-hint-item">
            <kbd>G</kbd>
            <span>开始 AI 分级</span>
          </div>
          <div className="keyboard-hint-item">
            <kbd>E</kbd>
            <span>导出选中照片</span>
          </div>
          <div className="keyboard-hint-item">
            <kbd>Enter</kbd>
            <span>预览大图</span>
          </div>
          <div className="keyboard-hint-item">
            <kbd>Esc</kbd>
            <span>关闭弹窗</span>
          </div>
        </div>
        <button className="keyboard-hint-close" onClick={() => setVisible(false)}>
          关闭
        </button>
      </div>
    </div>
  )
}
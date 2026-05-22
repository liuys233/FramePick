import { useState, useEffect } from 'react'
import { Modal, Button, Space, Typography, Slider, InputNumber, Input, Divider } from 'antd'
import { SCENES, DEFAULT_GRADES, GRADE_COLORS } from '../scoring'
import type { GradeRule, CustomRules } from '../types'

const { Text } = Typography

interface RulesDialogProps {
  onClose: () => void
  currentRules: CustomRules | null
  onSave: (rules: CustomRules) => void
}

export default function RulesDialog({ onClose, currentRules, onSave }: RulesDialogProps) {
  const [grades, setGrades] = useState<GradeRule[]>(
    currentRules?.grades?.map(g => ({ ...g })) || DEFAULT_GRADES.map(g => ({ ...g }))
  )
  const defaultSceneWeights = SCENES.portrait.weights
  const [weights, setWeights] = useState({
    exposure: currentRules?.weights?.exposure ?? defaultSceneWeights.exposure,
    similarity: currentRules?.weights?.similarity ?? defaultSceneWeights.similarity,
    eye: currentRules?.weights?.eye ?? defaultSceneWeights.eye,
    sharpness: currentRules?.weights?.sharpness ?? defaultSceneWeights.sharpness,
    color: currentRules?.weights?.color ?? defaultSceneWeights.color,
  })
  const [selectedScene, setSelectedScene] = useState('portrait')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleGradeChange = (index: number, field: keyof GradeRule, value: string | number) => {
    setGrades(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g))
  }

  const applySceneWeights = (sceneId: string) => {
    setSelectedScene(sceneId)
    const scene = SCENES[sceneId]
    if (scene) {
      setWeights({
        exposure: scene.weights.exposure,
        similarity: scene.weights.similarity,
        eye: scene.weights.eye,
        sharpness: scene.weights.sharpness,
        color: scene.weights.color,
      })
    }
  }

  const resetToDefault = () => {
    setGrades(DEFAULT_GRADES.map(g => ({ ...g })))
    setWeights({ exposure: 0.33, similarity: 0.33, eye: 0.34, sharpness: 0.15, color: 0.30 })
  }

  const handleSave = () => {
    onSave({ grades, weights })
    onClose()
  }

  return (
    <Modal
      title="自定义分级规则"
      open={true}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button danger onClick={resetToDefault}>恢复默认</Button>
          <Button type="primary" onClick={handleSave}>保存规则</Button>
        </Space>
      }
      width={600}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>快速应用场景权重</Text>
          <Space wrap>
            {(Object.entries(SCENES) as [string, { icon: string; label: string }][]).map(([id, scene]) => (
              <Button
                key={id}
                size="small"
                type={selectedScene === id ? 'primary' : 'default'}
                onClick={() => applySceneWeights(id)}
              >
                {scene.icon} {scene.label}
              </Button>
            ))}
            <Button size="small" onClick={resetToDefault}>重置默认</Button>
          </Space>
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>检测权重</Text>
          {[
            { key: 'exposure', label: '曝光检测' },
            { key: 'sharpness', label: '清晰度' },
            { key: 'color', label: '色彩' },
            { key: 'similarity', label: '相似度' },
            { key: 'eye', label: '人眼检测' },
          ].map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text type="secondary" style={{ width: 70, fontSize: 12 }}>{label}</Text>
              <Slider
                min={0}
                max={100}
                value={Math.round(weights[key as keyof typeof weights] * 100)}
                onChange={v => setWeights(prev => ({ ...prev, [key]: v / 100 }))}
                style={{ flex: 1, margin: 0 }}
              />
              <InputNumber
                size="small"
                min={0}
                max={100}
                value={Math.round(weights[key as keyof typeof weights] * 100)}
                onChange={v => setWeights(prev => ({ ...prev, [key]: (v || 0) / 100 }))}
                style={{ width: 60 }}
                suffix="%"
              />
            </div>
          ))}
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>分级区间设置</Text>
          <Space direction="vertical" style={{ width: '100%' }}>
            {grades.map((grade, i) => (
              <div key={grade.key} style={{
                padding: 12,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid #3a3a5c',
                borderRadius: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text strong style={{ color: GRADE_COLORS[grade.key] }}>{grade.name}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Text type="secondary" style={{ width: 70, fontSize: 12 }}>名称</Text>
                  <Input
                    size="small"
                    value={grade.name}
                    onChange={e => handleGradeChange(i, 'name', e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Text type="secondary" style={{ width: 70, fontSize: 12 }}>最低分</Text>
                  <Text type="secondary" style={{ fontSize: 11, width: 50 }}>{grade.minScore} 分</Text>
                  <Slider
                    min={0}
                    max={100}
                    value={grade.minScore}
                    onChange={v => handleGradeChange(i, 'minScore', v)}
                    style={{ flex: 1, margin: 0 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text type="secondary" style={{ width: 70, fontSize: 12 }}>最高分</Text>
                  <Text type="secondary" style={{ fontSize: 11, width: 50 }}>{grade.maxScore} 分</Text>
                  <Slider
                    min={0}
                    max={100}
                    value={grade.maxScore}
                    onChange={v => handleGradeChange(i, 'maxScore', v)}
                    style={{ flex: 1, margin: 0 }}
                  />
                </div>
              </div>
            ))}
          </Space>
        </div>
      </Space>
    </Modal>
  )
}

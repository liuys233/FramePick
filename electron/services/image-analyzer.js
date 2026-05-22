'use strict'

const sharp = require('sharp')

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// ── pHash (perceptual hash, 64-bit) ─────────────────────────────
const _phashCache = new Map()
const PHASH_CACHE_MAX = 5000

async function computePHash(filePath) {
  if (_phashCache.has(filePath)) return _phashCache.get(filePath)

  // Limit cache size to prevent memory leak
  if (_phashCache.size >= PHASH_CACHE_MAX) {
    const firstKey = _phashCache.keys().next().value
    if (firstKey) _phashCache.delete(firstKey)
  }

  const buf = await sharp(filePath)
    .resize(32, 32, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer()

  const pixels = new Uint8Array(buf)

  // Compute DCT coefficients for 8x8 top-left block (perceptual hash)
  const size = 32
  const dct8x8 = new Float64Array(64)
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          sum += pixels[y * size + x] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size))
        }
      }
      dct8x8[v * 8 + u] = sum
    }
  }

  const avg = dct8x8.reduce((s, v) => s + v, 0) / 64

  let hash = 0n
  for (let i = 0; i < 64; i++) {
    if (dct8x8[i] > avg) hash |= (1n << BigInt(i))
  }

  const result = { hash, str: hash.toString(16).padStart(16, '0') }
  _phashCache.set(filePath, result)
  return result
}

function hammingDist(a, b) {
  let x = a ^ b
  let d = 0
  while (x) { d++; x &= x - 1n }
  return d
}

// ── 曝光检测 ────────────────────────────────────────────────────
async function analyzeExposure(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const px = new Uint8Array(data.buffer)
  const ch = info.channels
  const N = info.width * info.height
  const hist = new Uint32Array(256)
  let over = 0
  let under = 0
  let lumSum = 0

  for (let i = 0; i < px.length; i += ch) {
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    const lum = clamp(Math.round(0.299 * r + 0.587 * g + 0.114 * b), 0, 255)
    hist[lum]++
    lumSum += lum
    if (lum > 250) over++
    if (lum < 5) under++
  }

  const avgLum = lumSum / N
  const overPct = (over / N) * 100
  const underPct = (under / N) * 100

  let score = 100
  if (avgLum < 50) score -= (50 - avgLum) * 0.8
  if (avgLum > 200) score -= (avgLum - 200) * 0.6
  score -= overPct * 8
  score -= underPct * 2
  score = clamp(Math.round(score), 0, 100)

  return {
    score,
    avgLuminance: Math.round(avgLum),
    overexposedRatio: +overPct.toFixed(1),
    underexposedRatio: +underPct.toFixed(1),
    histogram: Array.from(hist),
  }
}

// ── 清晰度检测 (Laplacian variance) ─────────────────────────────
async function analyzeSharpness(filePath) {
  const { data, info } = await sharp(filePath)
    .resize(640, undefined, { fit: 'inside', withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const w = info.width
  const h = info.height
  const raw = new Uint8Array(data.buffer)
  const f = new Float64Array(raw.length)
  for (let i = 0; i < raw.length; i++) f[i] = raw[i]

  let sum = 0
  let cnt = 0
  const laps = new Float64Array(w * h)

  for (let y = 1; y < h - 1; y++) {
    const rowPrev = (y - 1) * w
    const rowCurr = y * w
    const rowNext = (y + 1) * w
    for (let x = 1; x < w - 1; x++) {
      const val =
        -f[rowPrev + x - 1] - f[rowPrev + x] - f[rowPrev + x + 1] +
        -f[rowCurr + x - 1] + 8 * f[rowCurr + x] - f[rowCurr + x + 1] +
        -f[rowNext + x - 1] - f[rowNext + x] - f[rowNext + x + 1]
      laps[rowCurr + x] = val
      sum += val
      cnt++
    }
  }

  const mean = sum / cnt
  let variance = 0
  for (let i = 0; i < laps.length; i++) {
    const dv = laps[i] - mean
    variance += dv * dv
  }
  variance /= cnt

  let score
  if (variance < 20) score = 10
  else if (variance < 50) score = 20 + (variance - 20) * 1.5
  else if (variance < 150) score = 65 + (variance - 50) * 0.25
  else if (variance < 300) score = 90 + (variance - 150) * 0.05
  else score = 98
  score = clamp(Math.round(score), 0, 100)

  return { score, laplacianVariance: Math.round(variance * 100) / 100 }
}

// ── 色彩丰富度检测 ──────────────────────────────────────────────
async function analyzeColor(filePath) {
  const { data, info } = await sharp(filePath)
    .resize(320, undefined, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const px = new Uint8Array(data.buffer)
  const ch = info.channels
  const colorSet = new Set()
  let satSum = 0
  let cnt = 0

  for (let i = 0; i < px.length; i += ch) {
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    const maxC = Math.max(r, g, b)
    const minC = Math.min(r, g, b)
    satSum += maxC === 0 ? 0 : (maxC - minC) / maxC
    colorSet.add(`${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`)
    cnt++
  }

  const avgSat = satSum / cnt
  const diversity = colorSet.size / cnt

  let score = 100
  if (avgSat < 0.1) score -= 30
  else if (avgSat < 0.2) score -= 10
  if (diversity < 0.01) score -= 20
  else if (diversity < 0.05) score -= 10
  score = clamp(Math.round(score), 0, 100)

  return {
    score,
    avgSaturation: +(avgSat * 100).toFixed(1),
    colorDiversity: +(diversity * 100).toFixed(1),
  }
}

// ── 人眼/人脸检测 (肤色启发式) ─────────────────────────────────
async function analyzeEye(filePath) {
  try {
    const { data, info } = await sharp(filePath)
      .resize(160, undefined, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const px = new Uint8Array(data.buffer)
    const ch = info.channels
    let skin = 0
    let total = 0

    for (let i = 0; i < px.length; i += ch) {
      const r = px[i]
      const g = px[i + 1]
      const b = px[i + 2]
      if (
        r > 95 && g > 40 && b > 20 &&
        Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
        Math.abs(r - g) > 15 && r > g && r > b
      ) {
        skin++
      }
      total++
    }

    const ratio = skin / total
    // 皮肤占比 > 5% 认为有人像
    const score = ratio > 0.05 ? 75 : 100
    return { score, skinRatio: +(ratio * 100).toFixed(1) }
  } catch {
    return { score: 100, skinRatio: 0 }
  }
}

// ── 相似度分组 (pHash 两两比较) ─────────────────────────────────
async function analyzeSimilarityAll(photos, threshold) {
  threshold = threshold || 10
  const hashes = []
  for (const p of photos) {
    hashes.push(await computePHash(p.path))
  }

  const groups = []
  const visited = new Set()

  for (let i = 0; i < hashes.length; i++) {
    if (visited.has(i)) continue
    const group = [i]
    for (let j = i + 1; j < hashes.length; j++) {
      if (visited.has(j)) continue
      if (hammingDist(hashes[i].hash, hashes[j].hash) <= threshold) {
        group.push(j)
        visited.add(j)
      }
    }
    if (group.length > 1) {
      visited.add(i)
      groups.push(group)
    }
  }

  const scores = new Array(photos.length).fill(100)
  for (const group of groups) {
    for (let k = 1; k < group.length; k++) {
      scores[group[k]] = Math.max(20, 100 - k * 18)
    }
  }

  return { groups, scores }
}

// ── 单张综合检测 ────────────────────────────────────────────────
async function analyzePhoto(filePath) {
  const [exposure, sharpness, color, eye] = await Promise.all([
    analyzeExposure(filePath).catch(() => ({ score: 50 })),
    analyzeSharpness(filePath).catch(() => ({ score: 50 })),
    analyzeColor(filePath).catch(() => ({ score: 50 })),
    analyzeEye(filePath).catch(() => ({ score: 100 })),
  ])
  return { eye, exposure, sharpness, color }
}

// ── 批量检测 ────────────────────────────────────────────────────
async function analyzeBatch(photos, onProgress) {
  const results = []
  for (let i = 0; i < photos.length; i++) {
    try {
      results.push(await analyzePhoto(photos[i].path))
    } catch (err) {
      console.error('分析失败，跳过:', photos[i].path, err.message)
      results.push({ eye: { score: 50 }, exposure: { score: 50 }, sharpness: { score: 50 }, color: { score: 50 } })
    }
    if (onProgress) onProgress({ current: i + 1, total: photos.length })
  }

  const sim = await analyzeSimilarityAll(photos, 10)
  sim.scores.forEach((s, i) => { results[i].similarity = s })

  return { results, similarityGroups: sim.groups }
}

module.exports = {
  analyzePhoto,
  analyzeBatch,
  analyzeExposure,
  analyzeSharpness,
  analyzeColor,
  analyzeEye,
  computePHash,
  hammingDist,
  analyzeSimilarityAll,
}

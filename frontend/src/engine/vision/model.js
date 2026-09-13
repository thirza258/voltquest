/** Small deterministic images and a transparent attention head for teaching vision concepts. */
export const IMAGE_SIZE = 128
export const DEFAULT_VISION = { kind: 'vision', version: 1, theme: 'iot', mode: 'threshold', threshold: 150, edgeLow: 50, edgeHigh: 120, hueMin: 40, hueMax: 90, blur: 0, brightness: 1, offset: 0, noise: 0, occlusion: 0, patchSize: 16, query: 36, temperature: 1, positionWeight: 0.5 }
export const VISION_THEMES = ['iot', 'drone', 'robotics']
export const VISION_MODES = ['threshold', 'color', 'edges', 'attention']
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const finite = (v, low, high) => typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high
export function validateVision(input) {
  if (!input || input.kind !== 'vision' || input.version !== 1 || !VISION_THEMES.includes(input.theme) || !VISION_MODES.includes(input.mode)) throw new Error('Expected a VoltQuest vision project, version 1.')
  const limits = { threshold: [0, 255], edgeLow: [0, 255], edgeHigh: [0, 255], hueMin: [0, 179], hueMax: [0, 179], brightness: [0.2, 1.5], offset: [-40, 40], noise: [0, 40], occlusion: [0, 0.8], temperature: [0.1, 3], positionWeight: [0, 1] }
  if (Object.entries(limits).some(([key, range]) => !finite(input[key], ...range)) || input.edgeLow > input.edgeHigh || input.hueMin > input.hueMax || ![0, 3, 5].includes(input.blur) || ![8, 16, 32].includes(input.patchSize) || !Number.isInteger(input.query) || !finite(input.query, 0, (IMAGE_SIZE / input.patchSize) ** 2 - 1)) throw new Error('Vision settings are outside the supported ranges. Low thresholds must not exceed high thresholds.')
  return Object.fromEntries(Object.keys(DEFAULT_VISION).map(key => [key, input[key]]))
}
export function parseVision(text) {
  if (typeof text !== 'string' || text.length > 8000) throw new Error('Vision settings files must be smaller than 8 KB.')
  let value
  try { value = JSON.parse(text) } catch { throw new Error('The vision project is not valid JSON.') }
  return validateVision(value)
}
/** Synthetic scene with a known target mask; noise is seeded by pixel coordinate, not wall time. */
export function makeScene(input) {
  const config = validateVision(input), width = IMAGE_SIZE, height = IMAGE_SIZE
  const data = new Uint8ClampedArray(width * height * 4), truth = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x, centre = 64 + config.offset
    let rgb = [24, 30, 38], target = false
    if (config.theme === 'iot') {
      if (x > 12 && x < 116 && y > 22 && y < 106) rgb = [30, 70, 55]
      target = Math.hypot(x - centre, y - 64) < 13
      if (target) rgb = [250, 245, 200]
    } else if (config.theme === 'drone') {
      rgb = [70 + Math.floor(y / 8) % 2 * 6, 75, 80]
      target = Math.abs(x - centre) < 22 && Math.abs(y - 64) < 22
      if (target) rgb = [25, 215, 80]
      // The pad is a colour target; an H shape is visual decoration, not a learned class.
      if (target && ((Math.abs(Math.abs(x - centre) - 9) < 2 && Math.abs(y - 64) < 13) || (Math.abs(y - 64) < 2 && Math.abs(x - centre) < 11))) rgb = [225, 245, 230]
    } else {
      rgb = [35, 38, 42]
      target = Math.abs(x - (centre + (64 - y) * 0.15)) < 7
      if (target) rgb = [235, 235, 235]
    }
    if (target) truth[index] = 1
    if (x > centre - 23 && x < centre + 23 && y > 42 && y < 42 + 44 * config.occlusion) rgb = [30, 30, 30]
    const hash = ((Math.imul(index + 1, 1664525) + 1013904223) >>> 0) / 4294967295
    for (let c = 0; c < 3; c++) data[index * 4 + c] = clamp(Math.round(rgb[c] * config.brightness + (hash * 2 - 1) * config.noise), 0, 255)
    data[index * 4 + 3] = 255
  }
  return { width, height, data, truth }
}
export function maskMetrics(mask, width, height, truth = null) {
  let count = 0, sumX = 0, sumY = 0, intersection = 0, union = 0
  for (let i = 0; i < width * height; i++) {
    const on = mask[i] > 0
    if (on) { count++; sumX += i % width; sumY += Math.floor(i / width) }
    if (truth) { if (on && truth[i]) intersection++; if (on || truth[i]) union++ }
  }
  const centroid = count ? { x: sumX / count, y: sumY / count } : null
  return { count, fraction: count / (width * height), centroid, errorX: centroid ? (centroid.x - (width - 1) / 2) / ((width - 1) / 2) : null, iou: truth ? (union ? intersection / union : 1) : null }
}
export function softmax(logits) {
  if (!Array.isArray(logits) || !logits.length || logits.some(v => !Number.isFinite(v))) throw new Error('Attention logits must be a finite nonempty vector.')
  const max = Math.max(...logits), exp = logits.map(v => Math.exp(v - max)), sum = exp.reduce((a, b) => a + b, 0)
  return exp.map(v => v / sum)
}
/** One fixed attention head: patch mean RGB + optional coordinates, identity Q/K, RGB values.
 * Deliberately no trained weights, MLP, class token, classifier or claim of ViT inference. */
export function patchAttention(scene, config) {
  const { patchSize, query, temperature, positionWeight } = validateVision(config)
  const cols = scene.width / patchSize, rows = scene.height / patchSize, tokens = []
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const mean = [0, 0, 0]
    for (let dy = 0; dy < patchSize; dy++) for (let dx = 0; dx < patchSize; dx++) {
      const start = ((row * patchSize + dy) * scene.width + col * patchSize + dx) * 4
      for (let c = 0; c < 3; c++) mean[c] += scene.data[start + c] / (255 * patchSize * patchSize)
    }
    tokens.push({ row, col, mean, embedding: [...mean.map(v => 2 * v), positionWeight * (col + 0.5) / cols, positionWeight * (row + 0.5) / rows] })
  }
  const q = tokens[query].embedding
  const logits = tokens.map(token => token.embedding.reduce((sum, v, i) => sum + q[i] * v, 0) / (Math.sqrt(5) * temperature))
  const weights = softmax(logits), context = [0, 0, 0]
  tokens.forEach((token, index) => token.mean.forEach((v, c) => { context[c] += weights[index] * v }))
  return { tokens, weights, logits, context, query, pairCount: tokens.length ** 2, dimensions: 5 }
}
export function visionDecision(theme, metrics, mode) {
  if (mode === 'attention') return { state: 'Attention is not a detection or control command', topic: null, payload: null }
  if (!metrics.centroid || metrics.count < 16) return { state: 'No target: hold / stop', topic: theme === 'robotics' ? '/cmd_vel' : theme === 'iot' ? 'iot/visual-sensor' : 'drone/vision-offset', payload: theme === 'robotics' ? { linear: { x: 0 }, angular: { z: 0 } } : { detected: false } }
  if (theme === 'iot') return { state: 'Visual event detected', topic: 'iot/visual-sensor', payload: { detected: true, bright_fraction: Number(metrics.fraction.toFixed(4)) } }
  if (theme === 'robotics') return { state: 'Image-based steering preview', topic: '/cmd_vel', payload: { linear: { x: 0.15 }, angular: { z: Number(clamp(-metrics.errorX, -0.8, 0.8).toFixed(3)) } } }
  return { state: 'Landing-marker offset preview', topic: 'drone/vision-offset', payload: { detected: true, normalized_x: Number(metrics.errorX.toFixed(3)), aligned: Math.abs(metrics.errorX) < 0.1 } }
}

/** Small deterministic images and a transparent attention head for teaching vision concepts. */
export const IMAGE_SIZE = 128
/**
 * Settings added for the classical OpenCV courses (morphology to template matching). Version-1 files
 * written before they existed load with these defaults, so saved settings and exports keep working.
 */
export const VISION_V1_ADDITIONS = { contrast: 1, speckle: 0, tilt: 0, scale: 1, morphOp: 'open', kernel: 3, iterations: 1, minArea: 50, epsilon: 0.04, equalize: 'none', clipLimit: 2, houghShape: 'lines', houghThreshold: 30, minLineLength: 20, maxLineGap: 5, minRadius: 6, maxRadius: 30, matchThreshold: 0.6 }
export const DEFAULT_VISION = { kind: 'vision', version: 1, theme: 'iot', mode: 'threshold', threshold: 150, edgeLow: 50, edgeHigh: 120, hueMin: 40, hueMax: 90, blur: 0, brightness: 1, offset: 0, noise: 0, occlusion: 0, patchSize: 16, query: 36, temperature: 1, positionWeight: 0.5, ...VISION_V1_ADDITIONS }
export const VISION_THEMES = ['iot', 'drone', 'robotics', 'shapes', 'lanes', 'document']
export const VISION_MODES = ['threshold', 'color', 'edges', 'morphology', 'contours', 'histogram', 'perspective', 'hough', 'template', 'attention']
export const MORPH_OPS = ['open', 'close', 'erode', 'dilate']
export const EQUALIZERS = ['none', 'global', 'clahe']
export const HOUGH_SHAPES = ['lines', 'circles']
/** Which device a theme's observation drives: new themes reuse the three existing adapters. */
export const THEME_DEVICES = { iot: 'iot', drone: 'drone', robotics: 'robotics', shapes: 'iot', lanes: 'robotics', document: 'iot' }
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const finite = (v, low, high) => typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high
export function validateVision(raw) {
  if (!raw || raw.kind !== 'vision' || raw.version !== 1 || !VISION_THEMES.includes(raw.theme) || !VISION_MODES.includes(raw.mode)) throw new Error('Expected a VoltQuest vision project, version 1.')
  // Only the later additions may be missing; every original version-1 key is still required.
  const input = { ...VISION_V1_ADDITIONS, ...Object.fromEntries(Object.entries(raw).filter(([key, value]) => key in VISION_V1_ADDITIONS ? value !== undefined : true)) }
  const limits = { threshold: [0, 255], edgeLow: [0, 255], edgeHigh: [0, 255], hueMin: [0, 179], hueMax: [0, 179], brightness: [0.2, 1.5], offset: [-40, 40], noise: [0, 40], occlusion: [0, 0.8], temperature: [0.1, 3], positionWeight: [0, 1],
    contrast: [0.2, 1], speckle: [0, 0.2], tilt: [0, 0.6], scale: [0.6, 1.4], minArea: [0, 4000], epsilon: [0.01, 0.1], clipLimit: [1, 4], minLineLength: [5, 80], maxLineGap: [1, 20], minRadius: [3, 40], maxRadius: [5, 60], matchThreshold: [0.2, 0.99] }
  const integers = { iterations: [1, 3], houghThreshold: [5, 100] }
  if (Object.entries(limits).some(([key, range]) => !finite(input[key], ...range)) || Object.entries(integers).some(([key, range]) => !Number.isInteger(input[key]) || !finite(input[key], ...range))
    || input.edgeLow > input.edgeHigh || input.hueMin > input.hueMax || input.minRadius >= input.maxRadius || ![0, 3, 5].includes(input.blur) || ![8, 16, 32].includes(input.patchSize) || ![3, 5, 7].includes(input.kernel)
    || !MORPH_OPS.includes(input.morphOp) || !EQUALIZERS.includes(input.equalize) || !HOUGH_SHAPES.includes(input.houghShape)
    || !Number.isInteger(input.query) || !finite(input.query, 0, (IMAGE_SIZE / input.patchSize) ** 2 - 1)) throw new Error('Vision settings are outside the supported ranges. Low thresholds must not exceed high thresholds.')
  return Object.fromEntries(Object.keys(DEFAULT_VISION).map(key => [key, input[key]]))
}
export function parseVision(text) {
  if (typeof text !== 'string' || text.length > 8000) throw new Error('Vision settings files must be smaller than 8 KB.')
  let value
  try { value = JSON.parse(text) } catch { throw new Error('The vision project is not valid JSON.') }
  return validateVision(value)
}
/** lowbias32 integer hash: deterministic, and without the visible patterns of a linear congruence. */
function mix32(value) {
  let n = value >>> 0
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d)
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b)
  return (n ^ (n >>> 16)) >>> 0
}
/** Convex quadrilateral containment (corners in order); used for the perspective card. */
function insideQuad(x, y, quad) {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = quad[i], [bx, by] = quad[(i + 1) % 4], cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
    if (cross !== 0) { if (sign && Math.sign(cross) !== sign) return false; sign = Math.sign(cross) }
  }
  return true
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
/** A point on the card at (u, v) in [0, 1]², interpolated between its four corners. */
const onCard = (quad, u, v) => lerp(lerp(quad[0], quad[1], u), lerp(quad[3], quad[2], u), v)
/** Corners (TL, TR, BR, BL) of the document card: tilt narrows the far (top) edge like a camera pitch. */
export function cardCorners(config) {
  const shift = config.offset * 0.5, squeeze = 20 * config.tilt, drop = 8 * config.tilt
  return [[34 + squeeze + shift, 30 + drop], [94 - squeeze + shift, 30 + drop], [98 + shift, 98], [30 + shift, 98]]
}
/** Lane centre lines run from the bottom edge to the horizon at y = 40; offset moves both lanes. */
export function laneX(y, side, offset) {
  const t = (127 - y) / 87
  return side === 'left' ? 24 + offset * 0.5 + 32 * t : 104 + offset * 0.5 - 32 * t
}
/** Synthetic scene with a known target mask; noise is seeded by pixel coordinate, not wall time. */
export function makeScene(input) {
  const config = validateVision(input), width = IMAGE_SIZE, height = IMAGE_SIZE
  const data = new Uint8ClampedArray(width * height * 4), truth = new Uint8Array(width * height)
  const card = config.theme === 'document' ? cardCorners(config) : null
  const marker = card ? [onCard(card, 0.32, 0.32), onCard(card, 0.68, 0.32), onCard(card, 0.68, 0.68), onCard(card, 0.32, 0.68)] : null
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x, centre = 64 + config.offset
    let rgb = [24, 30, 38], target = false
    if (config.theme === 'shapes') {
      // A circle, a square and a triangle; the offset moves all three by half as much.
      const sx = config.offset * 0.5
      const circle = Math.hypot(x - (32 + sx), y - 36) <= 12
      const square = Math.abs(x - (96 + sx)) <= 12 && Math.abs(y - 36) <= 12
      const triangle = y >= 76 && y <= 112 && Math.abs(x - (64 + sx)) <= (y - 76) * 20 / 36
      target = circle || square || triangle
      rgb = target ? [235, 230, 210] : [28, 32, 40]
    } else if (config.theme === 'lanes') {
      rgb = [58 + (Math.floor(x / 6) + Math.floor(y / 6)) % 2 * 4, 60, 64]
      target = y >= 40 && (Math.abs(x - laneX(y, 'left', config.offset)) < 2.5 || Math.abs(x - laneX(y, 'right', config.offset)) < 2.5)
      if (target) rgb = [240, 240, 235]
    } else if (config.theme === 'document') {
      rgb = [96, 70, 52]
      target = insideQuad(x, y, card)
      if (target) rgb = insideQuad(x, y, marker) ? [22, 22, 26] : [236, 236, 230]
    } else if (config.theme === 'iot') {
      if (x > 12 && x < 116 && y > 22 && y < 106) rgb = [30, 70, 55]
      target = Math.hypot(x - centre, y - 64) < 13
      if (target) rgb = [250, 245, 200]
    } else if (config.theme === 'drone') {
      const s = config.scale
      rgb = [70 + Math.floor(y / 8) % 2 * 6, 75, 80]
      target = Math.abs(x - centre) < 22 * s && Math.abs(y - 64) < 22 * s
      if (target) rgb = [25, 215, 80]
      // The pad is a colour target; an H shape is visual decoration, not a learned class.
      if (target && ((Math.abs(Math.abs(x - centre) - 9 * s) < 2 * s && Math.abs(y - 64) < 13 * s) || (Math.abs(y - 64) < 2 * s && Math.abs(x - centre) < 11 * s))) rgb = [225, 245, 230]
    } else {
      rgb = [35, 38, 42]
      target = Math.abs(x - (centre + (64 - y) * 0.15)) < 7
      if (target) rgb = [235, 235, 235]
    }
    if (target) truth[index] = 1
    if (x > centre - 23 && x < centre + 23 && y > 42 && y < 42 + 44 * config.occlusion) rgb = [30, 30, 30]
    const hash = ((Math.imul(index + 1, 1664525) + 1013904223) >>> 0) / 4294967295
    // Contrast squeezes intensities toward mid-grey; at 1 the original scene is unchanged.
    for (let c = 0; c < 3; c++) data[index * 4 + c] = clamp(Math.round((rgb[c] * config.brightness - 128) * config.contrast + 128 + (hash * 2 - 1) * config.noise), 0, 255)
    if (config.speckle) {
      // Salt-and-pepper specks from a well-mixed coordinate hash (a linear one draws stripes); the target truth is unchanged.
      const speck = mix32(index + 0x9e3779b9) / 4294967296
      if (speck < config.speckle / 2) data.fill(255, index * 4, index * 4 + 3)
      else if (speck < config.speckle) data.fill(0, index * 4, index * 4 + 3)
    }
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
export function visionDecision(scene, metrics, mode) {
  const theme = THEME_DEVICES[scene] ?? scene
  if (mode === 'attention') return { state: 'Attention is not a detection or control command', topic: null, payload: null }
  if (!metrics.centroid || metrics.count < 16) return { state: 'No target: hold / stop', topic: theme === 'robotics' ? '/cmd_vel' : theme === 'iot' ? 'iot/visual-sensor' : 'drone/vision-offset', payload: theme === 'robotics' ? { linear: { x: 0 }, angular: { z: 0 } } : { detected: false } }
  if (theme === 'iot') return { state: 'Visual event detected', topic: 'iot/visual-sensor', payload: { detected: true, bright_fraction: Number(metrics.fraction.toFixed(4)) } }
  if (theme === 'robotics') return { state: 'Image-based steering preview', topic: '/cmd_vel', payload: { linear: { x: 0.15 }, angular: { z: Number(clamp(-metrics.errorX, -0.8, 0.8).toFixed(3)) } } }
  return { state: 'Landing-marker offset preview', topic: 'drone/vision-offset', payload: { detected: true, normalized_x: Number(metrics.errorX.toFixed(3)), aligned: Math.abs(metrics.errorX) < 0.1 } }
}

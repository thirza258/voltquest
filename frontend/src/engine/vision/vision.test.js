import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const cv = createRequire(import.meta.url)('@techstark/opencv-js')
import { DEFAULT_VISION, VISION_V1_ADDITIONS, cardCorners, makeScene, validateVision, parseVision, maskMetrics, patchAttention, softmax, visionDecision } from './model.js'
import { classifyShape, orderCorners, processOpenCv } from './opencv.js'

beforeAll(async () => { if (!cv.Mat) await new Promise(resolve => { cv.onRuntimeInitialized = resolve }) })
const config = patch => ({ ...DEFAULT_VISION, ...patch })
describe('actual OpenCV and vision mathematics', () => {
  it('runs the pinned local OpenCV 4.12 engine, thresholds a real mask and matches target truth', () => {
    expect(cv.getBuildInformation()).toContain('OpenCV 4.12.0')
    const scene = makeScene(DEFAULT_VISION), result = processOpenCv(cv, scene, DEFAULT_VISION)
    expect(result.metrics.count).toBeGreaterThan(500); expect(result.metrics.count).toBeLessThan(540)
    expect(result.metrics.centroid).toEqual({ x: 64, y: 64 }); expect(result.metrics.iou).toBe(1)
    expect(result.data.length).toBe(128 * 128 * 4)
  })
  it('loses the target under darkness and recovers it with an appropriate threshold', () => {
    const dark = config({ brightness: 0.4 }), scene = makeScene(dark)
    const lost = processOpenCv(cv, scene, dark); expect(lost.metrics.count).toBe(0); expect(lost.metrics.centroid).toBeNull()
    expect(visionDecision('iot', lost.metrics, 'threshold').payload).toEqual({ detected: false })
    expect(processOpenCv(cv, scene, { ...dark, threshold: 70 }).metrics.iou).toBe(1)
  })
  it('uses OpenCV HSV ranges and reports the expected sign for moved drone markers', () => {
    const c = config({ theme: 'drone', mode: 'color', offset: 25 }), scene = makeScene(c)
    const result = processOpenCv(cv, scene, c)
    expect(result.metrics.centroid.x).toBe(89); expect(result.metrics.errorX).toBeCloseTo((89 - 63.5) / 63.5)
    expect(result.metrics.iou).toBeGreaterThan(0.8)
    expect(processOpenCv(cv, scene, { ...c, hueMin: 0, hueMax: 0 }).metrics.count).toBe(0)
  })
  it('runs Canny boundaries with Gaussian blur and gives robot steering with the correct sign', () => {
    const c = config({ theme: 'robotics', mode: 'edges', blur: 5, offset: 25 }), result = processOpenCv(cv, makeScene(c), c)
    expect(result.metrics.count).toBeGreaterThan(200); expect(result.metrics.count).toBeLessThan(450)
    expect(result.metrics.iou).toBeNull(); expect(result.metrics.errorX).toBeGreaterThan(0)
    expect(visionDecision('robotics', result.metrics, 'edges').payload.angular.z).toBeLessThan(0)
  })
  it('computes centroid and IoU from independent tiny masks, including empty masks', () => {
    const m = maskMetrics([255, 0, 0, 255], 2, 2, [1, 1, 0, 1])
    expect(m).toEqual({ count: 2, fraction: 0.5, centroid: { x: 0.5, y: 0.5 }, errorX: 0, iou: 2 / 3 })
    expect(maskMetrics([0, 0], 2, 1).centroid).toBeNull()
  })
  it('keeps softmax stable for large logits and computes normalized attention/context', () => {
    expect(softmax([10000, 10000])).toEqual([0.5, 0.5]); expect(() => softmax([NaN])).toThrow()
    const c = config({ mode: 'attention' }), a = patchAttention(makeScene(c), c)
    expect(a.tokens).toHaveLength(64); expect(a.pairCount).toBe(4096); expect(a.weights.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12)
    expect(a.context.every(v => v >= 0 && v <= 1)).toBe(true)
    const b = patchAttention(makeScene(c), { ...c, patchSize: 8 }); expect(b.tokens).toHaveLength(256); expect(b.pairCount / a.pairCount).toBe(16)
    expect(patchAttention(makeScene(c), { ...c, query: 0 }).weights).not.toEqual(a.weights)
    expect(visionDecision('drone', {}, 'attention').payload).toBeNull()
  })
  it('is deterministic across noisy scenes and releases native Mat allocations after failure', () => {
    const c = config({ noise: 40, brightness: 0.7, occlusion: 0.4 }), a = makeScene(c)
    expect(a).toEqual(makeScene(c))
    const live = new Set(), broken = { ...cv, Mat: class { constructor(...args) { const value = new cv.Mat(...args), remove = value.delete.bind(value); live.add(value); value.delete = () => { live.delete(value); remove() }; return value } }, threshold() { throw new Error('forced native operation failure') } }
    expect(() => processOpenCv(broken, a, c)).toThrow('forced native'); expect(live.size).toBe(0)
    for (let i = 0; i < 10; i++) expect(processOpenCv(cv, a, c).metrics.count).toBeGreaterThanOrEqual(0)
  })
  it('validates imported settings atomically and bounds patch queries and native allocations', () => {
    expect(parseVision(JSON.stringify(DEFAULT_VISION))).toEqual(DEFAULT_VISION)
    for (const bad of [null, config({ version: 2 }), config({ query: 64 }), config({ patchSize: 1 }), config({ edgeLow: 200, edgeHigh: 100 }), config({ brightness: Infinity }), config({ hueMin: -1 }), config({ offset: '20' })]) expect(() => validateVision(bad)).toThrow()
    expect(() => parseVision(' '.repeat(8001))).toThrow(); expect(() => parseVision('{bad')).toThrow()
  })
})

describe('classical OpenCV course pipelines', () => {
  const run = patch => { const c = config(patch); return processOpenCv(cv, makeScene(c), c) }
  it('loads version-1 settings saved before the new keys existed and rejects bad new values', () => {
    const old = Object.fromEntries(Object.entries(DEFAULT_VISION).filter(([key]) => !(key in VISION_V1_ADDITIONS)))
    expect(validateVision(old)).toEqual(DEFAULT_VISION)
    expect(parseVision(JSON.stringify({ ...old, theme: 'drone' })).theme).toBe('drone')
    for (const bad of [config({ kernel: 4 }), config({ morphOp: 'blur' }), config({ iterations: 1.5 }), config({ minRadius: 30, maxRadius: 30 }), config({ equalize: 'auto' }), config({ houghShape: 'ellipse' }), config({ matchThreshold: 1 }), config({ theme: 'camera' }), config({ mode: 'sift' })]) expect(() => validateVision(bad)).toThrow()
    expect(() => validateVision({ ...old, threshold: undefined })).toThrow()
  })
  it('opens away salt-and-pepper specks that a plain threshold keeps', () => {
    const noisy = run({ speckle: 0.08 })
    expect(noisy.metrics.iou).toBeLessThan(0.5)
    const opened = run({ mode: 'morphology', speckle: 0.08, morphOp: 'open', kernel: 3 })
    expect(opened.details.before.components).toBeGreaterThan(500); expect(opened.details.after.components).toBe(1)
    expect(opened.metrics.iou).toBeGreaterThan(0.85)
    expect(run({ mode: 'morphology', speckle: 0.08, morphOp: 'dilate' }).metrics.count).toBeGreaterThan(noisy.metrics.count)
    expect(run({ mode: 'morphology', speckle: 0.08, morphOp: 'erode' }).metrics.count).toBeLessThan(opened.metrics.count)
  })
  it('measures and labels contours, and needs a minimum area once specks appear', () => {
    const clean = run({ theme: 'shapes', mode: 'contours', threshold: 128 })
    expect(clean.details.shapes.map(shape => shape.label)).toEqual(['circle', 'triangle', 'square'])
    expect(clean.details.shapes.map(shape => shape.vertices)).toEqual([4, 3, 4])
    expect(clean.metrics.iou).toBe(1)
    expect(run({ theme: 'shapes', mode: 'contours', threshold: 128, speckle: 0.05, minArea: 0 }).details.shapes.length).toBeGreaterThan(100)
    expect(run({ theme: 'shapes', mode: 'contours', threshold: 128, speckle: 0.05, minArea: 50 }).details.shapes).toHaveLength(3)
    expect(classifyShape(12, 0.9, 1)).toBe('circle'); expect(classifyShape(4, 0.78, 2)).toBe('rectangle'); expect(classifyShape(6, 0.7, 1)).toBe('polygon')
  })
  it('lets Otsu recover a low-contrast lamp that a fixed threshold misses, and shows equalization stretching', () => {
    const dim = { contrast: 0.4, brightness: 0.7 }
    expect(run(dim).metrics.count).toBe(0)
    const otsu = run({ ...dim, mode: 'histogram' })
    expect(otsu.details.otsu).toBe(92); expect(otsu.metrics.iou).toBe(1)
    expect(otsu.details.before.histogram.reduce((a, b) => a + b, 0)).toBe(128 * 128)
    const global = run({ ...dim, mode: 'histogram', equalize: 'global' })
    expect(global.details.after.spread).toBeGreaterThan(100); expect(global.details.before.spread).toBeLessThan(11)
    expect(global.details.otsu).toBe(0); expect(global.metrics.iou).toBeLessThan(0.1)
    expect(run({ ...dim, mode: 'histogram', equalize: 'clahe' }).metrics.iou).toBe(1)
  })
  it('finds the tilted card corners in order and rectifies it onto the full frame', () => {
    const tilted = run({ theme: 'document', mode: 'perspective', tilt: 0.4 })
    expect(tilted.details.found).toBe(true)
    expect(tilted.details.corners).toEqual([{ x: 42, y: 34 }, { x: 86, y: 34 }, { x: 98, y: 98 }, { x: 30, y: 98 }])
    expect(tilted.metrics.iou).toBe(1); expect(tilted.data.length).toBe(128 * 128 * 4)
    expect(cardCorners(config({ tilt: 0.4 }))[0][0]).toBeCloseTo(42)
    expect(run({ theme: 'document', mode: 'perspective', threshold: 240 }).details.found).toBe(false)
    expect(orderCorners([{ x: 9, y: 9 }, { x: 0, y: 0 }, { x: 0, y: 9 }, { x: 9, y: 0 }])).toEqual([{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 9 }, { x: 0, y: 9 }])
  })
  it('detects lane segments and a round lamp with the Hough transform', () => {
    const lanes = run({ theme: 'lanes', mode: 'hough', blur: 3 })
    expect(lanes.details.lines).toHaveLength(4)
    expect(lanes.details.lines.every(line => Math.abs(Math.abs(line.angle) - 70) < 1.5)).toBe(true)
    expect(lanes.metrics.iou).toBeNull()
    const moved = run({ theme: 'lanes', mode: 'hough', blur: 3, offset: 20 })
    expect(moved.metrics.errorX).toBeGreaterThan(0.1)
    expect(visionDecision('lanes', moved.metrics, 'hough').payload.angular.z).toBeLessThan(0)
    expect(run({ theme: 'lanes', mode: 'hough', blur: 3, houghThreshold: 80 }).details.lines).toEqual([])
    const lamp = run({ mode: 'hough', houghShape: 'circles', houghThreshold: 15, blur: 3 })
    expect(lamp.details.circles).toEqual([{ x: 63.5, y: 63.5, radius: 12.5 }])
    expect(run({ mode: 'hough', houghShape: 'circles', houghThreshold: 25, blur: 3 }).details.circles).toEqual([])
  })
  it('matches the pad template regardless of brightness but not at another scale', () => {
    const exact = run({ theme: 'drone', mode: 'template' })
    expect(exact.details).toMatchObject({ score: 1, location: { x: 40, y: 40 }, detected: true })
    expect(run({ theme: 'drone', mode: 'template', brightness: 0.5 }).details.score).toBe(1)
    const moved = run({ theme: 'drone', mode: 'template', offset: 25 })
    expect(moved.details.location.x).toBe(65); expect(moved.metrics.errorX).toBeGreaterThan(0.3)
    for (const scale of [0.7, 1.3]) expect(run({ theme: 'drone', mode: 'template', scale }).details.detected).toBe(false)
    expect(run({ mode: 'template' }).details.detected).toBe(false)
    expect(visionDecision('document', exact.metrics, 'template').topic).toBe('iot/visual-sensor')
  })
})

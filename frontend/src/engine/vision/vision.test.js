import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const cv = createRequire(import.meta.url)('@techstark/opencv-js')
import { DEFAULT_VISION, makeScene, validateVision, parseVision, maskMetrics, patchAttention, softmax, visionDecision } from './model.js'
import { processOpenCv } from './opencv.js'

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

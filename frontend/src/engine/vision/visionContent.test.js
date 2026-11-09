import { beforeAll, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import content from '@content/vision.json'
import { VISION_EXAMPLES } from '../../features/vision/examples.js'
import { makeScene, validateVision } from './model.js'
import { processOpenCv } from './opencv.js'
const cv = createRequire(import.meta.url)('@techstark/opencv-js')

beforeAll(async () => { if (!cv.Mat) await new Promise(resolve => { cv.onRuntimeInitialized = resolve }) })
const LESSONS = content.tutorials
const NEW_MODES = ['morphology', 'contours', 'histogram', 'perspective', 'hough', 'template']

it('numbers every course and keeps the original six ids, with the capstone last', () => {
  expect(LESSONS).toHaveLength(12)
  LESSONS.forEach((lesson, index) => { expect(lesson.order, lesson.id).toBe(index + 1); expect(lesson.title.startsWith(`${index + 1}. `), lesson.id).toBe(true) })
  expect(LESSONS.slice(0, 3).map(lesson => lesson.id)).toEqual(['opencv-foundations', 'opencv-drone', 'opencv-robotics'])
  expect(LESSONS.slice(9).map(lesson => lesson.id)).toEqual(['vision-transformers', 'vision-deployment', 'vision-integration'])
})

it('teaches each classical OpenCV technique once, with a preset that really demonstrates it', () => {
  const added = LESSONS.slice(3, 9)
  expect(added.map(lesson => validateVision(lesson.config).mode).sort()).toEqual([...NEW_MODES].sort())
  for (const lesson of added) {
    const config = validateVision(lesson.config)
    expect(config, lesson.id).toEqual(lesson.config)
    expect(lesson.integrated, lesson.id).toBe(false)
    expect(lesson.version, lesson.id).toBe(1)
    expect(lesson.lessons, lesson.id).toHaveLength(3); expect(lesson.formulas, lesson.id).toHaveLength(2); expect(lesson.steps, lesson.id).toHaveLength(4)
    expect(lesson.practice, lesson.id).toHaveLength(2); expect(lesson.exam.questions, lesson.id).toHaveLength(5); expect(lesson.exam.passPercent).toBe(80)
    expect(lesson.sources.length, lesson.id).toBeGreaterThanOrEqual(2)
    expect(lesson.sources.every(source => /^https:\/\/docs\.opencv\.org\//.test(source.url)), lesson.id).toBe(true)
    expect(lesson.exampleIds.length, lesson.id).toBeGreaterThanOrEqual(1)
    for (const id of lesson.exampleIds) expect(VISION_EXAMPLES[id]?.code, `${lesson.id} example ${id}`).toBeTruthy()
    const result = processOpenCv(cv, makeScene(config), config)
    const d = result.details
    if (config.mode === 'morphology') expect(d.after.components, lesson.id).toBeLessThan(d.before.components)
    if (config.mode === 'contours') expect(d.shapes.length, lesson.id).toBeGreaterThanOrEqual(2)
    if (config.mode === 'histogram') expect(result.metrics.count, lesson.id).toBeGreaterThan(0)
    if (config.mode === 'perspective') expect(d.found, lesson.id).toBe(true)
    if (config.mode === 'hough') expect((d.lines ?? d.circles).length, lesson.id).toBeGreaterThan(0)
    if (config.mode === 'template') expect(d.detected, lesson.id).toBe(true)
  }
})

it('runs every course preset through real OpenCV without errors', () => {
  for (const lesson of LESSONS) {
    const config = validateVision(lesson.config)
    if (config.mode === 'attention') continue
    expect(() => processOpenCv(cv, makeScene(config), config), lesson.id).not.toThrow()
  }
})

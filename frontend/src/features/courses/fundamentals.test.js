import { expect, it } from 'vitest'
import { TUTORIALS } from '../../content/index.js'
import dictionary from '../../i18n/id.json'
import { fundamentalsForCourse, getTutorialFundamentals, TUTORIAL_FUNDAMENTALS } from './fundamentals.js'
import { getFundamentalReading, getLearningTutorial, LEARNING_TUTORIALS } from './learningCatalog.js'

it('gives every firmware, robotics and vision tutorial exactly one substantive, translated guide', () => {
  expect(LEARNING_TUTORIALS).toHaveLength(58)
  expect(TUTORIAL_FUNDAMENTALS.map(guide => guide.tutorialId).sort()).toEqual(LEARNING_TUTORIALS.map(tutorial => tutorial.id).sort())
  expect(new Set(TUTORIAL_FUNDAMENTALS.map(guide => guide.tutorialId)).size).toBe(TUTORIAL_FUNDAMENTALS.length)
  for (const tutorial of TUTORIALS) for (const board of tutorial.boards) {
    expect(getTutorialFundamentals(tutorial.id), `${tutorial.id} on ${board}`).toBeTruthy()
  }
  for (const guide of TUTORIAL_FUNDAMENTALS) {
    expect(guide.explanation.split(/\s+/).length, guide.tutorialId).toBeGreaterThan(35)
    expect(guide.observation.length, guide.tutorialId).toBeGreaterThan(60)
    for (const text of [guide.topic, guide.explanation, guide.observation]) {
      expect(dictionary[text], text).toBeTruthy()
      expect(dictionary[text]).not.toBe(text)
    }
  }
})

it('resolves every reading to a real course section and connects that course back to the same tutorial', () => {
  for (const guide of TUTORIAL_FUNDAMENTALS) {
    expect(guide.readings.length, guide.tutorialId).toBeGreaterThan(0)
    expect(new Set(guide.readings.map(reading => `${reading.courseId}:${reading.lessonId}`)).size).toBe(guide.readings.length)
    const tutorial = getLearningTutorial(guide.tutorialId)
    expect(tutorial.path).toMatch(/^\/(tutorials|robotics|vision)\/[a-z0-9-]+$/)
    for (const reading of guide.readings) {
      const target = getFundamentalReading(reading)
      expect(target, `${guide.tutorialId} → ${reading.courseId}#${reading.lessonId}`).toBeTruthy()
      expect(target.path).toMatch(/^\/(courses|robotics|vision)\/[a-z0-9-]+#[a-z0-9-]+$/)
      expect(target.path).toContain(`#${reading.lessonId}`)
      expect(fundamentalsForCourse(reading.courseId)).toContain(guide)
    }
  }
})

it('treats unknown tutorial and section identifiers as missing content', () => {
  expect(getTutorialFundamentals('constructor')).toBeNull()
  expect(getLearningTutorial('unknown')).toBeNull()
  expect(fundamentalsForCourse('unknown')).toEqual([])
  expect(getFundamentalReading({ courseId: 'ee-signals', lessonId: 'missing' })).toBeNull()
  expect(getFundamentalReading({ courseId: 'robot-motion', lessonId: 'missing' })).toBeNull()
  expect(getFundamentalReading({ courseId: 'unknown', lessonId: 'lesson-1' })).toBeNull()
})

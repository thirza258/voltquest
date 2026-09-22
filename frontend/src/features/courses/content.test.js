import { describe, expect, it } from 'vitest'
import { COURSES, COURSE_TRACKS, getCourse, getTrack, gradeQuestions } from './content.js'
import { TUTORIALS } from '../../content/index.js'
import dictionary from '../../i18n/id.json'

const narratives = course => [course.title, course.summary, course.workedExample, course.application, course.lab.task, ...(course.extraLabs ?? []).map(lab => lab.task), ...course.formulas.flatMap(formula => [formula.title, formula.symbols, formula.assumptions, formula.example]),
  ...course.lessons.flatMap(lesson => [lesson.title, lesson.text]),
  ...(course.codeExample ? [course.codeExample.title, course.codeExample.explanation, course.codeExample.exercise] : []),
  ...[...course.practice, ...course.exam.questions].flatMap(question => [question.prompt, question.explanation, ...question.options.map(option => option.text)])]

it('ships electrical, IoT, drone, programming and the ten-course engineering ethics path', () => {
  expect(COURSE_TRACKS.map(track => track.id)).toEqual(['electrical', 'iot-parts', 'iot-foundations', 'drone-foundations', 'programming', 'ethics'])
  expect(COURSES).toHaveLength(44)
  expect(new Set(COURSES.map(course => course.id)).size).toBe(44)
  for (const track of COURSE_TRACKS) {
    const courses = COURSES.filter(course => course.track === track.id)
    const count = track.id === 'programming' ? 12 : track.id.endsWith('foundations') ? 1 : 10
    expect(courses.map(course => course.order)).toEqual(Array.from({ length: count }, (_, i) => i + 1))
    expect(courses.map(course => course.difficulty)).toEqual(Array.from({ length: count }, (_, i) => i < 5 ? 'Fundamental' : 'Intermediate'))
    expect(getTrack(track.id)).toBe(track)
    expect(dictionary[track.title]).toBeTruthy()
    expect(dictionary[track.summary]).toBeTruthy()
  }
  expect(getCourse('constructor')).toBeNull()
  expect(getTrack('unknown')).toBeNull()
})

describe.each(COURSES)('$id curriculum', course => {
  it('has substantive lessons, distinct assessment questions, valid preparation and a working lab target', () => {
    expect(course.lessons).toHaveLength(3)
    expect(course.practice).toHaveLength(2)
    expect(course.exam.questions).toHaveLength(5)
    expect(course.exam.passPercent).toBe(80)
    expect(course.version).toBe(1)
    expect(course.minutes).toBeGreaterThanOrEqual(20)
    for (const lesson of course.lessons) expect(lesson.text.split(/\s+/).length).toBeGreaterThanOrEqual(40)
    expect(course.workedExample.length).toBeGreaterThan(200)
    expect(course.application.length).toBeGreaterThan(100)
    for (const id of course.prerequisites) {
      expect(getCourse(id)).toBeTruthy()
      expect(COURSES.indexOf(getCourse(id))).toBeLessThan(COURSES.indexOf(course))
    }
    for (const lab of [course.lab, ...(course.extraLabs ?? [])]) expect(TUTORIALS.some(tutorial => tutorial.id === lab.tutorialId)).toBe(true)
    expect(course.formulas.length).toBeGreaterThan(0)
    for (const formula of course.formulas) expect(formula.equation.length).toBeGreaterThan(5)
    const questions = [...course.practice, ...course.exam.questions]
    expect(new Set(questions.map(question => question.id)).size).toBe(7)
    expect(new Set(questions.map(question => question.prompt)).size).toBe(7)
    for (const question of questions) {
      expect(question.options).toHaveLength(3)
      expect(new Set(question.options.map(option => option.text)).size).toBe(3)
      expect(question.options.filter(option => option.id === question.answerId)).toHaveLength(1)
      expect(course.lessons.some(lesson => lesson.id === question.lessonId)).toBe(true)
    }
    expect(narratives(course).filter(text => !dictionary[text.trim()])).toEqual([])
    for (const source of course.sources) expect(new URL(source.url).protocol).toBe('https:')
  })

  it('grades complete, failed and incomplete attempts at the 80% boundary', () => {
    const questions = course.exam.questions
    const answers = Object.fromEntries(questions.map(question => [question.id, question.answerId]))
    expect(gradeQuestions(questions, answers)).toMatchObject({ correct: 5, percent: 100, complete: true })
    for (const [count, percent] of [[1, 80], [2, 60]]) {
      const mixed = { ...answers }
      for (const question of questions.slice(0, count)) mixed[question.id] = question.options.find(option => option.id !== question.answerId).id
      expect(gradeQuestions(questions, mixed)).toMatchObject({ correct: 5 - count, percent, complete: true })
    }
    delete answers[questions[0].id]
    expect(gradeQuestions(questions, answers)).toMatchObject({ correct: 4, complete: false })
    answers[questions[0].id] = 'not-an-option'
    expect(gradeQuestions(questions, answers).complete).toBe(false)
    expect(gradeQuestions(questions).percent).toBe(0)
  })
})

it('independently checks quantitative answer keys against the worked electrical relationships', () => {
  const answer = (id, n) => { const question = getCourse(id).exam.questions[n - 1]; return question.options.find(option => option.id === question.answerId).text }
  expect(answer('ee-ohms-law', 1)).toBe(`${0.002 * 2000} V`)
  expect(answer('ee-ohms-law', 2)).toBe(`${Math.round((3.3 - 2.1) / 0.006)} Ω`)
  expect(answer('ee-networks', 1)).toBe(`${8 + 12} mA`)
  expect(answer('ee-networks', 2)).toBe(`${3.3 / 2} V`)
  expect(answer('ee-power', 1)).toBe(`${0.5 * 4} Wh`)
  expect(answer('ee-power', 2)).toBe(`${30 * 0.5 + 2 * 0.5} mA`)
  expect(answer('ee-power', 3)).toBe(`${500 / 10} hours`)
  expect(answer('ee-capacitors', 1)).toBe(`${1000 * 100e-6} s`)
  expect(answer('ee-signals', 1)).toBe(String(Math.round(1023 / 5)))
  expect(answer('ee-signals', 4)).toBe(`${1 / 0.005} Hz`)
  expect(answer('ee-reliable-node', 1)).toBe(`${100 / 2} Hz`)
  expect(answer('iot-leds', 1)).toBe(`${Math.round((3.3 - 2) / 0.005)} Ω`)
  expect(answer('iot-leds', 2)).toBe(`${8 * 40} mA`)
  expect(answer('iot-detection', 1)).toBe(`${(343 * 0.004 / 2 * 100).toFixed(1)} cm`)
  expect(answer('iot-displays', 1)).toBe(`${(128 * 64 / 8).toLocaleString('en-US')} bytes`)
  expect(answer('iot-power-integration', 1)).toBe(`${((5 - 3.3) * 0.1).toFixed(2)} W`)
})

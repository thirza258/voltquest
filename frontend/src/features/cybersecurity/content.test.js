import { describe, expect, it } from 'vitest'
import content from '@content/cybersecurity.json'
import courses from '@content/courses.json'
import hpc from '@content/hpc.json'
import robotics from '@content/robotics.json'
import vision from '@content/vision.json'
import { LABS } from '../../engine/cybersecurity/scenarios.js'
import { gradeQuestions } from '../courses/content.js'
import { CYBER_STORAGE_PREFIX, MAX_PROJECT_BYTES, createCyberProject, parseCyberProject, parseRequestDraft, validateCyberProject } from './project.js'

it('provides a coherent ten-course path with tutorials, unique ids and grounded assessments', () => {
  expect(content.courses).toHaveLength(10)
  expect(content.courses.map(course => course.lab)).toEqual(Object.keys(LABS))
  const allIds = [...content.courses, ...courses.courses, ...hpc.courses, ...robotics.tutorials, ...vision.tutorials].map(course => course.id)
  expect(new Set(allIds).size).toBe(allIds.length)
  const questionIds = []
  for (const [index, course] of content.courses.entries()) {
    expect(course.order).toBe(index + 1)
    expect(course.version).toBe(1)
    expect(course.prerequisites).toEqual(index ? [content.courses[index - 1].id] : [])
    expect(course.lessons).toHaveLength(4)
    expect(course.steps).toHaveLength(4)
    expect(course.practice).toHaveLength(3)
    expect(course.exam.questions).toHaveLength(5)
    expect(course.exam.passPercent).toBe(80)
    for (const lesson of course.lessons) {
      expect(lesson.paragraphs).toHaveLength(2)
      expect(lesson.paragraphs.every(paragraph => paragraph.length > 150)).toBe(true)
      expect(lesson.pitfall.length).toBeGreaterThan(35)
    }
    for (const question of [...course.practice, ...course.exam.questions]) {
      questionIds.push(question.id)
      expect(question.options).toHaveLength(3)
      expect(new Set(question.options.map(option => option.text)).size).toBe(3)
      expect(question.options.filter(option => option.id === question.answerId)).toHaveLength(1)
      expect(course.lessons.some(section => section.id === question.lessonId)).toBe(true)
      expect(question.explanation.length).toBeGreaterThan(35)
    }
    expect(course.sources.every(source => /^https:\/\/(cheatsheetseries\.owasp\.org|community\.owasp\.org|developer\.mozilla\.org)\//.test(source.url))).toBe(true)
    const answers = Object.fromEntries(course.exam.questions.map(question => [question.id, question.answerId]))
    expect(gradeQuestions(course.exam.questions, answers)).toMatchObject({ complete: true, percent: 100 })
    const last = course.exam.questions.at(-1)
    answers[last.id] = last.options.find(option => option.id !== last.answerId).id
    expect(gradeQuestions(course.exam.questions, answers)).toMatchObject({ complete: true, percent: 80 })
  }
  expect(questionIds).toHaveLength(80)
  expect(new Set(questionIds).size).toBe(80)
})

describe.each(Object.keys(LABS))('%s notebook', lab => {
  it('round-trips draft edits, defenses and notes in a separate file format', () => {
    const project = createCyberProject(lab)
    expect(parseRequestDraft(project.request)).toEqual(LABS[lab].baseline)
    project.notes = 'Investigate the object boundary. Keep this exact note. <script>inert</script>'
    project.request.headers = '{ "unfinished"'
    project.controls.sql = !project.controls.sql
    expect(parseCyberProject(JSON.stringify(project), lab)).toEqual(project)
    expect(() => parseRequestDraft(project.request)).toThrow(/headers are not valid JSON/)
    expect(CYBER_STORAGE_PREFIX).toBe('vq.cybersecurity.v1.')
  })
})

it('rejects foreign, malformed and oversized notebooks without trusting imported result claims', () => {
  const project = createCyberProject('sql')
  for (const value of [null, [], {}, { ...project, version: 2 }, { ...project, format: 'voltquest-project' }, { ...project, lab: '__proto__' }, { ...project, notes: 10 }, { ...project, notes: 'x'.repeat(10001) }, { ...project, controls: { sql: true } }, { ...project, request: { ...project.request, headers: {} } }]) expect(() => validateCyberProject(value)).toThrow()
  expect(() => parseCyberProject(JSON.stringify(project), 'http')).toThrow(/another lab/)
  expect(() => parseCyberProject('{')).toThrow(/not valid JSON/)
  expect(() => parseCyberProject(' '.repeat(MAX_PROJECT_BYTES + 1))).toThrow(/64 KiB/)
  expect(() => createCyberProject('__proto__')).toThrow(/Unknown/)
  expect(parseCyberProject(JSON.stringify({ ...project, verification: { passed: true }, history: [{ findings: ['made up'] }] }))).toEqual(project)
})

it('validates actual request JSON separately and leaves invalid drafts saveable', () => {
  const draft = createCyberProject().request
  expect(() => parseRequestDraft({ ...draft, body: '[' })).toThrow(/body is not valid JSON/)
  expect(() => parseRequestDraft({ ...draft, body: '[]' })).toThrow(/JSON object/)
  expect(() => parseRequestDraft({ ...draft, headers: '{"cookie":4}' })).toThrow(/string/)
  expect(() => parseRequestDraft({ ...draft, path: 'https://example.test' })).toThrow(/local path/)
  expect(() => parseRequestDraft({ ...draft, body: '{"nested":{"x":1}}' })).toThrow(/text, number or boolean/)
})

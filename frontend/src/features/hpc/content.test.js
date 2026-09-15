import { describe, expect, it } from 'vitest'
import content from '@content/hpc.json'
import electrical from '@content/courses.json'
import robotics from '@content/robotics.json'
import vision from '@content/vision.json'
import { LABS } from '../../engine/hpc/model.js'
import { gradeQuestions } from '../courses/content.js'
import { exampleCode, nativeInstructions } from './examples.js'
import { createHpcProject, parseHpcProject, validateHpcProject } from './project.js'

describe('complete HPC curriculum', () => {
  it('has ten ordered distinct courses with complete learning and testing material', () => {
    expect(content.courses).toHaveLength(10)
    const allIds = [...electrical.courses, ...robotics.tutorials, ...vision.tutorials, ...content.courses].map(course => course.id)
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(content.courses.map(course => course.lab)).toEqual(Object.keys(LABS))
    for (const [index, course] of content.courses.entries()) {
      expect(course.order).toBe(index + 1)
      expect(course.version).toBe(1)
      expect(course.prerequisites).toEqual(index ? [content.courses[index - 1].id] : [])
      expect(course.lessons).toHaveLength(4)
      expect(course.formulas).toHaveLength(2)
      expect(course.steps).toHaveLength(4)
      expect(course.native.tests.length).toBeGreaterThanOrEqual(2)
      expect(course.native.walkthrough).toHaveLength(3)
      expect(course.outcomes).toHaveLength(3)
      expect(course.challenge.acceptance.length).toBeGreaterThanOrEqual(3)
      for (const section of course.lessons) {
        expect(section.paragraphs).toHaveLength(2)
        expect(section.paragraphs.join(' ').split(/\s+/).length).toBeGreaterThan(110)
        expect(section.pitfall.length).toBeGreaterThan(30)
      }
      for (const source of course.sources) expect(new URL(source.url).protocol).toBe('https:')
      for (const language of ['c', 'cpp']) {
        const source = exampleCode(course.lab, language), instructions = nativeInstructions(course.lab, language)
        expect(source).toContain('int main(')
        expect(source).toContain('PASS')
        expect(instructions.file).toBe(`${course.lab}.${language}`)
        expect(instructions.build).toContain(instructions.file)
      }
    }
  })
  it('provides 30 practice and 50 exam questions with valid review targets and grading', () => {
    const ids = []
    for (const course of content.courses) {
      expect(course.practice).toHaveLength(3)
      expect(course.exam.questions).toHaveLength(5)
      expect(course.exam.passPercent).toBe(80)
      for (const question of [...course.practice, ...course.exam.questions]) {
        ids.push(question.id)
        expect(new Set(question.options.map(option => option.text)).size).toBe(question.options.length)
        expect(question.options.filter(option => option.id === question.answerId)).toHaveLength(1)
        expect(course.lessons.some(lesson => lesson.id === question.lessonId)).toBe(true)
        expect(question.explanation.length).toBeGreaterThan(25)
      }
      expect(gradeQuestions(course.exam.questions, Object.fromEntries(course.exam.questions.map(question => [question.id, question.answerId]))).percent).toBe(100)
    }
    expect(ids).toHaveLength(80)
    expect(new Set(ids).size).toBe(80)
  })
})

describe('HPC project boundary', () => {
  it.each(Object.keys(LABS))('round-trips %s settings, two edited sources and notes', lab => {
    const project = createHpcProject(lab)
    project.sources.c += '\n/* C edit */\n'; project.sources.cpp += '\n// C++ edit\n'; project.notes = 'Prediction and evidence'
    expect(parseHpcProject(JSON.stringify(project))).toEqual(project)
    expect(validateHpcProject({ ...project, token: 'not persisted' })).toEqual(project)
  })
  it('rejects malformed, oversized, incompatible and dangerous allocation inputs atomically', () => {
    const project = createHpcProject('blocking')
    for (const value of [null, [], { ...project, format: 'voltquest-project' }, { ...project, version: 2 }, { ...project, language: 'python' }, { ...project, lab: '__proto__' }, { ...project, parameters: { ...project.parameters, n: 1e9 } }, { ...project, sources: {} }, { ...project, notes: 'a'.repeat(10241) }]) expect(() => validateHpcProject(value)).toThrow()
    expect(() => parseHpcProject('{bad')).toThrow(/JSON/)
    expect(() => parseHpcProject(' '.repeat(205000))).toThrow(/200 KiB/)
    expect(() => validateHpcProject({ ...project, sources: { ...project.sources, c: '😀'.repeat(20000) } })).toThrow(/64 KiB/)
    expect(() => parseHpcProject(JSON.stringify(project), 'mpi')).toThrow(/different course/)
  })
})

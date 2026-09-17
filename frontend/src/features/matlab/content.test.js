import { describe, expect, it } from 'vitest'
import content from '@content/matlab.json'
import reference from '@content/matlab-functions.json'
import standard from '@content/courses.json'
import hpc from '@content/hpc.json'
import cyber from '@content/cybersecurity.json'
import { runMatlab, SIGNATURES } from '../../engine/matlab/model.js'
import { gradeQuestions } from '../courses/content.js'
import { createMatlabProject, validateMatlabProject, parseMatlabProject } from './project.js'

describe('MATLAB curriculum and examples', () => {
  it('contains a complete ordered learning path and one checkpoint per section', () => {
    expect(content.courses).toHaveLength(18)
    const courseIds = [...standard.courses, ...hpc.courses, ...cyber.courses, ...content.courses].map(c => c.id)
    expect(new Set(courseIds).size).toBe(courseIds.length)
    const questions = []
    for (const [index, course] of content.courses.entries()) {
      expect(course.order).toBe(index + 1)
      expect(course.version).toBe(1)
      expect(course.prerequisites).toEqual(index ? [content.courses[index - 1].id] : [])
      expect(course.lessons).toHaveLength(4)
      expect(course.steps).toHaveLength(4)
      expect(course.challenge.acceptance).toHaveLength(3)
      expect(course.exam.questions).toHaveLength(5)
      expect(course.exam.passPercent).toBe(80)
      expect(course.desktop.code).toContain('assert(')
      expect(course.desktop.products).toContain('MATLAB')
      expect(course.expected.length).toBeGreaterThan(70)
      for (const lesson of course.lessons) {
        expect(lesson.paragraphs).toHaveLength(2)
        expect(lesson.paragraphs.join(' ').split(/\s+/).length).toBeGreaterThan(80)
        expect(lesson.pitfall.length).toBeGreaterThan(30)
        expect(lesson.question.lessonId).toBe(lesson.id)
      }
      for (const q of [...course.lessons.map(s => s.question), ...course.exam.questions]) {
        questions.push(q.id)
        expect(new Set(q.options.map(o => o.text)).size).toBe(3)
        expect(q.options.filter(o => o.id === q.answerId)).toHaveLength(1)
        expect(course.lessons.some(s => s.id === q.lessonId)).toBe(true)
        expect(q.explanation.length).toBeGreaterThan(25)
      }
      expect(gradeQuestions(course.exam.questions, Object.fromEntries(course.exam.questions.map(q => [q.id, q.answerId]))).percent).toBe(100)
      for (const source of course.sources) expect(new URL(source.url).hostname).toBe('www.mathworks.com')
      for (const fn of course.functions) expect(reference.functions.some(item => item.name === fn)).toBe(true)
    }
    expect(questions).toHaveLength(162); expect(new Set(questions).size).toBe(162)
    expect(JSON.stringify(content)).not.toMatch(/\\u000[0-8bcef]/)
  })

  it.each(content.courses)('executes the complete $id starter with its numerical assertions', course => {
    const result = runMatlab(course.code)
    expect(result.source).toBe(course.code)
    expect(result.workspace.length).toBeGreaterThan(0)
    expect(result.outputTruncated).toBe(false)
    for (const series of result.plots) {
      expect(series.x.length).toBe(series.y.length)
      expect(series.y.every(Number.isFinite)).toBe(true)
    }
  })

  it('checks explained physical limits and convergence independently of starter assertions', () => {
    const ode = content.courses.find(c => c.id === 'matlab-ode')
    const error = code => runMatlab(code).workspace.find(v => v.name === 'max_error').values[0]
    const coarse = error(ode.code), fine = error(ode.code.replace('h = 0.05;', 'h = 0.025;'))
    expect(coarse).toBeGreaterThan(fine * 1.9)
    expect(coarse).toBeLessThan(fine * 2.1)
    const thermal = content.courses.find(c => c.id === 'matlab-capstone')
    const result = runMatlab(thermal.code)
    const value = name => result.workspace.find(v => v.name === name).values[0]
    expect(value('equilibrium')).toBe(25); expect(value('tau')).toBe(10)
    expect(result.plots[0].y.at(-1)).toBeCloseTo(25 - 5 * 0.95 ** 100, 10)
    const changed = runMatlab(thermal.code.replace('C = 20;', 'C = 40;'))
    expect(changed.workspace.find(v => v.name === 'equilibrium').values).toEqual([25])
    expect(changed.workspace.find(v => v.name === 'tau').values).toEqual([20])
  })

  it('keeps the supported reference synchronized with the runtime and labels desktop requirements', () => {
    expect(reference.functions).toHaveLength(244)
    expect(new Set(reference.functions.map(fn => fn.name)).size).toBe(244)
    expect(reference.functions.filter(fn => fn.scope === 'browser').map(fn => fn.name).sort()).toEqual(Object.keys(SIGNATURES).sort())
    for (const fn of reference.functions) {
      expect(new URL(fn.url).hostname).toBe('www.mathworks.com')
      expect(fn.description.length).toBeGreaterThan(10)
      if (fn.scope === 'desktop') expect(fn.product.length).toBeGreaterThan(5)
      else expect(fn.signature).toBe(SIGNATURES[fn.name])
    }
  })

  it.each(reference.functions.filter(fn => fn.scope === 'browser'))('runs the documented $name reference example', fn => {
    expect(() => runMatlab(fn.example)).not.toThrow()
  })
})

describe('MATLAB notebook boundaries', () => {
  it.each(content.courses)('round-trips edited $id code and notes without importing fabricated evidence', course => {
    const value = createMatlabProject(course.id)
    value.code = '% an unfinished script\nx = '
    value.notes = 'Predictions and measured observations'
    expect(parseMatlabProject(JSON.stringify({ ...value, result: { output: ['fake'] }, account: 'ignored' }))).toEqual(value)
  })
  it('rejects incompatible, malformed and oversized imports without interpreting their source', () => {
    const value = createMatlabProject()
    for (const input of [null, [], {}, { ...value, format: 'voltquest-project' }, { ...value, version: 2 }, { ...value, lesson: '__proto__' }, { ...value, code: 2 }, { ...value, notes: null }, { ...value, code: '😀'.repeat(9000) }, { ...value, notes: 'a'.repeat(10241) }]) expect(() => validateMatlabProject(input)).toThrow()
    expect(() => parseMatlabProject('{no')).toThrow(/JSON/)
    expect(() => parseMatlabProject(' '.repeat(65537))).toThrow(/64 KiB/)
    expect(() => parseMatlabProject(JSON.stringify(value), 'matlab-capstone')).toThrow(/another course/)
  })
})

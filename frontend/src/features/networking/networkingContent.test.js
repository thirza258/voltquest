import { describe, expect, it } from 'vitest'
import content from '@content/networking.json'
import { addDevice, emptyProject, updateDevice } from '../../engine/network/model.js'
import { cliError, createSession, execute, promptFor } from '../../engine/network/cli.js'
import { runDesktop } from '../../engine/network/desktop.js'
import { emptyState } from '../../engine/network/sim.js'
import { labProject } from '../../engine/network/lab.js'
import { applySolution, checkGoals } from '../../engine/network/checks.js'

const COURSES = content.courses
const PROMPT = /^([A-Za-z][\w-]*)((?:\([a-z-]+\))?[>#])\s?(.*)$/
const PC_PROMPT = /^C:\\>\s?(.*)$/

/**
 * Replay a lesson example as typed: every non-comment line must be a prompt line, the prompt must be
 * the one the CLI would show at that point, and the command must be accepted.
 */
function replayExample(example, type) {
  const problems = []
  const lines = example.split('\n').map(line => line.trimEnd()).filter(line => line.trim() && !line.trim().startsWith('!'))
  if (type === 'pc') {
    let project = addDevice(emptyProject(), 'pc').project
    const state = emptyState()
    for (const line of lines) {
      const match = line.match(PC_PROMPT)
      if (!match) { problems.push(`not a C:\\> prompt line: ${line}`); continue }
      const result = runDesktop(project, state, project.devices[0].id, match[1])
      project = result.project
      if (result.lines.some(text => text === 'Invalid Command.' || text.startsWith('Usage:') || text.startsWith('Error:'))) problems.push(`desktop rejected: ${match[1]}`)
    }
    return problems
  }
  let { project } = addDevice(emptyProject(), type)
  const first = lines[0]?.match(PROMPT)
  if (!first) return [`first line is not a prompt: ${lines[0]}`]
  project = updateDevice(project, project.devices[0].id, device => ({ ...device, config: { ...device.config, hostname: first[1] } }))
  let session = createSession(project.devices[0].id)
  const state = emptyState()
  // A transcript may start in any mode the prompt shows; walk there with the usual commands.
  const opening = { '>': [], '#': ['enable'], '(config)#': ['enable', 'configure terminal'] }[first[2]]
  if (!opening) return [`transcripts must start at >, # or (config)#: ${first[0]}`]
  for (const line of opening) ({ project, session } = execute(project, state, session, line))
  for (const line of lines) {
    const match = line.match(PROMPT)
    if (!match) { problems.push(`not a prompt line: ${line}`); continue }
    const expected = promptFor(project.devices[0], session)
    if (`${match[1]}${match[2]}` !== expected) problems.push(`prompt ${match[1]}${match[2]} but the CLI is at ${expected} before "${match[3]}"`)
    const result = execute(project, state, session, match[3])
    if (cliError(result.output)) problems.push(`rejected "${match[3]}": ${result.output.split('\n').at(-1)}`)
    project = result.project; session = result.session
  }
  return problems
}

describe('networking course content', () => {
  it('has ten ordered courses with complete sections, checks, labs and exams', () => {
    expect(content.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(COURSES).toHaveLength(10)
    expect(new Set(COURSES.map(course => course.id)).size).toBe(10)
    for (const [index, course] of COURSES.entries()) {
      const where = course.id
      expect(course.id, where).toMatch(/^net-[a-z-]+$/)
      expect(course.version, where).toBe(1)
      expect(course.order, where).toBe(index + 1)
      expect(course.title.startsWith(`${index + 1}. `), where).toBe(true)
      expect(['Fundamental', 'Intermediate', 'Advanced'], where).toContain(course.difficulty)
      expect(course.minutes, where).toBeGreaterThanOrEqual(20); expect(course.minutes, where).toBeLessThanOrEqual(90)
      expect(course.summary.length, where).toBeGreaterThan(60)
      expect(course.lessons, where).toHaveLength(4)
      for (const [n, lesson] of course.lessons.entries()) {
        expect(lesson.id, where).toBe(`${course.id}-s${n + 1}`)
        expect(lesson.paragraphs.length, lesson.id).toBeGreaterThanOrEqual(2)
        expect(lesson.paragraphs.every(text => text.length >= 120), lesson.id).toBe(true)
        expect(['router', 'switch', 'pc', 'none'], lesson.id).toContain(lesson.exampleDevice)
        expect(lesson.example.trim().length, lesson.id).toBeGreaterThan(10)
        expect(lesson.pitfall.length, lesson.id).toBeGreaterThan(40)
        const q = lesson.question
        expect(q.options, lesson.id).toHaveLength(3)
        expect(q.options.filter(option => option.id === q.answerId), lesson.id).toHaveLength(1)
        expect(q.explanation.length, lesson.id).toBeGreaterThan(30)
      }
      expect(course.steps.length, where).toBeGreaterThanOrEqual(4); expect(course.steps.length, where).toBeLessThanOrEqual(7)
      expect(course.expected.length, where).toBeGreaterThan(40)
      expect(course.challenge.task.length, where).toBeGreaterThan(40)
      expect(course.challenge.acceptance.length, where).toBeGreaterThanOrEqual(2)
      expect(course.exam.passPercent, where).toBe(80)
      expect(course.exam.questions, where).toHaveLength(5)
      const lessonIds = course.lessons.map(lesson => lesson.id)
      const questionIds = [...course.lessons.map(lesson => lesson.question.id), ...course.exam.questions.map(q => q.id)]
      expect(new Set(questionIds).size, where).toBe(questionIds.length)
      for (const q of course.exam.questions) {
        expect(q.options, q.id).toHaveLength(3)
        expect(q.options.filter(option => option.id === q.answerId), q.id).toHaveLength(1)
        expect(lessonIds, q.id).toContain(q.lessonId)
        expect(q.explanation.length, q.id).toBeGreaterThan(30)
      }
      expect(course.sources.length, where).toBeGreaterThanOrEqual(2)
      expect(course.sources.every(source => source.title && /^https:\/\//.test(source.url)), where).toBe(true)
    }
  })

  it('replays every lesson example exactly as printed', () => {
    for (const course of COURSES) for (const lesson of course.lessons) {
      if (lesson.exampleDevice === 'none') {
        expect(lesson.example.split('\n').some(line => PROMPT.test(line.trim()) || PC_PROMPT.test(line.trim())), lesson.id).toBe(false)
        continue
      }
      expect(replayExample(lesson.example, lesson.exampleDevice), lesson.id).toEqual([])
    }
  })

  it('builds every lab, fails at least one goal at the start, and passes all goals with the solution', () => {
    for (const course of COURSES) {
      const lab = course.lab
      expect(lab.title.length, course.id).toBeGreaterThan(5)
      expect(lab.brief.length, course.id).toBeGreaterThan(60)
      expect(lab.topology.devices.length, course.id).toBeLessThanOrEqual(12)
      for (const device of lab.topology.devices) {
        expect(device.x, `${course.id} ${device.name}`).toBeGreaterThanOrEqual(40); expect(device.x).toBeLessThanOrEqual(720)
        expect(device.y, `${course.id} ${device.name}`).toBeGreaterThanOrEqual(40); expect(device.y).toBeLessThanOrEqual(380)
      }
      const start = labProject(lab.topology, lab.title)
      expect(start.errors, `${course.id} starting configuration`).toEqual([])
      expect(lab.goals.length, course.id).toBeGreaterThanOrEqual(2); expect(lab.goals.length, course.id).toBeLessThanOrEqual(8)
      expect(lab.goals.every(goal => goal.label?.length > 5), course.id).toBe(true)
      const before = checkGoals(start.project, lab.goals)
      expect(before.passed, `${course.id}: the starting lab must not already be solved`).toBeLessThan(before.total)
      const solved = applySolution(start.project, lab.solution)
      expect(solved.errors, `${course.id} solution`).toEqual([])
      const after = checkGoals(solved.project, lab.goals)
      expect(after.results.filter(item => !item.passed).map(item => `${item.goal.label}: ${item.detail}`), `${course.id} goals after the solution`).toEqual([])
    }
  })
})

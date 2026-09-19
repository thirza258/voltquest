import { describe, expect, it } from 'vitest'
import { AGENT_COURSES, createProject, parseProject, presetConfig, validateProject } from '../../features/agents/project.js'
import { contextTokens, DEFAULT_SKILL, estimateTokens, evaluateHarness, initialState, lintSkill, parseConfig, runUntilPause, stepAgent, tokenCost } from './model.js'

function config(id = 'foundations', overrides = {}) { return { ...presetConfig(`agents-${id}`), ...overrides } }
function start(value = config(), skill) { return initialState(parseConfig(JSON.stringify(value)), skill) }
function complete(value) {
  let state = start(value)
  for (let i = 0; i < 96 && !['completed', 'stopped'].includes(state.status); i++) {
    state = state.status === 'approval' ? stepAgent(state, { approve: true }) : state.status === 'question' ? stepAgent(state, { answer: 'Prepare a draft only.' }) : runUntilPause(state)
  }
  return state
}
const call = (name, args = {}) => ({ type: 'tool', name, args })
const results = state => state.trace.filter(event => event.type === 'tool_result').map(event => event.detail.result)

describe('authored courses and actual tutorial execution', () => {
  it('provides twenty substantial courses with independent section questions and valid five-question exams', () => {
    expect(AGENT_COURSES).toHaveLength(20)
    const ids = new Set()
    for (const course of AGENT_COURSES) {
      expect(ids.has(course.id)).toBe(false); ids.add(course.id)
      expect(course.lessons).toHaveLength(4); expect(course.steps).toHaveLength(4)
      expect(course.exam.questions).toHaveLength(5); expect(course.exam.passPercent).toBe(80)
      for (const lesson of course.lessons) {
        expect(lesson.paragraphs).toHaveLength(2)
        expect(lesson.paragraphs.join(' ').length).toBeGreaterThan(400)
        expect(lesson.pitfall.length).toBeGreaterThan(30)
      }
      const sectionIds = course.lessons.map(lesson => lesson.id)
      for (const question of [...course.lessons.map(lesson => lesson.question), ...course.exam.questions]) {
        expect(ids.has(question.id)).toBe(false); ids.add(question.id)
        expect(sectionIds).toContain(question.lessonId)
        expect(question.options.filter(option => option.id === question.answerId)).toHaveLength(1)
        expect(new Set(question.options.map(option => option.text)).size).toBe(3)
        expect(question.explanation.length).toBeGreaterThan(30)
      }
      for (const source of course.sources) expect(new URL(source.url).protocol).toBe('https:')
    }
  })
  it.each(AGENT_COURSES)('$id executes through the real bounded harness', course => {
    const state = complete(presetConfig(course.id))
    expect(state.status).toBe('completed')
    expect(state.ledger).toHaveLength(state.cursor)
    expect(state.totalUsd).toBeGreaterThan(0)
    expect(state.totalUsd).toBeLessThan(state.config.budgetUsd)
    expect(state.ledger.every(row => row.input > 0 && row.output <= row.reserved)).toBe(true)
  })
})

it('does not mutate previous state; pauses before a write and resumes exactly once', () => {
  const original = start(config('codex')), before = JSON.stringify(original)
  const waiting = runUntilPause(original)
  expect(JSON.stringify(original)).toBe(before)
  expect(waiting.status).toBe('approval'); expect(waiting.files['draft.md']).toBeUndefined()
  const unchanged = stepAgent(waiting)
  expect(unchanged).toEqual(waiting)
  const approved = stepAgent(waiting, { approve: true })
  expect(approved.files['draft.md']).toContain('verified email')
  expect(approved.ledger).toEqual(waiting.ledger)
  expect(approved.totalUsd).toBe(waiting.totalUsd)
  expect(results(runUntilPause(approved)).at(-1).text).toBe(approved.files['draft.md'])
})
it('denial keeps app state unchanged and cannot be bypassed by approving a missing scope', () => {
  const waiting = runUntilPause(start(config('integrations')))
  expect(stepAgent(waiting, { approve: false }).issues).toHaveLength(1)
  const denied = complete(config('integrations', { scopes: ['issues:read'] }))
  expect(denied.issues).toHaveLength(1)
  expect(denied.trace.filter(event => event.type === 'tool_error')).toHaveLength(2)
})
it('records an answer without charging a paused request twice', () => {
  const waiting = runUntilPause(start(config('instructions')))
  expect(waiting.status).toBe('question')
  expect(stepAgent(waiting, { answer: ' ' })).toEqual(waiting)
  const answered = stepAgent(waiting, { answer: 'Draft only' })
  expect(answered.ledger).toEqual(waiting.ledger)
  expect(answered.context.at(-1).text).toContain('Draft only')
})
it('replays identical keyed issues but rejects conflicting content', () => {
  const value = config('integrations')
  value.turns.splice(3, 0, call('create_issue', { ...value.turns[1].args, title: 'Different payload' }))
  const state = complete(value)
  expect(state.issues).toHaveLength(2)
  expect(results(state).some(result => result.replayed)).toBe(true)
  expect(state.trace.some(event => event.detail.error?.includes('different content'))).toBe(true)
})
it.each(['../secret', '/secret', 'a/b', '__proto__', 'constructor', 'prototype'])('rejects unsafe virtual path %s', path => {
  const state = complete(config('tools', { turns: [call('write_file', { path, text: 'bad' })] }))
  expect(state.files[path]).not.toBe('bad')
  expect(state.trace.at(-1).type).toBe('tool_error')
})
it('rejects unknown tools and malformed arguments without executing them', () => {
  const state = complete(config('tools', { turns: [call('eval', { code: 'process.exit()' }), call('read_file', { path: 'report.txt', extra: true }), call('read_file', {})] }))
  expect(state.trace.filter(event => event.type === 'tool_error')).toHaveLength(3)
})
it('keeps injected document text inert while returning real search matches', () => {
  const state = complete(config('harness'))
  expect(results(state)[0][0].id).toBe('untrusted-note')
  expect(state.issues).toHaveLength(1)
  expect(Object.keys(state.files)).toHaveLength(4)
})
it('compacts only unpinned context and counts previous proposals as input', () => {
  const state = complete(config('context'))
  const compact = state.trace.find(event => event.type === 'compacted').detail
  expect(compact.after).toBeLessThan(compact.before)
  expect(compact.retainedPinned).toEqual(['goal', 'constraint'])
  expect(state.context.some(item => item.id === 'old-log')).toBe(false)
  expect(state.context.some(item => item.id.startsWith('proposal-'))).toBe(true)
})
it('loads one exact skill body and distinguishes formatting from behavioral validation', () => {
  const state = complete(config('use-skills'))
  expect(state.context.filter(item => item.id === 'active-skill')).toEqual([{ id: 'active-skill', text: DEFAULT_SKILL, pinned: true }])
  expect(lintSkill('---\nname: BAD\ndescription: Use for tests\n---\nDo work').valid).toBe(false)
  expect(lintSkill(DEFAULT_SKILL).valid).toBe(true)
  const invalid = runUntilPause(start(config('build-skills'), 'Not a skill'))
  expect(invalid.loadedSkill).toBe(false)
  expect(invalid.trace.some(event => event.type === 'tool_error')).toBe(true)
})
it('uses the stated estimate and never double-counts cached input in cost', () => {
  expect(estimateTokens('abcd')).toBe(1); expect(estimateTokens('😀')).toBe(1)
  expect(tokenCost(1000, 400, 200, { input: 2, cached: 0.5, output: 8 })).toBeCloseTo(0.003, 9)
  const uncached = stepAgent(start()), cached = stepAgent(start(config('foundations', { cachedTokens: 128000 })))
  expect(contextTokens(cached)).toBe(contextTokens(uncached))
  expect(cached.ledger[0].cached).toBe(cached.ledger[0].input)
  expect(cached.totalUsd).toBeLessThan(uncached.totalUsd)
})
it.each([{ budgetUsd: 0 }, { contextWindow: 64 }, { outputReserve: 16, turns: [{ type: 'finish', text: 'A lengthy proposed response. '.repeat(10) }] }])('stops before an invalid request without charging: %j', overrides => {
  const state = runUntilPause(start(config('foundations', overrides)))
  expect(state.status).toBe('stopped'); expect(state.ledger).toEqual([])
})
it('enforces turn limits and rejects invalid limits before running', () => {
  const state = complete(config('foundations', { maxTurns: 1 }))
  expect(state.status).toBe('stopped'); expect(state.ledger).toHaveLength(1)
  for (const overrides of [{ maxTurns: 0 }, { budgetUsd: -1 }, { rates: { input: 0, cached: -1, output: 1 } }, { turns: Array(33).fill({ type: 'finish', text: 'done' }) }, { context: [{ id: 'x', text: 'x', pinned: 'yes' }] }]) expect(() => parseConfig(JSON.stringify(config('foundations', overrides)))).toThrow()
})
it('executes a version-pinned MCP handshake, discovery, tools, resources and prompts', () => {
  const value = config('mcp')
  const rpc = (id, method, params) => call('mcp', { request: { jsonrpc: '2.0', id, method, params } })
  value.turns.push(rpc(4, 'resources/read', { uri: 'handbook://onboarding' }), rpc(5, 'prompts/get', { name: 'triage' }), rpc(6, 'tools/call', { name: 'search_docs', arguments: {} }))
  const state = complete(value), output = results(state)
  expect(output[0].result.protocolVersion).toBe('2025-11-25')
  expect(output[2].result.tools[0].inputSchema.additionalProperties).toBe(false)
  expect(output[3].result.content[0].text).toContain('verified email')
  expect(output[4].result.contents[0].uri).toBe('handbook://onboarding')
  expect(output[5].result.messages[0].role).toBe('user')
  expect(output[6].result.isError).toBe(true)
})
it('does not accept an uninitialized or mismatched protocol call', () => {
  const value = config('mcp'); value.turns = [value.turns[2], { ...value.turns[0], args: { request: { jsonrpc: '2.0', id: 9, method: 'initialize', params: { protocolVersion: 'unsupported' } } } }]
  expect(results(complete(value)).map(result => result.error.code)).toEqual([-32000, -32602])
})
it('runs positive and negative regression evidence independently of the current experiment', () => {
  const state = start(), before = JSON.stringify(state)
  const checks = evaluateHarness(state.config, state.skill)
  expect(checks).toHaveLength(6); expect(checks.every(check => check.passed)).toBe(true)
  expect(JSON.stringify(state)).toBe(before)
})
it('preserves unfinished drafts but strips fabricated results, approvals and unknown fields on import', () => {
  const project = { ...createProject(), source: '{ unfinished', notes: 'Keep exact source' }
  expect(parseProject(JSON.stringify({ ...project, trace: ['fake'], status: 'approved' }))).toEqual(project)
  expect(() => parseConfig(project.source)).toThrow('incomplete')
  expect(() => validateProject(project, 'agents-cli')).toThrow('another course')
  expect(() => parseProject('x'.repeat(196609))).toThrow('192 KiB')
  expect(() => validateProject({ ...project, javascript: 'x'.repeat(32769) })).toThrow('javascript')
})

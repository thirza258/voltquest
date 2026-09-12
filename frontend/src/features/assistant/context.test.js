import { expect, it } from 'vitest'
import { TUTORIALS } from '../../content/index.js'
import { tutorialCircuit } from '../tutorials/circuits.js'
import { resolvePins, listDefs, defaultMcuPlacement } from '../../engine/components/registry.js'
import { BOARD_IDS, getBoard } from '../../engine/boards/index.js'
import { layoutBreadboards } from '../../engine/components/breadboard.js'
import catalog from '../../../../content/mcp-catalog.json'
import { buildAssistantContext } from './context.js'

it('captures unsaved code, actual inspector pins, lesson progress and live values without solutions or identity', () => {
  const lesson = TUTORIALS.find(t => t.id === 'pi-blink')
  const doc = tutorialCircuit(lesson, 'raspberrypi5')
  const led = doc.components.find(c => c.type === 'led')
  const context = buildAssistantContext({ mode: 'tutorial', lesson: { ...lesson, solution: { code: 'SECRET_REFERENCE' } }, doc, code: 'print("unsaved")', selectedIds: [led.id], completedSteps: [1], state: { status: 'running', player: { token: 'SECRET_TOKEN' }, serial: [{ text: 'hello' }], evaluation: { componentStates: { [led.id]: { voltage: 1.8, current: 0.01, brightness: 0.5 } } } } })
  expect(context.code).toBe('print("unsaved")')
  expect(context.selection[0].pins.anode).toBe(resolvePins(led, doc).pins.anode.hole)
  expect(context.lesson.completedSteps).toEqual([1])
  expect(context.simulation.components[led.id].current).toBe(0.01)
  expect(context.board.language).toBe('python-gpio-subset')
  expect(JSON.stringify(context)).not.toContain('SECRET')
})

it.each(['campaign', 'sandbox', 'showcase'])('captures %s context and objective text, excluding hints and reference code', mode => {
  const doc = tutorialCircuit(TUTORIALS.find(t => t.id === 'uno-blink'), 'uno')
  const context = buildAssistantContext({ mode, title: 'Unsaved project name', doc, code: 'manual', lesson: mode === 'campaign' ? { title: 'Quest', objectives: [{ id: 'led', text: 'Light the LED', hints: { tier3: 'hidden' } }], solution: 'hidden' } : null, objectives: { objectives: [{ id: 'led', passed: true }] } })
  expect(context.mode).toBe(mode)
  expect(context.title).toBe('Unsaved project name')
  if (mode === 'campaign') expect(context.lesson.objectives).toEqual([{ id: 'led', text: 'Light the LED', passed: true }])
  else expect(context.lesson).toBeNull()
  expect(JSON.stringify(context)).not.toContain('hidden')
})

it('bounds UTF-8 snapshots and tells the model when data was omitted', () => {
  const doc = tutorialCircuit(TUTORIALS.find(t => t.id === 'uno-blink'), 'uno')
  const context = buildAssistantContext({ mode: 'sandbox', doc, code: '💡'.repeat(24000), state: { serial: [{ text: 'x'.repeat(10000) }] } })
  expect(context.truncated).toContain('code')
  expect(context.truncated).toContain('serial')
  expect(new TextEncoder().encode(JSON.stringify(context)).length).toBeLessThan(96000)
})

it('keeps the MCP catalog identical to the actual registry, layouts and board profiles', () => {
  expect(catalog.layouts).toEqual(Object.fromEntries(['half', 'full', 'dual'].map(mode => [mode, layoutBreadboards(mode)])))
  for (const id of BOARD_IDS) expect(catalog.boards[id]).toEqual(JSON.parse(JSON.stringify({ ...getBoard(id), placements: Object.fromEntries(['half', 'full', 'dual'].map(mode => [mode, defaultMcuPlacement(id, mode)])) })))
  for (const def of listDefs()) expect(catalog.components[def.type]).toEqual(JSON.parse(JSON.stringify({ name: def.name, type: def.type, mount: def.mount, category: def.category, footprint: def.footprint, props: def.props, learn: def.learn })))
})

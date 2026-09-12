// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { installMemoryStorage } from '../test-utils/localStorage.js'
import { buildStarterDoc, objectivesWithHints, useLevelSession } from './useLevelSession.js'
import { useDocumentStore } from '../store/documentStore.js'
import { useWorkspaceStore } from '../store/workspaceStore.js'
import { useSimStore } from '../store/simStore.js'

afterEach(cleanup)

const LEVEL = {
  id: 'test-l1',
  worldId: 'w1',
  title: 'Code Awakening',
  codeName: 'Level 1-4',
  board: 'uno',
  boardMode: 'half',
  xp: 120,
  starterCode: 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n}\n',
  objectives: [{ id: 'led', text: 'Wire the LED', hints: { tier1: 'Follow the current', tier2: { mcuPins: ['D13'] }, tier3: true } }],
}

describe('buildStarterDoc', () => {
  it('places the starting board when the level has no starter circuit', () => {
    const doc = buildStarterDoc(LEVEL)
    expect(doc.mcu).toBe('uno')
    expect(doc.components).toHaveLength(1)
    expect(doc.components[0].type).toBe('uno')
    expect(doc.boardMode).toBe('half')
  })

  it('uses startBoard over the target board (the power-swap level starts on an Uno)', () => {
    const doc = buildStarterDoc({ ...LEVEL, board: 'esp32', startBoard: 'uno' })
    expect(doc.mcu).toBe('uno')
  })

  it('clears damage markers carried by a starter circuit', () => {
    const starterCircuit = {
      version: 1,
      boardMode: 'half',
      breadboards: [{ id: 'bb1', type: 'half', x: 0, y: 0 }],
      mcu: 'uno',
      components: [
        { id: 'c_led1', type: 'led', props: { color: 'red', damaged: true }, rotation: 0, anchor: { board: 'bb1', hole: 'e5' } },
      ],
      wires: [],
      meta: {},
    }
    const doc = buildStarterDoc({ ...LEVEL, starterCircuit })
    expect(doc.components[0].props).toEqual({ color: 'red' })
    // The level's own object must not be mutated.
    expect(starterCircuit.components[0].props.damaged).toBe(true)
  })

  it('returns an empty board-less doc for an unknown board', () => {
    const doc = buildStarterDoc({ id: 'x', board: 'pentium' })
    expect(doc.components).toHaveLength(0)
    expect(doc.mcu).toBeNull()
  })
})

describe('objectivesWithHints', () => {
  it('merges level hints onto the validator report', () => {
    const merged = objectivesWithHints({ objectives: [{ id: 'led', text: 'Wire the LED', passed: false }] }, LEVEL)
    expect(merged[0].hints.tier1).toBe('Follow the current')
  })

  it('falls back to the level objectives when the report is empty', () => {
    const merged = objectivesWithHints(null, LEVEL)
    expect(merged).toHaveLength(1)
    expect(merged[0].passed).toBe(false)
  })
})

describe('useLevelSession', () => {
  beforeEach(() => {
    installMemoryStorage()
    useDocumentStore.getState().load(buildStarterDoc(null))
  })

  it('seeds the document, the sketch and the simulation when a level opens', () => {
    const { result } = renderHook(() => useLevelSession({ levelId: LEVEL.id, level: LEVEL, mode: 'campaign' }))

    expect(result.current.level).toBe(LEVEL)
    expect(result.current.boardId).toBe('uno')
    expect(useDocumentStore.getState().doc.mcu).toBe('uno')
    expect(useWorkspaceStore.getState().code).toBe(LEVEL.starterCode)
    expect(useWorkspaceStore.getState().levelId).toBe(LEVEL.id)
    expect(useSimStore.getState().level).toBe(LEVEL)
    expect(useSimStore.getState().doc.mcu).toBe('uno')
    expect(result.current.draftOffer).toBeNull()
  })

  it('offers a saved draft and restores it on demand', () => {
    const draftDoc = { ...buildStarterDoc(LEVEL), meta: { name: 'resumed' } }
    localStorage.setItem(
      `vq.draft.${LEVEL.id}`,
      JSON.stringify({ doc: draftDoc, code: '// resumed sketch\n', blocklyXml: null, editorMode: 'text', savedAt: Date.now() }),
    )

    const { result } = renderHook(() => useLevelSession({ levelId: LEVEL.id, level: LEVEL, mode: 'campaign' }))
    expect(result.current.draftOffer).not.toBeNull()

    act(() => result.current.resumeDraft())
    expect(useWorkspaceStore.getState().code).toBe('// resumed sketch\n')
    expect(useDocumentStore.getState().doc.meta.name).toBe('resumed')
    expect(result.current.draftOffer).toBeNull()
  })

  it('restarts the level back to its starter circuit and sketch', () => {
    const { result } = renderHook(() => useLevelSession({ levelId: LEVEL.id, level: LEVEL, mode: 'campaign' }))
    act(() => {
      useWorkspaceStore.getState().setCode('// scribbles\n')
      useDocumentStore.getState().addComponent('resistor', { anchor: { board: 'bb1', hole: 'e10' } })
    })
    expect(useDocumentStore.getState().doc.components).toHaveLength(2)

    act(() => result.current.restartLevel())
    expect(useDocumentStore.getState().doc.components).toHaveLength(1)
    expect(useWorkspaceStore.getState().code).toBe(LEVEL.starterCode)
  })

  it('keeps new edits when the player starts working instead of accepting an older draft', () => {
    localStorage.setItem(`vq.draft.${LEVEL.id}`, JSON.stringify({ doc: buildStarterDoc(LEVEL), code: '// older work' }))
    const { result } = renderHook(() => useLevelSession({ levelId: LEVEL.id, level: LEVEL }))
    expect(result.current.draftOffer).not.toBeNull()
    act(() => useWorkspaceStore.getState().setCode('// new work'))
    expect(result.current.draftOffer).toBeNull()
    expect(useWorkspaceStore.getState().peekDraft('campaign', LEVEL.id).code).toBe('// new work')
  })

  it('reports a missing level', () => {
    const { result } = renderHook(() => useLevelSession({ levelId: 'nope', level: null, mode: 'campaign' }))
    expect(result.current.notFound).toBe(true)
  })
})

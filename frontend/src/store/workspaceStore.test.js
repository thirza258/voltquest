// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { installMemoryStorage } from '../test-utils/localStorage.js'

async function freshStore() {
  vi.resetModules()
  const mod = await import('./workspaceStore.js')
  return mod.useWorkspaceStore
}

const OBJECTIVES = [
  { id: 'place', passed: true, hints: { tier1: 'Place it', tier2: { componentTypes: ['uno'] }, tier3: true } },
  { id: 'wire', passed: false, hints: { tier1: 'Wire it', tier2: { mcuPins: ['D13'] }, tier3: true } },
  { id: 'blink', passed: false, hints: { tier1: 'Blink it', tier2: null, tier3: false } },
]

describe('workspaceStore', () => {
  beforeEach(() => {
    installMemoryStorage()
    vi.useRealTimers()
  })

  it('opens a level with campaign defaults and clears previous hint state', async () => {
    const store = await freshStore()
    store.getState().requestHint(OBJECTIVES)
    store.getState().openLevel({ mode: 'campaign', levelId: 'w1-l4', code: 'void setup(){}' })

    const s = store.getState()
    expect(s.levelId).toBe('w1-l4')
    expect(s.code).toBe('void setup(){}')
    expect(s.leftTab).toBe('objectives')
    expect(s.hintTier).toEqual({})
    expect(s.showGhost).toBe(false)
  })

  it('opens the sandbox on the parts tab instead of objectives', async () => {
    const store = await freshStore()
    store.getState().openLevel({ mode: 'sandbox' })
    expect(store.getState().leftTab).toBe('parts')
  })

  it('walks hint tiers on the first unpassed objective', async () => {
    const store = await freshStore()

    const first = store.getState().requestHint(OBJECTIVES)
    expect(first).toEqual({ objectiveId: 'wire', tier: 1 })
    expect(store.getState().hintTargets).toBeNull()
    expect(store.getState().leftTab).toBe('objectives')

    const second = store.getState().requestHint(OBJECTIVES)
    expect(second.tier).toBe(2)
    expect(store.getState().hintTargets).toEqual({ mcuPins: ['D13'] })
    expect(store.getState().showGhost).toBe(false)

    const third = store.getState().requestHint(OBJECTIVES)
    expect(third.tier).toBe(3)
    expect(store.getState().showGhost).toBe(true)

    // Tier is capped at 3.
    expect(store.getState().requestHint(OBJECTIVES).tier).toBe(3)
    expect(store.getState().maxHintTier()).toBe(3)
  })

  it('does not show a ghost for an objective that opts out of tier 3', async () => {
    const store = await freshStore()
    const onlyBlink = [{ id: 'blink', passed: false, hints: { tier1: 'x', tier2: null, tier3: false } }]
    store.getState().requestHint(onlyBlink)
    store.getState().requestHint(onlyBlink)
    store.getState().requestHint(onlyBlink)
    expect(store.getState().showGhost).toBe(false)
  })

  it('clears hints for an objective once it passes', async () => {
    const store = await freshStore()
    store.getState().requestHint(OBJECTIVES)
    store.getState().requestHint(OBJECTIVES)
    expect(store.getState().hintTargets).not.toBeNull()

    store.getState().clearHintsFor('wire')
    expect(store.getState().hintTier.wire).toBeUndefined()
    expect(store.getState().hintTargets).toBeNull()
  })

  it('tracks whether switching to blocks would discard manual edits', async () => {
    const store = await freshStore()
    expect(store.getState().blocksWouldOverwrite()).toBe(false)

    store.getState().setBlocklyXml('<xml/>')
    store.getState().setCode('int x;', { fromBlocks: false })
    expect(store.getState().blocksWouldOverwrite()).toBe(true)

    // Code regenerated from blocks is not a manual edit.
    store.getState().setCode('int y;', { fromBlocks: true })
    expect(store.getState().blocksWouldOverwrite()).toBe(false)
  })

  it('validates tab and tool inputs', async () => {
    const store = await freshStore()
    store.getState().setLeftTab('learn')
    store.getState().setLeftTab('nonsense')
    expect(store.getState().leftTab).toBe('learn')

    store.getState().setRightTab('iot')
    expect(store.getState().rightTab).toBe('iot')

    store.getState().setTool('wire')
    expect(store.getState().tool).toBe('wire')
    store.getState().setTool('anything-else')
    expect(store.getState().tool).toBe('select')

    store.getState().setWireColor('green')
    expect(store.getState().wireColor).toBe('green')
    store.getState().setWireColor('chartreuse')
    expect(store.getState().wireColor).toBe('green')
  })

  it('persists panel sizes and serial visibility across reloads', async () => {
    const store = await freshStore()
    store.getState().setPanelSize('left', 360)
    store.getState().toggleSerial(false)

    const reloaded = await freshStore()
    expect(reloaded.getState().panels.left).toBe(360)
    expect(reloaded.getState().serialOpen).toBe(false)
  })

  it('enforces a minimum panel width', async () => {
    const store = await freshStore()
    store.getState().setPanelSize('right', 10)
    expect(store.getState().panels.right).toBe(120)
  })

  it('saves and restores a per-level draft', async () => {
    const store = await freshStore()
    store.getState().openLevel({ mode: 'campaign', levelId: 'w2-l1', code: 'start' })
    store.getState().setDocProvider(() => ({ version: 1, components: [{ id: 'c_led' }] }))
    store.getState().setCode('int sos;')
    store.getState().saveDraft()

    const draft = store.getState().peekDraft('campaign', 'w2-l1')
    expect(draft.code).toBe('int sos;')
    expect(draft.doc.components).toHaveLength(1)

    // A different level has its own slot.
    expect(store.getState().peekDraft('campaign', 'w2-l2')).toBeNull()

    store.getState().openLevel({ mode: 'campaign', levelId: 'w2-l1', code: 'start' })
    store.getState().applyDraft(draft)
    expect(store.getState().code).toBe('int sos;')
    expect(store.getState().draftRestored).toBe(true)

    store.getState().discardDraft('campaign', 'w2-l1')
    expect(store.getState().peekDraft('campaign', 'w2-l1')).toBeNull()
  })

  it('keeps the sandbox draft in its own slot and never drafts a showcase preview', async () => {
    const store = await freshStore()
    store.getState().openLevel({ mode: 'sandbox' })
    store.getState().setCode('sandbox code')
    store.getState().saveDraft(() => null)
    expect(store.getState().peekDraft('sandbox', null).code).toBe('sandbox code')

    store.getState().openLevel({ mode: 'showcase', levelId: 'abc' })
    store.getState().setCode('read only')
    store.getState().saveDraft(() => null)
    expect(store.getState().peekDraft('showcase', 'abc')).toBeNull()
  })

  it('debounces draft writes while typing', async () => {
    vi.useFakeTimers()
    const store = await freshStore()
    store.getState().openLevel({ mode: 'campaign', levelId: 'w1-l1', code: '' })
    store.getState().setDocProvider(() => null)

    store.getState().setCode('a')
    store.getState().setCode('ab')
    store.getState().setCode('abc')
    expect(store.getState().peekDraft()).toBeNull() // nothing written yet

    vi.advanceTimersByTime(1100)
    expect(store.getState().peekDraft().code).toBe('abc')
  })
})

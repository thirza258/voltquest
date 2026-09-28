/**
 * Workspace UI state — CONTRACTS §11.2.
 *
 * Everything here is view state: which mode and level are open, the code buffer, editor mode, panel
 * tabs and sizes, the canvas tool, and the per-objective hint tier. It deliberately holds no
 * simulation or circuit state (those live in simStore and documentStore) so that the workspace can
 * re-render from cheap, serialisable values.
 *
 * In-progress work is mirrored to localStorage as a draft per level (and one for the sandbox), so a
 * refresh mid-level does not lose a circuit or a half-written sketch.
 */
import { create } from 'zustand'
import { readJson, removeKey, writeJson } from '../lib/storage.js'
import { WIRE_COLORS } from '../engine/components/registry.js'

const SETTINGS_KEY = 'vq.workspace'
const DRAFT_PREFIX = 'vq.draft.'
const DRAFT_DEBOUNCE_MS = 1000

export const LEFT_TABS = ['objectives', 'parts', 'inspect', 'learn', 'assistant']
export const RIGHT_TABS = ['code', 'phone', 'iot']

const DEFAULT_PANELS = { left: 300, right: 420, serial: 180 }

const STARTER_CODE = `void setup() {\n\n}\n\nvoid loop() {\n\n}\n`

/** Panel sizes and the serial-monitor collapse state outlive a session; nothing else does. */
function loadPersisted() {
  const saved = readJson(SETTINGS_KEY, null)
  if (!saved || typeof saved !== 'object') return { panels: { ...DEFAULT_PANELS }, serialOpen: true }
  return {
    panels: { ...DEFAULT_PANELS, ...(saved.panels ?? {}) },
    serialOpen: saved.serialOpen !== false,
  }
}

const draftKey = (mode, levelId) => `${DRAFT_PREFIX}${mode === 'sandbox' ? `sandbox${levelId && levelId !== 'new' ? `.${levelId}` : ''}` : levelId ?? 'unknown'}`

const persisted = loadPersisted()

export const useWorkspaceStore = create((set, get) => {
  let draftTimer = null

  const persistSettings = () => {
    const { panels, serialOpen } = get()
    writeJson(SETTINGS_KEY, { panels, serialOpen })
  }

  /** Debounced so typing in Monaco does not hammer localStorage. */
  const scheduleDraftSave = () => {
    if (!get().draftsEnabled) return
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      draftTimer = null
      get().saveDraft()
    }, DRAFT_DEBOUNCE_MS)
  }

  return {
    mode: 'campaign',
    levelId: null,
    code: STARTER_CODE,
    editorMode: 'text',
    blocklyXml: null,
    /** Set when the text buffer was edited by hand since blocks last generated it. */
    codeDirtyFromText: false,

    leftTab: 'objectives',
    rightTab: 'code',
    serialOpen: persisted.serialOpen,
    panels: persisted.panels,

    tool: 'select',
    wireColor: WIRE_COLORS[0],

    /** Per-objective hint tier: { [objectiveId]: 0..3 }. */
    hintTier: {},
    hintTargets: null,
    showGhost: false,

    /** Which briefing/dialog is open, so only one modal shows at a time. */
    modal: null,
    draftsEnabled: true,
    draftRestored: false,

    /** Point the workspace at a level (or the sandbox) and reset per-level UI state. */
    openLevel({ mode = 'campaign', levelId = null, code, blocklyXml = null, editorMode = 'text' } = {}) {
      if (draftTimer) {
        clearTimeout(draftTimer)
        draftTimer = null
      }
      set({
        mode,
        levelId,
        code: code ?? STARTER_CODE,
        blocklyXml,
        editorMode,
        codeDirtyFromText: false,
        leftTab: mode === 'campaign' ? 'objectives' : 'parts',
        rightTab: 'code',
        tool: 'select',
        hintTier: {},
        hintTargets: null,
        showGhost: false,
        modal: null,
        draftRestored: false,
      })
    },

    setCode(code, { fromBlocks = false } = {}) {
      set({ code, codeDirtyFromText: fromBlocks ? false : true })
      scheduleDraftSave()
    },

    setBlocklyXml(blocklyXml) {
      set({ blocklyXml })
      scheduleDraftSave()
    },

    /**
     * Switch between the text and block editors. Going text → blocks can discard hand edits, so the
     * caller is told whether a confirmation is needed rather than this store deciding for it.
     */
    setEditorMode(editorMode) {
      set({ editorMode })
      scheduleDraftSave()
    },

    /** True when switching to blocks would overwrite manual code edits. */
    blocksWouldOverwrite() {
      const { editorMode, codeDirtyFromText, blocklyXml } = get()
      return editorMode === 'text' && codeDirtyFromText && !!blocklyXml
    },

    setLeftTab(leftTab) {
      if (LEFT_TABS.includes(leftTab)) set({ leftTab })
    },
    setRightTab(rightTab) {
      if (RIGHT_TABS.includes(rightTab)) set({ rightTab })
    },
    toggleSerial(open) {
      set((s) => ({ serialOpen: open ?? !s.serialOpen }))
      persistSettings()
    },
    setPanelSize(which, px) {
      set((s) => ({ panels: { ...s.panels, [which]: Math.max(120, Math.round(px)) } }))
      persistSettings()
    },

    setTool(tool) {
      set({ tool: tool === 'wire' ? 'wire' : 'select' })
    },
    setWireColor(wireColor) {
      if (WIRE_COLORS.includes(wireColor)) set({ wireColor })
    },

    openModal(modal) {
      set({ modal })
    },
    closeModal() {
      set({ modal: null })
    },

    /**
     * Reveal the next hint for the first unpassed objective.
     * Tier 1 is text, tier 2 highlights the board, tier 3 shows the ghost blueprint.
     * @param {{ id: string, passed: boolean, hints?: object }[]} objectives
     * @returns {{ objectiveId: string, tier: number } | null}
     */
    requestHint(objectives = []) {
      const target = objectives.find((o) => !o.passed) ?? objectives.at(-1)
      if (!target) return null
      const current = get().hintTier[target.id] ?? 0
      const tier = Math.min(3, current + 1)
      const hints = target.hints ?? {}
      set((s) => ({
        hintTier: { ...s.hintTier, [target.id]: tier },
        hintTargets: tier >= 2 ? hints.tier2 ?? null : null,
        showGhost: tier >= 3 && hints.tier3 !== false,
        leftTab: 'objectives',
      }))
      return { objectiveId: target.id, tier }
    },

    /** Highest hint tier reached anywhere in this level, for progress reporting. */
    maxHintTier() {
      const tiers = Object.values(get().hintTier)
      return tiers.length ? Math.max(...tiers) : 0
    },

    /** Clear hint state for an objective that has since passed (so the ghost does not linger). */
    clearHintsFor(objectiveId) {
      const { hintTier } = get()
      if (!(objectiveId in hintTier)) return
      const next = { ...hintTier }
      delete next[objectiveId]
      set({ hintTier: next, hintTargets: null, showGhost: false })
    },

    resetHints() {
      set({ hintTier: {}, hintTargets: null, showGhost: false })
    },

    setShowGhost(showGhost) {
      set({ showGhost })
    },

    // ---- drafts -------------------------------------------------------------

    /** Write the current circuit/code to the level's draft slot. `getDoc` supplies the circuit. */
    saveDraft(getDoc) {
      const { mode, levelId, code, blocklyXml, editorMode, docProvider } = get()
      if (!get().draftsEnabled) return
      if (mode === 'showcase') return
      const provider = getDoc ?? docProvider
      const doc = typeof provider === 'function' ? provider() : null
      writeJson(draftKey(mode, levelId), { doc, code, blocklyXml, editorMode, savedAt: Date.now() })
    },

    /** Register a function that returns the current CircuitDoc, so drafts can include it. */
    setDocProvider(docProvider) {
      set({ docProvider })
    },

    /** Read a saved draft without applying it (the UI offers "resume" or "start over"). */
    peekDraft(mode = get().mode, levelId = get().levelId) {
      return readJson(draftKey(mode, levelId), null)
    },

    /** Apply a saved draft's code/blocks to the workspace. The caller loads the doc into documentStore. */
    applyDraft(draft) {
      if (!draft) return null
      set({
        code: draft.code ?? get().code,
        blocklyXml: draft.blocklyXml ?? null,
        editorMode: draft.editorMode ?? 'text',
        draftRestored: true,
        codeDirtyFromText: false,
      })
      return draft
    },

    discardDraft(mode = get().mode, levelId = get().levelId) {
      removeKey(draftKey(mode, levelId))
      set({ draftRestored: false })
    },

    setDraftsEnabled(draftsEnabled) {
      set({ draftsEnabled })
    },
  }
})

export default useWorkspaceStore

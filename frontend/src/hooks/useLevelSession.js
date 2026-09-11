/**
 * Everything that happens when a campaign level is opened, played and finished.
 *
 * The workspace itself stays presentational: this hook loads the level, seeds the circuit and the
 * sketch, keeps the simulation in step with the document, offers a saved draft back to the player,
 * counts attempts and hints, and latches the success modal exactly once per run.
 *
 * Pure data in, stores out — a caller may pass a `level` fixture instead of a `levelId` (tests do),
 * so nothing here depends on the quest content actually being bundled.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as registry from '../engine/components/registry.js'
import { getLevel } from '../content/index.js'
import { emptyDoc, useDocumentStore } from '../store/documentStore.js'
import { usePlayerStore } from '../store/playerStore.js'
import { useSimStore } from '../store/simStore.js'
import { useWorkspaceStore } from '../store/workspaceStore.js'

const DRAFT_SAVE_MS = 1000
const FALLBACK_CODE = 'void setup() {\n\n}\n\nvoid loop() {\n\n}\n'

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)))

/**
 * Strip any damage a previous level baked into a starter circuit (QUEST_SCHEMA: "damage is cleared
 * on load"). Damage lives in the simulation, but content may carry a marker prop on the part.
 */
function clearDamage(doc) {
  const next = clone(doc)
  next.components = (next.components ?? []).map((component) => {
    if (!component?.props) return component
    const { damaged: _damaged, blown: _blown, ...props } = component.props
    return { ...component, props }
  })
  return next
}

/**
 * The circuit a level starts from: its `starterCircuit`, or a bare board at
 * `registry.defaultMcuPlacement(startBoard ?? board)`.
 * @param {object|null} level
 * @returns {object} CircuitDoc
 */
export function buildStarterDoc(level) {
  if (level?.starterCircuit) return clearDamage(level.starterCircuit)
  const boardMode = level?.boardMode ?? 'half'
  const doc = emptyDoc(boardMode)
  const boardId = level?.startBoard ?? level?.board ?? null
  if (!boardId || !registry.getDef(boardId)) return doc
  const placement = registry.defaultMcuPlacement(boardId, boardMode)
  const mcu = registry.createComponent(boardId, placement)
  return { ...doc, mcu: boardId, components: [mcu] }
}

/** A draft is only worth offering when it actually holds something. */
function draftIsUseful(draft) {
  if (!draft || typeof draft !== 'object') return false
  const hasDoc = !!draft.doc && ((draft.doc.components?.length ?? 0) > 0 || (draft.doc.wires?.length ?? 0) > 0)
  const hasCode = typeof draft.code === 'string' && draft.code.trim().length > 0
  return hasDoc || hasCode
}

/**
 * Merge the per-objective `hints` from the level onto the validator's report, which only carries
 * `{ id, text, passed, rules }`. Without this the hint tiers have no targets to reveal.
 */
export function objectivesWithHints(report, level) {
  const fromLevel = level?.objectives ?? []
  const reported = report?.objectives
  if (!Array.isArray(reported) || !reported.length) {
    return fromLevel.map((objective) => ({ ...objective, passed: false }))
  }
  return reported.map((objective) => {
    const source = fromLevel.find((o) => o.id === objective.id)
    return source ? { ...objective, hints: source.hints } : objective
  })
}

/**
 * @param {{ levelId?: string, mode?: 'campaign'|'sandbox'|'showcase', level?: object|null, enabled?: boolean }} options
 */
export function useLevelSession({ levelId, mode = 'campaign', level: levelOverride = null, enabled = true } = {}) {
  const level = useMemo(() => levelOverride ?? (levelId ? getLevel(levelId) : null), [levelOverride, levelId])

  const doc = useDocumentStore((s) => s.doc)
  const loadDoc = useDocumentStore((s) => s.load)

  const code = useWorkspaceStore((s) => s.code)
  const hintTier = useWorkspaceStore((s) => s.hintTier)

  const objectives = useSimStore((s) => s.objectives)
  const simState = useSimStore((s) => s.state)

  const [draftOffer, setDraftOffer] = useState(null)
  const [success, setSuccess] = useState(null)

  /** Guards so the success modal fires once per run and `completeLevel` is never double-counted. */
  const passedRef = useRef(false)
  const firedRunRef = useRef(null)
  const sessionKey = `${mode}:${levelId ?? 'new'}`
  const loadedKeyRef = useRef(null)

  // ---- open the level -----------------------------------------------------------------------

  useEffect(() => {
    if (!enabled) return
    if (loadedKeyRef.current === sessionKey) return
    loadedKeyRef.current = sessionKey

    const workspace = useWorkspaceStore.getState()
    const sim = useSimStore.getState()
    const starterDoc = buildStarterDoc(level)

    workspace.openLevel({
      mode,
      levelId,
      code: level?.starterCode ?? FALLBACK_CODE,
      blocklyXml: level?.starterBlocklyXml ?? null,
      editorMode: 'text',
    })
    workspace.setDocProvider(() => useDocumentStore.getState().doc)
    loadDoc(starterDoc)

    sim.setLevel(mode === 'campaign' ? level : null, mode)
    sim.reset()
    sim.setDocument(useDocumentStore.getState().doc)
    sim.setCode(useWorkspaceStore.getState().code)

    passedRef.current = false
    firedRunRef.current = null
    setSuccess(null)

    const draft = workspace.peekDraft(mode, levelId)
    setDraftOffer(draftIsUseful(draft) ? draft : null)
  }, [enabled, sessionKey, level, levelId, mode, loadDoc])

  // ---- keep the simulation in step with the editor -------------------------------------------

  useEffect(() => {
    if (!enabled || loadedKeyRef.current !== sessionKey) return
    useSimStore.getState().setDocument(doc)
  }, [doc, enabled, sessionKey])

  useEffect(() => {
    if (!enabled || loadedKeyRef.current !== sessionKey) return
    useSimStore.getState().setCode(code)
  }, [code, enabled, sessionKey])

  // Circuit edits are not routed through workspaceStore, so drafts are saved from here.
  useEffect(() => {
    if (!enabled || mode === 'showcase' || loadedKeyRef.current !== sessionKey) return undefined
    const timer = setTimeout(() => useWorkspaceStore.getState().saveDraft(), DRAFT_SAVE_MS)
    return () => clearTimeout(timer)
  }, [doc, enabled, mode, sessionKey])

  // ---- success latch ------------------------------------------------------------------------

  useEffect(() => {
    if (!enabled || mode !== 'campaign' || !level) return
    const allPassed = !!objectives?.allPassed
    const wasPassed = passedRef.current
    passedRef.current = allPassed
    if (!allPassed || wasPassed) return

    const runId = simState?.runId ?? 0
    if (firedRunRef.current === runId) return
    firedRunRef.current = runId

    const stars = Math.max(1, Math.min(3, Number(objectives?.stars ?? 1)))
    const result = usePlayerStore.getState().completeLevel(level.id, {
      level,
      stars,
      objectives_passed: (objectives?.objectives ?? []).filter((o) => o.passed).map((o) => o.id),
      code_lines: objectives?.efficiency?.codeLines ?? 0,
      component_count: objectives?.efficiency?.componentCount ?? 0,
      damage_count: Object.keys(simState?.damaged ?? {}).length,
      duration_ms: Math.round(simState?.millis ?? 0),
    })
    setSuccess({
      stars,
      starReasons: objectives?.starReasons ?? [],
      xpGained: result?.xpGained ?? 0,
      levelUp: !!result?.levelUp,
      unlocked: result?.unlocked ?? { skins: [], wirePalettes: [] },
    })
    useWorkspaceStore.getState().openModal('success')
  }, [enabled, level, mode, objectives, simState])

  // ---- actions ------------------------------------------------------------------------------

  const run = useCallback(() => {
    const sim = useSimStore.getState()
    if (simState?.status === 'running' || simState?.status === 'compiling') {
      sim.stop()
      return undefined
    }
    if (level) usePlayerStore.getState().recordAttempt(level.id, useWorkspaceStore.getState().maxHintTier())
    passedRef.current = false
    return sim.run()
  }, [level, simState?.status])

  const stop = useCallback(() => useSimStore.getState().stop(), [])
  const resetSim = useCallback(() => {
    passedRef.current = false
    useSimStore.getState().reset()
  }, [])

  const requestHint = useCallback(() => {
    const workspace = useWorkspaceStore.getState()
    const merged = objectivesWithHints(useSimStore.getState().objectives, level)
    const result = workspace.requestHint(merged)
    if (result && level) usePlayerStore.getState().recordAttempt(level.id, workspace.maxHintTier())
    return result
  }, [level])

  /** Put the level back to its starter circuit and sketch, dropping the draft. */
  const restartLevel = useCallback(() => {
    const workspace = useWorkspaceStore.getState()
    workspace.discardDraft(mode, levelId)
    workspace.openLevel({
      mode,
      levelId,
      code: level?.starterCode ?? FALLBACK_CODE,
      blocklyXml: level?.starterBlocklyXml ?? null,
      editorMode: 'text',
    })
    workspace.setDocProvider(() => useDocumentStore.getState().doc)
    loadDoc(buildStarterDoc(level))
    const sim = useSimStore.getState()
    sim.reset()
    sim.setDocument(useDocumentStore.getState().doc)
    sim.setCode(useWorkspaceStore.getState().code)
    passedRef.current = false
    firedRunRef.current = null
    setSuccess(null)
    setDraftOffer(null)
  }, [level, levelId, loadDoc, mode])

  const resumeDraft = useCallback(() => {
    const draft = draftOffer
    if (!draft) return
    const workspace = useWorkspaceStore.getState()
    workspace.applyDraft(draft)
    if (draft.doc) loadDoc(draft.doc)
    const sim = useSimStore.getState()
    sim.setDocument(useDocumentStore.getState().doc)
    sim.setCode(useWorkspaceStore.getState().code)
    setDraftOffer(null)
  }, [draftOffer, loadDoc])

  const dismissDraft = useCallback(() => {
    useWorkspaceStore.getState().discardDraft(mode, levelId)
    setDraftOffer(null)
  }, [levelId, mode])

  const closeSuccess = useCallback(() => {
    setSuccess(null)
    useWorkspaceStore.getState().closeModal()
  }, [])

  /** The board actually on the bench — w3-l1 starts on an Uno but targets an ESP32. */
  const boardId = doc?.mcu ?? level?.startBoard ?? level?.board ?? null

  return {
    level,
    notFound: !!levelId && !level,
    boardId,
    doc,
    code,
    objectives,
    simState,
    hintTier,
    draftOffer,
    success,
    run,
    stop,
    resetSim,
    restartLevel,
    requestHint,
    resumeDraft,
    dismissDraft,
    closeSuccess,
  }
}

export default useLevelSession

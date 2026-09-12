/**
 * Headless quest harness.
 *
 * Loads a level's reference solution (circuit + sketch) into an inline simulation, runs virtual time
 * forward in small steps, applies any scripted control actions, and reports whether the level's own
 * objectives pass. This is the project's main integration test: it exercises the registry, the
 * circuit solver, the interpreter, the runtime and the validator together, exactly as a player would.
 *
 * Runs in plain node — no DOM, no Worker, no timers.
 */
import { createSimulation } from './sim/index.js'
import { evaluateObjectives } from './validator/index.js'
import * as registry from './components/registry.js'

const STEP_MS = 50
const DEFAULT_RUN_MS = 6000

/** Deep clone so a run can never mutate the bundled level content. */
const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)))

/**
 * Resolve a solution action's `select` to a component id in the document.
 * Accepts { componentId }, { componentType, index?, props? }.
 */
function resolveActionTarget(doc, select) {
  if (!select) return null
  if (select.componentId) return select.componentId
  const matches = (doc.components ?? []).filter((c) => {
    if (select.componentType && c.type !== select.componentType) return false
    for (const [k, v] of Object.entries(select.props ?? {})) if (c.props?.[k] !== v) return false
    return true
  })
  const index = typeof select.index === 'number' ? select.index : 0
  return matches[index]?.id ?? null
}

/**
 * Run one level's reference solution.
 *
 * @param {object} level a level object from content/quests
 * @param {{ runMs?: number, stepMs?: number }} [options]
 * @returns {Promise<{ allPassed, stars, objectives, elapsedMs, warnings, events, serial, error }>}
 */
export async function runLevelSolution(level, options = {}) {
  const runMs = options.runMs ?? level?.solutionRunMs ?? DEFAULT_RUN_MS
  const stepMs = options.stepMs ?? STEP_MS
  const doc = clone(level?.solution?.circuit)
  const code = level?.solution?.code ?? ''

  if (!doc) {
    return { allPassed: false, stars: 0, objectives: [], elapsedMs: 0, warnings: [], events: [], serial: '', error: 'Level has no solution.circuit' }
  }

  const sim = createSimulation({ inline: true })
  try {
    sim.setDocument(doc)
    sim.setCode(code)
    sim.setPowered(true)

    // Sticky objective state, exactly as the workspace maintains it.
    let sticky = {}
    const report = () => {
      const state = sim.getState()
      const result = evaluateObjectives(level, {
        doc,
        compiled: state.compiled,
        sim: state,
        code,
        board: state.compiled?.mcu?.board ?? null,
        registry,
        sticky: state.status === 'running' ? sticky : {},
      })
      if (state.status === 'running') {
        for (const objective of result.objectives) if (objective.passed) sticky[objective.id] = true
      } else {
        sticky = {}
      }
      return result
    }

    // Wiring-only levels can already be complete before the sketch runs.
    let result = report()

    const runResult = await sim.run()
    if (!runResult.ok) {
      const messages = (runResult.errors ?? []).map((e) => `line ${e.line ?? '?'}: ${e.message}`).join('; ')
      return {
        allPassed: false,
        stars: 0,
        objectives: result.objectives,
        elapsedMs: 0,
        warnings: sim.getState().warnings ?? [],
        events: [],
        serial: '',
        error: `Sketch did not compile — ${messages || 'unknown error'}`,
      }
    }

    // Actions are scripted control changes (pressing a button, turning a knob) at virtual times.
    const actions = (level?.solution?.actions ?? [])
      .map((a) => ({ ...a, componentId: resolveActionTarget(doc, a.select) }))
      .sort((a, b) => (a.atMs ?? 0) - (b.atMs ?? 0))
    let nextAction = 0
    let actionError = null

    let elapsedMs = 0
    while (elapsedMs < runMs) {
      while (nextAction < actions.length && (actions[nextAction].atMs ?? 0) <= elapsedMs) {
        const action = actions[nextAction++]
        if (action.componentId && action.patch) sim.setControl(action.componentId, action.patch)
        if (action.http) void sim.httpRequest(action.http).catch((error) => { actionError = error.error ?? error.message ?? 'HTTP action failed' })
        if (action.serial != null) sim.serialWrite(action.serial)
        if (action.mqtt) sim.mqttPublish(action.mqtt.topic, action.mqtt.payload)
      }
      sim.advance(stepMs)
      // Let request promises settle without introducing host timers into deterministic execution.
      await Promise.resolve()
      elapsedMs += stepMs
      result = report()
      if (result.allPassed) break
    }

    const state = sim.getState()
    return {
      allPassed: result.allPassed,
      stars: result.stars,
      objectives: result.objectives,
      starReasons: result.starReasons,
      elapsedMs,
      warnings: state.warnings ?? [],
      events: state.events ?? [],
      serial: state.trace?.serialText ?? '',
      error: state.runtimeError ? `${state.runtimeError.message} (line ${state.runtimeError.line})` : actionError,
    }
  } finally {
    sim.dispose()
  }
}

/**
 * Run every level in order.
 * @param {Record<string, object>} levels
 * @param {string[]} [order]
 */
export async function runAllLevels(levels, order) {
  const ids = order?.length ? order : Object.keys(levels ?? {})
  const results = {}
  for (const id of ids) {
    if (!levels[id]) continue
    results[id] = await runLevelSolution(levels[id])
  }
  return results
}

/** One-line explanation of why a run failed — used by the test's failure output. */
export function describeFailure(levelId, result) {
  if (!result) return `${levelId}: no result`
  if (result.error) return `${levelId}: ${result.error}`
  const failed = (result.objectives ?? []).filter((o) => !o.passed)
  if (!failed.length) return `${levelId}: passed`
  const lines = failed.map((o) => `    - ${o.text}\n      ${o.detail ?? 'no detail'}`)
  return `${levelId}: ${failed.length} objective(s) unmet after ${result.elapsedMs} ms\n${lines.join('\n')}`
}

export default runLevelSolution

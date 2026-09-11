/**
 * Simulation store — CONTRACTS §11.2.
 *
 * Owns the single `Simulation` instance, mirrors its snapshots into React state, and (in campaign
 * mode) re-evaluates the level's objectives after every snapshot.
 *
 * Objective stickiness is maintained here rather than in the validator: while the sketch is running,
 * an objective that has passed stays passed until the next `run()`/`reset()`, so a blink that is
 * momentarily LOW does not un-tick a completed step. While the simulation is idle, objectives are
 * recomputed live from the circuit, because power is on at idle and the wiring-only levels must be
 * completable without pressing Run.
 */
import { create } from 'zustand'
import { createSimulation } from '../engine/sim/index.js'
import { evaluateObjectives } from '../engine/validator/index.js'
import { getBoard } from '../engine/boards/index.js'

/** Build the Worker in the browser; fall back to the inline runtime in tests and SSR. */
function defaultCreateWorker() {
  if (typeof Worker === 'undefined') return null
  try {
    return new Worker(new URL('../engine/sim/sim.worker.js', import.meta.url), { type: 'module' })
  } catch {
    return null
  }
}

export function createSimStore({ createWorker = defaultCreateWorker, inline = null } = {}) {
  return create((set, get) => {
    let sim = null
    let unsubscribe = null
    /** Objective ids that have passed during the current run; cleared on run/reset. */
    let sticky = {}

    /** Recompute objectives for the active level and fold in stickiness. */
    function evaluate(state) {
      const { level, mode } = get()
      if (!level || mode !== 'campaign') return null
      const running = state.status === 'running'
      if (!running) sticky = {}

      const board = state.compiled?.mcu?.board ?? (state.board ? getBoard(state.board) : null)
      let report
      try {
        report = evaluateObjectives(level, {
          doc: get().doc,
          compiled: state.compiled,
          sim: state,
          code: get().code,
          board,
          sticky: running ? sticky : {},
        })
      } catch (error) {
        // A malformed rule must never take the workspace down with it.
        return { objectives: [], allPassed: false, stars: 0, starReasons: [`Objective check failed: ${error.message}`], efficiency: { codeLines: 0, componentCount: 0 } }
      }
      if (running) for (const objective of report.objectives ?? []) if (objective.passed) sticky[objective.id] = true
      return report
    }

    function publish(state) {
      set({ state, objectives: evaluate(state) })
    }

    return {
      /** The Simulation instance; null until `init()` runs. */
      sim: null,
      state: null,
      objectives: null,
      /** Level being validated (campaign mode only) and the inputs the validator needs. */
      level: null,
      mode: 'campaign',
      doc: null,
      code: '',

      /** Create the simulation. Safe to call repeatedly; only the first call builds anything. */
      init() {
        if (sim) return sim
        sim = createSimulation({ createWorker, inline })
        unsubscribe = sim.subscribe(publish)
        set({ sim, state: sim.getState() })
        return sim
      },

      /** Point the store at a level (campaign) or clear it (sandbox/showcase). */
      setLevel(level, mode = 'campaign') {
        sticky = {}
        set({ level: level ?? null, mode, objectives: null })
        const state = get().state
        if (state) set({ objectives: evaluate(state) })
      },

      /** Push the current circuit into the simulation. */
      setDocument(doc) {
        set({ doc })
        get().init().setDocument(doc)
      },

      /** Push the current sketch source (used by the next run). */
      setCode(code) {
        set({ code })
        get().init().setCode(code)
      },

      async run() {
        sticky = {}
        return get().init().run()
      },

      stop() {
        get().init().stop()
      },

      reset() {
        sticky = {}
        get().init().reset()
      },

      setControl(componentId, patch) {
        get().init().setControl(componentId, patch)
      },

      setPowered(on) {
        get().init().setPowered(on)
      },

      serialWrite(text) {
        get().init().serialWrite(text)
      },

      httpRequest(request) {
        return get().init().httpRequest(request)
      },

      mqttPublish(topic, payload) {
        get().init().mqttPublish(topic, payload)
      },

      /** Tear down the worker; used when the workspace unmounts. */
      dispose() {
        unsubscribe?.()
        unsubscribe = null
        sim?.dispose()
        sim = null
        sticky = {}
        set({ sim: null, state: null, objectives: null })
      },
    }
  })
}

export const useSimStore = createSimStore()

export default useSimStore

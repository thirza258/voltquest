// SimulationController — main-thread owner of the whole simulation state (CONTRACTS §8).
// Compiles the circuit, evaluates it with the MCU pin states, drives the firmware runtime (in a Web Worker or
// inline for tests/headless), converts evaluations into `env` messages and publishes immutable snapshots at most
// once per animation frame. Runs under Node: no DOM/Worker globals are touched — the worker is injected.

import * as defaultCircuit from '../circuit/index.js'
import { createRuntime as defaultCreateRuntime } from '../runtime/index.js'
import { createTrace } from './trace.js'
import { deriveEnv, deriveModuleOutputs, envEquals } from './env.js'
import { createDynamics } from '../drone/dynamics.js'
import { validateDroneDoc } from '../drone/document.js'

const FRAME_MS = 16 // Node fallback for requestAnimationFrame
const INLINE_NOTIFY_MS = 20 // inline mode: at most one notification per 20 virtual ms (≤ 50 / virtual second)
const SERIAL_RING = 2000
const EVENTS_MAX = 200
const HTTP_LOG_MAX = 200
const MQTT_LOG_MAX = 500
const HTTP_BODY_MAX = 16 * 1024
const HTTP_TIMEOUT_MS = 3000
const COMPILE_TIMEOUT_MS = 15000
const MAX_DAMAGE_PASSES = 4 // a blown part can shift current elsewhere; re-evaluate until damage settles

/** Cause + fix text for warnings that originate in the runtime rather than the circuit engine. */
const RUNTIME_WARNING_HINTS = {
  adc2_wifi: 'ADC2 pins (GPIO 0, 2, 4, 12–15, 25–27) cannot be read while WiFi is active. Move the sensor to an ADC1 pin (GPIO 32–39).',
  input_only_pin: 'GPIO 34, 35, 36 and 39 are input-only on the ESP32: they cannot drive outputs or enable pull-ups. Use another GPIO.',
  unbound_device: 'The library found no module on that pin. Check the wiring and the module power pins.',
}

const IDLE_WIFI = { status: 'idle', ssid: null, ip: null, mode: null, rssi: null }

function diagnostic(message, code = null, severity = 'error') {
  return { code, line: 0, col: 0, message, severity }
}

function requestFrame(fn) {
  if (typeof globalThis.requestAnimationFrame === 'function' && typeof globalThis.cancelAnimationFrame === 'function') {
    const id = globalThis.requestAnimationFrame(fn)
    return () => globalThis.cancelAnimationFrame(id)
  }
  const id = setTimeout(fn, FRAME_MS)
  return () => clearTimeout(id)
}

function pushRing(arr, item, max) {
  arr.push(item)
  if (arr.length > max) arr.splice(0, arr.length - max)
}

function pickKeys(obj, keep) {
  const out = {}
  for (const k of Object.keys(obj)) if (keep.has(k)) out[k] = obj[k]
  return out
}

/**
 * Creates a simulation.
 * @param {object} [options]
 * @param {() => { postMessage(msg): void, onmessage: Function|null, terminate(): void }} [options.createWorker]
 *        Worker factory (WorkerLike). When given the runtime runs in that worker in real time.
 * @param {boolean|{ createRuntime?: Function }} [options.inline] Run the runtime on this thread with a virtual clock
 *        driven by `advance(ms)`; an object form injects a runtime factory (tests). Default when no worker factory is given.
 * @param {typeof defaultCircuit} [options.circuit] Circuit-engine module namespace (test injection).
 * @returns {import('./index.js').Simulation}
 */
export function createSimulation({ createWorker = null, inline = null, circuit = defaultCircuit } = {}) {
  const useInline = !createWorker || Boolean(inline)
  const createRuntimeFn = (inline && typeof inline === 'object' && inline.createRuntime) || defaultCreateRuntime
  const trace = createTrace()
  let recordedBuild = null, recordedCode = null

  /** Mutable working state; `getState()` freezes a copy lazily. */
  const st = {
    status: 'idle',
    runId: 0,
    diagnostics: [],
    runtimeError: null,
    millis: 0,
    powered: false,
    board: null,
    compiled: null,
    evaluation: null,
    mcuPins: {},
    controls: {},
    damaged: {},
    burntPins: {},
    warnings: [],
    warningCodesSeen: {},
    events: [],
    serial: [],
    serialSeq: 0,
    serialBaud: null,
    tones: {},
    peripherals: {},
    wifi: { ...IDLE_WIFI },
    http: { started: false, port: null, routes: [], log: [] },
    mqtt: { connected: false, topics: {}, log: [] },
  }

  let doc = null
  let code = ''
  let poweredPref = true
  let transport = null
  let disposed = false

  // publication
  const listeners = new Set()
  let version = 0
  let notifiedVersion = -1
  let snapshot = null
  let cancelFrame = null
  let advancing = false
  let virtualMs = 0
  let lastNotifyVirtualMs = -Infinity

  // per-run bookkeeping
  let runtimeWarnings = []
  let activeWarningCodes = new Set()
  let shortActive = false
  let lastEnv = null
  let envTick = 0
  let unboundPeripheralLogged = false
  let pendingCompile = null
  let httpSeq = 0
  const pendingHttp = new Map()

  // --- snapshots & notification -----------------------------------------------------------------------------

  function buildSnapshot() {
    return Object.freeze({
      status: st.status,
      runId: st.runId,
      diagnostics: st.diagnostics.slice(),
      runtimeError: st.runtimeError,
      millis: st.millis,
      powered: st.powered,
      board: st.board,
      compiled: st.compiled,
      evaluation: st.evaluation,
      mcuPins: { ...st.mcuPins },
      controls: { ...st.controls },
      damaged: { ...st.damaged },
      burntPins: { ...st.burntPins },
      warnings: st.warnings.slice(),
      warningCodesSeen: { ...st.warningCodesSeen },
      events: st.events.slice(),
      serial: st.serial.slice(),
      serialSeq: st.serialSeq,
      serialBaud: st.serialBaud,
      tones: { ...st.tones },
      peripherals: { ...st.peripherals },
      wifi: { ...st.wifi },
      http: { started: st.http.started, port: st.http.port, routes: st.http.routes.slice(), log: st.http.log.slice() },
      mqtt: { connected: st.mqtt.connected, topics: { ...st.mqtt.topics }, log: st.mqtt.log.slice() },
      trace,
      flight: st.flight ? { ...st.flight, replayAvailable: recordedBuild === JSON.stringify(doc) && recordedCode === code && st.flight.timeline.length > 0 && st.flight.timeline[0].id === 1 } : null,
    })
  }

  function getState() {
    if (!snapshot) snapshot = buildSnapshot()
    return snapshot
  }

  function notify() {
    if (notifiedVersion === version) return
    notifiedVersion = version
    const snap = getState()
    for (const listener of [...listeners]) listener(snap)
  }

  function flush() {
    cancelFrame = null
    if (!disposed) notify()
  }

  function scheduleFlush() {
    if (cancelFrame || disposed) return
    cancelFrame = requestFrame(flush)
  }

  /** Marks the state changed: invalidates the snapshot and schedules a notification. */
  function touch() {
    version += 1
    snapshot = null
    if (!advancing) scheduleFlush()
  }

  // --- transports (worker / inline) --------------------------------------------------------------------------

  function makeWorkerTransport() {
    const worker = createWorker()
    worker.onmessage = (event) => onMessage(event?.data)
    if ('onerror' in worker || worker.onerror === undefined) {
      worker.onerror = (event) => {
        st.status = 'error'
        st.runtimeError = { message: event?.message ?? 'Simulation worker crashed', line: 0 }
        pendingCompile?.finish({ ok: false, errors: [diagnostic(st.runtimeError.message, 'worker_error')], warnings: [] })
        touch()
      }
    }
    return {
      kind: 'worker',
      post: (msg) => worker.postMessage(msg),
      load: (source, board) => worker.postMessage({ type: 'load', source, board: board.id, droneDoc: doc?.kind === 'drone' ? doc : null }),
      start: () => worker.postMessage({ type: 'start' }),
      stop: () => worker.postMessage({ type: 'stop' }),
      reset: () => worker.postMessage({ type: 'reset' }),
      dispose: () => worker.terminate(),
    }
  }

  function makeInlineTransport() {
    let runtime = null
    return {
      kind: 'inline',
      post: (msg) => runtime?.handle(msg),
      load: (source, board) => {
        runtime?.stop?.()
        runtime = createRuntimeFn({ board, post: onMessage, realtime: false, droneDoc: doc?.kind === 'drone' ? doc : null })
        return runtime.load(source)
      },
      start: () => runtime?.start(),
      stop: () => runtime?.stop(),
      reset: () => runtime?.reset(),
      advance: (ms) => runtime?.advance(ms),
      dispose: () => runtime?.stop?.(),
    }
  }

  function ensureTransport() {
    if (!transport) transport = useInline ? makeInlineTransport() : makeWorkerTransport()
    return transport
  }

  function firmwareLoaded() {
    return st.status === 'running' || st.status === 'stopped' || st.status === 'error'
  }

  function nowUs() {
    return Math.max(trace.nowUs(), st.millis * 1000)
  }

  // --- circuit evaluation --------------------------------------------------------------------------------------

  function noteWarningCode(code, count = 1) {
    if (!code) return
    st.warningCodesSeen = { ...st.warningCodesSeen, [code]: (st.warningCodesSeen[code] ?? 0) + count }
  }

  /** Turns fresh damage events into sticky dynamicState; returns true when a new part/pin got damaged. */
  function absorbEvents(events) {
    let changed = false
    let shortSeen = false
    for (const ev of events ?? []) {
      if (!ev) continue
      if (ev.type === 'blow') {
        if (!ev.componentId || st.damaged[ev.componentId]) continue
        st.damaged = { ...st.damaged, [ev.componentId]: true }
        changed = true
      } else if (ev.type === 'burnt_pin') {
        if (!ev.pinName || st.burntPins[ev.pinName]) continue
        st.burntPins = { ...st.burntPins, [ev.pinName]: true }
        changed = true
      } else if (ev.type === 'short') {
        shortSeen = true
        if (shortActive) continue
      }
      pushRing(st.events, { ...ev, t: nowUs() }, EVENTS_MAX)
    }
    shortActive = shortSeen
    return changed
  }

  function updateWarnings() {
    const all = [...(st.evaluation?.warnings ?? []), ...runtimeWarnings]
    const codesNow = new Set()
    for (const w of all) if (w?.code) codesNow.add(w.code)
    for (const code of codesNow) if (!activeWarningCodes.has(code)) noteWarningCode(code)
    activeWarningCodes = codesNow
    st.warnings = all
  }

  function updatePinVoltages() {
    const volts = st.evaluation?.mcuPinVoltages
    if (!volts) return
    let next = null
    for (const [pin, state] of Object.entries(st.mcuPins)) {
      const v = volts[pin]
      if (v === undefined || state.voltage === v) continue
      next ??= { ...st.mcuPins }
      next[pin] = { ...state, voltage: v }
    }
    if (next) st.mcuPins = next
  }

  /** Evaluates the DC operating point, applies sticky damage, refreshes warnings and pushes a new env if needed. */
  function evaluateCircuit() {
    if (doc?.kind === 'drone' && st.compiled) {
      st.flight ??= createDynamics(doc, st.compiled, st.damaged).snapshot()
      st.damaged = { ...st.damaged, ...st.flight.damaged }
      if (!st.powered) st.flight = { ...st.flight, armed: false, rpm: [0, 0, 0, 0], electrical: { ...st.flight.electrical, currentA: 0, V_bus: 0, becV: 0, fcPowered: false } }
      st.evaluation = { ok: true, converged: true, nodeVoltages: {}, mcuPinVoltages: {}, pinCurrents: {}, componentStates: {}, supplyCurrentA: st.flight.electrical.currentA, warnings: st.flight.warnings, events: [] }
      st.warnings = st.flight.warnings
      touch(); return
    }
    if (st.compiled) {
      const components = doc?.components ?? []
      let evaluation = null
      for (let pass = 0; pass < MAX_DAMAGE_PASSES; pass++) {
        evaluation = circuit.evaluateCircuit(st.compiled, {
          powered: st.powered,
          mcuPins: st.mcuPins,
          controls: st.controls,
          damaged: st.damaged,
          burntPins: st.burntPins,
          moduleOutputs: deriveModuleOutputs(components, st.controls),
        })
        if (!absorbEvents(evaluation?.events)) break
      }
      st.evaluation = evaluation
      updatePinVoltages()
    }
    updateWarnings()
    publishEnv()
    touch()
  }

  /** Sends `env` to the runtime when the firmware-visible world changed (or unconditionally with `force`). */
  function publishEnv(force = false) {
    if (st.status !== 'running' || !transport || !st.compiled?.mcu) return
    const env = deriveEnv(st.compiled, st.evaluation, st.controls, st.compiled.mcu.board, lastEnv, { tick: envTick })
    if (!force && envEquals(env, lastEnv)) return
    lastEnv = env
    transport.post({ type: 'env', ...env })
  }

  // --- inbound runtime messages ------------------------------------------------------------------------------

  function applyPinChanges(changes) {
    const next = { ...st.mcuPins }
    for (const change of changes ?? []) {
      if (!change || typeof change.pin !== 'string') continue
      const prev = next[change.pin] ?? { mode: 'input', level: 0, duty: 0, freq: null, value: 0, voltage: undefined }
      const merged = { ...prev }
      if (change.mode !== undefined) merged.mode = change.mode
      if (change.level !== undefined) merged.level = change.level
      if (change.duty !== undefined) merged.duty = change.duty
      if (change.freq !== undefined) merged.freq = change.freq
      if (change.value !== undefined) merged.value = change.value
      next[change.pin] = merged
    }
    st.mcuPins = next
  }

  function onCompiled(msg) {
    const errors = (msg.errors ?? []).map((d) => ({ severity: 'error', ...d }))
    const warnings = (msg.warnings ?? []).map((d) => ({ severity: 'warning', ...d }))
    st.diagnostics = [...errors, ...warnings]
    touch()
    pendingCompile?.finish({ ok: Boolean(msg.ok), errors, warnings })
  }

  function onStatus(msg) {
    if (msg.status === 'error') {
      st.status = 'error'
      st.runtimeError = msg.error ? { message: msg.error.message ?? String(msg.error), line: msg.error.line ?? 0 } : { message: 'Runtime error', line: 0 }
      rejectPendingHttp('error')
    } else if (msg.status === 'running') {
      if (st.status === 'compiling' || st.status === 'running') st.status = 'running'
    } else if (msg.status === 'stopped' || msg.status === 'halted') {
      if (st.status === 'running') st.status = 'stopped'
    }
    touch()
  }

  function onLog(msg) {
    if (msg.level !== 'warn') return
    const code = msg.code ?? 'runtime_warning'
    if (runtimeWarnings.some((w) => w.code === code && w.message === msg.message)) return
    runtimeWarnings = [
      ...runtimeWarnings,
      { code, message: msg.message ?? code, hint: RUNTIME_WARNING_HINTS[code] ?? '', severity: 'warning', pinNames: msg.pin ? [msg.pin] : undefined },
    ]
    noteWarningCode(code)
    activeWarningCodes.add(code)
    st.warnings = [...(st.evaluation?.warnings ?? []), ...runtimeWarnings]
    touch()
  }

  function onHttp(msg) {
    if (msg.event === 'serverStarted') {
      st.http = { ...st.http, started: true, port: msg.port ?? st.http.port ?? 80, routes: (msg.routes ?? st.http.routes).slice() }
    } else if (msg.event === 'route') {
      st.http = { ...st.http, routes: (msg.routes ?? st.http.routes).slice() }
    }
    touch()
  }

  function onHttpResponse(msg) {
    const pending = pendingHttp.get(msg.id)
    if (!pending) return
    pendingHttp.delete(msg.id)
    clearTimeout(pending.timer)
    const body = typeof msg.body === 'string' ? msg.body : msg.body == null ? '' : String(msg.body)
    const entry = { t: msg.t ?? nowUs(), method: pending.method, path: pending.path, status: msg.status, contentType: msg.contentType, body: body.slice(0, HTTP_BODY_MAX) }
    st.http = { ...st.http, log: [...st.http.log, entry].slice(-HTTP_LOG_MAX) }
    touch()
    pending.resolve({ status: msg.status, contentType: msg.contentType, headers: msg.headers ?? {}, body })
  }

  function onMqtt(msg) {
    const t = msg.t ?? nowUs()
    switch (msg.event) {
      case 'connect':
        st.mqtt = { ...st.mqtt, connected: msg.ok !== false, host: msg.host ?? null, clientId: msg.clientId ?? null }
        break
      case 'disconnect':
        st.mqtt = { ...st.mqtt, connected: false }
        break
      case 'publish': {
        const prev = st.mqtt.topics[msg.topic]
        st.mqtt = {
          ...st.mqtt,
          topics: { ...st.mqtt.topics, [msg.topic]: { value: msg.payload, t, count: (prev?.count ?? 0) + 1 } },
          log: [...st.mqtt.log, { t, dir: 'pub', topic: msg.topic, payload: msg.payload }].slice(-MQTT_LOG_MAX),
        }
        break
      }
      case 'subscribe':
        st.mqtt = { ...st.mqtt, log: [...st.mqtt.log, { t, dir: 'sub', topic: msg.topic, payload: null }].slice(-MQTT_LOG_MAX) }
        break
      default:
        return // 'deliver' is the sketch receiving what mqttPublish() already logged
    }
    touch()
  }

  function onPeripheral(msg) {
    if (msg.componentId == null) {
      if (!unboundPeripheralLogged) {
        unboundPeripheralLogged = true
        console.warn(`[voltquest] ${msg.protocol ?? 'peripheral'} output is not bound to any component on the board; dropping it.`)
      }
      return
    }
    st.peripherals = { ...st.peripherals, [msg.componentId]: { protocol: msg.protocol, data: msg.data } }
    touch()
  }

  /** Handles one outbound runtime message (§7.2). */
  function onMessage(msg) {
    if (disposed || !msg || typeof msg !== 'object') return
    if (typeof msg.t === 'number' && Number.isFinite(msg.t)) st.millis = Math.max(st.millis, Math.floor(msg.t / 1000))
    switch (msg.type) {
      case 'flight': {
        if (doc?.kind !== 'drone' || st.status !== 'running') return
        const previous = st.flight
        const blackbox = [...(previous?.blackbox ?? []), ...(msg.state.blackbox ?? [])].filter((row, i, all) => i === 0 || row.t !== all[i - 1].t).slice(-3000)
        const timeline = [...(previous?.timeline ?? [])]
        for (const a of msg.state.timeline ?? []) if (JSON.stringify(timeline.at(-1)) !== JSON.stringify(a)) timeline.push(a)
        st.flight = { ...msg.state, blackbox, timeline: timeline.slice(-10000) }
        st.damaged = st.flight.damaged; st.events = st.flight.events; st.warningCodesSeen = st.flight.warningCodesSeen
        if (st.flight.warningCodesSeen.reverse_polarity || st.flight.warningCodesSeen.short_circuit) stopRuntime('stopped')
        return evaluateCircuit()
      }
      case 'compiled':
        return onCompiled(msg)
      case 'status':
        return onStatus(msg)
      case 'pins':
        if (!firmwareLoaded()) return
        applyPinChanges(msg.changes)
        trace.record(msg)
        return evaluateCircuit()
      case 'read':
        if (!firmwareLoaded()) return
        trace.record(msg)
        return touch()
      case 'serial':
        if (!firmwareLoaded() || typeof msg.text !== 'string' || !msg.text.length) return
        pushRing(st.serial, { t: msg.t ?? nowUs(), text: msg.text }, SERIAL_RING)
        st.serialSeq += 1
        trace.record(msg)
        return touch()
      case 'serialBegin':
        st.serialBaud = msg.baud ?? null
        return touch()
      case 'tone': {
        const tones = { ...st.tones }
        if (msg.freq) tones[msg.pin] = msg.freq
        else delete tones[msg.pin]
        st.tones = tones
        return touch()
      }
      case 'peripheral':
        if (!firmwareLoaded()) return
        return onPeripheral(msg)
      case 'wifi':
        st.wifi = { status: msg.status ?? 'idle', ssid: msg.ssid ?? null, ip: msg.ip ?? null, mode: msg.mode ?? null, rssi: msg.rssi ?? null }
        return touch()
      case 'http':
        return onHttp(msg)
      case 'httpResponse':
        return onHttpResponse(msg)
      case 'mqtt':
        return onMqtt(msg)
      case 'tick':
        if (typeof msg.millis === 'number') st.millis = Math.max(st.millis, msg.millis)
        trace.record(msg)
        envTick += 1
        publishEnv()
        return touch()
      case 'log':
        return onLog(msg)
      default:
        return undefined // 'interrupt' and unknown informational messages
    }
  }

  // --- run lifecycle -------------------------------------------------------------------------------------------

  function rejectPendingHttp(error) {
    for (const [id, pending] of pendingHttp) {
      clearTimeout(pending.timer)
      pendingHttp.delete(id)
      pending.reject({ status: 0, error })
    }
  }

  /** Clears everything a `reset()` clears (§8) and re-evaluates; keeps doc, code, controls, power and runId. */
  function clearRunState() {
    pendingCompile?.finish({ ok: false, errors: [diagnostic('Run was reset', 'reset')], warnings: [] })
    rejectPendingHttp('reset')
    transport?.reset()
    trace.reset()
    runtimeWarnings = []
    activeWarningCodes = new Set()
    shortActive = false
    lastEnv = null
    envTick = 0
    unboundPeripheralLogged = false
    virtualMs = 0
    lastNotifyVirtualMs = -Infinity
    Object.assign(st, {
      status: 'idle',
      flight: null,
      diagnostics: [],
      runtimeError: null,
      millis: 0,
      mcuPins: {},
      damaged: {},
      burntPins: {},
      warnings: [],
      warningCodesSeen: {},
      events: [],
      serial: [],
      serialBaud: null,
      tones: {},
      peripherals: {},
      wifi: { ...IDLE_WIFI },
      http: { started: false, port: null, routes: [], log: [] },
      mqtt: { connected: false, topics: {}, log: [] },
    })
    evaluateCircuit()
  }

  function loadFirmware(source, board) {
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => finish({ ok: false, errors: [diagnostic('The firmware compiler did not respond in time.', 'compile_timeout')], warnings: [] }),
        COMPILE_TIMEOUT_MS,
      )
      function finish(result) {
        if (pendingCompile?.finish !== finish) return
        clearTimeout(timer)
        pendingCompile = null
        resolve(result)
      }
      pendingCompile = { finish }
      const direct = transport.load(source, board)
      // A runtime that returns its result without posting `compiled` still resolves the run.
      if (pendingCompile?.finish === finish && direct && typeof direct.ok === 'boolean') {
        finish({ ok: direct.ok, errors: direct.errors ?? [], warnings: direct.warnings ?? [] })
      }
    })
  }

  function stopRuntime(status) {
    transport?.stop()
    st.status = status
    rejectPendingHttp('stopped')
  }

  const sim = {
    /** Replaces the circuit; recompiles, drops damage of removed parts and keeps a running sketch running. */
    setDocument(nextDoc) {
      if (disposed) return
      const previousKind = doc?.kind
      doc = nextDoc ?? null
      if (doc?.kind === 'drone') validateDroneDoc(doc)
      st.flight = null
      const prevBoard = st.board
      const compiled = doc ? circuit.compileCircuit(doc) : null
      st.compiled = compiled
      st.board = compiled?.mcu?.board?.id ?? null
      const ids = new Set([...(doc?.components ?? []), ...(doc?.links ?? [])].map((c) => c.id))
      st.damaged = pickKeys(st.damaged, ids)
      st.controls = pickKeys(st.controls, ids)
      if (!compiled?.mcu || st.board !== prevBoard) st.burntPins = {}
      st.powered = poweredPref && Boolean(compiled?.mcu)
      const wasRunning = st.status === 'running' || st.status === 'compiling'
      if (wasRunning && (!compiled?.mcu || st.board !== prevBoard || doc?.kind === 'drone' || previousKind === 'drone')) stopRuntime('stopped')
      evaluateCircuit()
    },

    /** Stores the sketch source used by the next `run()`. */
    setCode(source) {
      code = typeof source === 'string' ? source : ''
      touch()
    },
    replayFlight() {
      if (!sim.getState().flight?.replayAvailable) return Promise.resolve({ ok: false })
      return sim.run({ flightTimeline: st.flight.timeline })
    },
    setSticks(sticks) { if (st.status === 'running') transport?.post({ type: 'sticks', sticks }) },
    setSpeed(speed) { transport?.post({ type: 'flightSpeed', speed }) },
    setFlightTimeline(timeline) { transport?.post({ type: 'flightTimeline', timeline }) },
    setBenchTilt(tilt) { transport?.post({ type: 'benchTilt', tilt }) },
    disturb(rates) { transport?.post({ type: 'disturbance', rates }) },

    /** Implicit reset, then compile + start the sketch. Resolves once the runtime reported the compile result. */
    async run({ flightTimeline = [] } = {}) {
      if (disposed) return { ok: false, errors: [diagnostic('Simulation was disposed', 'disposed')] }
      clearRunState()
      st.runId += 1
      const runId = st.runId
      if (!st.compiled?.mcu) {
        const errors = [diagnostic('Place a microcontroller board (Uno, Nano or ESP32) before running.', 'no_mcu')]
        st.status = 'error'
        st.diagnostics = errors
        touch()
        return { ok: false, errors }
      }
      if (!st.powered) {
        const errors = [diagnostic('Power is off — turn the supply on to run the sketch.', 'unpowered')]
        st.status = 'error'
        st.diagnostics = errors
        touch()
        return { ok: false, errors }
      }
      st.status = 'compiling'
      touch()
      ensureTransport()
      lastEnv = null
      const result = await loadFirmware(code, st.compiled.mcu.board)
      if (disposed || runId !== st.runId) return { ok: false, errors: [diagnostic('Run was superseded', 'superseded')] }
      if (!result.ok) {
        if (st.status === 'compiling') st.status = 'error'
        touch()
        return { ok: false, errors: result.errors }
      }
      if (st.status !== 'compiling') return { ok: false, errors: [diagnostic('Run was interrupted', 'interrupted')] }
      st.status = 'running'
      virtualMs = 0
      lastNotifyVirtualMs = -Infinity
      recordedBuild = JSON.stringify(doc); recordedCode = code
      if (doc?.kind === 'drone') transport.post({ type: 'flightTimeline', timeline: flightTimeline })
      transport.start()
      lastEnv = null
      publishEnv(true)
      touch()
      return { ok: true, errors: [] }
    },

    /** Stops the sketch; pin states stay as they were (use `reset()` to clear them). */
    stop() {
      if (disposed || (st.status !== 'running' && st.status !== 'compiling')) return
      pendingCompile?.finish({ ok: false, errors: [diagnostic('Run was stopped', 'stopped')], warnings: [] })
      stopRuntime('stopped')
      touch()
    },

    /** Clears damage, warnings, trace, serial, peripherals and network state; keeps circuit, code and controls. */
    reset() {
      if (disposed) return
      clearRunState()
      touch()
    },

    /** Merges a control patch (button pressed, knob value, sensor slider…) and re-evaluates. */
    setControl(componentId, patch) {
      if (disposed || !componentId || !patch) return
      st.controls = { ...st.controls, [componentId]: { ...(st.controls[componentId] ?? {}), ...patch } }
      evaluateCircuit()
    },

    /** Toggles the USB supply. Powering off stops a running sketch and releases every MCU pin. */
    setPowered(on) {
      if (disposed) return
      poweredPref = Boolean(on)
      const powered = poweredPref && Boolean(st.compiled?.mcu)
      if (powered === st.powered) return
      st.powered = powered
      if (doc?.kind === 'drone') st.flight = null
      if (!powered) {
        if (st.status === 'running' || st.status === 'compiling') {
          pendingCompile?.finish({ ok: false, errors: [diagnostic('Power was switched off', 'unpowered')], warnings: [] })
          stopRuntime('stopped')
        }
        st.mcuPins = {}
      }
      evaluateCircuit()
    },

    /** Sends text to the sketch's Serial input buffer. */
    serialWrite(text) {
      if (disposed || st.status !== 'running' || typeof text !== 'string') return
      transport.post({ type: 'serialInput', text })
    },

    /** Issues an HTTP request to the sketch's WebServer; rejects `{ status: 0, error }` on timeout (3 s wall). */
    httpRequest({ method = 'GET', path = '/', body, headers } = {}) {
      return new Promise((resolve, reject) => {
        if (disposed || st.status !== 'running' || !transport) {
          reject({ status: 0, error: 'not_running' })
          return
        }
        const id = ++httpSeq
        const timer = setTimeout(() => {
          if (!pendingHttp.delete(id)) return
          reject({ status: 0, error: 'timeout' })
        }, HTTP_TIMEOUT_MS)
        pendingHttp.set(id, { resolve, reject, timer, method, path })
        transport.post({ type: 'httpRequest', id, method, path, body, headers })
      })
    },

    /** Publishes to the virtual broker as an external client (delivered to the sketch's subscriptions). */
    mqttPublish(topic, payload) {
      if (disposed || typeof topic !== 'string') return
      const t = nowUs()
      const prev = st.mqtt.topics[topic]
      st.mqtt = {
        ...st.mqtt,
        topics: { ...st.mqtt.topics, [topic]: { value: payload, t, count: (prev?.count ?? 0) + 1 } },
        log: [...st.mqtt.log, { t, dir: 'in', topic, payload }].slice(-MQTT_LOG_MAX),
      }
      if (st.status === 'running' && transport) transport.post({ type: 'mqttInbound', topic, payload })
      touch()
    },

    /** Inline mode only: runs the virtual clock forward by `ms` synchronously, notifying at most every 20 virtual ms. */
    advance(ms) {
      if (!useInline) throw new Error('advance(ms) is only available in inline mode')
      if (disposed || st.status !== 'running' || !(ms > 0)) return
      advancing = true
      try {
        let remaining = ms
        while (remaining > 0 && st.status === 'running') {
          const step = Math.min(remaining, INLINE_NOTIFY_MS)
          try {
            transport.advance(step)
          } catch (err) {
            st.status = 'error'
            st.runtimeError = { message: err?.message ?? String(err), line: err?.line ?? 0 }
            rejectPendingHttp('error')
            touch()
          }
          remaining -= step
          virtualMs += step
          if (notifiedVersion !== version && virtualMs - lastNotifyVirtualMs >= INLINE_NOTIFY_MS) {
            lastNotifyVirtualMs = virtualMs
            notify()
          }
        }
      } finally {
        advancing = false
      }
      if (notifiedVersion !== version) scheduleFlush()
    },

    getState,

    /** Subscribes to snapshots (≤ 1 per frame). Returns the unsubscribe function. */
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {}
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /** Terminates the worker/runtime and releases timers and listeners. */
    dispose() {
      if (disposed) return
      disposed = true
      pendingCompile?.finish({ ok: false, errors: [diagnostic('Simulation was disposed', 'disposed')], warnings: [] })
      rejectPendingHttp('disposed')
      if (cancelFrame) cancelFrame()
      cancelFrame = null
      transport?.dispose()
      transport = null
      listeners.clear()
    },
  }

  return sim
}

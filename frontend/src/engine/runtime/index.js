import * as boards from '../boards/index.js'
import { compile, createVM, formatValue } from '../interpreter/index.js'
import { createArduinoApi } from './arduino.js'
import { normalizeBoard, createPinResolver } from './pins.js'
import { createSerial, createFormatNatives } from './serial.js'
import { createNetwork } from './network.js'
import { createScheduler } from './scheduler.js'
import { registerLibraries } from './libraries/index.js'
import { translatePython } from './python.js'
import { createDynamics, TELEMETRY_US } from '../drone/dynamics.js'
import { compileCircuit } from '../circuit/index.js'

const LIBRARY_HEADERS = {
  Servo: ['Servo.h', 'ESP32Servo.h'], LiquidCrystal_I2C: ['LiquidCrystal_I2C.h'],
  Adafruit_NeoPixel: ['Adafruit_NeoPixel.h'], DHT: ['DHT.h'],
  Adafruit_BME280: ['Adafruit_BME280.h'], Adafruit_SSD1306: ['Adafruit_SSD1306.h'],
  TwoWire: ['Wire.h'], Wire: ['Wire.h'], WiFi: ['WiFi.h'], WiFiClient: ['WiFi.h'],
  IPAddress: ['WiFi.h'], WebServer: ['WebServer.h'], PubSubClient: ['PubSubClient.h'],
  MPU6050: ['MPU6050.h'], VoltRC: ['VoltRC.h'], RC: ['VoltRC.h', 'VoltFlight.h'], VoltFlight: ['VoltFlight.h'], Flight: ['VoltFlight.h'], PID: ['PID.h', 'VoltFlight.h'], AHRS: ['AHRS.h'], Adafruit_BMP280: ['Adafruit_BMP280.h'],
}
const CORE_HEADERS = new Set(['Arduino.h', 'stdint.h', 'stdbool.h', 'stddef.h', 'math.h', 'string.h', 'stdlib.h', 'stdio.h'])
const ESP_NAMES = /^(WiFi|WiFiClient|WebServer|PubSubClient|ESP|touchRead|ledc\w*|dacWrite|hallRead|analogSet\w*|analogReadMilliVolts|esp_random|ADC_\w*|WL_\w*|WIFI_\w*|HTTP_\w*)$/
const emptyEnv = (board) => ({ digital: {}, analog: {}, touch: {}, peripherals: {}, peripheralMap: [], wifiAllowed: board.family === 'esp32' })

export function createRuntime({ board: profile, post = () => {}, realtime = true, now, droneDoc = null } = {}) {
  const board = normalizeBoard(profile, boards)
  const pins = createPinResolver(board, boards)
  let program = null
  let vm = null
  let host
  let serial
  let network
  let status = 'stopped'
  let runtimeError = null
  let sourceLines = null
  let pinStates = {}
  let tones = {}
  let changes = []
  let reads = []
  let serialText = ''
  let droneCompiled = droneDoc ? compileCircuit(droneDoc) : null
  let nextFlightUs = TELEMETRY_US, lastInputId = 0, lastSampleUs = 0
  let pendingTimeline = []
  let timers = []
  let pendingInterrupts = []
  const interrupts = new Map()
  const logged = new Set()

  const core = {
    board, pins, intBits: board.intBits, env: emptyEnv(board), shared: {},
    now: () => vm?.now() ?? 0,
    post: (message) => {
      if (message.type === 'peripheral' && message.protocol === 'esc') core.drone?.command(message.componentId, message.data.us)
      post({ ...message, t: core.now() })
    },
    format: formatValue,
    log(level, code, message) {
      const key = `${code}:${message}`
      if (logged.has(key)) return
      logged.add(key)
      core.post({ type: 'log', level, code, message })
    },
    pinState(pin) { return pinStates[pin] ?? { mode: 'input', level: 0, duty: 0, freq: 0, value: 0 } },
    setMode(pin, mode) { updatePin(pin, { mode, duty: 0, freq: 0, value: 0 }) },
    setLevel(pin, level) {
      const previous = core.pinState(pin)
      const mode = previous.mode.startsWith('input') ? (level ? 'input_pullup' : 'input') : 'output'
      updatePin(pin, { mode, level, duty: 0, freq: 0, value: 0 })
    },
    setPwm(pin, duty, freq) { updatePin(pin, { mode: 'pwm', duty, freq, level: duty > 0 ? 1 : 0, value: 0 }) },
    setDac(pin, value) { updatePin(pin, { mode: 'dac', value, level: value > 0 ? 1 : 0, duty: 0, freq: 0 }) },
    setTone(pin, freq) {
      if ((tones[pin] ?? 0) === freq) return
      tones[pin] = freq
      core.post({ type: 'tone', pin, freq })
    },
    queueRead(kind, pin, value) { reads.push({ t: core.now(), kind, pin, value }) },
    queueSerial(text) { serialText += text },
    after(delayUs, callback) {
      timers.push({ atUs: core.now() + Math.max(0, Math.round(delayUs)), callback })
      timers.sort((first, second) => first.atUs - second.atUs)
    },
    attachInterrupt(pin, callable, mode) {
      interrupts.set(pin, { callable, mode })
      core.post({ type: 'interrupt', pin, mode })
    },
    detachInterrupt(pin) {
      interrupts.delete(pin)
      pendingInterrupts = pendingInterrupts.filter((entry) => entry.pin !== pin)
    },
    controlsOf: (componentId) => core.env.peripherals[componentId] ?? {},
    bindings: {
      byPin(protocol, role, pin) {
        return core.env.peripheralMap.find((binding) => binding.protocol === protocol && binding.pins[role] === pin && binding.powered) ?? null
      },
      byAddress(protocol, address) {
        return core.env.peripheralMap.find((binding) => binding.protocol === protocol && binding.i2cAddress === address
          && binding.pins.sda === board.i2c.sda && binding.pins.scl === board.i2c.scl && binding.powered) ?? null
      },
    },
    peripheral(binding, protocol, data) {
      if (!binding) {
        core.log('warn', 'unbound_device', `No powered ${protocol} device is connected to the requested pins.`)
        return false
      }
      core.post({ type: 'peripheral', componentId: binding.componentId, protocol, data })
      return true
    },
    restart() { core.shared.restartRequested = true },
  }

  function updatePin(pin, patch) {
    const previous = core.pinState(pin)
    if (Object.entries(patch).every(([key, value]) => previous[key] === value)) return
    pinStates[pin] = { ...previous, ...patch }
    changes.push({ t: core.now(), pin, ...patch })
  }

  function flush() {
    const batch = { changes, reads, serialText }
    changes = []
    reads = []
    serialText = ''
    if (batch.changes.length) core.post({ type: 'pins', changes: batch.changes })
    if (batch.reads.length) core.post({ type: 'read', reads: batch.reads })
    if (batch.serialText) core.post({ type: 'serial', text: batch.serialText })
  }

  function reportStatus(next, error) {
    if (error && sourceLines) error = { ...error, line: sourceLines[error.line - 1] ?? error.line }
    status = next
    runtimeError = error ?? null
    core.post({ type: 'status', status, ...(error ? { error } : {}) })
  }

  function pump() {
    if (core.drone) {
      while (core.drone.nextUs <= core.now()) core.drone.step()
      const flight = core.drone.state
      Object.assign(core.env, flight.sensors, { drone: flight.derived, escProtocol: droneDoc.droneConfig.esc.protocol })
      core.env.peripheralMap = droneCompiled.peripheralMap.map(binding => ({ ...binding, powered: flight.electrical.fcPowered && (binding.protocol !== 'esc' || flight.electrical.escEnabled[Number(droneDoc.mounts.find(m => m.componentId === binding.componentId)?.mount?.replace('esc', '')) - 1]) }))
      if (core.drone.consumeReset()) {
        const time = core.now()
        vm = createVM(program, host); vm.start(); vm.advanceTo(time)
        pinStates = {}; timers = []; interrupts.clear(); pendingInterrupts = []
      }
      if (core.now() >= nextFlightUs) {
        const compact = { ...flight, blackbox: flight.blackbox.filter(r => r.t > lastSampleUs), timeline: flight.timeline.filter(r => r.id > lastInputId) }
        post({ type: 'flight', t: core.now(), state: JSON.parse(JSON.stringify(compact)) })
        lastSampleUs = flight.blackbox.at(-1)?.t ?? lastSampleUs
        lastInputId = flight.timeline.at(-1)?.id ?? lastInputId
        nextFlightUs += TELEMETRY_US
      }
    }
    network.pump()
    while (timers.length && timers[0].atUs <= core.now()) timers.shift().callback()
    if (core.shared.interruptsEnabled === false) return
    const pending = pendingInterrupts
    pendingInterrupts = []
    for (const entry of pending) {
      if (interrupts.get(entry.pin) !== entry.handler) continue
      const result = vm.call(entry.handler.callable, [])
      if (result.status === 'error') {
        scheduler.stop()
        reportStatus('error', result.error)
        break
      }
    }
  }

  const scheduler = createScheduler({
    realtime, now, statementCostUs: board.statementCostUs,
    sliceStatements: Math.floor(4000 / board.statementCostUs),
    driver: {
      now: core.now,
      advanceTo: (timeUs) => vm.advanceTo(timeUs),
      nextEventUs: () => Math.min(timers[0]?.atUs ?? Infinity, network.nextEventUs, core.drone?.nextUs ?? Infinity),
      beforeSlice: pump,
      step: (budget) => {
        const result = vm.step(budget)
        return core.shared.pythonDone ? { status: 'halted' } : result
      },
      afterSlice() {
        flush()
        if (core.shared.restartRequested) start()
      },
      onTick(millis) { network.pump(); core.post({ type: 'tick', millis }) },
      onError: (error) => reportStatus('error', error),
      onHalt: () => reportStatus('halted'),
    },
  })

  function rebuild(clearEnv = true) {
    scheduler.reset()
    vm = null
    pinStates = {}
    tones = {}
    changes = []
    reads = []
    serialText = ''
    timers = []
    pendingInterrupts = []
    interrupts.clear()
    logged.clear()
    runtimeError = null
    core.shared = { wifiConnected: false, interruptsEnabled: true }
    if (clearEnv) core.env = emptyEnv(board)
    core.drone = droneDoc ? createDynamics(droneDoc, droneCompiled) : null
    core.drone?.setTimeline(pendingTimeline)
    nextFlightUs = TELEMETRY_US; lastInputId = 0; lastSampleUs = 0
    const arduino = createArduinoApi(core)
    serial = createSerial(core, { printf: board.family === 'esp32' })
    network = createNetwork(core)
    const libraries = registerLibraries(core, { adc: arduino.adc, network })
    host = {
      intBits: board.intBits, statementCostUs: board.statementCostUs,
      natives: { ...arduino.natives, ...createFormatNatives(core), ...libraries.natives },
      globals: { ...arduino.globals, ...libraries.globals, Serial: serial.clazz.construct() },
      classes: { ...libraries.classes, HardwareSerial: serial.clazz },
    }
    if (program) vm = createVM(program, host)
    status = 'stopped'
  }

  function load(source) {
    program = null
    rebuild()
    const translated = board.language === 'python' ? translatePython(source) : null
    sourceLines = translated?.lineMap ?? null
    if (translated && !translated.ok) {
      core.post({ type: 'compiled', ...translated })
      return translated
    }
    const result = compile(translated?.source ?? source, { intBits: board.intBits })
    if (sourceLines) result.errors = result.errors.map((error) => ({ ...error, line: sourceLines[error.line - 1] ?? error.line }))
    const errors = result.errors.slice()
    const error = (name, message) => {
      const line = String(source).split('\n').findIndex((text) => text.includes(name)) + 1
      errors.push({ line: Math.max(1, line), col: 1, severity: 'error', message })
    }
    for (const header of result.includes) {
      if (!CORE_HEADERS.has(header) && !board.libraries.includes(header)) error(header, `${header} is not available on ${board.name}`)
    }
    for (const name of new Set([...result.classesUsed, ...result.globalsUsed])) {
      if (board.family !== 'esp32' && ESP_NAMES.test(name)) {
        error(name, `'${name}' was not declared in this scope — ${LIBRARY_HEADERS[name]?.[0] ?? name} is not available on ${board.name}`)
        continue
      }
      const headers = LIBRARY_HEADERS[name]
      if (headers && !headers.some((header) => result.includes.includes(header) && board.libraries.includes(header))) {
        error(name, `'${name}' does not name a type; did you forget #include <${headers[0]}>?`)
      } else if (!(name in host.classes) && !(name in host.globals) && !(name in host.natives)) {
        error(name, result.classesUsed.includes(name) ? `'${name}' does not name a type` : `'${name}' was not declared in this scope`)
      }
    }
    const compiled = { ok: result.ok && errors.length === 0, errors, warnings: result.warnings }
    if (compiled.ok) { program = result.program; vm = createVM(program, host) }
    core.post({ type: 'compiled', ...compiled })
    return compiled
  }

  function start() {
    if (!program) return
    rebuild(false)
    vm.start()
    reportStatus('running')
    scheduler.start()
  }

  function stop() {
    scheduler.stop()
    flush()
    for (const pin of Object.keys(tones)) core.setTone(pin, 0)
    reportStatus('stopped')
  }

  function reset() {
    stop()
    rebuild()
  }

  function handle(message) {
    if (!message || typeof message !== 'object') return
    switch (message.type) {
      case 'load': return load(message.source)
      case 'start': return start()
      case 'stop': return stop()
      case 'reset': return reset()
      case 'serialInput': return serial.handleInput(message.text)
      case 'httpRequest': return network.queueHttpRequest(message)
      case 'mqttInbound': return network.deliverInbound(message.topic, message.payload)
      case 'sticks': return core.drone?.setSticks(message.sticks)
      case 'flightSpeed': return scheduler.setSpeed(message.speed)
      case 'flightTimeline': pendingTimeline = message.timeline ?? []; return core.drone?.setTimeline(pendingTimeline)
      case 'benchTilt': return core.drone?.setTilt(message.tilt)
      case 'disturbance': return core.drone?.disturb(message.rates)
      case 'droneDocument':
        droneDoc = message.doc; droneCompiled = droneDoc ? compileCircuit(droneDoc) : null
        return
      case 'env': {
        const previous = core.env.digital
        for (const field of ['digital', 'analog', 'touch', 'peripherals', 'peripheralMap', 'wifiAllowed', 'imu', 'baro', 'gps', 'rc', 'rpm', 'tune']) {
          if (message[field] !== undefined) core.env[field] = message[field]
        }
        for (const [pin, handler] of interrupts) {
          const before = previous[pin] ?? 0
          const after = core.env.digital[pin] ?? 0
          if (before === after) continue
          if (handler.mode === 'change' || (after && ['rising', 'high'].includes(handler.mode)) || (!after && ['falling', 'low'].includes(handler.mode))) {
            pendingInterrupts.push({ pin, handler })
          }
        }
      }
    }
  }

  rebuild()
  return {
    load, start, stop, reset, handle,
    advance: (ms) => scheduler.advance(ms),
    getPinStates: () => Object.fromEntries(Object.entries(pinStates).map(([pin, state]) => [pin, { ...state }])),
    getSnapshot: () => ({ millis: Math.floor(core.now() / 1000), running: scheduler.running, status, error: runtimeError, tones: { ...tones }, wifi: network.snapshot() }),
  }
}

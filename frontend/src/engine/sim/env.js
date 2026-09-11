// Environment derivation — turns a circuit evaluation into what the firmware "sees" (CONTRACTS §8 `deriveEnv`,
// §7.1 `env` message) and derives module output levels for the circuit engine (§5.3 `moduleOutputs`).
// Pure functions, no state.

/** Touch values reported to `touchRead()` for a bound touch pad (ESP32 raw counts: low = touched). */
export const TOUCH_TOUCHED = 15
export const TOUCH_IDLE = 70

const HIGH_RATIO = 0.6 // digital 1 above 0.6·vcc
const LOW_RATIO = 0.3 // digital 0 below 0.3·vcc; in between the previous level holds (hysteresis)
const ANALOG_DECIMALS = 4 // 0.1 mV — below any ADC step, avoids float-noise re-sends

/** Default control values the runtime receives for sensor modules whose sliders/toggles were never moved. */
export const PERIPHERAL_CONTROL_DEFAULTS = {
  ultrasonic_hcsr04: { distanceCm: 50 },
  pir: { motion: false },
  dht22: { temperatureC: 24.5, humidity: 55 },
  bme280: { temperatureC: 24.5, pressureHpa: 1013, humidity: 55 },
  touch_pad: { touched: false },
}

/**
 * Module output levels for `dynamicState.moduleOutputs` (§5.3): pir.out follows its motion toggle,
 * dht22.data idles HIGH, hcsr04.echo idles LOW. Components of other types contribute nothing.
 * @param {Array<{id: string, type: string}>} components
 * @param {object} controls `{ [componentId]: { motion?, ... } }`
 */
export function deriveModuleOutputs(components, controls = {}) {
  const outputs = {}
  for (const comp of components ?? []) {
    if (!comp) continue
    switch (comp.type) {
      case 'pir':
        outputs[comp.id] = { out: controls[comp.id]?.motion ? 1 : 0 }
        break
      case 'dht22':
        outputs[comp.id] = { data: 1 }
        break
      case 'ultrasonic_hcsr04':
        outputs[comp.id] = { echo: 0 }
        break
      default:
        break
    }
  }
  return outputs
}

// --- seeded noise for floating inputs -------------------------------------------------------------------------

function hashString(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Deterministic 0|1 for a floating pin at a given tick — the same (tick, pin) always draws the same level. */
export function floatingLevel(pin, tick) {
  return mulberry32(hashString(pin) ^ Math.imul(tick | 0, 0x9e3779b1)) < 0.5 ? 0 : 1
}

/** Pins the circuit engine flagged as floating (`floating_input` warnings, by pin name or by terminal/net). */
export function floatingPins(compiled, evaluation) {
  const pins = new Set()
  const mcu = compiled?.mcu
  for (const w of evaluation?.warnings ?? []) {
    if (w?.code !== 'floating_input') continue
    for (const p of w.pinNames ?? []) pins.add(p)
    if (!w.pinNames?.length && w.terminals?.length && mcu?.pinNet) {
      const nets = new Set(w.terminals.map((t) => compiled.terminalToNet?.[t]).filter(Boolean))
      for (const [pin, net] of Object.entries(mcu.pinNet)) if (nets.has(net)) pins.add(pin)
    }
  }
  return pins
}

function roundVolts(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  const f = 10 ** ANALOG_DECIMALS
  return Math.round(v * f) / f
}

/**
 * Derives the `env` message body the runtime consumes from the current evaluation.
 * @param {object} compiled CompiledCircuit (§5.1)
 * @param {object|null} evaluation Evaluation (§5.4)
 * @param {object} controls `{ [componentId]: {...} }`
 * @param {object} board BoardProfile (§2) of the placed MCU
 * @param {object|null} prevEnv previously derived env (hysteresis for the 0.3–0.6·vcc dead band)
 * @param {{ tick?: number }} [opts] `tick` re-seeds the floating-input noise (the controller bumps it on every runtime tick)
 * @returns {{ digital: object, analog: object, touch: object, peripherals: object, peripheralMap: Array, wifiAllowed: boolean, moduleOutputs: object }}
 */
export function deriveEnv(compiled, evaluation, controls = {}, board, prevEnv = null, { tick = 0 } = {}) {
  const digital = {}
  const analog = {}
  const touch = {}
  const peripherals = {}
  const peripheralMap = compiled?.peripheralMap ?? []
  const vcc = board?.vcc ?? 5
  const voltages = evaluation?.mcuPinVoltages ?? {}
  const floating = floatingPins(compiled, evaluation)

  for (const pin of board?.pins ?? []) {
    if (pin.kind !== 'digital' && pin.kind !== 'analog') continue
    const v = voltages[pin.name]
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    if (floating.has(pin.name)) digital[pin.name] = floatingLevel(pin.name, tick)
    else if (v > HIGH_RATIO * vcc) digital[pin.name] = 1
    else if (v < LOW_RATIO * vcc) digital[pin.name] = 0
    else digital[pin.name] = prevEnv?.digital?.[pin.name] ?? 0
    if (pin.caps?.includes('adc')) analog[pin.name] = roundVolts(v)
  }

  for (const binding of peripheralMap) {
    if (!binding?.componentId) continue
    const own = controls[binding.componentId] ?? {}
    if (binding.protocol === 'touch' && binding.pins?.signal) {
      touch[binding.pins.signal] = own.touched ? TOUCH_TOUCHED : TOUCH_IDLE
    }
    const values = { ...(PERIPHERAL_CONTROL_DEFAULTS[binding.type] ?? {}), ...own }
    if (Object.keys(values).length) peripherals[binding.componentId] = values
  }

  const wifiAllowed = board?.family === 'esp32' || (board?.libraries ?? []).includes('WiFi.h')
  const moduleOutputs = deriveModuleOutputs(
    peripheralMap.map((b) => ({ id: b.componentId, type: b.type })),
    controls,
  )
  return { digital, analog, touch, peripherals, peripheralMap, wifiAllowed, moduleOutputs }
}

/** Structural equality of two derived envs (used to send `env` only when something the firmware sees changed). */
export function envEquals(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.wifiAllowed === b.wifiAllowed &&
    a.peripheralMap === b.peripheralMap &&
    flatEqual(a.digital, b.digital) &&
    flatEqual(a.analog, b.analog) &&
    flatEqual(a.touch, b.touch) &&
    nestedEqual(a.peripherals, b.peripherals)
  )
}

function flatEqual(a = {}, b = {}) {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  for (const k of ka) if (a[k] !== b[k]) return false
  return true
}

function nestedEqual(a = {}, b = {}) {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  for (const k of ka) if (!(k in b) || !flatEqual(a[k], b[k])) return false
  return true
}

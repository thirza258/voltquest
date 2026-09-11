/**
 * Core Arduino API — pins, timing, maths, interrupts (CONTRACTS §7.4).
 *
 * Every function that touches a pin resolves the sketch's number/alias through the pin resolver first, so all
 * outbound messages carry PinNames. Natives are declared as `{ fn, returns, params }` objects wherever the
 * static return type matters for `Serial.print` formatting.
 */

import { ADC_ATTENUATION_FULL_SCALE } from './pins.js'

/** pinMode() arguments. AVR values; the ESP32 core's numeric values are not exposed to sketches. */
export const PIN_MODES = { 0: 'input', 1: 'output', 2: 'input_pullup', 3: 'input_pulldown' }

/** Interrupt trigger modes (Arduino values). */
export const INTERRUPT_MODES = { 1: 'change', 2: 'falling', 3: 'rising', 4: 'high', 5: 'low' }

/** Poll interval used while `pulseIn` waits for an edge that only an `env` update can deliver. */
const PULSE_POLL_US = 100

/** Deterministic PRNG so `random()` replays identically in tests (CONTRACTS §7.4). */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const num = (v) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
const int = (v) => Math.trunc(num(v))

/**
 * Builds the core API.
 * @param {object} core runtime core (see `index.js`)
 * @returns {{ natives: object, globals: object }}
 */
export function createArduinoApi(core) {
  const { board, pins } = core
  const isEsp32 = board.family === 'esp32'

  let writeBits = 8
  let readBits = board.adcBits ?? 10
  let defaultAttenuation = 3 // ADC_11db
  const pinAttenuation = new Map()
  let rng = mulberry32(0x5eed1)

  /** Resolves a sketch pin argument; logs and returns null when the board has no such pin. */
  function pinOf(value, what) {
    const info = pins.resolve(typeof value === 'string' ? value : int(value))
    if (!info) {
      core.log('warn', 'unknown_pin', `${what}: pin ${formatPinArg(value)} does not exist on the ${board.name}.`)
      return null
    }
    return info
  }

  function formatPinArg(value) {
    return typeof value === 'string' ? `'${value}'` : String(int(value))
  }

  /** Full-scale ADC voltage for a pin (ESP32 attenuation, otherwise Vcc). */
  function fullScaleFor(info) {
    if (!isEsp32) return board.vcc ?? 5
    const att = pinAttenuation.get(info.name) ?? defaultAttenuation
    return ADC_ATTENUATION_FULL_SCALE[att] ?? ADC_ATTENUATION_FULL_SCALE[3]
  }

  /** Converts a pin voltage to an ADC count using the current read resolution. */
  function adcCount(volts, fullScale) {
    const maxCount = (1 << readBits) - 1
    const v = Math.max(0, Math.min(num(volts), fullScale))
    return Math.round((v / fullScale) * maxCount)
  }

  /**
   * Shared implementation of analogRead()/analogReadMilliVolts(): resolves the pin, applies the ADC2/WiFi and
   * non-ADC rules, and records the `read` entry.
   * @returns {{ info: object|null, volts: number, fullScale: number, ok: boolean }}
   */
  function sampleAnalog(pinArg, what) {
    const info = pinOf(pinArg, what)
    const fullScale = info ? fullScaleFor(info) : (board.vcc ?? 5)
    if (!info) return { info: null, volts: 0, fullScale, ok: false }
    if (!info.caps.has('adc')) {
      core.log('warn', 'not_adc_pin', `${what}(${info.name}): that pin has no ADC — it always reads 0.`)
      core.queueRead('analog', info.name, 0)
      return { info, volts: 0, fullScale, ok: false }
    }
    if (isEsp32 && info.adcUnit === 2 && core.shared.wifiConnected) {
      core.log('warn', 'adc2_wifi', `${what}(${info.name}): ADC2 is unavailable while WiFi is on — use an ADC1 pin (GPIO32–GPIO39).`)
      core.queueRead('analog', info.name, 0)
      return { info, volts: 0, fullScale, ok: false }
    }
    const volts = num(core.env.analog?.[info.name])
    return { info, volts, fullScale, ok: true }
  }

  function digitalLevel(info) {
    const st = core.pinState(info.name)
    if (st.mode === 'output' || st.mode === 'pwm' || st.mode === 'dac') return st.level
    const v = core.env.digital?.[info.name]
    return v ? 1 : 0
  }

  const natives = {
    // ------------------------------------------------------------------ digital I/O
    pinMode: {
      returns: 'void',
      fn(args) {
        const info = pinOf(args[0], 'pinMode')
        if (!info) return
        let mode = PIN_MODES[int(args[1])] ?? 'input'
        if (mode === 'input_pulldown' && !isEsp32) {
          core.log('warn', 'no_pulldown', `pinMode(${info.name}, INPUT_PULLDOWN): the ${board.name} has no internal pull-downs — using INPUT. Add a 10 kΩ resistor to GND instead.`)
          mode = 'input'
        }
        if (mode === 'output' && info.caps.has('input_only')) {
          core.log('warn', 'input_only_pin', `pinMode(${info.name}, OUTPUT): ${info.name} is input-only on the ${board.name} and cannot drive anything.`)
          mode = 'input'
        }
        core.setMode(info.name, mode)
      },
    },
    digitalWrite: {
      returns: 'void',
      fn(args) {
        const info = pinOf(args[0], 'digitalWrite')
        if (!info) return
        if (info.caps.has('input_only')) {
          core.log('warn', 'input_only_pin', `digitalWrite(${info.name}, …): ${info.name} is input-only on the ${board.name}.`)
          return
        }
        core.setLevel(info.name, args[1] ? 1 : 0)
      },
    },
    digitalRead: {
      returns: 'int',
      fn(args) {
        const info = pinOf(args[0], 'digitalRead')
        return info ? digitalLevel(info) : 0
      },
    },

    // ------------------------------------------------------------------ analog I/O
    analogRead: {
      returns: 'int',
      fn(args) {
        const s = sampleAnalog(args[0], 'analogRead')
        if (!s.ok) return 0
        const value = adcCount(s.volts, s.fullScale)
        core.queueRead('analog', s.info.name, value)
        return value
      },
    },
    analogWrite: {
      returns: 'void',
      fn(args) {
        const info = pinOf(args[0], 'analogWrite')
        if (!info) return
        if (info.caps.has('input_only')) {
          core.log('warn', 'input_only_pin', `analogWrite(${info.name}): this pin is input-only.`)
          return
        }
        const maxValue = (1 << writeBits) - 1
        const raw = Math.max(0, Math.min(int(args[1]), maxValue))
        if (!info.caps.has('pwm')) {
          const level = raw < maxValue / 2 ? 0 : 1
          core.log('warn', 'no_pwm_pin', `analogWrite(${info.name}, ${raw}): ${info.name} has no PWM on the ${board.name} — it can only be fully ${level ? 'on' : 'off'}. PWM pins: ${pwmPinList()}.`)
          core.setMode(info.name, 'output')
          core.setLevel(info.name, level)
          return
        }
        core.setPwm(info.name, raw / maxValue, board.pwmDefault?.freqHz ?? 490)
      },
    },
    analogReadResolution: { returns: 'void', fn(args) { readBits = Math.max(1, Math.min(16, int(args[0]) || board.adcBits)) } },
    analogWriteResolution: { returns: 'void', fn(args) { writeBits = Math.max(1, Math.min(16, int(args[0]) || 8)) } },

    // ------------------------------------------------------------------ time
    delay: {
      returns: 'void',
      *fn(args, ctx) {
        const ms = num(args[0])
        yield ctx.sleep(Math.max(0, ms) * 1000)
      },
    },
    delayMicroseconds: {
      returns: 'void',
      *fn(args, ctx) {
        yield ctx.sleep(Math.max(0, num(args[0])))
      },
    },
    millis: { returns: 'unsigned long', fn: () => Math.floor(core.now() / 1000) >>> 0 },
    micros: { returns: 'unsigned long', fn: () => Math.floor(core.now()) >>> 0 },
    yield: { returns: 'void', *fn(args, ctx) { yield ctx.sleep(0) } },

    // ------------------------------------------------------------------ tone
    tone: {
      returns: 'void',
      fn(args) {
        const info = pinOf(args[0], 'tone')
        if (!info) return
        const freq = Math.max(0, int(args[1]))
        core.setMode(info.name, 'output')
        core.setTone(info.name, freq)
        const duration = args.length > 2 ? num(args[2]) : 0
        if (duration > 0) core.after(duration * 1000, () => core.setTone(info.name, 0))
      },
    },
    noTone: {
      returns: 'void',
      fn(args) {
        const info = pinOf(args[0], 'noTone')
        if (info) core.setTone(info.name, 0)
      },
    },

    // ------------------------------------------------------------------ pulseIn
    pulseIn: {
      returns: 'unsigned long',
      *fn(args, ctx) {
        const info = pinOf(args[0], 'pulseIn')
        if (!info) return 0
        const level = args[1] ? 1 : 0
        const timeout = args.length > 2 ? Math.max(0, num(args[2])) : 1000000

        const binding = core.bindings.byPin('ultrasonic', 'echo', info.name)
        if (binding) {
          const controls = core.controlsOf(binding.componentId)
          const distance = Math.max(2, Math.min(400, num(controls.distanceCm ?? 50)))
          const us = Math.round(distance * 58.3)
          if (us >= timeout) { yield ctx.sleep(timeout); return 0 }
          yield ctx.sleep(us)
          return us
        }

        const started = ctx.now()
        while (digitalLevel(info) !== level) {
          if (ctx.now() - started >= timeout) return 0
          yield ctx.sleep(PULSE_POLL_US)
        }
        const high = ctx.now()
        while (digitalLevel(info) === level) {
          if (ctx.now() - high >= timeout) return 0
          yield ctx.sleep(PULSE_POLL_US)
        }
        return ctx.now() - high
      },
    },

    // ------------------------------------------------------------------ maths & bits
    map: {
      returns: 'long',
      fn(args) {
        const [x, inMin, inMax, outMin, outMax] = args.map(num)
        if (inMax === inMin) return Math.trunc(outMin)
        return Math.trunc(((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin)
      },
    },
    constrain: (args) => Math.min(Math.max(num(args[0]), num(args[1])), num(args[2])),
    min: (args) => args.map(num).reduce((a, b) => (b < a ? b : a)),
    max: (args) => args.map(num).reduce((a, b) => (b > a ? b : a)),
    abs: (args) => Math.abs(num(args[0])),
    pow: { returns: 'double', fn: (args) => Math.pow(num(args[0]), num(args[1])) },
    sqrt: { returns: 'double', fn: (args) => Math.sqrt(num(args[0])) },
    sq: (args) => num(args[0]) * num(args[0]),
    round: { returns: 'long', fn: (args) => Math.round(num(args[0])) },
    floor: { returns: 'long', fn: (args) => Math.floor(num(args[0])) },
    ceil: { returns: 'long', fn: (args) => Math.ceil(num(args[0])) },
    sin: { returns: 'double', fn: (args) => Math.sin(num(args[0])) },
    cos: { returns: 'double', fn: (args) => Math.cos(num(args[0])) },
    tan: { returns: 'double', fn: (args) => Math.tan(num(args[0])) },
    log: { returns: 'double', fn: (args) => Math.log(num(args[0])) },
    log10: { returns: 'double', fn: (args) => Math.log10(num(args[0])) },
    exp: { returns: 'double', fn: (args) => Math.exp(num(args[0])) },
    fabs: { returns: 'double', fn: (args) => Math.abs(num(args[0])) },
    random: {
      returns: 'long',
      fn(args) {
        if (args.length === 0) return Math.floor(rng() * 2147483647)
        const lo = args.length >= 2 ? int(args[0]) : 0
        const hi = args.length >= 2 ? int(args[1]) : int(args[0])
        if (hi <= lo) return lo
        return lo + Math.floor(rng() * (hi - lo))
      },
    },
    randomSeed: { returns: 'void', fn(args) { rng = mulberry32(int(args[0]) || 1) } },
    bit: { returns: 'unsigned long', fn: (args) => (1 << (int(args[0]) & 31)) >>> 0 },
    bitRead: { returns: 'int', fn: (args) => (int(args[0]) >> (int(args[1]) & 31)) & 1 },
    bitSet: { returns: 'unsigned long', fn: (args) => (int(args[0]) | (1 << (int(args[1]) & 31))) >>> 0 },
    bitClear: { returns: 'unsigned long', fn: (args) => (int(args[0]) & ~(1 << (int(args[1]) & 31))) >>> 0 },
    bitWrite: { returns: 'unsigned long', fn: (args) => (args[2] ? int(args[0]) | (1 << (int(args[1]) & 31)) : int(args[0]) & ~(1 << (int(args[1]) & 31))) >>> 0 },
    lowByte: { returns: 'byte', fn: (args) => int(args[0]) & 0xFF },
    highByte: { returns: 'byte', fn: (args) => (int(args[0]) >> 8) & 0xFF },
    isDigit: { returns: 'bool', fn: (args) => (charCode(args[0]) >= 48 && charCode(args[0]) <= 57 ? 1 : 0) },
    isAlpha: { returns: 'bool', fn: (args) => (/[a-z]/i.test(String.fromCharCode(charCode(args[0]))) ? 1 : 0) },
    isSpace: { returns: 'bool', fn: (args) => (/\s/.test(String.fromCharCode(charCode(args[0]))) ? 1 : 0) },
    isUpperCase: { returns: 'bool', fn: (args) => (/[A-Z]/.test(String.fromCharCode(charCode(args[0]))) ? 1 : 0) },
    isLowerCase: { returns: 'bool', fn: (args) => (/[a-z]/.test(String.fromCharCode(charCode(args[0]))) ? 1 : 0) },
    isPunct: { returns: 'bool', fn: (args) => (/[!-/:-@[-`{-~]/.test(String.fromCharCode(charCode(args[0]))) ? 1 : 0) },

    // ------------------------------------------------------------------ interrupts
    attachInterrupt: {
      returns: 'void',
      fn(args) {
        const info = pinOf(args[0], 'attachInterrupt')
        if (!info) return
        const mode = INTERRUPT_MODES[int(args[2])] ?? 'change'
        core.attachInterrupt(info.name, args[1], mode)
      },
    },
    detachInterrupt: {
      returns: 'void',
      fn(args) {
        const info = pinOf(args[0], 'detachInterrupt')
        if (info) core.detachInterrupt(info.name)
      },
    },
    digitalPinToInterrupt: { returns: 'int', fn: (args) => int(args[0]) },
    interrupts: { returns: 'void', fn() { core.shared.interruptsEnabled = true } },
    noInterrupts: { returns: 'void', fn() { core.shared.interruptsEnabled = false } },
  }

  /** ESP32 ADC configuration is shared with `libraries/esp32.js`. */
  const adc = {
    setAttenuation(att) { defaultAttenuation = clampAttenuation(att) },
    setPinAttenuation(pinArg, att) {
      const info = pinOf(pinArg, 'analogSetPinAttenuation')
      if (info) pinAttenuation.set(info.name, clampAttenuation(att))
    },
    readMilliVolts(pinArg) {
      const s = sampleAnalog(pinArg, 'analogReadMilliVolts')
      if (!s.ok) return 0
      const mv = Math.round(Math.min(s.volts, s.fullScale) * 1000)
      core.queueRead('analog', s.info.name, adcCount(s.volts, s.fullScale))
      return mv
    },
    fullScaleFor,
    get readBits() { return readBits },
    get writeBits() { return writeBits },
  }

  function clampAttenuation(att) {
    const a = int(att)
    return a >= 0 && a < ADC_ATTENUATION_FULL_SCALE.length ? a : 3
  }

  function pwmPinList() {
    return (board.pins ?? []).filter((p) => p.caps?.includes('pwm')).map((p) => p.name).join(', ') || 'none'
  }

  function charCode(v) {
    if (typeof v === 'string') return v.charCodeAt(0) || 0
    return int(v) & 0xFF
  }

  const aliases = pins.aliasGlobals()
  const globals = {
    HIGH: 1, LOW: 0,
    INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, INPUT_PULLDOWN: 3,
    LOW_LEVEL: 0,
    CHANGE: 1, FALLING: 2, RISING: 3, ONLOW: 4, ONHIGH: 5,
    DEC: 10, HEX: 16, OCT: 8, BIN: 2,
    PI: Math.PI, HALF_PI: Math.PI / 2, TWO_PI: Math.PI * 2,
    DEG_TO_RAD: Math.PI / 180, RAD_TO_DEG: 180 / Math.PI,
    EULER: Math.E,
    ...aliases,
  }

  return { natives, globals, adc, digitalLevel }
}

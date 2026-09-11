/**
 * Board normalisation and sketch-pin resolution.
 *
 * Sketches address pins by Arduino number (13, 14 = A0 on an Uno, 4 = GPIO4 on an ESP32) or by alias
 * (`LED_BUILTIN`, `A0`, `T0`). Everything the runtime posts uses PinNames (`'D13'`, `'A0'`, `'GPIO4'`), so every
 * API call goes through `createPinResolver(board).byNumber(n)`. The boards package (`engine/boards`) is the
 * authority; when it is a stub (returns null / empty `pins`) the family tables below keep the runtime usable.
 */

/** Per-family defaults used when the BoardProfile is missing or incomplete. */
const FAMILY_DEFAULTS = {
  avr: {
    name: 'Arduino Uno', vcc: 5, gpioMaxV: 5.5, adcBits: 10, intBits: 16, statementCostUs: 1, pullupOhms: 35000,
    ledBuiltin: 'D13', i2c: { sda: 'A4', scl: 'A5' }, pwmDefault: { freqHz: 490, bits: 8 },
    libraries: ['Servo.h', 'LiquidCrystal_I2C.h', 'Wire.h', 'Adafruit_NeoPixel.h', 'DHT.h', 'Adafruit_SSD1306.h', 'Adafruit_GFX.h', 'Adafruit_BME280.h', 'Adafruit_Sensor.h'],
  },
  esp32: {
    name: 'ESP32 DevKit V1', vcc: 3.3, gpioMaxV: 3.6, adcBits: 12, intBits: 32, statementCostUs: 0.25, pullupOhms: 45000,
    ledBuiltin: 'GPIO2', i2c: { sda: 'GPIO21', scl: 'GPIO22' }, pwmDefault: { freqHz: 1000, bits: 8 },
    libraries: ['Servo.h', 'LiquidCrystal_I2C.h', 'Wire.h', 'Adafruit_NeoPixel.h', 'DHT.h', 'Adafruit_SSD1306.h', 'Adafruit_GFX.h', 'Adafruit_BME280.h', 'Adafruit_Sensor.h', 'WiFi.h', 'WebServer.h', 'PubSubClient.h', 'ESP32Servo.h'],
  },
}

const BOARD_NAMES = { uno: 'Arduino Uno', nano: 'Arduino Nano', esp32: 'ESP32 DevKit V1', esp32s3: 'ESP32-S3 DevKitC-1' }

/**
 * Fallback per-board pin knowledge (numbers → capabilities). Only consulted when the BoardProfile has no `pins`,
 * plus the ADC unit (ADC1/ADC2) which PinDef does not carry.
 */
const FALLBACK = {
  uno: {
    maxNumber: 19, pwm: [3, 5, 6, 9, 10, 11], interrupt: [2, 3], serial: [0, 1],
    adc: { 14: 0, 15: 1, 16: 2, 17: 3, 18: 4, 19: 5 }, analogOnly: [],
    aliases: { A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, LED_BUILTIN: 13, SDA: 18, SCL: 19 },
  },
  nano: {
    maxNumber: 21, pwm: [3, 5, 6, 9, 10, 11], interrupt: [2, 3], serial: [0, 1],
    adc: { 14: 0, 15: 1, 16: 2, 17: 3, 18: 4, 19: 5, 20: 6, 21: 7 }, analogOnly: [20, 21],
    aliases: { A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, A6: 20, A7: 21, LED_BUILTIN: 13, SDA: 18, SCL: 19 },
  },
  esp32: {
    maxNumber: 39,
    header: [15, 2, 4, 16, 17, 5, 18, 19, 21, 3, 1, 22, 23, 13, 12, 14, 27, 26, 25, 33, 32, 35, 34, 39, 36],
    adc1: { 36: 0, 37: 1, 38: 2, 39: 3, 32: 4, 33: 5, 34: 6, 35: 7 },
    adc2: { 4: 0, 0: 1, 2: 2, 15: 3, 13: 4, 12: 5, 14: 6, 27: 7, 25: 8, 26: 9 },
    dac: { 25: 1, 26: 2 },
    touch: { 4: 0, 0: 1, 2: 2, 15: 3, 13: 4, 12: 5, 14: 6, 27: 7, 33: 8, 32: 9 },
    inputOnly: [34, 35, 36, 39], serial: [1, 3], i2c: { 21: 'i2c_sda', 22: 'i2c_scl' },
    aliases: {
      T0: 4, T1: 0, T2: 2, T3: 15, T4: 13, T5: 12, T6: 14, T7: 27, T8: 33, T9: 32,
      A0: 36, A1: 37, A2: 38, A3: 39, A4: 32, A5: 33, A6: 34, A7: 35, A10: 4, A11: 0, A12: 2, A13: 15, A14: 13, A15: 12, A16: 14, A17: 27, A18: 25, A19: 26,
      LED_BUILTIN: 2, SDA: 21, SCL: 22, RX: 3, TX: 1, DAC1: 25, DAC2: 26,
    },
  },
  esp32s3: {
    maxNumber: 48,
    adc1: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9 },
    adc2: { 11: 0, 12: 1, 13: 2, 14: 3, 15: 4, 16: 5, 17: 6, 18: 7, 19: 8, 20: 9 },
    dac: {}, inputOnly: [], serial: [43, 44], i2c: { 8: 'i2c_sda', 9: 'i2c_scl' },
    touch: Object.fromEntries(Array.from({ length: 14 }, (_, i) => [i + 1, i + 1])),
    aliases: {
      ...Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`T${i + 1}`, i + 1])),
      ...Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`A${i}`, i + 1])),
      LED_BUILTIN: 48, SDA: 8, SCL: 9, RX: 44, TX: 43,
    },
  },
}

/** Full-scale voltages of the ESP32 ADC attenuation settings (index = ADC_0db … ADC_11db). */
export const ADC_ATTENUATION_FULL_SCALE = [1.1, 1.5, 2.2, 3.3]

/**
 * Turns whatever the worker hands us into a complete BoardProfile-like object.
 * Accepts a BoardProfile, a BoardId string, or null (→ Uno defaults).
 * @param {object|string|null} board
 * @param {object} [boardsModule] engine/boards namespace (test injection)
 */
export function normalizeBoard(board, boardsModule) {
  let profile = board
  if (typeof board === 'string') profile = boardsModule?.getBoard?.(board) ?? { id: board }
  if (!profile || typeof profile !== 'object') profile = { id: 'uno' }
  const id = profile.id ?? 'uno'
  const family = profile.family ?? (id.startsWith('esp32') ? 'esp32' : 'avr')
  const defaults = FAMILY_DEFAULTS[family] ?? FAMILY_DEFAULTS.avr
  const ledBuiltin = Object.hasOwn(profile, 'ledBuiltin') ? profile.ledBuiltin : (id === 'esp32s3' ? 'GPIO48' : defaults.ledBuiltin)
  const i2c = profile.i2c ?? (id === 'esp32s3' ? { sda: 'GPIO8', scl: 'GPIO9' } : defaults.i2c)
  return {
    ...defaults,
    ...profile,
    id,
    family,
    name: profile.name ?? BOARD_NAMES[id] ?? defaults.name,
    ledBuiltin,
    i2c,
    pins: Array.isArray(profile.pins) ? profile.pins : [],
    libraries: Array.isArray(profile.libraries) ? profile.libraries : defaults.libraries,
    pwmDefault: profile.pwmDefault ?? defaults.pwmDefault,
  }
}

/**
 * @typedef PinInfo
 * @property {string} name        PinName posted in messages
 * @property {number} number      Arduino pin number
 * @property {Set<string>} caps   'digital'|'pwm'|'adc'|'dac'|'touch'|'input_only'|'i2c_sda'|'i2c_scl'|'interrupt'|'serial'
 * @property {number|null} adcChannel
 * @property {1|2|null} adcUnit   ESP32 ADC unit (ADC2 is unavailable while WiFi runs)
 * @property {number|null} touchChannel
 * @property {number|null} dacChannel
 * @property {boolean} onHeader   false when the fallback tables know the GPIO but the board header does not expose it
 */

function fallbackTable(board) {
  return FALLBACK[board.id] ?? (board.family === 'esp32' ? FALLBACK.esp32 : FALLBACK.uno)
}

function fallbackName(board, n) {
  if (board.family === 'esp32') return `GPIO${n}`
  return n >= 14 ? `A${n - 14}` : `D${n}`
}

function adcUnitOf(table, n) {
  if (table.adc1 && n in table.adc1) return 1
  if (table.adc2 && n in table.adc2) return 2
  return table.adc && n in table.adc ? 1 : null
}

function fallbackPinInfo(board, n) {
  const table = fallbackTable(board)
  if (!Number.isInteger(n) || n < 0 || n > table.maxNumber) return null
  const caps = new Set(['digital'])
  if (board.family === 'avr') {
    if (table.analogOnly.includes(n)) caps.delete('digital')
    if (table.pwm.includes(n)) caps.add('pwm')
    if (n in table.adc) caps.add('adc')
    if (table.interrupt.includes(n)) caps.add('interrupt')
    if (table.serial.includes(n)) caps.add('serial')
    if (table.aliases.SDA === n) caps.add('i2c_sda')
    if (table.aliases.SCL === n) caps.add('i2c_scl')
    return { name: fallbackName(board, n), number: n, caps, adcChannel: table.adc[n] ?? null, adcUnit: n in table.adc ? 1 : null, touchChannel: null, dacChannel: null, onHeader: true }
  }
  const inputOnly = table.inputOnly.includes(n)
  if (!inputOnly) caps.add('pwm')
  else caps.add('input_only')
  const adcChannel = table.adc1[n] ?? table.adc2[n] ?? null
  if (adcChannel != null) caps.add('adc')
  if (n in table.dac) caps.add('dac')
  if (n in table.touch) caps.add('touch')
  if (table.serial.includes(n)) caps.add('serial')
  if (table.i2c[n]) caps.add(table.i2c[n])
  caps.add('interrupt')
  return {
    name: fallbackName(board, n), number: n, caps, adcChannel, adcUnit: adcUnitOf(table, n),
    touchChannel: table.touch[n] ?? null, dacChannel: table.dac[n] ?? null,
    onHeader: table.header ? table.header.includes(n) : true,
  }
}

function infoFromPinDef(board, def) {
  const table = fallbackTable(board)
  const caps = new Set(def.caps ?? [])
  if (def.kind === 'digital' || def.kind === 'analog') caps.add('digital')
  if (def.kind === 'analog' && def.adcChannel != null) caps.add('adc')
  if (board.family === 'avr' && def.kind === 'analog' && def.number != null && table.analogOnly.includes(def.number)) caps.delete('digital')
  return {
    name: def.name, number: def.number, caps,
    adcChannel: def.adcChannel ?? null,
    adcUnit: caps.has('adc') ? (board.family === 'esp32' ? adcUnitOf(table, def.number) ?? 1 : 1) : null,
    touchChannel: def.touchChannel ?? null, dacChannel: def.dacChannel ?? null, onHeader: true,
  }
}

/**
 * Builds the pin resolver for a (normalised) board.
 * @param {object} board  result of normalizeBoard
 * @param {object} [boardsModule] engine/boards namespace (defaults to the real module when passed by the runtime)
 */
export function createPinResolver(board, boardsModule) {
  const byNumberCache = new Map()
  const byNameCache = new Map()
  const hasProfilePins = board.pins.length > 0

  function fromProfileByNumber(n) {
    const def = boardsModule?.resolvePinNumber?.(board, n) ?? board.pins.find((p) => p.number === n) ?? null
    return def ? infoFromPinDef(board, def) : null
  }

  function fromProfileByName(name) {
    const def = boardsModule?.resolvePinName?.(board, name)
      ?? board.pins.find((p) => p.name === name || p.label === name || (p.aliases ?? []).includes(name)) ?? null
    return def ? infoFromPinDef(board, def) : null
  }

  /** @param {number} n Arduino pin number → PinInfo or null when the pin does not exist on this board. */
  function byNumber(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return null
    n = Math.trunc(n)
    if (byNumberCache.has(n)) return byNumberCache.get(n)
    let info = null
    if (hasProfilePins) {
      info = fromProfileByNumber(n)
      // Real GPIOs that are not on the DevKit header (ESP32 GPIO0 …) still get a name so sketches keep running.
      if (!info && board.family === 'esp32') {
        info = fallbackPinInfo(board, n)
        if (info) info.onHeader = false
      }
    } else {
      info = fallbackPinInfo(board, n)
    }
    byNumberCache.set(n, info)
    return info
  }

  /** @param {string} name PinName, label or alias → PinInfo or null. */
  function byName(name) {
    if (typeof name !== 'string') return null
    if (byNameCache.has(name)) return byNameCache.get(name)
    let info = hasProfilePins ? fromProfileByName(name) : null
    if (!info && board.family === 'raspberrypi') return null
    if (!info) {
      const table = fallbackTable(board)
      if (name in table.aliases) info = byNumber(table.aliases[name])
      else {
        const m = /^(?:D|GPIO)(\d+)$/.exec(name)
        if (m) info = byNumber(Number(m[1]))
        else if (/^A\d$/.test(name) && board.family === 'avr') info = byNumber(14 + Number(name.slice(1)))
      }
    }
    byNameCache.set(name, info)
    return info
  }

  /** Accepts a number or a name/alias. */
  function resolve(pin) {
    return typeof pin === 'number' ? byNumber(pin) : byName(pin)
  }

  /** Alias globals exposed to sketches (`A0`, `T0`, `LED_BUILTIN`, …) → Arduino numbers. */
  function aliasGlobals() {
    const table = fallbackTable(board)
    const out = board.family === 'raspberrypi' ? {} : { ...table.aliases }
    if (hasProfilePins) {
      for (const def of board.pins) {
        if (def.number == null) continue
        for (const alias of def.aliases ?? []) out[alias] = def.number
      }
      const led = byName(board.ledBuiltin)
      if (led) out.LED_BUILTIN = led.number
      const sda = byName(board.i2c?.sda)
      const scl = byName(board.i2c?.scl)
      if (sda) out.SDA = sda.number
      if (scl) out.SCL = scl.number
    }
    return out
  }

  /** Pin numbers of the board's I2C bus, for library address matching. */
  function i2cPins() {
    return { sda: byName(board.i2c?.sda)?.name ?? board.i2c?.sda ?? null, scl: byName(board.i2c?.scl)?.name ?? board.i2c?.scl ?? null }
  }

  return { byNumber, byName, resolve, aliasGlobals, i2cPins }
}

/**
 * Runtime values of the Arduino subset: number/String formatting and the whole `String` class
 * (CONTRACTS §6 — "String is language-level (E1)").
 *
 * A sketch `String` is a JS primitive string. Arduino's mutating methods (`trim`, `toUpperCase`, `replace`,
 * `remove`, `setCharAt`, `concat`) cannot mutate a primitive, so they are flagged `mutates` and the VM writes
 * the result back to the l-value the method was called on — `s.trim();` as a bare statement behaves as it does
 * on hardware. Mutating methods additionally *return* the new string (Arduino returns `void`/`bool`), which is
 * a superset of the real API.
 */

import { isCharType, isFloatType, isIntegerType, widthOf } from './types.js'

/** Largest value Arduino's `printFloat` renders; beyond it the real Print emits "ovf". */
const FLOAT_OVF = 4294967040

/**
 * Formats a float the way Arduino's `Print::printFloat` does: fixed decimals, half-away-from-zero rounding,
 * and the spelled-out specials.
 * @param {number} v
 * @param {number} [digits] decimals (Arduino's default is 2)
 */
export function formatFloat(v, digits = 2) {
  if (Number.isNaN(v)) return 'nan'
  if (v === Infinity) return 'inf'
  if (v === -Infinity) return '-inf'
  if (Math.abs(v) > FLOAT_OVF) return 'ovf'
  const d = Math.max(0, Math.min(20, Math.trunc(digits)))
  // toFixed rounds half-to-even for some binary fractions; Arduino adds half an ulp of the last digit first.
  const scale = Math.pow(10, d)
  const rounded = Math.sign(v) * Math.floor((Math.abs(v) + 0.5 / scale) * scale) / scale
  let s = d === 0 ? String(Math.trunc(rounded)) : rounded.toFixed(d)
  if (s === '-0' || /^-0\.0+$/.test(s)) s = s.slice(1)
  return s
}

/**
 * Formats an integer in a print base. DEC keeps the sign; HEX/OCT/BIN print the two's complement of `width`
 * bits, so `Serial.print(-1, HEX)` is "FFFF" on an Uno and "FFFFFFFF" on an ESP32.
 * @param {number} v
 * @param {number} [base] 10 | 16 | 8 | 2 (any radix 2..36 works)
 * @param {number} [width] bit width used for the two's complement
 */
export function formatInt(v, base = 10, width = 32) {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? 'nan' : v > 0 ? 'inf' : '-inf'
  let n = Math.trunc(v)
  const b = base >= 2 && base <= 36 ? Math.trunc(base) : 10
  if (b === 10) return String(n)
  if (n < 0) {
    const mod = Math.pow(2, Math.min(width, 53))
    n = ((n % mod) + mod) % mod
  }
  return n.toString(b).toUpperCase()
}

/** Reads a `char[]` (array of codes, NUL-terminated) as text. Strings pass through. */
export function charArrayToString(v) {
  if (typeof v === 'string') return v
  if (v == null) return ''
  if (Array.isArray(v)) {
    let s = ''
    for (let i = 0; i < v.length; i++) {
      const c = v[i]
      if (c === 0 || c == null) break
      s += typeof c === 'number' ? String.fromCharCode(c & 0xFF) : String(c)
    }
    return s
  }
  if (typeof v === 'object' && typeof v.__toString === 'function') return String(v.__toString())
  return String(v)
}

/** Fills a fixed-size `char[]` with `text` plus a NUL terminator. */
export function stringToCharArray(text, size) {
  const s = String(text)
  const len = size == null ? s.length + 1 : size
  const out = new Array(len).fill(0)
  for (let i = 0; i < s.length && i < len - (size == null ? 1 : 0); i++) out[i] = s.charCodeAt(i) & 0xFF
  if (size == null) out[s.length] = 0
  return out
}

/**
 * Arduino-style rendering of a value (CONTRACTS §6).
 * @param {*} value
 * @param {string} [type] static C type of the expression ('char', 'float', 'unsigned long', 'String', …)
 * @param {number} [base] print base for integers (DEC/HEX/OCT/BIN) or decimal places for floats
 * @param {number} [intBits] width of `int` on the board — only affects HEX/OCT/BIN of negative ints
 * @returns {string}
 */
export function formatValue(value, type, base, intBits = 32) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'object') {
    if (Array.isArray(value)) return charArrayToString(value)
    if (typeof value.__toString === 'function') return String(value.__toString())
    return '[object]'
  }
  if (typeof value !== 'number') return String(value)
  if (isCharType(type)) return String.fromCharCode(value & 0xFF)
  if (type === 'bool') return value ? '1' : '0'
  if (isFloatType(type)) return formatFloat(value, base ?? 2)
  if (isIntegerType(type)) return formatInt(value, base ?? 10, widthOf(type, intBits))
  // Unknown static type (a plain native function's return value): integers print as integers, anything else
  // with two decimals — never as a character.
  if (Number.isInteger(value)) return formatInt(value, base ?? 10, 32)
  return formatFloat(value, base ?? 2)
}

/** Renders one side of a `String` concatenation. */
export function toText(value, type, intBits) {
  if (typeof value === 'string') return value
  return formatValue(value, type, undefined, intBits)
}

/** Arduino `String` concatenation: numbers become decimal, floats get 2 decimals, chars become characters. */
export function concatValues(left, leftType, right, rightType, intBits) {
  return toText(left, leftType, intBits) + toText(right, rightType, intBits)
}

/**
 * Truthiness in a condition. Note: Arduino's `String::operator bool` tests the internal buffer pointer, so an
 * empty String is *true* there; VoltQuest uses "not empty", which is what learners expect.
 */
export function truthy(v) {
  if (v === null || v === undefined) return false
  const t = typeof v
  if (t === 'number') return v !== 0
  if (t === 'boolean') return v
  if (t === 'string') return v.length > 0
  return true
}

/** Coerces any value to a number for arithmetic (`String` uses its leading numeric prefix, like `toFloat`). */
export function toNumber(v) {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v === null || v === undefined) return 0
  if (typeof v === 'string') return parseFloatPrefix(v)
  if (Array.isArray(v)) return parseFloatPrefix(charArrayToString(v))
  return Number.isFinite(Number(v)) ? Number(v) : 0
}

/** avr-libc `atol` semantics: leading whitespace, optional sign, digits, stop at the first non-digit. */
function parseIntPrefix(s) {
  const m = /^\s*[+-]?\d+/.exec(s)
  return m ? Math.trunc(Number(m[0])) : 0
}

/** avr-libc `atof` semantics. */
function parseFloatPrefix(s) {
  const m = /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s)
  return m ? Number(m[0]) : 0
}

/** A char argument may arrive as a code (char literal) or as a one-character String. */
function asText(v) {
  if (typeof v === 'number') return String.fromCharCode(v & 0xFF)
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return charArrayToString(v)
  return v == null ? '' : String(v)
}

function clampIndex(i, len) {
  if (!Number.isFinite(i)) return 0
  return Math.max(0, Math.min(len, Math.trunc(i)))
}

/**
 * Every `String` method of the subset. `mutates: true` means the VM assigns the returned string back to the
 * l-value the method was called on (Arduino mutates in place).
 * @type {Record<string, { returns: string, mutates?: boolean, fn: (self: string, args: any[]) => any }>}
 */
export const STRING_METHODS = {
  length: { returns: 'unsigned int', fn: (s) => s.length },
  isEmpty: { returns: 'bool', fn: (s) => (s.length === 0 ? 1 : 0) },
  charAt: { returns: 'char', fn: (s, a) => { const i = Math.trunc(toNumber(a[0])); return i >= 0 && i < s.length ? s.charCodeAt(i) : 0 } },
  indexOf: {
    returns: 'int',
    fn: (s, a) => s.indexOf(asText(a[0]), a.length > 1 ? clampIndex(toNumber(a[1]), s.length) : 0),
  },
  lastIndexOf: {
    returns: 'int',
    fn: (s, a) => {
      const needle = asText(a[0])
      if (a.length < 2) return s.lastIndexOf(needle)
      return s.lastIndexOf(needle, clampIndex(toNumber(a[1]), s.length))
    },
  },
  substring: {
    returns: 'String',
    fn: (s, a) => {
      const from = clampIndex(toNumber(a[0]), s.length)
      const to = a.length > 1 ? clampIndex(toNumber(a[1]), s.length) : s.length
      return to <= from ? '' : s.slice(from, to)
    },
  },
  toInt: { returns: 'long', fn: (s) => parseIntPrefix(s) | 0 },
  toFloat: { returns: 'float', fn: (s) => Math.fround(parseFloatPrefix(s)) },
  toDouble: { returns: 'double', fn: (s) => parseFloatPrefix(s) },
  equals: { returns: 'bool', fn: (s, a) => (s === asText(a[0]) ? 1 : 0) },
  equalsIgnoreCase: { returns: 'bool', fn: (s, a) => (s.toLowerCase() === asText(a[0]).toLowerCase() ? 1 : 0) },
  startsWith: { returns: 'bool', fn: (s, a) => (s.startsWith(asText(a[0]), a.length > 1 ? clampIndex(toNumber(a[1]), s.length) : 0) ? 1 : 0) },
  endsWith: { returns: 'bool', fn: (s, a) => (s.endsWith(asText(a[0])) ? 1 : 0) },
  c_str: { returns: 'String', fn: (s) => s },
  compareTo: {
    returns: 'int',
    fn: (s, a) => {
      const o = asText(a[0])
      const n = Math.min(s.length, o.length)
      for (let i = 0; i < n; i++) {
        const d = s.charCodeAt(i) - o.charCodeAt(i)
        if (d !== 0) return d
      }
      return s.length - o.length
    },
  },
  toUpperCase: { returns: 'String', mutates: true, fn: (s) => s.toUpperCase() },
  toLowerCase: { returns: 'String', mutates: true, fn: (s) => s.toLowerCase() },
  trim: { returns: 'String', mutates: true, fn: (s) => s.replace(/^[\s\0]+|[\s\0]+$/g, '') },
  replace: {
    returns: 'String',
    mutates: true,
    fn: (s, a) => {
      const find = asText(a[0])
      if (find === '') return s
      return s.split(find).join(asText(a[1]))
    },
  },
  concat: { returns: 'String', mutates: true, fn: (s, a, types, intBits) => s + toText(a[0], types?.[0], intBits) },
  remove: {
    returns: 'String',
    mutates: true,
    fn: (s, a) => {
      const from = clampIndex(toNumber(a[0]), s.length)
      const count = a.length > 1 ? Math.max(0, Math.trunc(toNumber(a[1]))) : s.length - from
      return s.slice(0, from) + s.slice(from + count)
    },
  },
  setCharAt: {
    returns: 'String',
    mutates: true,
    fn: (s, a) => {
      const i = Math.trunc(toNumber(a[0]))
      if (i < 0 || i >= s.length) return s
      return s.slice(0, i) + asText(a[1]).charAt(0) + s.slice(i + 1)
    },
  },
  reserve: { returns: 'bool', fn: () => 1 },
}

/** Arduino `String(value)` / `String(value, HEX)` / `String(float, decimals)`. */
export function stringCast(value, type, arg, intBits) {
  if (arg === undefined) return toText(value, type, intBits)
  const n = Math.trunc(toNumber(arg))
  if (typeof value === 'number' && isFloatType(type)) return formatFloat(value, n)
  if (typeof value === 'number' && !isIntegerType(type) && !Number.isInteger(value)) return formatFloat(value, n)
  return formatInt(toNumber(value), n, widthOf(type ?? 'long', intBits))
}

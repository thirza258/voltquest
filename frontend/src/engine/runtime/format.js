/**
 * Arduino-style value formatting. The interpreter exports `formatValue` (CONTRACTS §6); this module provides the
 * same rules as a fallback plus printf-family formatting shared by Serial.printf / snprintf / sprintf.
 */

const INT_TYPES = new Set(['int', 'unsigned int', 'short', 'unsigned short', 'long', 'unsigned long', 'byte', 'word',
  'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t', 'size_t', 'unsigned char', 'long long', 'unsigned long long'])
const FLOAT_TYPES = new Set(['float', 'double'])
const CHAR_TYPES = new Set(['char', 'int8_t', 'signed char'])
const UNSIGNED_TYPES = new Set(['unsigned int', 'unsigned short', 'unsigned long', 'byte', 'word', 'uint8_t', 'uint16_t', 'uint32_t', 'size_t', 'unsigned char', 'unsigned long long'])

/** Bit width of an integer C type (`intBits` decides `int`/`unsigned int`). */
export function widthOf(type, intBits = 16) {
  switch (type) {
    case 'byte': case 'uint8_t': case 'int8_t': case 'char': case 'unsigned char': case 'signed char': case 'bool': case 'boolean': return 8
    case 'short': case 'unsigned short': case 'int16_t': case 'uint16_t': case 'word': return 16
    case 'long': case 'unsigned long': case 'int32_t': case 'uint32_t': case 'size_t': return 32
    case 'int': case 'unsigned int': return intBits
    default: return 32
  }
}

/** Formats a float the way Arduino's Print does: fixed decimals, nan/inf/ovf spelled out. */
export function formatFloat(v, digits = 2) {
  if (Number.isNaN(v)) return 'nan'
  if (v === Infinity) return 'inf'
  if (v === -Infinity) return '-inf'
  if (Math.abs(v) > 4294967040) return 'ovf'
  const d = Math.max(0, Math.min(20, Math.trunc(digits)))
  // Arduino rounds half away from zero; toFixed rounds half to even on some engines for binary fractions —
  // apply the classic "+0.5·10^-d" rounding first.
  const rounding = 0.5 * Math.pow(10, -d)
  const scale = Math.pow(10, d)
  const rounded = Math.sign(v) * Math.floor((Math.abs(v) + rounding) * scale) / scale
  let s = rounded.toFixed(d)
  if (d === 0) s = String(Math.trunc(rounded))
  if (s === '-0' || /^-0\.0+$/.test(s)) s = s.slice(1)
  return s
}

/**
 * Formats an integer in a base. Negative numbers print with a sign in DEC and as two's complement (of `width`
 * bits) in other bases, as Arduino does.
 */
export function formatInt(v, base = 10, width = 32) {
  if (!Number.isFinite(v)) return String(v)
  let n = Math.trunc(v)
  const b = base >= 2 && base <= 36 ? Math.trunc(base) : 10
  if (b === 10) return String(n)
  if (n < 0) {
    const mod = 2 ** Math.min(width, 53)
    n = ((n % mod) + mod) % mod
  }
  return n.toString(b).toUpperCase()
}

/**
 * Fallback for the interpreter's formatValue (CONTRACTS §6).
 * @param {*} value
 * @param {string} [type] static C type of the expression ('char', 'float', 'int', 'String', 'bool', …)
 * @param {number} [base] print base for ints (DEC/HEX/OCT/BIN) or decimals for floats
 * @param {number} [intBits]
 */
export function fallbackFormatValue(value, type, base, intBits = 16) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'object') {
    if (typeof value.__toString === 'function') return String(value.__toString())
    if (Array.isArray(value)) return charArrayToString(value)
    return '[object]'
  }
  if (typeof value === 'bigint') return value.toString()
  if (typeof value !== 'number') return String(value)
  if (type && CHAR_TYPES.has(type)) return String.fromCharCode(((Math.trunc(value) % 256) + 256) % 256)
  if (type === 'bool' || type === 'boolean') return value ? '1' : '0'
  if (type && FLOAT_TYPES.has(type)) return formatFloat(value, base ?? 2)
  if (type && INT_TYPES.has(type)) return formatInt(value, base ?? 10, widthOf(type, intBits))
  // unknown type: integers print as integers, anything else with 2 decimals (never as a char)
  if (Number.isInteger(value)) return formatInt(value, base ?? 10, 32)
  return formatFloat(value, base ?? 2)
}

/** Interprets a `char[]` (array of codes, NUL-terminated) as text. Strings pass through. */
export function charArrayToString(v) {
  if (typeof v === 'string') return v
  if (v == null) return ''
  if (Array.isArray(v) || ArrayBuffer.isView(v)) {
    let s = ''
    for (const c of v) {
      if (c === 0) break
      s += typeof c === 'number' ? String.fromCharCode(c & 0xFF) : String(c)
    }
    return s
  }
  if (typeof v === 'object' && typeof v.__toString === 'function') return String(v.__toString())
  return String(v)
}

/** Writes `text` + NUL into a `char[]` destination (JS array). Returns the number of characters written. */
export function writeCharArray(dest, text, maxLen = Infinity) {
  if (!dest || typeof dest !== 'object' || !(Array.isArray(dest) || ArrayBuffer.isView(dest))) return 0
  const limit = Math.min(maxLen, ArrayBuffer.isView(dest) ? dest.length : Infinity)
  const n = Math.min(text.length, Math.max(0, limit - 1))
  for (let i = 0; i < n; i++) dest[i] = text.charCodeAt(i) & 0xFF
  if (n < limit) dest[n] = 0
  return n
}

/** Converts a value to a text string for `%s`, accepting String, char[], numbers and printable objects. */
function toText(v, type, intBits) {
  if (typeof v === 'string') return v
  if (Array.isArray(v) || ArrayBuffer.isView(v)) return charArrayToString(v)
  return fallbackFormatValue(v, type, undefined, intBits)
}

function pad(s, width, left, zero) {
  if (!width || s.length >= width) return s
  if (left) return s + ' '.repeat(width - s.length)
  if (zero) {
    const sign = s[0] === '-' || s[0] === '+' ? s[0] : ''
    return sign + '0'.repeat(width - s.length) + s.slice(sign.length)
  }
  return ' '.repeat(width - s.length) + s
}

/**
 * C printf formatting (subset: %d %i %u %ld %lu %x %X %o %c %s %f %e %g %p %% with flags `-+ 0#`, width and
 * precision, `*` width). Used by Serial.printf, snprintf and sprintf.
 * @param {string} fmt
 * @param {any[]} args
 * @param {string[]} [argTypes] static types of args (for %c on ints vs chars and unsigned widths)
 * @param {number} [intBits]
 */
export function cFormat(fmt, args, argTypes = [], intBits = 32) {
  let out = ''
  let ai = 0
  const next = () => { const v = args[ai]; const t = argTypes[ai]; ai++; return [v, t] }
  const re = /%([-+ 0#]*)(\*|\d+)?(?:\.(\*|\d+))?(hh|h|ll|l|z|j|t)?([diuxXocsfFeEgGp%])/g
  let last = 0
  let m
  while ((m = re.exec(fmt))) {
    out += fmt.slice(last, m.index)
    last = re.lastIndex
    const [, flags, widthSpec, precSpec, , conv] = m
    if (conv === '%') { out += '%'; continue }
    const left = flags.includes('-')
    const zero = flags.includes('0') && !left
    const plus = flags.includes('+')
    const space = flags.includes(' ')
    const alt = flags.includes('#')
    const width = widthSpec === '*' ? Math.trunc(Number(next()[0]) || 0) : widthSpec ? Number(widthSpec) : 0
    const precision = precSpec === '*' ? Math.trunc(Number(next()[0]) || 0) : precSpec != null ? Number(precSpec) : null
    const [value, type] = next()
    let s
    switch (conv) {
      case 'd': case 'i': {
        let n = Math.trunc(Number(value) || 0)
        s = String(Math.abs(n))
        if (precision != null) s = s.padStart(precision, '0')
        s = (n < 0 ? '-' : plus ? '+' : space ? ' ' : '') + s
        break
      }
      case 'u': {
        let n = Math.trunc(Number(value) || 0)
        if (n < 0) { const w = widthOf(type ?? 'unsigned long', intBits); const mod = 2 ** w; n = ((n % mod) + mod) % mod }
        s = String(n)
        if (precision != null) s = s.padStart(precision, '0')
        break
      }
      case 'x': case 'X': case 'o': {
        const n = Math.trunc(Number(value) || 0)
        const w = type && UNSIGNED_TYPES.has(type) ? widthOf(type, intBits) : (type ? widthOf(type, intBits) : 32)
        s = formatInt(n, conv === 'o' ? 8 : 16, w)
        if (conv === 'x') s = s.toLowerCase()
        if (precision != null) s = s.padStart(precision, '0')
        if (alt && n !== 0) s = (conv === 'o' ? '0' : conv === 'x' ? '0x' : '0X') + s
        break
      }
      case 'c':
        s = typeof value === 'string' ? value.charAt(0) : String.fromCharCode((Math.trunc(Number(value) || 0) & 0xFF))
        break
      case 's':
        s = toText(value, type, intBits)
        if (precision != null) s = s.slice(0, precision)
        break
      case 'f': case 'F': {
        const v = Number(value)
        s = Number.isFinite(v) ? Math.abs(v).toFixed(precision ?? 6) : (Number.isNaN(v) ? 'nan' : 'inf')
        s = (v < 0 || (v === 0 && 1 / v < 0) ? '-' : plus ? '+' : space ? ' ' : '') + s
        break
      }
      case 'e': case 'E': {
        const v = Number(value)
        s = v.toExponential(precision ?? 6).replace(/e([+-])(\d)$/, 'e$10$2')
        if (conv === 'E') s = s.toUpperCase()
        if (v >= 0 && plus) s = '+' + s
        break
      }
      case 'g': case 'G': {
        const v = Number(value)
        s = Number.isFinite(v) ? String(Number(v.toPrecision(precision == null ? 6 : Math.max(1, precision)))) : String(v)
        if (conv === 'G') s = s.toUpperCase()
        break
      }
      case 'p':
        s = '0x' + formatInt(Math.trunc(Number(value) || 0), 16, 32).toLowerCase()
        break
      default:
        s = ''
    }
    out += pad(s, width, left, zero && !['s', 'c'].includes(conv))
  }
  out += fmt.slice(last)
  return out
}

/** Implements dtostrf(value, width, precision) → right-aligned fixed string. */
export function dtostrf(value, width, precision) {
  const s = formatFloat(Number(value), precision)
  return s.length < width ? ' '.repeat(width - s.length) + s : s
}

/** Implements itoa/ltoa(value, base): lowercase digits like avr-libc. */
export function itoa(value, base = 10) {
  const n = Math.trunc(Number(value) || 0)
  if (base === 10) return String(n)
  return (n < 0 ? '-' : '') + Math.abs(n).toString(base)
}

/**
 * The C type system of the Arduino subset (CONTRACTS §6).
 *
 * Everything the interpreter does with numbers goes through this module: how wide a type is, how a value wraps
 * into it, and which type an operator produces. Getting this exactly right is the whole point of the package —
 * it is what lets VoltQuest teach "an `int` is 16 bits on an Uno and 32 bits on an ESP32".
 *
 * Type names are the spellings a sketch uses (`'unsigned long'`, `'uint8_t'`, `'String'`) plus the synthetic
 * names `'array'`, `'object'`, `'function'`, `'unknown'`. They are handed to natives verbatim as `ctx.argTypes`.
 */

/** Every integer type the subset understands. */
const INT_TYPES = new Set(['bool', 'char', 'byte', 'int8_t', 'uint8_t', 'short', 'unsigned short', 'int16_t',
  'uint16_t', 'word', 'int', 'unsigned int', 'long', 'unsigned long', 'int32_t', 'uint32_t', 'size_t'])

const FLOAT_TYPES = new Set(['float', 'double'])

/** Types that print as a character rather than a number (Arduino `Print::print(char)`). */
const CHAR_TYPES = new Set(['char'])

const UNSIGNED_TYPES = new Set(['bool', 'char', 'byte', 'uint8_t', 'unsigned short', 'uint16_t', 'word',
  'unsigned int', 'unsigned long', 'uint32_t', 'size_t'])

/** Spellings accepted in declarations, mapped to the canonical name used everywhere else. */
const ALIASES = {
  boolean: 'bool',
  'signed char': 'int8_t',
  'unsigned char': 'byte',
  signed: 'int',
  'signed int': 'int',
  unsigned: 'unsigned int',
  'signed short': 'short',
  'short int': 'short',
  'unsigned short int': 'unsigned short',
  'signed long': 'long',
  'long int': 'long',
  'unsigned long int': 'unsigned long',
  'long long': 'long',
  'unsigned long long': 'unsigned long',
  'long double': 'double',
}

/** All declaration keywords that name a type (used by the parser to tell declarations from expressions). */
export const TYPE_KEYWORDS = new Set(['void', 'bool', 'boolean', 'char', 'byte', 'word', 'int', 'short', 'long',
  'float', 'double', 'signed', 'unsigned', 'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t',
  'size_t', 'String', 'auto'])

/** Declaration specifiers that carry no type information and are simply dropped. */
export const DECL_SPECIFIERS = new Set(['const', 'static', 'volatile', 'constexpr', 'inline', 'register',
  'extern', 'PROGMEM'])

/** Canonicalises a raw type spelling (`'unsigned'`, `'boolean'`, `'long int'`). */
export function normalizeType(raw) {
  if (!raw) return 'unknown'
  const t = String(raw).trim().replace(/\s+/g, ' ')
  return ALIASES[t] ?? t
}

/** True for the integer types (`bool` included — it stores 0/1). */
export function isIntegerType(t) { return INT_TYPES.has(t) }

/** True for `float`/`double`. */
export function isFloatType(t) { return FLOAT_TYPES.has(t) }

/** True for anything that behaves as a number. */
export function isNumericType(t) { return INT_TYPES.has(t) || FLOAT_TYPES.has(t) }

/** True for the types `Serial.print` renders as a character. */
export function isCharType(t) { return CHAR_TYPES.has(t) }

/** True when the type is unsigned (so `>>` is logical and wrapping keeps the value non-negative). */
export function isUnsignedType(t) { return UNSIGNED_TYPES.has(t) }

/**
 * Bit width of an integer type. `int`/`unsigned int` follow the board (`intBits`: 16 on AVR, 32 on ESP32);
 * everything else is fixed, exactly as on the real toolchains.
 */
export function widthOf(t, intBits) {
  switch (t) {
    case 'bool': case 'char': case 'byte': case 'uint8_t': case 'int8_t': return 8
    case 'short': case 'unsigned short': case 'int16_t': case 'uint16_t': case 'word': return 16
    case 'long': case 'unsigned long': case 'int32_t': case 'uint32_t': case 'size_t': return 32
    case 'int': case 'unsigned int': return intBits
    default: return 32
  }
}

/** `sizeof(type)` in bytes. AVR has a 4-byte `double`; the ESP32 toolchain has 8. */
export function sizeOfType(t, intBits) {
  switch (t) {
    case 'void': return 1
    case 'bool': case 'char': case 'byte': case 'uint8_t': case 'int8_t': return 1
    case 'short': case 'unsigned short': case 'int16_t': case 'uint16_t': case 'word': return 2
    case 'int': case 'unsigned int': return intBits / 8
    case 'long': case 'unsigned long': case 'int32_t': case 'uint32_t': case 'size_t': case 'float': return 4
    case 'double': return intBits === 16 ? 4 : 8
    case 'String': return intBits === 16 ? 6 : 12
    default: return intBits === 16 ? 2 : 4        // pointers, arrays, objects
  }
}

/**
 * Wraps `v` into `t`, exactly as a store to a variable of that type would on the real hardware.
 * Non-numeric types pass the value through untouched.
 */
export function wrapToType(v, t, intBits) {
  switch (t) {
    case 'bool': return v ? 1 : 0
    case 'char': case 'byte': case 'uint8_t': return v & 0xFF
    case 'int8_t': return (v << 24) >> 24
    case 'short': case 'int16_t': return (v << 16) >> 16
    case 'unsigned short': case 'uint16_t': case 'word': return v & 0xFFFF
    case 'long': case 'int32_t': return v | 0
    case 'unsigned long': case 'uint32_t': case 'size_t': return v >>> 0
    case 'int': return intBits === 16 ? (v << 16) >> 16 : v | 0
    case 'unsigned int': return intBits === 16 ? v & 0xFFFF : v >>> 0
    case 'float': return Math.fround(v)
    case 'double': return intBits === 16 ? Math.fround(v) : +v
    case 'String': return typeof v === 'string' ? v : String(v)
    default: return v
  }
}

/**
 * C integer promotion: anything narrower than `int` becomes `int` (or `unsigned int` when `int` cannot hold
 * every value, i.e. 16-bit `uint16_t`). This is why `byte a = 200, b = 100; a + b` is 300 and not 44.
 */
export function promoteType(t, intBits) {
  switch (t) {
    case 'bool': case 'char': case 'byte': case 'uint8_t': case 'int8_t': case 'short': case 'int16_t':
      return 'int'
    case 'unsigned short': case 'uint16_t': case 'word':
      return intBits === 16 ? 'unsigned int' : 'int'
    default:
      return t
  }
}

/** The usual arithmetic conversions: wider wins, and at equal width unsigned wins. */
export function usualArithmetic(a, b, intBits) {
  if (isFloatType(a) || isFloatType(b)) return a === 'double' || b === 'double' ? 'double' : 'float'
  const l = promoteType(isIntegerType(a) ? a : 'int', intBits)
  const r = promoteType(isIntegerType(b) ? b : 'int', intBits)
  if (l === r) return l
  const wl = widthOf(l, intBits)
  const wr = widthOf(r, intBits)
  if (wl > wr) return l
  if (wr > wl) return r
  if (isUnsignedType(l)) return l
  if (isUnsignedType(r)) return r
  return l
}

const COMPARISONS = new Set(['==', '!=', '<', '>', '<=', '>='])
const LOGICAL = new Set(['&&', '||'])

/**
 * Static result type of a binary operator — the type the operator's result wraps to before any store.
 * `long big = 1000 * 1000;` is 16960 on an Uno precisely because `*` here produces an `int`.
 */
export function binaryResultType(op, lt, rt, intBits) {
  if (COMPARISONS.has(op) || LOGICAL.has(op)) return 'bool'
  if (op === ',') return rt
  if (op === '<<' || op === '>>') return promoteType(isIntegerType(lt) ? lt : 'int', intBits)
  if (op === '+') {
    if (lt === 'String' || rt === 'String') return 'String'
    if ((lt === 'array' && rt === 'String') || (lt === 'String' && rt === 'array')) return 'String'
  }
  if (op === '&' || op === '|' || op === '^' || op === '%') {
    if (!isNumericType(lt) && !isNumericType(rt)) return 'int'
    return usualArithmetic(isNumericType(lt) ? lt : 'int', isNumericType(rt) ? rt : 'int', intBits)
  }
  if (!isNumericType(lt) && !isNumericType(rt)) return 'int'
  return usualArithmetic(isNumericType(lt) ? lt : 'int', isNumericType(rt) ? rt : 'int', intBits)
}

/** Static result type of a prefix/unary operator. */
export function unaryResultType(op, t, intBits) {
  if (op === '!') return 'bool'
  if (op === '++' || op === '--') return t
  if (op === '~') return promoteType(isIntegerType(t) ? t : 'int', intBits)
  if (op === '-' || op === '+') {
    if (isFloatType(t)) return t
    return promoteType(isIntegerType(t) ? t : 'int', intBits)
  }
  return t
}

/** Type of the `cond ? a : b` result. */
export function conditionalResultType(a, b, intBits) {
  if (a === b) return a
  if (a === 'String' || b === 'String') return 'String'
  if (isNumericType(a) && isNumericType(b)) return usualArithmetic(a, b, intBits)
  return a === 'unknown' ? b : a
}

/** Smallest type an unsuffixed decimal integer literal gets, per C (`int`, else `long`, else `unsigned long`). */
export function literalIntType(value, intBits) {
  const max = intBits === 16 ? 32767 : 2147483647
  if (value <= max && value >= -max - 1) return 'int'
  if (value <= 2147483647) return 'long'
  return 'unsigned long'
}

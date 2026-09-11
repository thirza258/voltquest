/**
 * Tokeniser for the Arduino-C++ subset (CONTRACTS §6).
 *
 * Runs on preprocessed source (comments already blanked, directives already resolved) so that every token's
 * `line`/`col` still points at the character the user typed — diagnostics depend on it.
 */

import { literalIntType } from './types.js'

/** Multi-character operators, longest first so the scanner is greedy. */
const OPERATORS = [
  '<<=', '>>=', '...',
  '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '::',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '~', '&', '|', '^', '?', ':',
  ';', ',', '.', '(', ')', '[', ']', '{', '}', '#',
]

const SIMPLE_ESCAPES = { n: 10, r: 13, t: 9, b: 8, f: 12, v: 11, a: 7, 0: 0, '\\': 92, "'": 39, '"': 34, '?': 63 }

/** Thrown by {@link tokenize}; carries the position so `compile` can turn it into a Diagnostic. */
export class LexError extends Error {
  constructor(message, line, col) {
    super(message)
    this.name = 'LexError'
    this.line = line
    this.col = col
  }
}

const isDigit = (c) => c >= '0' && c <= '9'
const isIdentStart = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$'
const isIdentPart = (c) => isIdentStart(c) || isDigit(c)

/**
 * Integer literal type for a non-decimal (hex/octal/binary) literal: C tries int, unsigned int, long,
 * unsigned long. `0xFFFF` is therefore an `unsigned int` on a 16-bit board, not a negative `int`.
 */
function baseLiteralType(value, intBits) {
  if (value <= (intBits === 16 ? 32767 : 2147483647)) return 'int'
  if (value <= (intBits === 16 ? 65535 : 4294967295)) return 'unsigned int'
  if (value <= 2147483647) return 'long'
  return 'unsigned long'
}

/**
 * Splits preprocessed source into tokens.
 * @param {string} src
 * @param {{ intBits?: number }} [options]
 * @returns {{ type: 'ident'|'number'|'string'|'char'|'punct'|'eof', value: any, raw?: string, ctype?: string, line: number, col: number }[]}
 */
export function tokenize(src, { intBits = 16 } = {}) {
  const tokens = []
  let i = 0
  let line = 1
  let lineStart = 0
  const n = src.length
  const col = () => i - lineStart + 1

  while (i < n) {
    const c = src[i]
    if (c === '\n') { i++; line++; lineStart = i; continue }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') { i++; continue }

    const startLine = line
    const startCol = col()

    // Raw string literal: R"delim(...)delim"
    if (c === 'R' && src[i + 1] === '"') {
      const open = src.indexOf('(', i + 2)
      if (open < 0) throw new LexError('unterminated raw string literal', startLine, startCol)
      const delim = src.slice(i + 2, open)
      if (/[\s()\\]/.test(delim)) throw new LexError('invalid raw string delimiter', startLine, startCol)
      const terminator = ')' + delim + '"'
      const end = src.indexOf(terminator, open + 1)
      if (end < 0) throw new LexError('unterminated raw string literal', startLine, startCol)
      const text = src.slice(open + 1, end)
      for (let k = 0; k < text.length; k++) if (text[k] === '\n') { line++; lineStart = i + 2 + delim.length + 1 + k + 1 }
      i = end + terminator.length
      tokens.push({ type: 'string', value: text, ctype: 'String', line: startLine, col: startCol })
      continue
    }

    if (isIdentStart(c)) {
      const s = i
      while (i < n && isIdentPart(src[i])) i++
      tokens.push({ type: 'ident', value: src.slice(s, i), line: startLine, col: startCol })
      continue
    }

    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      tokens.push(readNumber())
      continue
    }

    if (c === '"') { tokens.push(readString()); continue }
    if (c === "'") { tokens.push(readChar()); continue }

    const op = OPERATORS.find((o) => src.startsWith(o, i))
    if (op) {
      i += op.length
      tokens.push({ type: 'punct', value: op, line: startLine, col: startCol })
      continue
    }

    throw new LexError(`stray '${c}' in program`, startLine, startCol)
  }

  tokens.push({ type: 'eof', value: '<end of file>', line, col: col() })
  return tokens

  function readNumber() {
    const startCol2 = col()
    const s = i
    let isFloat = false
    let nonDecimal = false
    let value
    if (src[i] === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
      nonDecimal = true
      i += 2
      const d = i
      while (i < n && /[0-9a-fA-F]/.test(src[i])) i++
      if (i === d) throw new LexError('no digits in hexadecimal constant', line, startCol2)
      value = parseInt(src.slice(d, i), 16)
    } else if (src[i] === '0' && (src[i + 1] === 'b' || src[i + 1] === 'B')) {
      nonDecimal = true
      i += 2
      const d = i
      while (i < n && (src[i] === '0' || src[i] === '1')) i++
      if (i === d) throw new LexError('no digits in binary constant', line, startCol2)
      value = parseInt(src.slice(d, i), 2)
    } else {
      while (i < n && (isDigit(src[i]) || src[i] === "'")) i++
      if (src[i] === '.') { isFloat = true; i++; while (i < n && isDigit(src[i])) i++ }
      if (src[i] === 'e' || src[i] === 'E') {
        const save = i
        i++
        if (src[i] === '+' || src[i] === '-') i++
        if (isDigit(src[i])) { isFloat = true; while (i < n && isDigit(src[i])) i++ } else i = save
      }
      const text = src.slice(s, i).replace(/'/g, '')
      if (!isFloat && /^0[0-7]+$/.test(text)) { nonDecimal = true; value = parseInt(text, 8) }
      else value = Number(text)
    }

    let unsigned = false
    let long = false
    let forceFloat = false
    for (;;) {
      const f = src[i]
      if (f === 'u' || f === 'U') { unsigned = true; i++; continue }
      if (f === 'l' || f === 'L') { long = true; i++; continue }
      if (f === 'f' || f === 'F') { forceFloat = true; isFloat = true; i++; continue }
      break
    }
    if (i < n && isIdentPart(src[i])) throw new LexError(`invalid suffix on numeric constant`, line, startCol2)

    let ctype
    if (isFloat) ctype = forceFloat ? 'float' : 'double'
    else if (unsigned && long) ctype = 'unsigned long'
    else if (long) ctype = 'long'
    else if (unsigned) ctype = value <= (intBits === 16 ? 65535 : 4294967295) ? 'unsigned int' : 'unsigned long'
    else if (nonDecimal) ctype = baseLiteralType(value, intBits)
    else ctype = literalIntType(value, intBits)

    return { type: 'number', value: isFloat ? value : Math.trunc(value), ctype, line, col: startCol2 }
  }

  function readString() {
    const startCol2 = col()
    const startLine2 = line
    i++
    let out = ''
    for (;;) {
      if (i >= n || src[i] === '\n') throw new LexError('missing terminating " character', startLine2, startCol2)
      const ch = src[i]
      if (ch === '"') { i++; break }
      if (ch === '\\') { out += String.fromCharCode(readEscape()); continue }
      out += ch
      i++
    }
    // Adjacent string literals concatenate ("ab" "cd" → "abcd").
    for (;;) {
      let j = i
      while (j < n && /\s/.test(src[j])) j++
      if (src[j] !== '"') break
      while (i < j) { if (src[i] === '\n') { line++; lineStart = i + 1 } i++ }
      i++
      for (;;) {
        if (i >= n || src[i] === '\n') throw new LexError('missing terminating " character', startLine2, startCol2)
        if (src[i] === '"') { i++; break }
        if (src[i] === '\\') { out += String.fromCharCode(readEscape()); continue }
        out += src[i]
        i++
      }
    }
    return { type: 'string', value: out, ctype: 'String', line: startLine2, col: startCol2 }
  }

  function readChar() {
    const startCol2 = col()
    i++
    let code
    if (i >= n || src[i] === '\n') throw new LexError("missing terminating ' character", line, startCol2)
    if (src[i] === "'") throw new LexError('empty character constant', line, startCol2)
    if (src[i] === '\\') code = readEscape()
    else { code = src.charCodeAt(i); i++ }
    while (i < n && src[i] !== "'" && src[i] !== '\n') i++      // multi-char constants: keep the first char
    if (src[i] !== "'") throw new LexError("missing terminating ' character", line, startCol2)
    i++
    return { type: 'number', value: code & 0xFF, ctype: 'char', line, col: startCol2 }
  }

  /** Reads the escape sequence at `src[i] === '\\'` and returns its character code. */
  function readEscape() {
    i++
    const e = src[i]
    if (e === 'x' || e === 'X') {
      i++
      const d = i
      while (i < n && /[0-9a-fA-F]/.test(src[i]) && i - d < 2) i++
      if (i === d) throw new LexError('\\x used with no following hex digits', line, col())
      return parseInt(src.slice(d, i), 16) & 0xFF
    }
    if (e >= '0' && e <= '7') {
      const d = i
      while (i < n && src[i] >= '0' && src[i] <= '7' && i - d < 3) i++
      return parseInt(src.slice(d, i), 8) & 0xFF
    }
    if (e === 'u' || e === 'U') {
      i++
      const d = i
      const len = e === 'u' ? 4 : 8
      while (i < n && /[0-9a-fA-F]/.test(src[i]) && i - d < len) i++
      return parseInt(src.slice(d, i), 16) & 0xFFFF
    }
    if (e === '\n') { i++; line++; lineStart = i; return -1 }
    i++
    if (e in SIMPLE_ESCAPES) return SIMPLE_ESCAPES[e]
    return e === undefined ? 0 : e.charCodeAt(0)
  }
}

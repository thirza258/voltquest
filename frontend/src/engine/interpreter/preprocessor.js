/**
 * Preprocessor for the Arduino subset (CONTRACTS §6): comment stripping, `#include` recording, object-like
 * `#define`/`#undef`, and `#ifdef/#ifndef/#if/#elif/#else/#endif`.
 *
 * Every transformation preserves the line structure of the source — comments and excluded regions become
 * blanks, never disappear — so a diagnostic's `line` always matches what the user sees in the editor.
 */

/** Characters at a masked offset are inside a string, char or raw-string literal and must never be rewritten. */
const IN_LITERAL = 1

/**
 * Replaces every comment with spaces (newlines kept) and builds a literal mask.
 * @param {string} src
 * @returns {{ text: string, mask: Uint8Array, errors: object[] }}
 */
export function stripComments(src) {
  const out = src.split('')
  const mask = new Uint8Array(src.length)
  const errors = []
  const n = src.length
  let i = 0
  let line = 1
  let lineStart = 0

  const blank = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ' }

  while (i < n) {
    const c = src[i]
    if (c === '\n') { i++; line++; lineStart = i; continue }

    if (c === '/' && src[i + 1] === '/') {
      let e = i
      while (e < n && src[e] !== '\n') e++
      blank(i, e)
      i = e
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const startLine = line
      const startCol = i - lineStart + 1
      let e = i + 2
      while (e < n && !(src[e] === '*' && src[e + 1] === '/')) {
        if (src[e] === '\n') { line++; lineStart = e + 1 }
        e++
      }
      if (e >= n) {
        errors.push({ line: startLine, col: startCol, message: 'unterminated comment', severity: 'error' })
        blank(i, n)
        i = n
        continue
      }
      blank(i, e + 2)
      i = e + 2
      continue
    }

    // Raw string literal R"delim( ... )delim"
    if (c === 'R' && src[i + 1] === '"') {
      const open = src.indexOf('(', i + 2)
      const delim = open < 0 ? null : src.slice(i + 2, open)
      if (delim !== null && !/[\s()\\]/.test(delim)) {
        const terminator = ')' + delim + '"'
        const end = src.indexOf(terminator, open + 1)
        if (end >= 0) {
          const stop = end + terminator.length
          for (let k = i; k < stop; k++) {
            mask[k] = IN_LITERAL
            if (src[k] === '\n') { line++; lineStart = k + 1 }
          }
          i = stop
          continue
        }
      }
      i++
      continue
    }

    if (c === '"' || c === "'") {
      // A `'` between digits is a C++14 digit separator, not a character literal.
      if (c === "'" && /[0-9a-fA-F]/.test(src[i - 1] ?? '') && /[0-9a-fA-F]/.test(src[i + 1] ?? '')) { i++; continue }
      const quote = c
      const startLine = line
      const startCol = i - lineStart + 1
      let k = i + 1
      while (k < n && src[k] !== quote && src[k] !== '\n') k += src[k] === '\\' ? 2 : 1
      if (k >= n || src[k] !== quote) {
        errors.push({ line: startLine, col: startCol, message: `missing terminating ${quote} character`, severity: 'error' })
        for (let m = i; m < Math.min(k, n); m++) mask[m] = IN_LITERAL
        i = Math.min(k, n)
        continue
      }
      for (let m = i; m <= k; m++) mask[m] = IN_LITERAL
      i = k + 1
      continue
    }

    i++
  }

  return { text: out.join(''), mask, errors }
}

/** Offsets at which each 1-based line starts. */
function lineOffsets(text) {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  return starts
}

const isIdentStart = (c) => c !== undefined && (/[A-Za-z_$]/.test(c))
const isIdentPart = (c) => c !== undefined && (/[A-Za-z0-9_$]/.test(c))

/**
 * Expands object-like macros in `text`. `blocked` holds the macros currently being expanded so that
 * `#define A A + 1` terminates instead of recursing forever.
 */
function expandText(text, macros, blocked, depth) {
  if (depth > 32) return text
  let out = ''
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (c === '"' || c === "'") {
      const quote = c
      let k = i + 1
      while (k < n && text[k] !== quote) k += text[k] === '\\' ? 2 : 1
      out += text.slice(i, Math.min(k + 1, n))
      i = k + 1
      continue
    }
    if (isIdentStart(c)) {
      let k = i
      while (k < n && isIdentPart(text[k])) k++
      const name = text.slice(i, k)
      if (Object.prototype.hasOwnProperty.call(macros, name) && !blocked.has(name)) {
        const next = new Set(blocked)
        next.add(name)
        out += expandText(macros[name], macros, next, depth + 1)
      } else {
        out += name
      }
      i = k
      continue
    }
    out += c
    i++
  }
  return out
}

/** Expands macros on one line, leaving masked (literal) spans untouched. */
function expandLine(line, mask, offset, macros) {
  let out = ''
  let i = 0
  while (i < line.length) {
    if (mask[offset + i] === IN_LITERAL) {
      const start = i
      while (i < line.length && mask[offset + i] === IN_LITERAL) i++
      out += line.slice(start, i)
      continue
    }
    const start = i
    while (i < line.length && mask[offset + i] !== IN_LITERAL) i++
    out += expandText(line.slice(start, i), macros, new Set(), 0)
  }
  return out
}

/**
 * Evaluates a `#if`/`#elif` condition. Supports `defined(X)`, `defined X`, integer literals, macro names
 * (their numeric value, or 0 when non-numeric), `! && || ( )`, `== != < > <= >=` and simple arithmetic on
 * integers — everything an Arduino sketch realistically writes.
 * @param {string} text
 * @param {Record<string,string>} macros
 * @param {(message: string) => void} report called when the condition cannot be evaluated (the branch is then
 *   taken as false, which must never happen silently)
 */
function evalCondition(text, macros, report) {
  const expanded = text.replace(/\bdefined\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g, (_m, name) =>
    (Object.prototype.hasOwnProperty.call(macros, name) ? '1' : '0'))
    .replace(/\bdefined\s+([A-Za-z_$][\w$]*)/g, (_m, name) =>
      (Object.prototype.hasOwnProperty.call(macros, name) ? '1' : '0'))
  const substituted = expandText(expanded, macros, new Set(), 0)
    .replace(/\b[A-Za-z_$][\w$]*\b/g, (name) => (name === 'true' ? '1' : name === 'false' ? '0' : '0'))
  if (!/^[\s0-9+\-*/%()!&|<>=^~]*$/.test(substituted)) {
    report(`cannot evaluate '#if ${text.trim()}'; the branch is treated as false`)
    return false
  }
  try {
    // Only digits, whitespace and C operators remain, so this is a closed arithmetic expression.
    const value = Function(`"use strict"; return (${substituted || '0'})`)()
    return Boolean(value)
  } catch {
    report(`cannot evaluate '#if ${text.trim()}'; the branch is treated as false`)
    return false
  }
}

/**
 * Runs the preprocessor.
 * @param {string} source
 * @param {{ defines?: Record<string,string> }} [options] `defines` pre-seeds macros (e.g. `__AVR__`)
 * @returns {{ text: string, includes: string[], macros: Record<string,string>, errors: object[] }}
 */
export function preprocess(source, { defines = {} } = {}) {
  const stripped = stripComments(source)
  const errors = stripped.errors.slice()
  const mask = stripped.mask
  const starts = lineOffsets(stripped.text)
  const rawLines = stripped.text.split('\n')
  const macros = { ...defines }
  const includes = []
  const outLines = new Array(rawLines.length)

  /** One entry per open conditional: `active` = emitting, `taken` = some branch already matched. */
  const stack = []
  const emitting = () => stack.every((f) => f.active)

  for (let li = 0; li < rawLines.length; li++) {
    let text = rawLines[li]
    let consumed = li
    const offset = starts[li]
    const firstIdx = text.search(/\S/)
    const isDirective = firstIdx >= 0 && text[firstIdx] === '#' && mask[offset + firstIdx] !== IN_LITERAL

    if (!isDirective) {
      outLines[li] = emitting() ? expandLine(text, mask, offset, macros) : ''
      continue
    }

    // Join `\`-continued directive lines, blanking the ones we swallow.
    let body = text
    while (/\\\s*$/.test(body) && consumed + 1 < rawLines.length) {
      outLines[consumed] = ''
      consumed++
      body = body.replace(/\\\s*$/, ' ') + rawLines[consumed]
    }
    for (let k = li; k <= consumed; k++) outLines[k] = ''

    const m = /^\s*#\s*([A-Za-z_]\w*)?\s*([\s\S]*)$/.exec(body)
    const name = m?.[1] ?? ''
    const rest = (m?.[2] ?? '').trim()
    const line = li + 1
    const col = firstIdx + 1
    const warn = (message) => errors.push({ line, col, message, severity: 'warning' })

    switch (name) {
      case 'ifdef':
      case 'ifndef': {
        const id = /^([A-Za-z_$][\w$]*)/.exec(rest)?.[1]
        if (!id) errors.push({ line, col, message: `no macro name given in #${name} directive`, severity: 'error' })
        const has = id ? Object.prototype.hasOwnProperty.call(macros, id) : false
        const want = name === 'ifdef' ? has : !has
        stack.push({ active: emitting() && want, taken: want, parentActive: emitting() })
        break
      }
      case 'if': {
        const want = evalCondition(rest, macros, warn)
        stack.push({ active: emitting() && want, taken: want, parentActive: emitting() })
        break
      }
      case 'elif': {
        const frame = stack[stack.length - 1]
        if (!frame) { errors.push({ line, col, message: '#elif without #if', severity: 'error' }); break }
        const want = !frame.taken && evalCondition(rest, macros, warn)
        frame.active = frame.parentActive && want
        frame.taken = frame.taken || want
        break
      }
      case 'else': {
        const frame = stack[stack.length - 1]
        if (!frame) { errors.push({ line, col, message: '#else without #if', severity: 'error' }); break }
        frame.active = frame.parentActive && !frame.taken
        frame.taken = true
        break
      }
      case 'endif': {
        if (!stack.pop()) errors.push({ line, col, message: '#endif without #if', severity: 'error' })
        break
      }
      case 'define': {
        if (!emitting()) break
        const d = /^([A-Za-z_$][\w$]*)\s*([\s\S]*)$/.exec(rest)
        if (!d) { errors.push({ line, col, message: 'no macro name given in #define directive', severity: 'error' }); break }
        if (/^\(/.test(rest.slice(d[1].length))) {
          // Leave the identifier untouched rather than producing nonsense; the sketch then reports it as an
          // undeclared name, which is a far clearer diagnostic than a mangled expansion.
          errors.push({ line, col, message: `function-like macro '${d[1]}' is not supported`, severity: 'warning' })
          break
        }
        macros[d[1]] = d[2].trim()
        break
      }
      case 'undef': {
        if (!emitting()) break
        const id = /^([A-Za-z_$][\w$]*)/.exec(rest)?.[1]
        if (!id) errors.push({ line, col, message: 'no macro name given in #undef directive', severity: 'error' })
        else delete macros[id]
        break
      }
      case 'include': {
        if (!emitting()) break
        const inc = /^[<"]([^>"]*)[>"]/.exec(rest)
        if (!inc) errors.push({ line, col, message: '#include expects "FILENAME" or <FILENAME>', severity: 'error' })
        else if (!includes.includes(inc[1])) includes.push(inc[1])
        break
      }
      case 'error': {
        if (emitting()) errors.push({ line, col, message: rest || '#error', severity: 'error' })
        break
      }
      case 'warning': {
        if (emitting()) errors.push({ line, col, message: rest || '#warning', severity: 'warning' })
        break
      }
      case 'pragma':
      case 'line':
      case '':
        break
      default:
        if (emitting()) errors.push({ line, col, message: `invalid preprocessing directive #${name}`, severity: 'warning' })
    }
    li = consumed
    text = ''
  }

  for (let k = 0; k < stack.length; k++) {
    errors.push({ line: rawLines.length, col: 1, message: 'unterminated #if', severity: 'error' })
  }

  return { text: outLines.join('\n'), includes, macros, errors }
}

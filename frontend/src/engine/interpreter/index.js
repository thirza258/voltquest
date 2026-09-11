/**
 * Arduino-C++ subset interpreter — package E1 (CONTRACTS §6).
 *
 * `compile()` turns sketch source into a resolved, closure-free program plus Arduino-style diagnostics;
 * `createVM()` runs that program against a host (natives, globals, classes) with a virtual, preemptible clock;
 * `formatValue()` renders a value the way Arduino's `Print` does.
 */

import { tokenize } from './lexer.js'
import { parse } from './parser.js'
import { preprocess } from './preprocessor.js'

export { createVM } from './vm.js'
export { formatValue } from './values.js'

/**
 * Compiles a sketch.
 * @param {string} source
 * @param {{ intBits?: number, knownNames?: Set<string>|string[]|null, defines?: Record<string,string> }} [options]
 *   `intBits` is the board's `int` width (16 on AVR, 32 on ESP32) and decides every wrapping rule.
 *   `knownNames` (optional) lists the identifiers the host provides; when given, any other free identifier
 *   becomes a "was not declared in this scope" error instead of only being reported in `globalsUsed`.
 * @returns {{ ok: boolean, program?: object, errors: object[], warnings: object[], includes: string[],
 *            macros: Record<string,string>, classesUsed: string[], globalsUsed: string[] }}
 */
export function compile(source, { intBits = 16, knownNames = null, defines = undefined } = {}) {
  const errors = []
  const warnings = []
  const text = typeof source === 'string' ? source : ''

  const pre = preprocess(text, defines ? { defines } : undefined)
  for (const d of pre.errors) (d.severity === 'warning' ? warnings : errors).push(d)

  const base = { errors, warnings, includes: pre.includes, macros: pre.macros, classesUsed: [], globalsUsed: [] }

  let tokens
  try {
    tokens = tokenize(pre.text, { intBits })
  } catch (err) {
    errors.push({ line: err.line ?? 1, col: err.col ?? 1, message: err.message, severity: 'error' })
    return { ok: false, ...base }
  }

  const parsed = parse(tokens, { intBits, knownNames })
  for (const d of parsed.errors) errors.push(d)
  for (const d of parsed.warnings) warnings.push(d)
  base.classesUsed = parsed.classesUsed
  base.globalsUsed = parsed.globalsUsed

  const ok = errors.length === 0 && parsed.program != null
  return ok ? { ok: true, program: parsed.program, ...base } : { ok: false, ...base }
}

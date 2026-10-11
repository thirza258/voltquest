/**
 * A teaching-subset AVR assembler. It parses AVR-style assembly into a program the simulator in
 * cpu.js executes, with a symbol table and an opcode listing. It implements a documented subset of
 * ~45 instructions and the directives .equ/.def/.org/.cseg; it is not a complete AVRA/avr-as and
 * encodes only the implemented mnemonics. Pure and deterministic: no eval, host or I/O.
 */
export const MAX_PROGRAM = 512

// Register aliases students commonly define; XL/XH etc. are always available.
export const REG_ALIASES = { XL: 'R26', XH: 'R27', YL: 'R28', YH: 'R29', ZL: 'R30', ZH: 'R31' }

/** Instruction table: operand shape + optional 16-bit encoder(ops) → word, or null when unencoded. */
const ops = {
  nop: { args: [], enc: () => 0x0000 },
  ldi: { args: ['rh', 'k8'], enc: (d, k) => 0xe000 | ((k & 0xf0) << 4) | ((d - 16) << 4) | (k & 0x0f) },
  mov: { args: ['r', 'r'], enc: (d, r) => 0x2c00 | ((r & 0x10) << 5) | (d << 4) | (r & 0x0f) },
  add: { args: ['r', 'r'], enc: (d, r) => 0x0c00 | ((r & 0x10) << 5) | (d << 4) | (r & 0x0f) },
  adc: { args: ['r', 'r'], enc: (d, r) => 0x1c00 | ((r & 0x10) << 5) | (d << 4) | (r & 0x0f) },
  sub: { args: ['r', 'r'], enc: (d, r) => 0x1800 | ((r & 0x10) << 5) | (d << 4) | (r & 0x0f) },
  sbc: { args: ['r', 'r'], enc: (d, r) => 0x0800 | ((r & 0x10) << 5) | (d << 4) | (r & 0x0f) },
  and: { args: ['r', 'r'], enc: (d, r) => 0x2000 | ((r & 0x10) << 5) | (d << 4) | (r & 0x0f) },
  or: { args: ['r', 'r'], enc: (d, r) => 0x2800 | ((r & 0x10) << 5) | (d << 4) | (r & 0x0f) },
  eor: { args: ['r', 'r'], enc: (d, r) => 0x2400 | ((r & 0x10) << 5) | (d << 4) | (r & 0x0f) },
  cp: { args: ['r', 'r'], enc: (d, r) => 0x1400 | ((r & 0x10) << 5) | (d << 4) | (r & 0x0f) },
  cpc: { args: ['r', 'r'], enc: (d, r) => 0x0400 | ((r & 0x10) << 5) | (d << 4) | (r & 0x0f) },
  subi: { args: ['rh', 'k8'], enc: (d, k) => 0x5000 | ((k & 0xf0) << 4) | ((d - 16) << 4) | (k & 0x0f) },
  sbci: { args: ['rh', 'k8'], enc: (d, k) => 0x4000 | ((k & 0xf0) << 4) | ((d - 16) << 4) | (k & 0x0f) },
  andi: { args: ['rh', 'k8'], enc: (d, k) => 0x7000 | ((k & 0xf0) << 4) | ((d - 16) << 4) | (k & 0x0f) },
  ori: { args: ['rh', 'k8'], enc: (d, k) => 0x6000 | ((k & 0xf0) << 4) | ((d - 16) << 4) | (k & 0x0f) },
  cpi: { args: ['rh', 'k8'], enc: (d, k) => 0x3000 | ((k & 0xf0) << 4) | ((d - 16) << 4) | (k & 0x0f) },
  com: { args: ['r'], enc: d => 0x9400 | (d << 4) },
  neg: { args: ['r'], enc: d => 0x9401 | (d << 4) },
  inc: { args: ['r'], enc: d => 0x9403 | (d << 4) },
  dec: { args: ['r'], enc: d => 0x940a | (d << 4) },
  lsr: { args: ['r'], enc: d => 0x9406 | (d << 4) },
  ror: { args: ['r'], enc: d => 0x9407 | (d << 4) },
  asr: { args: ['r'], enc: d => 0x9405 | (d << 4) },
  swap: { args: ['r'], enc: d => 0x9402 | (d << 4) },
  // Pseudo/implied: lsl Rd = add Rd,Rd; rol Rd = adc Rd,Rd; tst Rd = and Rd,Rd; clr Rd = eor Rd,Rd.
  lsl: { args: ['r'], enc: d => 0x0c00 | (d << 4) | d, alias: d => ['add', d, d] },
  rol: { args: ['r'], enc: d => 0x1c00 | (d << 4) | d, alias: d => ['adc', d, d] },
  tst: { args: ['r'], enc: d => 0x2000 | (d << 4) | d, alias: d => ['and', d, d] },
  clr: { args: ['r'], enc: d => 0x2400 | (d << 4) | d, alias: d => ['eor', d, d] },
  ser: { args: ['rh'], enc: d => 0xef0f | ((d - 16) << 4), alias: d => ['ldi', d, 0xff] },
  push: { args: ['r'], enc: d => 0x920f | (d << 4) },
  pop: { args: ['r'], enc: d => 0x900f | (d << 4) },
  in: { args: ['r', 'io'], enc: (d, a) => 0xb000 | ((a & 0x30) << 5) | (d << 4) | (a & 0x0f) },
  out: { args: ['io', 'r'], enc: (a, r) => 0xb800 | ((a & 0x30) << 5) | (r << 4) | (a & 0x0f) },
  sbi: { args: ['iolow', 'bit'], enc: (a, b) => 0x9a00 | (a << 3) | b },
  cbi: { args: ['iolow', 'bit'], enc: (a, b) => 0x9800 | (a << 3) | b },
  lds: { args: ['r', 'addr16'], enc: null, words: 2 },
  sts: { args: ['addr16', 'r'], enc: null, words: 2 },
  ld: { args: ['r', 'ptr'], enc: null },
  st: { args: ['ptr', 'r'], enc: null },
  rjmp: { args: ['label'], enc: (k) => 0xc000 | (k & 0x0fff) },
  rcall: { args: ['label'], enc: (k) => 0xd000 | (k & 0x0fff) },
  ret: { args: [], enc: () => 0x9508 },
  sei: { args: [], enc: () => 0x9478 },
  cli: { args: [], enc: () => 0x94f8 },
  sec: { args: [], enc: () => 0x9408 },
  clc: { args: [], enc: () => 0x9488 },
  brne: { args: ['label'], cond: true }, breq: { args: ['label'], cond: true },
  brcs: { args: ['label'], cond: true }, brlo: { args: ['label'], cond: true },
  brcc: { args: ['label'], cond: true }, brsh: { args: ['label'], cond: true },
  brmi: { args: ['label'], cond: true }, brpl: { args: ['label'], cond: true },
  brge: { args: ['label'], cond: true }, brlt: { args: ['label'], cond: true },
  brvs: { args: ['label'], cond: true }, brvc: { args: ['label'], cond: true },
  break: { args: [], enc: () => 0x9598 },
}
export const INSTRUCTIONS = ops
// Branch opcode bases (7-bit signed offset in bits 9..3), plus the tested flag/sense.
const BRANCH = {
  breq: [0xf001, 1, 1], brne: [0xf401, 1, 0], brcs: [0xf000, 0, 1], brlo: [0xf000, 0, 1],
  brcc: [0xf400, 0, 0], brsh: [0xf400, 0, 0], brmi: [0xf002, 2, 1], brpl: [0xf402, 2, 0],
  brlt: [0xf004, 4, 1], brge: [0xf404, 4, 0], brvs: [0xf003, 3, 1], brvc: [0xf403, 3, 0],
}
export const branchInfo = mnemonic => BRANCH[mnemonic]

const fail = (line, message) => { throw new Error(`Line ${line}: ${message}`) }
const parseNumber = (text) => {
  const t = text.trim()
  let value
  if (/^0x[0-9a-f]+$/i.test(t)) value = parseInt(t.slice(2), 16)
  else if (/^0b[01]+$/i.test(t)) value = parseInt(t.slice(2), 2)
  else if (/^-?\d+$/.test(t)) value = parseInt(t, 10)
  else if (/^'.'$/.test(t)) value = t.charCodeAt(1)
  else return null
  return value
}

/**
 * Assemble `source` into `{ program, symbols, equ, errors }`. `program` is a list of
 * `{ line, address, words, mnemonic, operands, raw }`; `symbols` maps label → word address.
 * A thrown error carries the first `Line N:` message; soft issues collect in `errors`.
 */
export function assemble(source) {
  if (typeof source !== 'string' || source.length > 20000) throw new Error('Keep the program within 20000 characters.')
  const rawLines = source.split('\n')
  const defs = {}, equ = {}, symbols = {}
  const pending = []
  let address = 0
  // Pass 1: directives, labels and instruction addresses.
  rawLines.forEach((raw, index) => {
    const line = index + 1
    let text = raw.replace(/;.*$/, '').trim()
    if (!text) return
    const labelMatch = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/)
    if (labelMatch) {
      const name = labelMatch[1]
      if (symbols[name] !== undefined || equ[name] !== undefined) fail(line, `duplicate label ${name}.`)
      symbols[name] = address
      text = labelMatch[2].trim()
      if (!text) return
    }
    if (text.startsWith('.')) {
      const directive = text.slice(1).split(/\s+/)[0].toLowerCase()
      const rest = text.slice(directive.length + 1).trim()
      if (directive === 'equ' || directive === 'set') {
        const m = rest.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/)
        if (!m) fail(line, 'use .equ NAME = value.')
        const value = parseNumber(m[2])
        if (value === null) fail(line, `cannot evaluate ${m[2]}.`)
        equ[m[1]] = value
      } else if (directive === 'def') {
        const m = rest.match(/^([A-Za-z_]\w*)\s*=\s*[Rr](\d{1,2})$/)
        if (!m || Number(m[2]) > 31) fail(line, 'use .def name = Rn (R0–R31).')
        defs[m[1]] = `R${Number(m[2])}`
      } else if (directive === 'org') {
        const value = parseNumber(rest)
        if (value === null || value < 0) fail(line, 'use .org <address>.')
        address = value
      } else if (['cseg', 'text', 'global', 'list', 'nolist'].includes(directive)) { /* accepted no-ops */ }
      else fail(line, `unsupported directive .${directive}.`)
      return
    }
    const parts = text.match(/^(\S+)\s*(.*)$/)
    const mnemonic = parts[1].toLowerCase()
    if (!Object.hasOwn(ops, mnemonic)) fail(line, `unknown instruction ${parts[1]}. See the instruction reference.`)
    const operandText = parts[2].trim()
    const operands = operandText ? splitOperands(operandText, line) : []
    const spec = ops[mnemonic]
    const words = spec.words ?? 1
    pending.push({ line, address, words, mnemonic, operands, raw: raw.trim() })
    address += words
    if (address > MAX_PROGRAM) fail(line, `program exceeds ${MAX_PROGRAM} words.`)
  })
  // Pass 2: resolve operands and encode.
  const program = pending.map(item => resolve(item, { defs, equ, symbols }))
  return { program, symbols, equ, defs }
}

function splitOperands(text, line) {
  const out = []
  let depth = 0, current = ''
  for (const ch of text) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(current.trim()); current = '' } else current += ch
  }
  if (current.trim()) out.push(current.trim())
  if (out.some(part => part === '')) fail(line, 'empty operand.')
  return out
}

function regNumber(token, scope, line) {
  const name = token.trim()
  const resolved = scope.defs[name] ?? REG_ALIASES[name.toUpperCase()] ?? name
  const m = resolved.match(/^[Rr](\d{1,2})$/)
  if (!m || Number(m[1]) > 31) fail(line, `expected a register R0–R31, found ${token}.`)
  return Number(m[1])
}
function immediate(token, scope, line) {
  const t = token.trim()
  if (Object.hasOwn(scope.equ, t)) return scope.equ[t] & 0xff
  const value = parseNumber(t)
  if (value === null) fail(line, `expected a numeric value 0–255, found ${token}.`)
  if (value < -128 || value > 255) fail(line, `immediate ${value} is out of range (−128..255).`)
  return value & 0xff
}

function resolve(item, scope) {
  const spec = ops[item.mnemonic]
  const { line } = item
  if (spec.args.length !== item.operands.length) fail(line, `${item.mnemonic.toUpperCase()} takes ${spec.args.length} operand(s), got ${item.operands.length}.`)
  const values = spec.args.map((kind, i) => {
    const token = item.operands[i]
    if (kind === 'r') return regNumber(token, scope, line)
    if (kind === 'rh') { const n = regNumber(token, scope, line); if (n < 16) fail(line, `${item.mnemonic.toUpperCase()} needs a high register R16–R31.`); return n }
    if (kind === 'k8') return immediate(token, scope, line)
    if (kind === 'bit') { const n = parseNumber(token); if (n === null || n < 0 || n > 7) fail(line, 'bit must be 0–7.'); return n }
    if (kind === 'io') { const a = ioAddress(token, scope, line, 0x3f); return a }
    if (kind === 'iolow') { const a = ioAddress(token, scope, line, 0x1f); return a }
    if (kind === 'addr16') { const a = Object.hasOwn(scope.equ, token) ? scope.equ[token] : parseNumber(token); if (a === null || a < 0 || a > 0xffff) fail(line, 'data address must be 0–65535.'); return a }
    if (kind === 'ptr') return pointer(token, line)
    if (kind === 'label') { if (scope.symbols[token] === undefined) fail(line, `unknown label ${token}.`); return scope.symbols[token] }
    return null
  })
  let word = null
  try { if (spec.cond) word = encodeBranch(item.mnemonic, values[0], item.address); else if (spec.enc) word = spec.enc(...values) & 0xffff } catch { word = null }
  return { ...item, values, word, target: spec.cond || ['rjmp', 'rcall'].includes(item.mnemonic) ? values[0] : null }
}

/** Named I/O port → data-space low address (0x00..limit), from IO_PORTS or a number. */
export const IO_PORTS = { PINB: 0x03, DDRB: 0x04, PORTB: 0x05, PINC: 0x06, DDRC: 0x07, PORTC: 0x08, PIND: 0x09, DDRD: 0x0a, PORTD: 0x0b, SPL: 0x3d, SPH: 0x3e, SREG: 0x3f }
function ioAddress(token, scope, line, limit) {
  const t = token.trim().toUpperCase()
  const addr = Object.hasOwn(IO_PORTS, t) ? IO_PORTS[t] : Object.hasOwn(scope.equ, token) ? scope.equ[token] : parseNumber(token)
  if (addr === null || addr < 0 || addr > limit) fail(line, `I/O address out of range (0–${limit}), found ${token}.`)
  return addr
}
function pointer(token, line) {
  const t = token.trim().toUpperCase()
  if (['X', 'Y', 'Z'].includes(t)) return { reg: t, mode: 'none' }
  if (['X+', 'Y+', 'Z+'].includes(t)) return { reg: t[0], mode: 'post' }
  if (['-X', '-Y', '-Z'].includes(t)) return { reg: t[1], mode: 'pre' }
  fail(line, `expected X, Y, Z (optionally with + or −), found ${token}.`)
}
function encodeBranch(mnemonic, target, address) {
  const [base] = BRANCH[mnemonic]
  const offset = target - (address + 1)
  if (offset < -64 || offset > 63) throw new Error('branch out of range')
  return (base | ((offset & 0x7f) << 3)) & 0xffff
}

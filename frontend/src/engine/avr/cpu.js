/**
 * A deterministic teaching simulator for the AVR subset that assembler.js produces. It models the
 * 32 general registers, the SREG flags, a small data space (registers + I/O + SRAM), the stack and
 * a cycle counter, and executes one instruction per step with documented AVR flag semantics. It is
 * not cycle-exact for every instruction and implements only the assembled subset.
 */
export const DATA_SIZE = 0x160 // 0x00–0x1F regs, 0x20–0x5F I/O, 0x60–0x15F SRAM (256 bytes).
export const SRAM_START = 0x60
export const MAX_STEPS = 100000
export const IO_BASE = 0x20
// SREG bit indices.
const C = 0, Z = 1, N = 2, V = 3, S = 4, H = 5, I = 7
export const FLAG_NAMES = ['C', 'Z', 'N', 'V', 'S', 'H', 'T', 'I']

const bit = (value, index) => (value >> index) & 1

export function createMachine() {
  return {
    regs: new Uint8Array(32),
    data: new Uint8Array(DATA_SIZE), // I/O and SRAM; registers are mirrored on read/write.
    sreg: 0,
    sp: DATA_SIZE - 1,
    pc: 0, // word address into the program's address space
    cycles: 0,
    steps: 0,
    halted: false,
    error: null,
    output: [], // bytes written to PORTB, for a simple observable
  }
}

const getFlag = (m, i) => bit(m.sreg, i)
const setFlag = (m, i, on) => { m.sreg = on ? (m.sreg | (1 << i)) : (m.sreg & ~(1 << i)) }

/** Read a data-space address: registers mirror 0x00–0x1F, everything else is the data array. */
export function dataRead(m, addr) {
  if (addr < 32) return m.regs[addr]
  return m.data[addr] ?? 0
}
export function dataWrite(m, addr, value) {
  const v = value & 0xff
  if (addr < 32) { m.regs[addr] = v; return }
  if (addr < DATA_SIZE) {
    // Writing PINx toggles PORTx on hardware; here PIN reads mirror PORT for teaching simplicity.
    m.data[addr] = v
    if (addr === IO_BASE + 0x05) m.output.push(v) // OUT PORTB
  }
}
const ioRead = (m, port) => port === 0x3f ? m.sreg : dataRead(m, IO_BASE + port)
const ioWrite = (m, port, value) => { if (port === 0x3f) m.sreg = value & 0xff; else dataWrite(m, IO_BASE + port, value) }

const pointerReg = letter => ({ X: 26, Y: 28, Z: 30 }[letter])
function readPointer(m, letter) { const lo = pointerReg(letter); return m.regs[lo] | (m.regs[lo + 1] << 8) }
function writePointer(m, letter, value) { const lo = pointerReg(letter); m.regs[lo] = value & 0xff; m.regs[lo + 1] = (value >> 8) & 0xff }

function addFlags(m, d, r, result, carryIn = 0) {
  const R = result & 0xff
  setFlag(m, H, ((d & 0xf) + (r & 0xf) + carryIn) > 0xf)
  setFlag(m, C, (d + r + carryIn) > 0xff)
  setFlag(m, V, ((bit(d, 7) & bit(r, 7) & (1 - bit(R, 7))) | ((1 - bit(d, 7)) & (1 - bit(r, 7)) & bit(R, 7))) === 1)
  setFlag(m, N, bit(R, 7))
  setFlag(m, Z, R === 0)
  setFlag(m, S, getFlag(m, N) ^ getFlag(m, V))
}
function subFlags(m, d, r, result, borrowIn = 0, keepZ = false) {
  const R = result & 0xff
  setFlag(m, H, ((d & 0xf) - (r & 0xf) - borrowIn) < 0)
  setFlag(m, C, (d - r - borrowIn) < 0)
  setFlag(m, V, ((bit(d, 7) & (1 - bit(r, 7)) & (1 - bit(R, 7))) | ((1 - bit(d, 7)) & bit(r, 7) & bit(R, 7))) === 1)
  setFlag(m, N, bit(R, 7))
  setFlag(m, Z, keepZ ? (getFlag(m, Z) === 1 && R === 0) : R === 0)
  setFlag(m, S, getFlag(m, N) ^ getFlag(m, V))
}
function logicFlags(m, R) {
  setFlag(m, V, false); setFlag(m, N, bit(R, 7)); setFlag(m, Z, R === 0); setFlag(m, S, getFlag(m, N) ^ getFlag(m, V))
}
function shiftFlags(m, R, carry) {
  setFlag(m, C, carry); setFlag(m, N, bit(R, 7)); setFlag(m, Z, R === 0)
  setFlag(m, V, getFlag(m, N) ^ getFlag(m, C)); setFlag(m, S, getFlag(m, N) ^ getFlag(m, V))
}

/** Build a word-address → program-index map (programs may have .org gaps and 2-word ops). */
export function indexProgram(program) {
  const map = new Map()
  for (let i = 0; i < program.length; i++) map.set(program[i].address, i)
  const end = program.length ? program.at(-1).address + program.at(-1).words : 0
  return { map, end }
}

/**
 * Execute one instruction at the current PC. Returns the machine (mutated). Sets `halted` at RET
 * with an empty stack, at BREAK, past the last instruction, or on error; counts steps and cycles.
 */
export function step(m, program, index = indexProgram(program)) {
  if (m.halted) return m
  if (m.steps >= MAX_STEPS) { m.halted = true; m.error = 'Step limit reached. Check for an unterminated loop.'; return m }
  const at = index.map.get(m.pc)
  if (at === undefined) { m.halted = true; if (m.pc < index.end) m.error = `No instruction at word address ${m.pc}.`; return m }
  const ins = program[at]
  m.steps++
  m.cycles += ins.words
  let next = m.pc + ins.words
  const [a, b] = ins.values
  const rd = a, rr = b
  const d = m.regs[rd], r = m.regs[rr]
  switch (ins.mnemonic) {
    case 'nop': case 'break': if (ins.mnemonic === 'break') m.halted = true; break
    case 'ldi': m.regs[rd] = ins.values[1]; break
    case 'mov': m.regs[rd] = r; break
    case 'add': { const R = (d + r) & 0xff; addFlags(m, d, r, R); m.regs[rd] = R; break }
    case 'adc': { const cin = getFlag(m, C); const R = (d + r + cin) & 0xff; addFlags(m, d, r, R, cin); m.regs[rd] = R; break }
    case 'lsl': { const R = (d << 1) & 0xff; addFlags(m, d, d, R); m.regs[rd] = R; break }
    case 'rol': { const cin = getFlag(m, C); const R = ((d << 1) | cin) & 0xff; addFlags(m, d, d, R, cin); m.regs[rd] = R; break }
    case 'sub': { const R = (d - r) & 0xff; subFlags(m, d, r, R); m.regs[rd] = R; break }
    case 'sbc': { const bin = getFlag(m, C); const R = (d - r - bin) & 0xff; subFlags(m, d, r, R, bin, true); m.regs[rd] = R; break }
    case 'subi': { const k = ins.values[1]; const R = (d - k) & 0xff; subFlags(m, d, k, R); m.regs[rd] = R; break }
    case 'sbci': { const k = ins.values[1]; const bin = getFlag(m, C); const R = (d - k - bin) & 0xff; subFlags(m, d, k, R, bin, true); m.regs[rd] = R; break }
    case 'cp': { const R = (d - r) & 0xff; subFlags(m, d, r, R); break }
    case 'cpc': { const bin = getFlag(m, C); const R = (d - r - bin) & 0xff; subFlags(m, d, r, R, bin, true); break }
    case 'cpi': { const k = ins.values[1]; const R = (d - k) & 0xff; subFlags(m, d, k, R); break }
    case 'and': { const R = d & r; logicFlags(m, R); m.regs[rd] = R; break }
    case 'tst': { logicFlags(m, d & d); break }
    case 'andi': { const R = d & ins.values[1]; logicFlags(m, R); m.regs[rd] = R; break }
    case 'or': { const R = d | r; logicFlags(m, R); m.regs[rd] = R; break }
    case 'ori': { const R = d | ins.values[1]; logicFlags(m, R); m.regs[rd] = R; break }
    case 'eor': { const R = d ^ r; logicFlags(m, R); m.regs[rd] = R; break }
    case 'clr': { logicFlags(m, 0); m.regs[rd] = 0; break }
    case 'ser': m.regs[rd] = 0xff; break
    case 'com': { const R = (0xff - d) & 0xff; setFlag(m, C, true); setFlag(m, V, false); setFlag(m, N, bit(R, 7)); setFlag(m, Z, R === 0); setFlag(m, S, getFlag(m, N) ^ getFlag(m, V)); m.regs[rd] = R; break }
    case 'neg': { const R = (0 - d) & 0xff; setFlag(m, C, R !== 0); setFlag(m, H, (bit(R, 3) | bit(d, 3)) === 1); setFlag(m, V, R === 0x80); setFlag(m, N, bit(R, 7)); setFlag(m, Z, R === 0); setFlag(m, S, getFlag(m, N) ^ getFlag(m, V)); m.regs[rd] = R; break }
    case 'inc': { const R = (d + 1) & 0xff; setFlag(m, V, d === 0x7f); setFlag(m, N, bit(R, 7)); setFlag(m, Z, R === 0); setFlag(m, S, getFlag(m, N) ^ getFlag(m, V)); m.regs[rd] = R; break }
    case 'dec': { const R = (d - 1) & 0xff; setFlag(m, V, d === 0x80); setFlag(m, N, bit(R, 7)); setFlag(m, Z, R === 0); setFlag(m, S, getFlag(m, N) ^ getFlag(m, V)); m.regs[rd] = R; break }
    case 'lsr': { const R = d >> 1; shiftFlags(m, R, d & 1); setFlag(m, N, false); setFlag(m, V, getFlag(m, N) ^ getFlag(m, C)); setFlag(m, S, getFlag(m, N) ^ getFlag(m, V)); m.regs[rd] = R; break }
    case 'ror': { const cin = getFlag(m, C); const R = (d >> 1) | (cin << 7); shiftFlags(m, R, d & 1); m.regs[rd] = R; break }
    case 'asr': { const R = (d >> 1) | (d & 0x80); shiftFlags(m, R, d & 1); m.regs[rd] = R; break }
    case 'swap': m.regs[rd] = ((d << 4) | (d >> 4)) & 0xff; break
    case 'in': m.regs[rd] = ioRead(m, ins.values[1]); break
    case 'out': ioWrite(m, ins.values[0], m.regs[ins.values[1]]); break
    case 'sbi': ioWrite(m, ins.values[0], ioRead(m, ins.values[0]) | (1 << ins.values[1])); break
    case 'cbi': ioWrite(m, ins.values[0], ioRead(m, ins.values[0]) & ~(1 << ins.values[1])); break
    case 'push': dataWrite(m, m.sp, d); m.sp -= 1; m.cycles += 1; break
    case 'pop': m.sp += 1; m.regs[rd] = dataRead(m, m.sp); m.cycles += 1; break
    case 'lds': m.regs[rd] = dataRead(m, ins.values[1]); m.cycles += 1; break
    case 'sts': dataWrite(m, ins.values[0], m.regs[ins.values[1]]); m.cycles += 1; break
    case 'ld': { const p = ins.values[1]; if (p.mode === 'pre') writePointer(m, p.reg, readPointer(m, p.reg) - 1); m.regs[rd] = dataRead(m, readPointer(m, p.reg)); if (p.mode === 'post') writePointer(m, p.reg, readPointer(m, p.reg) + 1); m.cycles += 1; break }
    case 'st': { const p = ins.values[0]; if (p.mode === 'pre') writePointer(m, p.reg, readPointer(m, p.reg) - 1); dataWrite(m, readPointer(m, p.reg), m.regs[ins.values[1]]); if (p.mode === 'post') writePointer(m, p.reg, readPointer(m, p.reg) + 1); m.cycles += 1; break }
    case 'sei': setFlag(m, I, true); break
    case 'cli': setFlag(m, I, false); break
    case 'sec': setFlag(m, C, true); break
    case 'clc': setFlag(m, C, false); break
    case 'rjmp': next = ins.target; m.cycles += 1; break
    case 'rcall': { const ret = m.pc + ins.words; dataWrite(m, m.sp, ret & 0xff); dataWrite(m, m.sp - 1, (ret >> 8) & 0xff); m.sp -= 2; next = ins.target; m.cycles += 2; break }
    case 'ret': { if (m.sp >= DATA_SIZE - 1) { m.halted = true; break } const hi = dataRead(m, m.sp + 1); const lo = dataRead(m, m.sp + 2); m.sp += 2; next = (hi << 8) | lo; m.cycles += 3; break }
    default: {
      if (ins.target !== null) { // a conditional branch
        const info = branchTest(m, ins.mnemonic)
        if (info) { next = ins.target; m.cycles += 1 }
      }
    }
  }
  if (!m.halted) m.pc = next
  return m
}

function branchTest(m, mnemonic) {
  switch (mnemonic) {
    case 'breq': return getFlag(m, Z) === 1
    case 'brne': return getFlag(m, Z) === 0
    case 'brcs': case 'brlo': return getFlag(m, C) === 1
    case 'brcc': case 'brsh': return getFlag(m, C) === 0
    case 'brmi': return getFlag(m, N) === 1
    case 'brpl': return getFlag(m, N) === 0
    case 'brlt': return getFlag(m, S) === 1
    case 'brge': return getFlag(m, S) === 0
    case 'brvs': return getFlag(m, V) === 1
    case 'brvc': return getFlag(m, V) === 0
    default: return false
  }
}

export function run(m, program, maxSteps = MAX_STEPS) {
  const index = indexProgram(program)
  let guard = 0
  while (!m.halted && guard < maxSteps) { step(m, program, index); guard++ }
  if (!m.halted && guard >= maxSteps) { m.halted = true; m.error = m.error ?? 'Run stopped at the step limit.' }
  return m
}

/** SREG as a readable flag map, e.g. { C:0, Z:1, ... }. */
export function flags(m) {
  return Object.fromEntries(FLAG_NAMES.map((name, i) => [name, bit(m.sreg, i)]))
}

import { add4 } from './logic.js'

/** VQ4: original teaching ISA, 4-bit data, separate 16×8 ROM and 16×4 RAM. */
export const ISA = [
  ['NOP', false, 'No state change'], ['LDI', true, 'A ← immediate; set Z, clear C'],
  ['LDA', true, 'A ← RAM[address]; set Z, clear C'], ['STA', true, 'RAM[address] ← A; keep flags'],
  ['ADD', true, 'A ← A + RAM[address]; set Z, C'], ['SUB', true, 'A ← A − RAM[address]; set Z, C = no borrow'],
  ['AND', true, 'A ← A AND RAM[address]; set Z, clear C'], ['OR', true, 'A ← A OR RAM[address]; set Z, clear C'],
  ['XOR', true, 'A ← A XOR RAM[address]; set Z, clear C'], ['JMP', true, 'PC ← address; keep flags'],
  ['JZ', true, 'If Z = 1, PC ← address; keep flags'], ['JC', true, 'If C = 1, PC ← address; keep flags'],
  ['OUT', false, 'Output register ← A; keep flags'], ['HLT', false, 'Halt until reset'],
  ['ADDI', true, 'A ← A + immediate; set Z, C'], ['SUBI', true, 'A ← A − immediate; set Z, C = no borrow'],
].map(([name, operand, effect], opcode) => ({ name, operand, effect, opcode }))
export const MAX_ASSEMBLY_SOURCE = 8192
export const MAX_CLOCKS = 768
export const MAX_TRACE = 96

export function assemble(source) {
  if (typeof source !== 'string' || source.length > MAX_ASSEMBLY_SOURCE) throw new Error('Keep assembly source within 8192 characters.')
  const labels = new Map(), statements = []
  source.split(/\r?\n/).forEach((raw, index) => {
    let text = raw.split(';')[0].trim().toUpperCase()
    if (!text) return
    const label = text.match(/^([A-Z][A-Z0-9_]{0,31}):\s*/)
    if (label) {
      if (labels.has(label[1])) throw new Error(`Line ${index + 1}: duplicate label ${label[1]}.`)
      labels.set(label[1], statements.length); text = text.slice(label[0].length)
    }
    if (text) statements.push({ text, line: index + 1 })
  })
  if (!statements.length || statements.length > 16) throw new Error('A VQ4 program needs 1–16 instructions.')
  const listing = statements.map(({ text, line }, address) => {
    const [name, operand, ...extra] = text.split(/\s+/), instruction = ISA.find(item => item.name === name)
    if (!instruction) throw new Error(`Line ${line}: unknown instruction ${name}. This editor runs VQ4 assembly.`)
    if (extra.length || Boolean(operand) !== instruction.operand) throw new Error(`Line ${line}: ${name} ${instruction.operand ? 'needs one operand' : 'takes no operand'}.`)
    let value = 0
    if (operand) {
      if (['JMP', 'JZ', 'JC'].includes(name) && labels.has(operand)) value = labels.get(operand)
      else if (/^(?:\d+|0X[0-9A-F]+|0B[01]+)$/.test(operand)) value = Number(operand)
      else throw new Error(`Line ${line}: use a number, or a defined code label for a jump.`)
      if (!Number.isInteger(value) || value < 0 || value > 15) throw new Error(`Line ${line}: operand must fit in four bits (0–15).`)
    }
    return { address, word: instruction.opcode * 16 + value, name, operand: value, line, source: text }
  })
  return { source, listing, rom: Array.from({ length: 16 }, (_, index) => listing[index]?.word ?? 0xd0) }
}

export function createCpu(program) {
  return { program, a: 0, pc: 0, ir: 0, z: 1, c: 0, out: 0, ram: Array(16).fill(0),
    phase: 'fetch', clocks: 0, halted: false, output: [], outputTruncated: false, trace: [], traceTruncated: false }
}

export function stepCpu(state) {
  if (state.halted || state.clocks >= MAX_CLOCKS) return state
  const next = { ...state, ram: [...state.ram], clocks: state.clocks + 1 }, phase = state.phase
  let controls = '', mnemonic = ''
  const writeA = (value, carry = 0) => { next.a = value & 15; next.z = Number(next.a === 0); next.c = carry }
  if (phase === 'fetch') {
    next.ir = state.program.rom[state.pc]; next.pc = (state.pc + 1) & 15; next.phase = 'decode'
    controls = `IR ← ROM[${state.pc}]; PC ← ${next.pc}`
  } else if (phase === 'decode') {
    next.phase = 'execute'; controls = `opcode = ${state.ir >> 4}; operand = ${state.ir & 15}`
  } else {
    const opcode = state.ir >> 4, operand = state.ir & 15, instruction = ISA[opcode]
    mnemonic = `${instruction.name}${instruction.operand ? ` ${operand}` : ''}`
    next.phase = 'fetch'; controls = instruction.effect
    switch (instruction.name) {
      case 'LDI': writeA(operand); break
      case 'LDA': writeA(state.ram[operand]); break
      case 'STA': next.ram[operand] = state.a; break
      case 'ADD': case 'ADDI': {
        const result = add4(state.a, instruction.name === 'ADD' ? state.ram[operand] : operand)
        writeA(result.value, result.carry); break
      }
      case 'SUB': case 'SUBI': {
        const b = instruction.name === 'SUB' ? state.ram[operand] : operand
        const result = add4(state.a, (~b) & 15, 1)
        writeA(result.value, result.carry); break
      }
      case 'AND': writeA(state.a & state.ram[operand]); break
      case 'OR': writeA(state.a | state.ram[operand]); break
      case 'XOR': writeA(state.a ^ state.ram[operand]); break
      case 'JMP': next.pc = operand; break
      case 'JZ': case 'JC': {
        const taken = instruction.name === 'JZ' ? state.z : state.c
        if (taken) next.pc = operand
        controls = `${instruction.name === 'JZ' ? 'Z' : 'C'} = ${taken}; ${taken ? `PC ← ${operand}` : 'keep PC'}`
        break
      }
      case 'OUT': next.out = state.a; next.output = [...state.output, state.a].slice(-64); next.outputTruncated ||= state.output.length >= 64; break
      case 'HLT': next.halted = true; next.phase = 'halted'; break
      case 'NOP': break
    }
  }
  const event = { clock: next.clocks, phase, pcBefore: state.pc, pcAfter: next.pc, ir: next.ir,
    aBefore: state.a, a: next.a, z: next.z, c: next.c, out: next.out, mnemonic, controls }
  next.trace = [...state.trace, event].slice(-MAX_TRACE)
  next.traceTruncated ||= state.trace.length >= MAX_TRACE
  return next
}

export function runCpu(state, clocks = MAX_CLOCKS) {
  if (!Number.isInteger(clocks) || clocks < 1 || clocks > MAX_CLOCKS) throw new Error(`Choose 1–${MAX_CLOCKS} clock steps.`)
  let next = state
  for (let i = 0; i < clocks && !next.halted && next.clocks < MAX_CLOCKS; i++) next = stepCpu(next)
  return next
}

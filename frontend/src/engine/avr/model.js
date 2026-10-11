import { assemble, INSTRUCTIONS, IO_PORTS } from './assembler.js'
import { createMachine, MAX_STEPS, run } from './cpu.js'

export { assemble, INSTRUCTIONS, IO_PORTS, MAX_PROGRAM, REG_ALIASES } from './assembler.js'
export { createMachine, run, step, flags, indexProgram, FLAG_NAMES, MAX_STEPS, DATA_SIZE, SRAM_START, IO_BASE } from './cpu.js'

const hex = (value, width) => value.toString(16).toUpperCase().padStart(width, '0')

/**
 * Assembler listing rows for the IDE: address, 16-bit opcode word (or '----' when the subset does
 * not encode that mnemonic), and the source line. Mirrors a real assembler's .lst output.
 */
export function listing(program) {
  return program.map(ins => ({
    line: ins.line,
    address: hex(ins.address, 4),
    word: ins.word === null ? (ins.words === 2 ? '---- ----' : '----') : ins.words === 2 ? `${hex(ins.word, 4)} ????` : hex(ins.word, 4),
    source: ins.raw,
    mnemonic: ins.mnemonic,
  }))
}

/**
 * Assemble and run `source` fresh, returning the final machine, listing, symbols and a compact
 * summary. Throws `Line N:` on an assembly error. The machine is deterministic and bounded.
 */
export function assembleAndRun(source, { maxSteps = MAX_STEPS } = {}) {
  const result = assemble(source)
  const machine = createMachine()
  run(machine, result.program, maxSteps)
  return { ...result, machine, listing: listing(result.program) }
}

/** One categorized reference row per supported instruction, for the IDE help panel. */
export const REFERENCE = [
  ['ldi Rd, K', 'Load immediate K (0–255) into R16–R31.', 'data'],
  ['mov Rd, Rr', 'Copy Rr into Rd.', 'data'],
  ['ld Rd, X|Y|Z', 'Load from data memory via a pointer (optional post-increment X+ or pre-decrement -X).', 'data'],
  ['st X|Y|Z, Rr', 'Store Rr to data memory via a pointer.', 'data'],
  ['lds Rd, addr', 'Load direct from a data address.', 'data'],
  ['sts addr, Rr', 'Store direct to a data address.', 'data'],
  ['push Rr / pop Rd', 'Push/pop a register via the stack pointer.', 'data'],
  ['in Rd, io / out io, Rr', 'Read/write an I/O register (PORTB, DDRB, PINB, …).', 'io'],
  ['sbi io, b / cbi io, b', 'Set/clear bit b in a low I/O register.', 'io'],
  ['add/adc Rd, Rr', 'Add (with carry) — sets H, S, V, N, Z, C.', 'alu'],
  ['sub/sbc Rd, Rr', 'Subtract (with carry) — sets H, S, V, N, Z, C.', 'alu'],
  ['subi/sbci Rd, K', 'Subtract immediate (R16–R31).', 'alu'],
  ['and/or/eor Rd, Rr', 'Bitwise logic — clears V, sets S, N, Z.', 'alu'],
  ['andi/ori Rd, K', 'Bitwise logic with immediate (R16–R31).', 'alu'],
  ['com/neg Rd', "One's / two's complement.", 'alu'],
  ['inc/dec Rd', 'Increment / decrement (does not touch C).', 'alu'],
  ['lsl/lsr/rol/ror/asr Rd', 'Shifts and rotates through carry.', 'alu'],
  ['swap Rd', 'Swap the nibbles of Rd.', 'alu'],
  ['cp/cpc/cpi', 'Compare (sets flags, stores nothing).', 'alu'],
  ['tst Rd / clr Rd / ser Rd', 'Test (AND Rd,Rd) / clear / set all bits.', 'alu'],
  ['rjmp label', 'Relative jump.', 'flow'],
  ['rcall label / ret', 'Call a subroutine and return via the stack.', 'flow'],
  ['breq/brne label', 'Branch if Z set / clear.', 'flow'],
  ['brcs/brcc (brlo/brsh)', 'Branch on carry (unsigned lower/same).', 'flow'],
  ['brmi/brpl label', 'Branch if negative / positive.', 'flow'],
  ['brlt/brge label', 'Branch if signed less-than / greater-or-equal.', 'flow'],
  ['brvs/brvc label', 'Branch on overflow set / clear.', 'flow'],
  ['sei/cli/sec/clc', 'Set/clear the I and C flags.', 'flow'],
  ['nop / break', 'No operation / stop the simulator.', 'flow'],
]

/** Names the simulator implements, for the editor highlighter. */
export const MNEMONICS = Object.keys(INSTRUCTIONS)
export const IO_NAMES = Object.keys(IO_PORTS)
export const REGISTERS = [...Array(32)].map((_, i) => `r${i}`)
export const DIRECTIVES = ['.equ', '.def', '.org', '.set', '.cseg']

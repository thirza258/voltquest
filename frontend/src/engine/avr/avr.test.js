import { describe, expect, it } from 'vitest'
import { assemble } from './assembler.js'
import { createMachine, flags, run, step, indexProgram, IO_BASE } from './cpu.js'
import { assembleAndRun, listing } from './model.js'

const prog = src => assemble(src).program
const machineFor = src => { const p = prog(src); const m = createMachine(); run(m, p); return m }

describe('AVR assembler', () => {
  it('encodes known opcodes', () => {
    expect(prog('ldi r16, 0xFF')[0].word).toBe(0xef0f)
    expect(prog('ldi r17, 0x0A')[0].word).toBe(0xe01a)
    expect(prog('nop')[0].word).toBe(0x0000)
    expect(prog('mov r0, r1')[0].word).toBe(0x2c01)
    expect(prog('add r16, r17')[0].word).toBe(0x0f01)
    expect(prog('ret')[0].word).toBe(0x9508)
    expect(prog('out 0x05, r16')[0].word).toBe(0xb905)
  })
  it('resolves labels into relative branch offsets', () => {
    const p = prog('ldi r16,3\nloop:\ndec r16\nbrne loop')
    const branch = p.find(i => i.mnemonic === 'brne')
    expect(branch.target).toBe(1) // word address of loop
    expect(branch.word).toBe(0xf7f1) // brne -2
  })
  it('rejects bad input with a line number', () => {
    expect(() => assemble('ldi r1, 5')).toThrow(/high register/)
    expect(() => assemble('foo r1')).toThrow(/Line 1/)
    expect(() => assemble('brne nowhere')).toThrow(/unknown label/)
    expect(() => assemble('ldi r16, 999')).toThrow(/out of range/)
  })
  it('supports .equ, .def and named I/O ports', () => {
    const p = prog('.def acc = r16\n.equ N = 5\nldi acc, N\nout PORTB, acc')
    expect(p[0].values).toEqual([16, 5])
    expect(p[1].values[0]).toBe(0x05)
  })
})

describe('AVR simulator', () => {
  it('sums 1..5 in a loop and lands with Z set', () => {
    const m = machineFor('  ldi r16, 0\n  ldi r17, 1\n  ldi r18, 5\nloop:\n  add r16, r17\n  inc r17\n  dec r18\n  brne loop')
    expect(m.regs[16]).toBe(15)
    expect(flags(m).Z).toBe(1) // dec r18 reached zero
    expect(m.halted).toBe(true)
  })
  it('computes add flags for 0x80 + 0x80', () => {
    const f = flags(machineFor('ldi r16,0x80\nldi r17,0x80\nadd r16,r17'))
    expect(f).toMatchObject({ C: 1, Z: 1, V: 1, N: 0, S: 1 })
  })
  it('computes sub borrow and sign', () => {
    const m = machineFor('ldi r16,0x10\nldi r17,0x20\nsub r16,r17')
    expect(m.regs[16]).toBe(0xf0)
    expect(flags(m)).toMatchObject({ C: 1, N: 1, Z: 0, V: 0 })
  })
  it('writes PORTB through OUT and records output', () => {
    const m = machineFor('ldi r16, 0xAA\nout PORTB, r16')
    expect(m.output).toEqual([0xaa])
    expect(m.data[IO_BASE + 0x05]).toBe(0xaa)
  })
  it('stores and loads through the X pointer', () => {
    const m = machineFor('ldi r26,0x60\nldi r27,0\nldi r16,0x42\nst X, r16\nld r18, X')
    expect(m.regs[18]).toBe(0x42)
    expect(m.data[0x60]).toBe(0x42)
  })
  it('calls and returns through the stack', () => {
    const m = machineFor('  rcall sub\n  rjmp end\nsub:\n  ldi r16, 7\n  ret\nend:\n  nop')
    expect(m.regs[16]).toBe(7)
    expect(m.halted).toBe(true)
  })
  it('steps one instruction at a time and counts cycles', () => {
    const p = prog('ldi r16,5\nldi r17,6\nadd r16,r17')
    const m = createMachine(), index = indexProgram(p)
    step(m, p, index); expect(m.regs[16]).toBe(5); expect(m.pc).toBe(1)
    step(m, p, index); step(m, p, index)
    expect(m.regs[16]).toBe(11); expect(m.cycles).toBe(3)
  })
  it('produces an assembler listing with addresses and opcodes', () => {
    const { listing: rows } = assembleAndRun('ldi r16, 1\nout PORTB, r16')
    expect(rows[0]).toMatchObject({ address: '0000', word: 'E001' })
    expect(rows[1].address).toBe('0001')
    expect(listing(prog('ld r0, X'))[0].word).toBe('----') // unencoded in the subset
  })
})

import { describe, expect, it } from 'vitest'
import { add4, clockCircuit, evaluateCircuit, gate, parseCircuit, settleLatch, truthTable } from './logic.js'
import { assemble, createCpu, ISA, MAX_CLOCKS, runCpu, stepCpu } from './cpu.js'
import { PRESETS } from './presets.js'

const execute = source => runCpu(createCpu(assemble(source)))
const word = (value, prefix) => Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`${prefix}${i}`, (value >> i) & 1]))
const fromBits = (value, prefix) => [0, 1, 2, 3].reduce((sum, i) => sum + value[`${prefix}${i}`] * 2 ** i, 0)

it('computes every basic gate row and every selector input', () => {
  const table = { AND: [0,0,0,1], OR: [0,1,1,1], XOR: [0,1,1,0], NAND: [1,1,1,0], NOR: [1,0,0,0], XNOR: [1,0,0,1] }
  for (const [name, expected] of Object.entries(table)) expect([[0,0],[0,1],[1,0],[1,1]].map(args => gate(name,args))).toEqual(expected)
  expect([0,1].map(a=>gate('NOT',[a]))).toEqual([1,0])
  expect([0,1].map(a=>gate('BUF',[a]))).toEqual([0,1])
  for (let a=0;a<2;a++) for (let b=0;b<2;b++) for (let s=0;s<2;s++) expect(gate('MUX',[a,b,s])).toBe(s ? b : a)
})

it('executes all eight full-adder input triples against integer addition', () => {
  const table = truthTable(parseCircuit(PRESETS['computer-adders'].source))
  expect(table).toHaveLength(8)
  for (const {inputs,outputs} of table) expect(outputs.S + 2*outputs.COUT).toBe(inputs.A+inputs.B+inputs.CIN)
})

it('matches NAND XOR, majority and decoder specifications exhaustively', () => {
  expect(truthTable(parseCircuit(PRESETS['computer-nand'].source)).map(row => row.outputs.X)).toEqual([0,1,1,0])
  expect(evaluateCircuit(parseCircuit(PRESETS['computer-nand'].source)).depth).toBe(3)
  for (const {inputs,outputs} of truthTable(parseCircuit(PRESETS['computer-boolean'].source))) expect(outputs.Y).toBe(Number(inputs.A+inputs.B+inputs.C>=2))
  for (const {inputs,outputs} of truthTable(parseCircuit(PRESETS['computer-routing'].source))) {
    for (let i=0;i<4;i++) expect(outputs[`W${i}`]).toBe(Number(i===inputs.A0+2*inputs.A1))
    expect(outputs.Y).toBe(inputs.A0 ? inputs.D1 : inputs.D0)
  }
})

it('verifies all four-bit operand pairs, carries, ripple wiring and subtraction', () => {
  const circuit = parseCircuit(PRESETS['computer-arithmetic'].source)
  for (let a=0;a<16;a++) for (let b=0;b<16;b++) {
    for (let c=0;c<2;c++) {
      expect(add4(a,b,c)).toEqual({value:(a+b+c)%16,carry:Number(a+b+c>=16)})
      const {outputs} = evaluateCircuit(circuit,{...word(a,'A'),...word(b,'B'),CIN:c})
      expect(fromBits(outputs,'S')+16*outputs.COUT).toBe(a+b+c)
    }
    expect(add4(a,(~b)&15,1)).toEqual({value:(a-b+16)%16,carry:Number(a>=b)})
  }
})

it('checks every ALU operation against independent arithmetic and bitwise expectations', () => {
  const circuit = parseCircuit(PRESETS['computer-alu'].source)
  for (let a=0;a<16;a++) for (let b=0;b<16;b++) for (let op=0;op<4;op++) {
    const value = [a&b,a|b,a^b,(a+b)%16][op]
    const {outputs} = evaluateCircuit(circuit,{...word(a,'A'),...word(b,'B'),CIN:0,OP0:op&1,OP1:op>>1})
    expect(fromBits(outputs,'Y')).toBe(value); expect(outputs.Z).toBe(Number(value===0)); expect(outputs.C).toBe(Number(op===3 && a+b>=16))
  }
})

it('samples DFFs simultaneously and implements hold plus synchronous reset priority', () => {
  const circuit = parseCircuit('INPUT D EN RST\nq1 = DFF q0 EN RST\nq0 = DFF D EN RST\nOUTPUT Q0=q0 Q1=q1')
  const inputs={D:1,EN:1,RST:0}, first=clockCircuit(circuit,inputs), second=clockCircuit(circuit,inputs,first.memory)
  expect(first.outputs).toEqual({Q0:1,Q1:0}); expect(second.outputs).toEqual({Q0:1,Q1:1})
  expect(clockCircuit(circuit,{D:0,EN:0,RST:0},second.memory).outputs).toEqual(second.outputs)
  expect(evaluateCircuit(circuit,{D:0,EN:0,RST:1},second.memory).outputs).toEqual(second.outputs)
  expect(clockCircuit(circuit,{D:1,EN:0,RST:1},second.memory).outputs).toEqual({Q0:0,Q1:0})
})

it('supports intentional DFF feedback without accepting a combinational loop', () => {
  const circuit=parseCircuit('q = DFF n 1 0\nn = NOT q\nOUTPUT Q=q')
  let memory={}
  for (const expected of [1,0,1,0]) { const step=clockCircuit(circuit,{},memory); memory=step.memory; expect(step.outputs.Q).toBe(expected) }
  expect(()=>parseCircuit('a = NOT b\nb = NOT a\nOUTPUT X=0')).toThrow(/feedback/)
})

it('writes exactly one memory cell and reads every address without writes', () => {
  const circuit=parseCircuit(PRESETS['computer-memory'].source)
  let memory={}
  for (const address of [1,2]) memory=clockCircuit(circuit,{A0:address&1,A1:address>>1,D:1,WE:1,RST:0},memory).memory
  for (let address=0;address<4;address++) {
    const inputs={A0:address&1,A1:address>>1,D:0,WE:0,RST:0}
    expect(evaluateCircuit(circuit,inputs,memory).outputs.DATA).toBe(Number(address===1||address===2))
    expect(clockCircuit(circuit,inputs,memory).memory).toEqual(memory)
  }
})

it('keeps invalid latch releases unknown until a valid reset or set', () => {
  expect(settleLatch(0,1,0)).toMatchObject({q:1,nq:0,invalid:false})
  expect(settleLatch(1,0,0).q).toBe(1)
  const invalid=settleLatch(1,1,1)
  expect(invalid).toEqual({q:null,nq:null,invalid:true,physicalOutputs:[0,0]})
  expect(settleLatch(invalid.q,0,0).q).toBeNull()
  expect(settleLatch(null,0,1)).toMatchObject({q:0,nq:1,invalid:false})
})

it.each(['OUTPUT x=missing','INPUT A A\nOUTPUT Y=A','INPUT A\nx = NOT A A\nOUTPUT Y=x','INPUT A\nx = eval A\nOUTPUT Y=x','OUTPUT Y=0 Y=1','INPUT A\nOUTPUT Y=A\nA = NOT 0'])('rejects malformed circuit %s', source => { expect(()=>parseCircuit(source)).toThrow() })
it('bounds source and truth tables and rejects non-bit controls', () => {
  expect(()=>parseCircuit(' '.repeat(16385))).toThrow(/16384/)
  expect(()=>truthTable(parseCircuit(PRESETS['computer-arithmetic'].source))).toThrow(/six/)
  expect(()=>truthTable(parseCircuit(PRESETS['computer-registers'].source))).toThrow(/Storage/)
  expect(()=>evaluateCircuit(parseCircuit('INPUT A\nOUTPUT Y=A'),{A:2})).toThrow(/0 or 1/)
  expect(()=>parseCircuit(`INPUT ${Array.from({length:17},(_,i)=>`a${i}`).join(' ')}\nOUTPUT Y=0`)).toThrow(/16 inputs/)
})

describe('VQ4 machine', () => {
  it('assembles numeric spellings and code labels to exact words', () => {
    expect(assemble('LDI 10\nLDI 0xA\nLDI 0b1010\nOUT\nHLT').rom.slice(0,5)).toEqual([0x1a,0x1a,0x1a,0xc0,0xd0])
    expect(assemble('; comment\nloop:\nNOP\nJMP loop').rom.slice(0,2)).toEqual([0,0x90])
    expect(assemble('NOP').rom.slice(1)).toEqual(Array(15).fill(0xd0))
  })
  it('fetches from the old PC and writes A only on execute', () => {
    const initial=createCpu(assemble('LDI 3\nHLT')), fetch=stepCpu(initial), decode=stepCpu(fetch), execute=stepCpu(decode)
    expect(initial).toMatchObject({a:0,pc:0,ir:0,phase:'fetch'})
    expect(fetch).toMatchObject({a:0,pc:1,ir:0x13,phase:'decode'})
    expect(decode).toMatchObject({a:0,pc:1,phase:'execute'})
    expect(execute).toMatchObject({a:3,z:0,c:0,phase:'fetch'})
  })
  it('implements every opcode including flags and taken/untaken jumps', () => {
    expect(ISA).toHaveLength(16)
    expect(execute('LDI 6\nSTA 3\nLDI 2\nADD 3\nOUT\nLDA 3\nSUBI 6\nJZ done\nLDI 15\ndone: HLT')).toMatchObject({a:0,z:1,c:1,out:8,halted:true})
    for(const [name,value] of [['AND',2],['OR',11],['XOR',9]]) expect(execute(`LDI 3\nSTA 0\nLDI 10\n${name} 0\nHLT`)).toMatchObject({a:value,c:0,z:0})
    expect(execute('LDI 5\nSTA 0\nLDI 3\nSUB 0\nHLT')).toMatchObject({a:14,c:0,z:0})
    expect(execute('LDI 1\nJZ wrong\nJC wrong\nJMP done\nwrong: LDI 9\ndone: NOP\nHLT')).toMatchObject({a:1,halted:true})
    expect(execute(PRESETS['assembly-flags'].source).output).toEqual([0,15])
  })
  it('wraps PC and stops bounded loops without inventing a halt', () => {
    const state=runCpu(createCpu(assemble(Array(16).fill('NOP').join('\n'))),48)
    expect(state).toMatchObject({pc:0,clocks:48,phase:'fetch',halted:false})
    const loop=execute('LDI 1\nloop: OUT\nJMP loop')
    expect(loop.clocks).toBe(MAX_CLOCKS); expect(loop.halted).toBe(false)
    expect(loop.trace).toHaveLength(96); expect(loop.traceTruncated).toBe(true)
    expect(loop.output).toHaveLength(64); expect(loop.outputTruncated).toBe(true)
    expect(stepCpu(loop)).toBe(loop)
    const halt=execute('HLT'); expect(stepCpu(halt)).toBe(halt)
    expect(()=>runCpu(halt,769)).toThrow()
  })
  it.each(['','LDI 16','LDI -1','LDI 0x10','LDI NaN','LDI 2 3','OUT 2','JMP missing','a: NOP\na: HLT','ADD label\nlabel: HLT',Array(17).fill('NOP').join('\n')])('rejects invalid assembly %s', source => { expect(()=>assemble(source)).toThrow() })
  it('rejects an out-of-range trailing target, excess source and host code', () => {
    expect(()=>assemble(`JMP end\n${Array(15).fill('NOP').join('\n')}\nend:`)).toThrow(/four bits/)
    expect(()=>assemble(' '.repeat(8193))).toThrow(/8192/)
    expect(()=>assemble('fetch("https://example.test")')).toThrow(/unknown instruction/)
  })
})

const cpuExamples = { 'computer-cpu':[8], 'assembly-encoding':[10,10,10], 'assembly-memory':[6,8], 'assembly-flags':[0,15], 'assembly-loops':[3,2,1], 'assembly-real-isas':[0], 'computer-capstone':[10] }
it.each(Object.entries(cpuExamples))('executes the actual %s authored example', (id, output) => {
  const state=execute(PRESETS[id].source)
  expect(state.halted).toBe(true); expect(state.output).toEqual(output)
})
it('tests capstone alternative inputs and explains four-bit overflow', () => {
  for (const [initial,expected] of [[4,10],[5,15],[6,5]]) {
    const state=execute(PRESETS['computer-capstone'].source.replace('LDI 4',`LDI ${initial}`))
    expect(state.output).toEqual([expected]); expect(state.ram.slice(0,2)).toEqual([0,expected])
  }
})

/** Small, editable circuits. Every connection uses the same parser as learner designs. */
const fullAdder = (prefix, a, b, cin) => `${prefix}p = XOR ${a} ${b}\n${prefix}s = XOR ${prefix}p ${cin}\n${prefix}g = AND ${a} ${b}\n${prefix}h = AND ${prefix}p ${cin}\n${prefix}c = OR ${prefix}g ${prefix}h`
const ripple = () => Array.from({ length: 4 }, (_, i) => fullAdder(`f${i}`, `A${i}`, `B${i}`, i ? `f${i - 1}c` : 'CIN')).join('\n')
const busInputs = 'A0 A1 A2 A3 B0 B1 B2 B3'
const decoder = 'n0 = NOT A0\nn1 = NOT A1\nw0 = AND n1 n0\nw1 = AND n1 A0\nw2 = AND A1 n0\nw3 = AND A1 A0'
const sumProgram = `; VQ4: sum 4 + 3 + 2 + 1 = 10
LDI 4
STA 0
LDI 0
STA 1
loop: LDA 1
ADD 0
STA 1
LDA 0
SUBI 1
STA 0
JZ done
JMP loop
done: LDA 1
OUT
HLT`

export const PRESETS = {
  'computer-bits': { mode: 'gates', source: 'INPUT B0 B1 B2 B3\nOUTPUT bit0=B0 bit1=B1 bit2=B2 bit3=B3', inputs: { B0: 1, B1: 0, B2: 1, B3: 0 } },
  'computer-gates': { mode: 'gates', source: 'INPUT A B\nn = NOT A\na = AND A B\no = OR A B\nx = XOR A B\nnand = NAND A B\nnor = NOR A B\nxnor = XNOR A B\nOUTPUT NOT=n AND=a OR=o XOR=x NAND=nand NOR=nor XNOR=xnor', inputs: { A: 1, B: 0 } },
  'computer-nand': { mode: 'gates', source: '; XOR from four NAND gates\nINPUT A B\np = NAND A B\nq = NAND A p\nr = NAND B p\nx = NAND q r\nOUTPUT X=x', inputs: { A: 1, B: 1 } },
  'computer-boolean': { mode: 'gates', source: '; Majority: any two votes enable Y\nINPUT A B C\nab = AND A B\nac = AND A C\nbc = AND B C\npair = OR ab ac\ny = OR pair bc\nOUTPUT Y=y', inputs: { A: 1, B: 0, C: 1 } },
  'computer-adders': { mode: 'gates', source: `INPUT A B CIN\n${fullAdder('f', 'A', 'B', 'CIN')}\nOUTPUT S=fs COUT=fc`, inputs: { A: 1, B: 1, CIN: 1 } },
  'computer-arithmetic': { mode: 'gates', source: `INPUT ${busInputs} CIN\n${ripple()}\nOUTPUT S0=f0s S1=f1s S2=f2s S3=f3s COUT=f3c`, inputs: { A0: 1, A1: 1, A2: 1, A3: 0, B0: 1, B1: 0, B2: 0, B3: 0, CIN: 0 } },
  'computer-routing': { mode: 'gates', source: `INPUT A0 A1 D0 D1\n${decoder}\ny = MUX D0 D1 A0\nOUTPUT W0=w0 W1=w1 W2=w2 W3=w3 Y=y`, inputs: { A0: 1, A1: 0, D0: 0, D1: 1 } },
  'computer-alu': { mode: 'gates', source: `; OP1:OP0 = 00 AND, 01 OR, 10 XOR, 11 ADD\nINPUT ${busInputs} CIN OP0 OP1\n${ripple()}\n${Array.from({ length: 4 }, (_, i) => `and${i} = AND A${i} B${i}\nor${i} = OR A${i} B${i}\nxor${i} = XOR A${i} B${i}\nlo${i} = MUX and${i} or${i} OP0\nhi${i} = MUX xor${i} f${i}s OP0\ny${i} = MUX lo${i} hi${i} OP1`).join('\n')}\np01 = OR y0 y1\np23 = OR y2 y3\nnz = OR p01 p23\nz = NOT nz\nadd = AND OP0 OP1\nc = AND f3c add\nOUTPUT Y0=y0 Y1=y1 Y2=y2 Y3=y3 Z=z C=c`, inputs: { A0: 1, A1: 1, A2: 0, A3: 0, B0: 1, B1: 0, B2: 1, B3: 0, CIN: 0, OP0: 1, OP1: 1 } },
  'computer-latches': { mode: 'latch', source: '; NOR latch: Q = NOT(R OR Qbar); Qbar = NOT(S OR Q)\n; Use the S / R controls to inspect settled behavior.', inputs: { S: 0, R: 0 } },
  'computer-registers': { mode: 'gates', source: `; DFF data enable synchronous-reset\nINPUT D0 D1 D2 D3 EN RST\n${Array.from({ length: 4 }, (_, i) => `q${i} = DFF D${i} EN RST`).join('\n')}\nOUTPUT Q0=q0 Q1=q1 Q2=q2 Q3=q3`, inputs: { D0: 1, D1: 0, D2: 1, D3: 0, EN: 1, RST: 0 } },
  'computer-memory': { mode: 'gates', source: `; Four addresses, one bit per address\nINPUT A0 A1 D WE RST\n${decoder}\n${Array.from({ length: 4 }, (_, i) => `en${i} = AND w${i} WE\nq${i} = DFF D en${i} RST`).join('\n')}\nlo = MUX q0 q1 A0\nhi = MUX q2 q3 A0\ny = MUX lo hi A1\nOUTPUT DATA=y Q0=q0 Q1=q1 Q2=q2 Q3=q3`, inputs: { A0: 1, A1: 0, D: 1, WE: 1, RST: 0 } },
  'computer-cpu': { mode: 'cpu', source: '; Follow fetch, decode and execute\nLDI 3\nADDI 5\nOUT\nHLT', inputs: {} },
  'assembly-encoding': { mode: 'cpu', source: '; Same value in binary, hex and decimal\nLDI 0b1010\nOUT\nLDI 0xA\nOUT\nLDI 10\nOUT\nHLT', inputs: {} },
  'assembly-memory': { mode: 'cpu', source: '; Preserve a value before replacing A\nLDI 6\nSTA 3\nLDI 2\nADD 3\nSTA 4\nLDA 3\nOUT\nLDA 4\nOUT\nHLT', inputs: {} },
  'assembly-flags': { mode: 'cpu', source: '; Four-bit overflow wraps to zero\nLDI 15\nADDI 1\nJC carry\nLDI 7\ncarry: OUT\nSUBI 1\nOUT\nHLT', inputs: {} },
  'assembly-loops': { mode: 'cpu', source: '; Count down without changing flags between SUBI and JZ\nLDI 3\nloop: OUT\nSUBI 1\nJZ done\nJMP loop\ndone: HLT', inputs: {} },
  'assembly-real-isas': { mode: 'cpu', source: '; Compare with the RISC-V reference in the course\nLDI 3\nloop: SUBI 1\nJZ done\nJMP loop\ndone: OUT\nHLT', inputs: {} },
  'computer-capstone': { mode: 'cpu', source: sumProgram, inputs: {} },
}

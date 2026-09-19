# Computer architecture and assembly

`/computer-architecture` is an open eighteen-course path linked from Courses, Tutorials and the
home footer. `?stage=assembly` selects six assembly courses. `/computer-architecture/:lessonId`
has four sections with worked examples and independent checkpoints, a guided experiment, a build
transfer guide, an applied challenge and a five-question 80% exam: 72 sections/checkpoints and
90 exam questions. Preparation is recommended, not an unlock gate.

The first eight courses emphasize bits/buses, gate truth tables, NAND composition, Boolean design,
full adders, ripple arithmetic, muxes/decoders and a gate-level ALU. Four introduce SR latches,
DFFs/registers, addressable memory and CPU control. Six teach assembly encoding, immediate/memory
operands, flags/masks, branches/loops, transfer to RV32I and a programmable-computer capstone.
The capstone sums 4+3+2+1 using RAM and conditional branches.

Every course explains transferring its logical contract to redstone or another medium. Minecraft
placement, edition-specific updates, propagation, clock timing and physical builds require separate
validation. No game engine, world/schematic export or native assembly runtime is implemented. RV32I
examples are reference reading, not executed by this application. Original explanations link to
Nand2Tetris, Computation Structures, Minecraft Creator and the versioned RISC-V specification reviewed
on 2026-09-19. This does not implement the Hack ISA.

## Deterministic models

`frontend/src/engine/computer/{logic,cpu,presets}.js` are pure Node-compatible modules without DOM,
network, timers, filesystem, eval or native execution. Their bounded computations run synchronously.
The engine has its own lazy `computer-model` chunk. Example editable circuit:

```text
INPUT A B
p = NAND A B
q = NAND A p
r = NAND B p
x = NAND q r
OUTPUT Y=x
```

Signals are case-sensitive identifiers beginning with a letter (maximum 32 characters). Constants
are `0` and `1`. Uppercase gates: BUF, NOT, AND, OR, XOR, NAND, NOR, XNOR, MUX and DFF.
`MUX data0 data1 select` chooses data1 for select=1. `DFF data enable reset` is one bit with an
implicit common rising edge, synchronous active-high reset and reset priority over enable. All DFFs
sample pre-edge inputs before any Q is committed. New runs start Q at zero. Feedback through DFF
is valid; combinational cycles (even disconnected), duplicates, missing signals and bad arity fail.

Bounds: 16,384 source characters, 16 input bits, 256 gates, 16 outputs and 256 manual edges. Truth
tables exhaust up to six inputs/64 rows and reject storage. Diagrams support up to 80 gates; the
signal table covers every permitted circuit. Depth counts ideal dependency stages, not physical
delay. Input changes recompute combinational values while preserving Q. Source edits invalidate all
observations, including truth tables and stored state. Unknown source is never host-evaluated.

The separate active-high NOR latch models settled behavior: 10 sets, 01 resets, 00 holds. With 11,
both physical NOR outputs are zero but the stored logical bit becomes unknown. Releasing both keeps
it unknown until valid set/reset. No analog metastability is simulated. Edited S/R are explicitly
pending until Apply; an older result retains the inputs actually applied.

## VQ4 teaching ISA

VQ4 has A/PC/OUT (4 bits), IR (8 bits), Z/C (one bit), separate 16×8 ROM and 16×4 RAM. Instructions
are bytes: high nibble opcode, low nibble operand. No stack, general register file, indirect
addressing, system calls, native memory access or OS is implemented.

| Opcode | Instruction | Execute effect |
| --- | --- | --- |
| 0 | NOP | Preserve state |
| 1 | LDI n | A = literal n; update Z, clear C |
| 2 | LDA n | A = RAM[n]; update Z, clear C |
| 3 | STA n | RAM[n] = A; preserve flags |
| 4 / 5 | ADD n / SUB n | Add/subtract RAM[n]; update Z/C |
| 6 / 7 / 8 | AND n / OR n / XOR n | Bitwise RAM[n] operation; update Z, clear C |
| 9 | JMP n | PC = n |
| A / B | JZ n / JC n | PC = n only if the named flag is one |
| C | OUT | Copy A to OUT and output history |
| D | HLT | Halt until a fresh run |
| E / F | ADDI n / SUBI n | Add/subtract literal; update Z/C |

Arithmetic uses four composed full-adder slices and wraps modulo 16. Subtraction is A+NOT(B)+1;
C=1 means **no unsigned borrow**. Z means A=0; no signed-overflow flag exists. Jumps, stores, OUT,
NOP and HLT preserve flags. PC increments modulo 16; unused ROM words contain HLT. Reset zeros
A/PC/IR/OUT/RAM, sets Z=1/C=0 and starts fetch.

Each instruction takes three model clocks: fetch (IR=ROM[old PC], PC++), decode, execute. CPU
execution uses actual assembled words. Source mnemonics/labels are case-insensitive; semicolon
comments and labels consume no ROM. Decimal/0x/0b operands must be 0–15. Only branches accept code
labels. Bad instructions/arity, duplicate/undefined labels, out-of-range targets and programs
outside 1–16 instructions fail. Executable assembly is limited to 8,192 source characters.

Runs stop at 768 cumulative clocks, including manual steps; this is visibly distinct from HLT.
Trace retains the latest 96 clocks and output history the latest 64 values, with truncation flags.
Rows record the executed phase, controls, PC/A before and after, IR, flags and OUT. RAM is inspectable.

## Notebook and course integration

`/sandbox?bench=computer&lesson=<id>` opens an independent experiment. `voltquest-computer` version 1
contains exactly `{format,version,lesson,source,inputs,notes}`, saved under `vq.computer.v1.<lesson>`.
It does not extend CircuitDoc, board ids, account projects, public course APIs, MCP or showcase.
Unfinished source can be saved/exported but not executed. Source allows 16,384 characters, notes
10,000, inputs sixteen named bits; imports are capped at 96 KiB UTF-8. Invented results/rewards are
discarded. Course pages accept only their own lesson notebooks; the free bench permits other presets.
Load/import/restore/preset changes confirm replacement. Intervening edits invalidate async imports.

Observation exports contain actual applied input/results or actual assembled program/CPU state,
not resumable execution claims. `.logic` and `.asm` downloads exactly match the editor. Scores and
reading checks reuse `vq.courses.v1`; rewards follow [LEARNING_REWARDS.md](LEARNING_REWARDS.md).
Interface controls support Indonesian with a disclosed English curriculum/technical fallback.
Switching locale retains source, input bits, results, notes and assessment choices.

## Verification

Tests exhaust gate tables, full-adder triples, four-bit operands/carries, ALU operands/operations,
and verify simultaneous DFF updates, feedback, hold/reset, isolated RAM writes, invalid latch release,
parsing bounds, every opcode, both branch outcomes, PC wrap, run limits and all authored assembly
results. Alternative capstone inputs test overflow. UI coverage includes editing, live signals,
diagrams, clocking, errors, exact downloads, notebook replacement, fake-evidence removal, assessments,
locale retention and rewards. See IMPLEMENTATION_STATUS.md for release-gate and browser evidence.

# AVR assembly track and assembler IDE

`/avr` and `/avr/:lessonId` provide eight AVR 8-bit assembly courses (`content/avr.json`), each with four
sections, a practice question per section, a guided starter, an applied challenge and a five-question
80% exam using the shared `vq.courses.v1` progress and the certificate system (added to the
certificate `CATALOGUES` in `backend/app/services/certificates.py`). The AVR assembler IDE is
available directly as a sandbox bench at `/sandbox?bench=avr` (with `/sandbox?bench=computer&asm=1`
preserved as a compatible route), and the computer hub links to both the track and the IDE.

## Engine (`engine/avr/`)

- `assembler.js` — a teaching-subset AVR assembler: labels, `.equ/.def/.org/.set/.cseg`, ~45
  instructions, and 16-bit opcode encoding for the implemented mnemonics (branches resolve to signed
  relative offsets). Unencoded mnemonics (LD/ST/LDS/STS) show `----` in the listing. Pure; throws
  `Line N:` on errors.
- `cpu.js` — a deterministic ATmega simulator: 32 registers, SREG status flags (C, Z, N, V, S, H, I;
  the T bit-transfer flag is not modeled) with documented
  AVR flag semantics, a small data space (registers 0x00–0x1F, I/O 0x20–0x5F, SRAM from 0x60), the
  stack, X/Y/Z pointers, PORTB output capture and a cycle counter. `step` runs one instruction;
  `run` runs to RET-with-empty-stack, BREAK, the end, or the step limit.
- `model.js` — `assemble`, `assembleAndRun`, `listing`, `createMachine`, `step`, `run`, `flags`, the
  instruction `REFERENCE` and highlighter lists (`MNEMONICS`, `IO_NAMES`, `DIRECTIVES`).

It is a documented subset, not a full toolchain: no program memory/LPM, interrupts, timers, EEPROM,
16-bit ADIW/MUL, or cycle-exact timing. The same programs assemble with avr-gcc/avra and run on real
hardware. `avr.test.js` checks known opcodes, flag cases, loops, pointers, call/return, stepping and
the listing; every course starter is asserted to assemble and run.

## IDE (`features/computer/AvrIde.jsx`)

A Microchip/Atmel-Studio-style view on the shared VS Code workbench (`features/sandbox/ide/`,
dark/light): AVR editor with live assemble markers, an opcode listing (address · opcode · source) with
the current instruction highlighted, and a machine pane with registers, SREG flags, data memory, PORTB
output and an instruction reference. Assemble & run, Step and Reset drive the simulator; Save/Load/
Import/Export and Download .asm manage the `voltquest-avr` notebook (`vq.avr.v1.<lesson>`), and the
sandbox registers unsaved work with the bench guard. `AvrPage.jsx` is the `/avr` hub and course shell
(sections, exam, certificate) embedding the IDE; `AvrIde` is also embedded on each course page.

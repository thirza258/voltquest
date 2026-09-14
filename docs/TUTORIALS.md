# Interactive tutorials

The hub also links to **High-performance computing in C & C++** at `/hpc`: ten detailed courses
with numerical/model experiments, native source and tests, practice questions and exams.
`/sandbox?bench=hpc` is independent of firmware circuits and their 106 board variants. See [HPC.md](HPC.md).

`/tutorials` is the searchable tutorial hub; `/tutorials/:tutorialId?board=<boardId>` opens a
guided simulation. The campaign remains at `/` and links prominently to the tutorial hub.
The shared header includes Tutorials. These routes are lazy-loaded.
The hub also links to self-study courses at `/courses`, with lessons, worked examples, practice
questions and exams. See `COURSES.md`; courses link to related labs without altering their circuits.

The shared `content/tutorials.json` currently contains 41 tutorials: ten Uno/Nano hardware lessons,
eight ESP32/ESP32-S3 hardware lessons, seven Raspberry Pi 4/5 lessons and ten C++ programming
lessons shared by Uno, Nano, ESP32 and ESP32-S3, plus three IoT foundation and three drone lessons.
Each board has an ordered
Easy → Intermediate → Hard learning path. Board, difficulty and search filters are reflected
in the URL. Lessons remain available without an API connection because the frontend bundles
the same content the backend serves.

The programming shortcut on the hub opens all ten C++ lessons. Easy covers sketch structure,
variables/types, arithmetic and conditions; Intermediate covers functions, loops and arrays;
Hard covers non-blocking timing, serial command parsing and state machines. Examples explain
expected output and include an editing challenge. Code-only lessons intentionally require no
jumper cables; the timing and state-machine lessons include a resistor-and-LED circuit.

There are 22 lessons available per Uno/Nano board, 24 per ESP32 board, and seven per Raspberry Pi
board: 106 runnable tutorial/board combinations in total. `programming.test.js` additionally verifies
explained numeric output, serial command handling, timing and state transitions on all four C++ boards.

## Content contract

Each tutorial carries:

```text
id, title, boards[], preset, summary, concepts[], minutes,
difficulty: Easy | Intermediate | Hard, order, language: cpp | python,
code, codeOverrides?: { [boardId]: code },
steps: [{ title, text }], challenge,
hardwareConcepts: [{ title, text }], programConcepts: [{ title, text }]
```

`boards` must contain implemented board ids. `codeOverrides` handles actual pin differences,
including ESP32-S3's ADC and DHT data pins. Difficulty is part of the authored content rather
than inferred from reading time. Lessons include at least three steps, two hardware concepts
and two program explanations. Steps can be marked complete locally for the current page visit;
they do not grant campaign XP or persist tutorial completion.

`preset` is one of `empty`, `led`, `button`, `pot`, `touch`, `servo`, `lcd`, `dht`, `traffic`.
`features/tutorials/circuits.js` builds a CircuitDoc with real registry parts and deterministic
ids. ESP32 boards use a dual breadboard, keeping auxiliary parts clear of the wider MCU footprint.
Every listed tutorial/board combination is exercised by `circuits.test.js` through the actual
simulation. Adding a tutorial also adds its runnable variants to this regression test.

## Tutorial page

Before the simulation, **Fundamentals behind this tutorial** explains the underlying principle,
connects it to the example and suggests an observation. A separate-tab link opens the corresponding
guide and exact course-section links in Courses. These supplementary guides come from
`content/tutorial-fundamentals.json`, cover every tutorial and are translated into Indonesian.
They leave the current board, edited code, checked steps and simulation mounted. See COURSES.md
for the shared guide schema and the robotics/vision coverage.

The page provides editable source, Run/Stop, Reset, Restore example, a live circuit and serial
or Python output. Control inputs on the prepared circuit remain interactive. HTTP lessons include
a virtual GET request form, and network lessons display WiFi and MQTT state. Firmware runs in a
Web Worker; the deterministic inline fallback is driven by the page for environments without Worker.

Below the simulation, Hardware concepts explain current paths, polarity, supplies, signal roles
and limits. Program concepts explain execution order, variables, timing, state and relevant APIs.

The placement table derives every component terminal's real breadboard hole from
`registry.resolvePins`; the cable table derives its endpoints from the very same CircuitDoc used
by the solver. No second, manually maintained wiring diagram can drift from the simulation.
Cable plugs use unoccupied holes on the same connected strip as each component leg, not holes already
occupied by a leg or another cable. The placement cards and cable table deliberately show different
hole letters where appropriate (for example, resistor leg a20 and jumper b20).
Raspberry Pi endpoints include both BCM and physical header numbers. Selecting a cable highlights
its two endpoints and scrolls the circuit into view. Text explains the a–e/f–j row connections,
center trench, independent rails and the distinction between cable color and electrical connectivity.

The Raspberry Pi canvas drawing is an explicitly simplified GPIO teaching diagram, with all 40
physical pin numbers and live damage/power indicators. It is not a mechanically exact board drawing.

Prepared tutorial wiring is read-only; editing code and operating buttons/sensors are supported.
Tutorial rewiring and persistent lesson progress remain optional extensions. The separate campaign
and sandbox workspaces now provide Monaco/Blockly, freeform wiring, and the virtual ESP32 phone.

## API

`GET /api/tutorials?board=&difficulty=&q=` returns `{ tutorials, total }`, ordered by difficulty
then authored order. Filters are optional; board and difficulty values are validated.
`GET /api/tutorials/{id}` returns the full tutorial or 404. Both endpoints are public and tolerate
missing tutorial content by returning an empty list / 404.

## Localization and AI guidance (2026-09-12 extension)

The header switches between English (default) and Indonesian without remounting the tutorial lab.
All 35 lessons have translated titles, summaries, steps, challenges, and hardware/program concepts;
their source code and output remain unchanged. Search matches both original and translated text.

The circuit section includes the shared AI guide and Claude Code/Codex MCP setup. Selecting a part
opens its read-only inspector; selecting a wiring-guide row focuses that cable in assistant context.
Every question snapshots the current edited code, board, prepared circuit, live simulation and checked
steps. Explicit Share current context makes the same snapshot available to a connected coding agent,
which can create a separate saved sandbox project. Tutorial circuits remain read-only and no XP or
persistent tutorial completion is introduced. See `ASSISTANT.md` for configuration and boundaries.

## 2026-09-13 curriculum extensions

The six-board catalogue now contains 41 tutorials and 106 tutorial/board combinations. Three new IoT
labs teach hysteresis sense/act, explicit telemetry units and HTTP command/status endpoints; the
access-point lesson uses `WiFi.softAP`. The new IoT potentiometer presets orient the endpoints so a
higher interactive control value produces a higher ADC value; old presets retain their behavior.
Three drone labs teach IMU tilt, props-off ESC signals and assisted hover/landing on ESP32 and ESP32-S3.
Drone tutorials use `kind:'drone'`, prepared read-only assemblies and `DroneLessonBench` with local
simulation refs. They share the existing flight engine, include socket tables, and preserve interactive
tilt/transmitter/serial controls. Tutorial diagrams must not write to global document/simulation stores.
`http:true` enables the HTTP form for additional IoT lessons.

The 22-course path adds explicit theory/formulas and links to these labs; see COURSES.md.
Five robotics tutorials and six computer-vision courses/labs have dedicated hubs and distinct sandbox
formats; see ROBOTICS.md and VISION.md. They are not counted as six-board firmware tutorial variants.
The vision capstone connects prepared IoT and drone firmware to real virtual inputs plus the robot model.

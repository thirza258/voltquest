# VoltQuest — agent handoff log

**Last verified: 2026-09-11.** This is the state document: what exists, what remains unfinished,
and what to do next. The specifications in `docs/` remain binding.

| Read | When |
| --- | --- |
| `docs/CONTRACTS.md` | Always, first: exports, data shapes and integration contracts. |
| `docs/ARCHITECTURE.md` — Module ownership | Before changing a package. |
| `docs/INTEGRATION_NOTES.md` | Before connecting packages; includes runtime and tutorial discoveries. |
| `docs/QUEST_SCHEMA.md` | Before authoring campaign levels. |
| `docs/API.md` | Before touching the backend. |
| `docs/DESIGN.md` | Before visual/UI changes. |
| `docs/TUTORIALS.md`, `docs/RASPBERRY_PI.md` | Before editing tutorials or Pi support. |

## 1. Current build, not the target product

The main entry point for a working interactive experience is **`/tutorials`**.
There are **35 tutorials**, ordered Easy → Intermediate → Hard, with editable code,
real simulation, explanations of program and hardware concepts, exact breadboard placement,
cable endpoint tables and click-to-highlight wiring. The circuit is prepared/read-only, but
buttons, pots, touch and sensor controls remain interactive.

Ten tutorials form an Arduino/ESP32 C++ programming path:
- Easy: setup/loop, variables/types, arithmetic, conditions.
- Intermediate: functions, loops, arrays.
- Hard: non-blocking timing, serial command parsing, state machines.

The other 25 lessons cover ten Uno/Nano circuits, eight ESP32/ESP32-S3 topics and seven Pi
Python/GPIO topics. Each Uno/Nano offers 20 lessons, each ESP32 offers 18, and each Pi offers seven.
All **90 tutorial/board combinations** are exercised through the real inline simulation.
The hub has search, board/difficulty filters and a programming-path shortcut.

Supported board ids: `uno`, `nano`, `esp32`, `esp32s3`, `raspberrypi4`, `raspberrypi5`.
The user explicitly requested **Raspberry Pi 4 / 5, not Pico**. Pi uses a restricted Python GPIO
learning model with a 40-pin header, not Linux/CPU emulation or arbitrary Python execution.
The canvas has a simplified Pi teaching diagram with all physical pin numbers.

`/` now renders the real campaign map and links prominently to tutorials.
**Campaign play, sandbox, showcase, profile and leaderboard pages are still unfinished** and
render explicit coming-soon pages rather than pretending to work. Only three campaign quests exist.
The README now has a Current build notice; its product overview still describes the target experience.

There is still **no git repository**. Do not assume a diff/history exists and do not initialize or
commit without the user's explicit request.

## 2. Verification

Latest full `make check`:
- **630 frontend tests in 38 files pass.**
- **45 backend tests pass.**
- Production build succeeds; initial JS payload is **221.2 KiB gzipped**, below the 1500 KiB budget.
- ESLint has no errors. Two existing exhaustive-deps warnings remain in
  `features/campaign/CampaignMap.jsx:82`; these are unrelated to the tutorial/runtime work.
- Node prints the existing jsdom/localStorage warning; persistence tests use the memory-storage helper.

Browser verification uses the actual Web Worker path, separate from the inline/jsdom tests.
The desktop hub, home navigation, ESP32 serial commands, Raspberry Pi 5 Run/cable highlighting,
and mobile width were checked in isolated Chrome. The header now switches to a native select on
small screens; tutorial pages fit a 390 px viewport without page-level horizontal overflow.
Uno Run and the ESP32 virtual HTTP request were also verified; GET /on returns 200 and LED on.

Run the tests, not just a build, after touching source examples: compilation alone does not prove
their explanation or timing is correct. `features/tutorials/programming.test.js` asserts expected
numeric output, command dispatch and LED state transitions on all four C++ boards.

## 3. Completed in this continuation

### Runtime — E2
The entry-point stub is gone. `engine/runtime/index.js` assembles the interpreter, Arduino API,
pin resolver, UART, scheduler, peripherals and virtual networking, with lifecycle/reset, diagnostics,
pin/read/serial batching, interrupt callbacks and snapshots.

The old handoff incorrectly described the libraries as built: their index imported missing files.
Adapters now exist for Servo, Wire, I2C LCD, NeoPixel, DHT, BME280, SSD1306, WiFi, WebServer,
PubSubClient and ESP32 APIs. These implement a teaching subset, not full upstream compatibility.
OLED has a 1024-byte page framebuffer and a simplified font.

Scheduler fixes pump network/timer events during VM sleeps, defer first execution until the initial
environment arrives, and handle restart generations. AVR/ESP32 formatting now rounds decimals once.
ESP input-only pins reject output/PWM. GPIO and DAC messages use the correct simulation units.
Runtime, pin, serial, network, Arduino and library modules now have direct tests.

### Pi model — C / E2
`engine/boards/raspberrypi.js` contains Pi 4/5 profiles and the 40-pin physical/BCM mapping.
MCU definitions are free-mounted; there is no ADC, DAC or built-in user LED.
`runtime/python.js` translates a deliberately restricted Python syntax into the cooperative VM.
`runtime/libraries/raspberrypi.js` implements the supported gpiozero and RPi.GPIO-style calls.
Original Python line numbers survive diagnostics. See `RASPBERRY_PI.md` for exact limits;
do not imply support for arbitrary imports, Python functions, Linux, networking or camera simulation.

### Simulation integration — F
`engine/headless.test.js` now executes all three authored reference solutions through solver,
runtime and validator; all pass. This is the regression net for future authored quests.

### Tutorial UI — H2 / H1
`features/tutorials/`: hub, detail lab, deterministic circuit presets, code variants and wiring guide.
`content/tutorials.json` is shared with the backend. `content/index.js` bundles/sorts lessons.
`App.jsx` lazy-loads tutorial routes; the campaign and shared header link to them.
The editor is an ordinary accessible textarea, not Monaco; source lines do not visually wrap.
The lab has serial input/output, a virtual HTTP GET form for the web lesson, and WiFi/MQTT status.
Step checkmarks last for the current page visit only; tutorial completion does not award XP.

### Backend — A
Public board discovery and tutorial list/detail endpoints are registered:
`/api/boards`, `/api/tutorials?board=&difficulty=&q=`, `/api/tutorials/{id}`.
Project create/update validates board ids, matching MCU, component type shapes, controller count,
Pi text-only editor mode and 200 KiB UTF-8 field limits. Partial updates validate merged state
before mutation. Save/publish/filter/fork round trips are tested for all six board ids.
Unknown showcase board filters are rejected. The frontend API client includes the new endpoints.

## 4. Remaining work, ordered by impact

### 4.1 Campaign workspace — H1
Build `features/workspace/WorkspacePage.jsx` to assemble the canvas, objectives, sim controls,
code editor and briefing/success flow. Existing hooks (`useLevelSession`, `useKeyboard`,
`useToneAudio`), stores, header, objectives and campaign map are available.
The tutorial lab proves the engine integration but is not a replacement for a quest workspace.
Wire guest/session initialization, offline progress and account UX as part of that work.

### 4.2 Editors, sandbox and sharing UI — H2
Monaco language setup, Blockly definitions and generator exist; editor components do not.
The full virtual phone, freeform sandbox/component drawer, export UI, gallery/forking,
profile and leaderboard pages remain unbuilt. Backend endpoints exist.
Keep Monaco, Blockly and the phone behind lazy boundaries to preserve the payload budget.

### 4.3 Remaining 11 campaign levels — B
Authored: `w1-l1` First Glow, `w1-l2` The Shield, `w1-l3` The Gatekeeper.
Missing: `w1-l4`, `w2-l1`–`w2-l5`, `w3-l1`, `w4-l1`–`w4-l4`.
Worlds already list all 14 ids. Preserve the intentional filter that omits unauthored levels.
Follow `QUEST_SCHEMA.md`, include a reference solution and let the headless test discover it.

### 4.4 Tutorial follow-ups
Optional next improvements: persistent lesson progress, lesson-to-lesson navigation, a full code editor,
and user-controlled rewiring mode. Do not silently expand Pi's advertised language support without
implementing/testing it and updating its docs. Pi board drawing is intentionally schematic.

### 4.5 Explicitly out of scope
Educator Portal, Custom Component Creator, virtual oscilloscope, ESP32-S3 camera/AI levels,
and cloud compilation remain out of scope per CONTRACTS §13.

## 5. Ground rules

1. **No TypeScript.** Plain JS and JSDoc; no new type build step.
2. **Engine must run in plain Node.** No DOM, window or Worker in deterministic modules.
   Only `engine/sim/sim.worker.js` touches `self`. Realtime scheduling is injected; deterministic
   runtime/tests do not access wall time or schedule host timers.
3. **Code against the docs contracts.** Correct a wrong contract in the same change and record
   integration discoveries in `INTEGRATION_NOTES.md`.
4. **Every package ships adjacent tests.** Vitest for JS/JSX, pytest for backend.
5. **No cloud compilation or avr8js.** Firmware and the Pi subset run client-side on the in-house VM.
   Do not execute user code on the backend or CDN-load Monaco.
6. **Power is on at idle.** Run starts firmware and implies reset.
7. **Update this handoff after a completed chunk**, including verification and remaining work.

## 6. Commands and gotchas

```bash
make install     # dependencies and Python venv
make dev         # API :8000 and frontend :5173
make test        # vitest + pytest
make check       # eslint + vitest + build + payload budget + pytest
make up-lite     # Docker SQLite stack :8080
```

Targeted frontend: `cd frontend && npx vitest run src/path/to/file.test.js`.
Backend: `cd backend && .venv/bin/python -m pytest -q`.

- jsdom localStorage can be a bare object: use `installMemoryStorage()` from
  `src/test-utils/localStorage.js` in persistence tests.
- Component tests begin with `// @vitest-environment jsdom`, then
  `// @vitest-environment-options { "url": "http://localhost:5173" }`.
- Never add a `types { }` block inside nginx's server/location; it replaces inherited MIME types.
- `seeds.mcuOf(doc)` returns a component object; `place()`/`placeFree()` return id strings.
- SVG CSS stays inside `CanvasStyles.jsx` so exported PNGs retain styling.
- ESP32-S3 auxiliary tutorial parts belong on bb2 to avoid the MCU footprint.
- Tutorial wiring instructions must derive from `resolvePins` and the actual CircuitDoc, not a
  separately maintained diagram that can drift.
- Cable ends must use free holes on the same strip as component legs, not occupied leg holes.
  `tutorialCircuit` allocates these holes and tests reject duplicate/occupied cable plugs.

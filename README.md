# VoltQuest

## Current build

Start with **`/tutorials`**: 35 runnable tutorials progress from Easy through Intermediate to Hard,
including ten Arduino/ESP32 C++ programming lessons and Raspberry Pi 4/5 Python GPIO lessons.
Each lesson includes editable code, a live simulation, program and hardware explanations, and exact
breadboard/cable instructions where components are needed. Supported boards: Uno, Nano, ESP32,
ESP32-S3, Raspberry Pi 4 and Raspberry Pi 5. Pi support is a restricted GPIO learning model, **not a
Linux emulator**; see [`docs/RASPBERRY_PI.md`](docs/RASPBERRY_PI.md) and [`docs/TUTORIALS.md`](docs/TUTORIALS.md).

The **32-quest campaign**, freeform **sandbox**, local **Monaco/Blockly editors**, **virtual phone**,
**showcase with interactive previews and forking**, and **profile/leaderboard** are implemented.
Sandbox projects support account saves, independent local drafts, JSON import, JSON/PNG/code/BOM
exports, and public sharing. Campaign progress and settings recover after connectivity returns.
English is the default, with a persistent Indonesian switch. The circuit's **AI** section offers
OpenRouter guidance from the current code, wiring and inspector, plus **Claude Code / Codex MCP**
setup for creating and editing saved projects. See [assistant setup](docs/ASSISTANT.md) for the
server key, agent configuration and context-sharing workflow.
See [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) for implementation evidence
and [`AGENTS.md`](AGENTS.md) for the current verification results and remaining release checks.

**Custom Drone Builder:** open `/sandbox?bench=drone` to configure a quad-X, wire named mounts and connectors, edit flight code, and fly with the virtual transmitter. Includes 3/5/7-inch presets, live estimates, blackbox plots, replay/slow motion, course editing, public forks and a ZIP build pack with wiring/BOM/sketch/checklist. See [the drone guide](docs/DRONE.md) for controls, firmware APIs, coefficient assumptions and verification limits.

## Product overview

**Learn electronics and Arduino programming by playing.** VoltQuest is a browser-based, gamified
electronics lab: you wire components onto an interactive breadboard, write real Arduino C++ (or drag
code blocks), press **Run**, and watch the circuit come alive — LEDs glowing in proportion to actual
current, servos sweeping, an ESP32 serving a web page to a simulated phone. Nothing is installed and
nothing can be destroyed for real, so the classic beginner mistakes become the lesson rather than a
trip to the shop: wire an LED straight across 5 V and it emits a puff of magic smoke, with a hint
explaining why it needed a resistor.

The product is specified in `Product Requirements Document (PRD) Addendum_ Multi-MCU & ESP32
Integration.md` in this repo, and built to the module contracts in [`docs/`](docs/). It covers both
tracks the PRD asks for: the 5 V **Arduino Uno / Nano** world, and the 3.3 V **ESP32** world where
the headline mechanic is the voltage trap — feed an ESP32 GPIO 5 V and the pin chars black, so you
have to reach for a voltage divider or a level shifter, exactly as on a real bench.

---

## Quick start with Docker

Requires Docker with Compose v2.

```bash
git clone <this repo> && cd voltquest
cp .env.example .env          # optional: set JWT_SECRET for anything shared
docker compose up --build     # first build takes a few minutes
```

Open **<http://localhost:8080>**. That is the whole install: nginx serves the built client and
proxies `/api` to the FastAPI service, which persists to PostgreSQL.

Prefer to skip the database container? The lite stack keeps a SQLite file in a named volume and is
what you want for a single machine or a classroom laptop:

```bash
docker compose -f docker-compose.lite.yml up --build
```

Stop either stack with `make down`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEB_PORT` | `8080` | Host port for the web client |
| `JWT_SECRET` | `dev-secret-change-me` | Signs player tokens — **change this** outside local use |
| `POSTGRES_PASSWORD` | `voltquest` | Database password (full stack only) |
| `CORS_ORIGINS` | `http://localhost:8080,http://localhost:5173` | Browser origins allowed to call the API |

---

## Feature tour

**A 32-level campaign across seven worlds.** *The Spark of Life* teaches power, LEDs, resistors and
buttons (starting with the deliberate magic-smoke failure and its fix). *Signals and Rhythms* covers
Morse-code timing, an LDR voltage divider, PWM dimming, transistor motor driving, and a Simon Says
boss level. *The Power Swap* is the transition boss: move a working 5 V circuit onto an ESP32,
protect its 3.3 V GPIO from a 5 V ultrasonic sensor with a divider, and re-scale your code from a
10-bit to a 12-bit ADC. *The Connected World* is the ESP32 IoT academy — capacitive touch, a NeoPixel
ring, a Wi-Fi controlled switch, and a weather station streaming over MQTT. *Rotor Rising* adds six custom-drone quests: props-off ESC tests, propulsion estimates, motor mapping, IMU readings, rate PID and a gate-course flight.

*Responsive Machines* adds six **intermediate** Uno challenges: button debounce, hysteresis,
independent timers, a guarded servo, a live climate display and a crossing state machine.
*Reliable Connections* adds six **hard** ESP32 challenges: framed serial parsing, expiring HTTP
commands, MQTT acknowledgements, combined sensor thresholds, median range filtering and a connected
greenhouse capstone. Every quest has an editable starter, wiring guidance, hints and a tested solution.

**A breadboard that behaves like a breadboard.** Full-size (830 tie-point) and half-size (400)
boards on a true 0.1 in pitch, with snap-to-hole placement, continuity highlighting when you hover a
row, continuous power rails, spline-routed jumper wires in five hotkeyed colours, and rotation. Drop
an ESP32 on a single board and it covers every row — so VoltQuest offers to snap a second board
alongside and bridge the gap, teaching the real workbench trick.

**Real circuit simulation.** A modified nodal analysis solver computes the voltage at every node and
the current through every component, with piecewise-linear models for diodes and transistors, PWM
solved as a duty-weighted average of its discrete states rather than a smeared DC level, and
sticky damage: exceed a part's rating and it blows, stays blown, and the objectives panel tells you
what happened and how to fix it. Hover anything for live volts, milliamps and ohms.

**Code, two ways.** A Monaco editor with Arduino syntax highlighting and inline error markers, or
Blockly blocks that generate the same C++. Sketches execute in a Web Worker against a virtual clock,
so `millis()`, `delay()` and `micros()` behave, and the UI never stutters. A serial monitor shows
`Serial.print` output with virtual timestamps, a baud selector (mismatch it and you get the
authentic garbled output), and an input field for `Serial.read`.

**A simulated IoT stack.** The ESP32 track joins a virtual access point (`VoltNet`), and a slide-out
phone panel loads whatever your sketch serves at `http://192.168.4.1` — links, forms and `fetch`
calls route back into the simulation, so a web-controlled relay page actually toggles the LED on the
breadboard. An inspector tails Wi-Fi state, HTTP routes and MQTT topics.

**Sandbox and sharing.** A free-play canvas with the whole component drawer. Export a project as
JSON, a PNG of the board, a `.ino` sketch for a real Arduino, or a bill of materials CSV with
per-part prices and vendor links. Publish to a showcase gallery and let others fork your circuit.

**Progress that sticks.** XP and levels, one-to-three-star ratings (all objectives, then no fried
parts, then an efficiency goal), a three-tier hint system that ends in a translucent "ghost
blueprint" of the correct wiring, unlockable board skins and neon wire palettes, and a leaderboard.
Play starts immediately as a guest and progress survives a backend outage in local storage, so you
can claim a username later without losing anything.

---

## Local development

```bash
make install    # npm ci + a python venv from backend/requirements.txt
make dev        # API on :8000, Vite on :5173 with /api proxied
```

Open <http://localhost:5173>. Other useful targets:

```bash
make test       # vitest + pytest
make lint       # eslint
make check      # full gate: lint, tests, build, initial-payload budget, backend tests
make help       # every target
```

`make check` is the gate CI should run. Besides lint and tests it enforces the PRD's load-time
budget by gzipping the JavaScript that `index.html` pulls eagerly and failing if it exceeds 1500 kB —
which is what keeps Monaco, Blockly and the phone panel behind lazy chunks.

---

## Architecture

```
Browser (SPA)                                     Server
┌───────────────────────────────────┐              ┌──────────────────────────┐
│ React 18 + Tailwind + Zustand     │              │ FastAPI                  │
│  breadboard canvas (SVG)          │  HTTPS /api  │  players, progress, XP   │
│  Monaco + Blockly editors         │◄────────────►│  projects, showcase      │
│  objectives, hints, virtual phone │              │  BOM export, leaderboard │
├───────────────────────────────────┤              ├──────────────────────────┤
│ Simulation core (Web Worker)      │              │ PostgreSQL or SQLite     │
│  Arduino C++ interpreter + VM     │              └──────────────────────────┘
│  MNA circuit solver               │
│  quest rule validator             │              content/ (worlds, 32 quests,
└───────────────────────────────────┘               catalog, cosmetics) is read
                                                    by both client and server
```

The simulation is entirely client-side: no compile server, no round trip to run your code. The API
stores player/project data and optionally forwards circuit-assistant questions to OpenRouter.
MCP agents can save projects; firmware still executes only in the browser.

Detailed specs live in `docs/`:

| Document | Contents |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack choices, repository layout, data flow, module ownership |
| [`docs/CONTRACTS.md`](docs/CONTRACTS.md) | The binding interface between every module — board profiles, breadboard geometry, component registry, electrical models, interpreter host, runtime messages, simulation state, canvas props, stores |
| [`docs/QUEST_SCHEMA.md`](docs/QUEST_SCHEMA.md) | Level and world JSON, and every validator rule type |
| [`docs/API.md`](docs/API.md) | REST endpoints, payloads, XP formulas, database models |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Visual language, layout, keyboard map, accessibility rules |

### Project structure

```
content/            worlds.json, quests/*.json, catalog.json, cosmetics.json
backend/app/        FastAPI: routers/, models, schemas, security, content loader, xp
frontend/src/
  engine/           pure simulation, runs headless under vitest
    boards/         Uno, Nano, ESP32, ESP32-S3 pin and capability profiles
    components/     breadboard geometry + the 27-part registry
    circuit/        net extraction and the MNA solver
    interpreter/    Arduino C++ lexer, parser, VM
    runtime/        Arduino API and device libraries on top of the VM
    sim/            worker, controller, trace
    validator/      declarative quest rule engine
  canvas/           SVG breadboard, layers, per-component renderers, effects
  features/         workspace, campaign, code, iot, sandbox, showcase, profile
  ui/               design-system primitives and Chip the mascot
```

---

## Deliberate deviations from the PRD

The PRD names specific technologies; three were swapped for ones that serve the same requirement
better, and the choices are load-bearing enough to call out.

**Firmware execution: a purpose-built Arduino C++ interpreter instead of `avr8js` plus a cloud
build farm.** `avr8js` executes compiled AVR machine code, which requires a compiler service —
hundreds of megabytes of toolchain per architecture, and for the ESP32 the PRD itself concedes
in-browser compilation is infeasible and proposes a Dockerised `arduino-cli` pool. A single
interpreter instead keeps the PRD's own hard constraint (NFR: "100 % client-side execution", zero
setup on locked-down Chromebooks), makes **Run** instant with no network round trip, covers both the
5 V AVR and 3.3 V ESP32 tracks with one engine, and models the pedagogy the curriculum needs
directly: 16- versus 32-bit `int` overflow, 10- versus 12-bit ADC scaling, and UART timing. The
trade-off is honest: it executes a large, practical subset of Arduino C++ rather than arbitrary C++,
so pointer arithmetic and user-defined classes are out of scope.

**API: FastAPI instead of Node/NestJS**, at the user's request. The endpoints, models and XP maths
are unchanged from the PRD's intent.

**Canvas: plain React-rendered SVG instead of Pixi.js or Konva.** The scene is a few hundred static
shapes, not a particle system. SVG hits the 60 FPS target with memoised layers, and gives crisp
zooming, real DOM accessibility and trivial PNG export.

Also deferred from the PRD's later phases, and not present in this build: the Educator Portal
(classrooms and assignments), the Custom Component Creator, the virtual oscilloscope, ESP32-S3
camera/AI levels, and cloud compilation.

---

## Troubleshooting

**`docker compose up` fails immediately.** Check the Docker daemon is running (`docker info`). On
Docker Desktop, start the app first.

**Port 8080 is taken.** `WEB_PORT=9090 docker compose up` — or set `WEB_PORT` in `.env`.

**The client loads but every API call fails.** The API container is probably still starting; the
client is offline-tolerant and will retry, and the footer shows an offline pill meanwhile. Check
`docker compose logs backend`. If it exits on startup, the usual cause is `DATABASE_URL` pointing at
a database that is not ready — the compose files already gate the API on the database healthcheck.

**Quests are missing or `/api/health` reports `levels: 0`.** The API reads quest JSON from
`CONTENT_DIR` (`/content` in Docker). Confirm `content/quests/` is populated in the build context.

**Tests fail with `document is not defined`.** Component tests need jsdom: put
`// @vitest-environment jsdom` on the first line of the test file.

---

## License

No license has been chosen yet; add one before distributing.

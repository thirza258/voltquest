# VoltQuest — Architecture

VoltQuest is a browser-based, gamified electronics lab (see the PRD in the repo root). This document is the
single source of truth for how the codebase is organized. `docs/CONTRACTS.md` defines the exact JS/JSON
interfaces between modules; `docs/QUEST_SCHEMA.md` defines level content; `docs/API.md` defines the
FastAPI backend; `docs/DESIGN.md` defines the visual language.

## Stack (fixed — do not substitute)

| Layer | Choice |
| --- | --- |
| Frontend | React 18 (JavaScript + JSX, **no TypeScript**), Vite 6, Tailwind CSS 3, Zustand 5, react-router-dom 7 |
| Canvas | Plain SVG rendered by React (no Pixi/Konva). Pan/zoom via a `<g transform>` viewport. The sandbox additionally lazy-loads a Three.js WebGL2 viewing mode; the SVG remains the circuit editor. See SANDBOX_3D.md. |
| Code editor | `@monaco-editor/react` with the `monaco-editor` npm package bundled locally (no CDN); loaded lazily (`React.lazy`) when the Code tab first opens |
| Blocks | `blockly` npm package (lazy chunk), custom Arduino generator (Blockly → C++ one-way). Block set: setup/loop, pinMode, digitalWrite/Read, analogRead/Write, delay, millis, tone/noTone, Serial.begin/print/println, map, variables, math/compare/logic, if/else, repeat/while/for, functions; ESP32: touchRead, ledcWrite, WiFi.begin, server.on/send, mqtt publish |
| Firmware engine | **Custom Arduino-C++ subset interpreter** (`frontend/src/engine/interpreter`) running in a Web Worker with a virtual clock. Same engine emulates AVR (Uno/Nano: 5 V, 10-bit ADC, 16-bit int) and ESP32 (3.3 V, 12-bit ADC, 32-bit int, WiFi/WebServer/MQTT/touch/ledc libraries). No avr8js, no cloud compiler. |
| Circuit engine | Custom DC Modified Nodal Analysis solver with piecewise-linear diode/transistor iteration (`frontend/src/engine/circuit`) |
| Backend | FastAPI (Python 3.12 in Docker), SQLAlchemy 2, Pydantic 2, PyJWT, bcrypt. SQLite by default, PostgreSQL via `DATABASE_URL`. |
| Circuit assistant | Official OpenAI Python SDK 2.x with configurable OpenRouter base URL/model and backend-only key; transient context snapshots, no firmware execution |
| Coding agents | Official MCP Python SDK 1.x, Streamable HTTP at `/api/mcp/`; separate scoped credentials, explicit context sharing and owned project creation/update |
| Deploy | Docker Compose: `frontend` (nginx serving the Vite build + `/api` reverse proxy), `backend` (uvicorn), `db` (postgres:16) |
| Tests | vitest (frontend engine + validator + headless quest solutions + a perf guard: 50 components, 1 kHz toggling sketch → ≤ 60 notifications per virtual second), pytest (backend), Playwright smoke (optional) |
| Load budget | PRD NFR < 3 s on 15 Mbps: Monaco, Blockly and the Virtual Phone are lazy chunks; `build.rollupOptions.output.manualChunks` splits `monaco`, `blockly`, `engine`; nginx gzips; initial non-lazy JS ≤ 1.5 MB gzipped (checked by `scripts/check.sh`) |

Why an interpreter instead of avr8js + arduino-cli: avr8js needs a compiled HEX, which needs a compiler service
(hundreds of MB of toolchain per architecture, and impossible for ESP32 in-browser). A single interpreter gives
instant "Run", zero backend dependency for the core loop (PRD NFR: 100% client-side execution), identical
support for both MCU tracks, and lets us teach 16- vs 32-bit int, 10- vs 12-bit ADC, and 5 V vs 3.3 V faithfully.

## Repository layout

```
voltquest/
├── README.md                     # quick start, docker deploy, dev setup, feature tour
├── docker-compose.yml
├── .env.example
├── docs/                         # this folder
├── content/                      # shared content, read by BOTH frontend (bundled) and backend (loaded at boot)
│   ├── worlds.json               # campaign worlds (ordering, theme, mascot intro)
│   ├── quests/<levelId>.json     # one level per file — see QUEST_SCHEMA.md
│   ├── catalog.json              # component catalog metadata for BOM (names, vendors, prices)
│   └── cosmetics.json            # unlockable skins/wire palettes with per-item unlockLevel (XP→level formula lives in lib/xp.js & xp.py)
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py               # FastAPI app factory, CORS, routers, startup (create tables, load content)
│   │   ├── config.py             # Settings from env (DATABASE_URL, JWT_SECRET, CONTENT_DIR, CORS_ORIGINS)
│   │   ├── db.py                 # engine/session, Base
│   │   ├── models.py             # SQLAlchemy models
│   │   ├── schemas.py            # Pydantic schemas
│   │   ├── security.py           # JWT + bcrypt helpers
│   │   ├── deps.py               # get_db, get_current_player
│   │   ├── content.py            # loads content/ (quests, worlds, catalog, cosmetics) into memory
│   │   ├── xp.py                 # XP → level formula, unlock computation (mirrors frontend/src/lib/xp.js)
│   │   └── routers/{health,players,auth,quests,progress,projects,showcase,exports,leaderboard}.py
│   └── tests/                    # pytest, uses SQLite tmp db
├── frontend/
│   ├── Dockerfile                # multi-stage: node build → nginx
│   ├── nginx.conf
│   ├── package.json, vite.config.js, tailwind.config.js, postcss.config.js, index.html, eslint.config.js
│   └── src/
│       ├── main.jsx, App.jsx     # router + providers
│       ├── api/client.js         # fetch wrapper, token handling, typed endpoint functions
│       ├── lib/                  # small pure helpers (xp.js, ids.js, format.js, download.js)
│       ├── store/                # zustand stores: documentStore, simStore, playerStore, workspaceStore
│       ├── ui/                   # design-system primitives (Button, Panel, Tabs, Modal, ...), ChipMascot
│       ├── engine/
│       │   ├── boards/           # MCU board profiles (pins, voltages, capabilities)
│       │   ├── components/       # component registry (footprints, models, learn cards), breadboard geometry
│       │   ├── circuit/          # nets, netlist, MNA solver, evaluation (failures, warnings)
│       │   ├── interpreter/      # lexer, preprocessor, parser, VM (generator-based), static types
│       │   ├── runtime/          # Arduino API + libraries on top of the VM, scheduler, Runtime class
│       │   ├── sim/              # sim.worker.js, SimulationController (main thread), trace buffer
│       │   ├── validator/        # declarative quest rule engine
│       │   └── headless.js       # run a level's solution circuit+code without DOM (tests)
│       ├── canvas/               # SVG breadboard canvas, interactions, component renderers, effects
│       ├── features/
│       │   ├── workspace/        # 3-panel IDE layout, header, footer, objectives, hints, drawer, inspector, modals
│       │   ├── code/             # Monaco editor, Blockly editor + generator, serial monitor
│       │   ├── iot/              # Virtual phone (HTTP UI), IoT inspector (WiFi/MQTT console)
│       │   ├── campaign/         # world map, level cards, briefing
│       │   ├── sandbox/          # free play, save/load, exports (JSON/PNG/.ino/BOM)
│       │   ├── showcase/         # gallery, read-only preview, fork
│       │   └── profile/          # XP, stars, cosmetics, claim account / login
│       └── content/index.js      # loads ../../content via import.meta.glob('@content/...')
└── scripts/check.sh              # lint + tests + build for both apps
```

## Data flow

```
 CircuitDoc (documentStore) ──► circuit.compile() ──► CompiledCircuit (nets, elements, peripheralMap)
        ▲                                                     │
   canvas edits                                               ▼
                                   circuit.evaluate(compiled, dynamicState) ──► Evaluation
                                        ▲                 (voltages, currents, warnings, damage events)
                                        │                                  │
                          mcu pin states / user controls                    ▼
                                        │                     simStore ◄── SimulationController ──► React UI
                                        │                                  │        ▲
                                  Worker: Runtime (VM + Arduino API) ◄── env ┘        │
                                        │  pin writes, serial, peripheral events, wifi/mqtt/http
                                        └──────────────────────────────────────────────┘
                                                                  validator.evaluateObjectives(level, ctx) ──► objectives, stars
```

1. The user edits the circuit on the canvas → `documentStore.doc` changes → `SimulationController.setDocument`.
2. The controller compiles nets and a static netlist, then evaluates the DC operating point with the current MCU pin
   states and user controls (buttons/knobs/sliders). The evaluation produces node voltages, per-component states
   (current, brightness, damage), MCU input voltages and warnings.
3. MCU input voltages are turned into an `env` message for the worker (digital levels, ADC voltages, touch values,
   peripheral sensor values). The worker runs the interpreted sketch in virtual time and posts pin writes,
   serial output, peripheral events (servo angle, LCD text, NeoPixel colors, tone), WiFi/MQTT/HTTP events.
4. Pin writes re-trigger evaluation (step 2). Everything lands in `simStore`; the canvas renders glow/smoke/etc.
5. In campaign mode the validator re-evaluates objectives on each sim update; when all pass the success modal
   shows stars and XP, and progress is posted to the backend (offline-tolerant).

## Module ownership (implementation work packages)

H2 owns the WinUI learning extension in `features/winui` and `content/winui.json`.
Native source is displayed/downloaded as text; there is no browser/native execution
bridge. Backend certificate ownership adds the catalogue to its existing allowlist.
See [WINUI.md](WINUI.md) for source packs, course state and verification boundaries.

Course certificate UI belongs to H2 in `features/courses`, using the shared assessment's optional
`course` prop. Backend ownership covers `api/routes/certificates.py`, `schemas/certificates.py`,
`services/{certificates,certificate_pdf}.py` and the additive `CourseCertificate` model. Services
own grading/persistence/PDF construction; routes only adapt HTTP. See CERTIFICATES.md.

The computer learning extension belongs to H2 (`features/computer`,
`content/computer-architecture.json`). Its pure `engine/computer` modules own digital gate/state
evaluation and the VQ4 assembler/CPU. H2 also owns shared `features/courses/learningRewards.js`
and `CourseRewards.jsx`; the existing course progress and assessment modules are their only
learning-action integration points. These features do not modify account XP, backend storage,
CircuitDoc or firmware execution. See COMPUTER_ARCHITECTURE.md and LEARNING_REWARDS.md.

| Package | Paths | Depends on contracts |
| --- | --- | --- |
| A backend | `backend/**` | API.md, QUEST_SCHEMA.md (loads content), catalog/cosmetics JSON |
| B quest content | `content/**` | QUEST_SCHEMA.md, component types/pins from CONTRACTS §3–4, boards §2 |
| C registry+boards+breadboard | `frontend/src/engine/boards/**`, `frontend/src/engine/components/**` | CONTRACTS §2–4 |
| D circuit engine | `frontend/src/engine/circuit/**` | CONTRACTS §5 |
| E1 interpreter core | `frontend/src/engine/interpreter/**` | CONTRACTS §6 |
| E2 runtime/libraries | `frontend/src/engine/runtime/**` | CONTRACTS §6–7 |
| E2 Python GPIO extension | `frontend/src/engine/runtime/python.js`, `runtime/libraries/raspberrypi.js` | RASPBERRY_PI.md |
| F sim controller+worker+validator+headless | `frontend/src/engine/sim/**`, `frontend/src/engine/validator/**`, `frontend/src/engine/headless.js` | CONTRACTS §5–9 |
| G1 canvas core | `frontend/src/canvas/**` except `renderers/` | CONTRACTS §10 |
| G2 component renderers + effects | `frontend/src/canvas/renderers/**`, `frontend/src/canvas/effects/**` | CONTRACTS §10 |
| H1 app shell | `frontend/src/features/{workspace,campaign,profile}/**`, `frontend/src/store/**`, `frontend/src/api/**`, `frontend/src/lib/**`, `App.jsx` | CONTRACTS §9, §11, API.md |
| H1 localization and assistant | `frontend/src/i18n/**`, `frontend/src/features/assistant/**` | CONTRACTS §14, API.md, DESIGN.md, ASSISTANT.md |
| H2 code/iot/sandbox/showcase | `frontend/src/features/{code,iot,sandbox,showcase}/**` | CONTRACTS §7, §9, §11 |
| H2 tutorials | `frontend/src/features/tutorials/**` | TUTORIALS.md, RASPBERRY_PI.md |
| H2 courses | `frontend/src/features/courses/**`, `content/courses.json` | COURSES.md, DESIGN.md, CONTRACTS §11 |
| I devops | `docker-compose.yml`, `*/Dockerfile`, `frontend/nginx.conf`, `.env.example`, `scripts/**`, `README.md` | ARCHITECTURE |
| J ui kit | `frontend/src/ui/**`, `tailwind.config.js` theme | DESIGN.md, CONTRACTS §12 |

Deferred (not in this build, listed in README): Educator Portal, Custom Component Creator, virtual oscilloscope, ESP32-S3 camera/AI levels, cloud compilation.

Rules for all packages:
- Only touch files you own. If you need something from another package, code against `docs/CONTRACTS.md`.
  The scaffold contains stub modules at every contract entry point so the app always builds — replace the stub.
- Pure engine modules (`engine/**`) must run in Node (vitest) with no DOM/Worker globals. The Worker wrapper is
  the only file that uses `self`.
- Every package ships tests for what it owns (`*.test.js` next to the code, vitest; pytest for backend).
- No TypeScript. Use JSDoc `@typedef` for shapes where helpful.

## Custom Drone Builder ownership and integration

| Package | Paths | Contract |
| --- | --- | --- |
| Drone deterministic subsystem | `frontend/src/engine/drone/**` | CONTRACTS §15, DRONE.md |
| Drone assembly/flight UI and export pack | `frontend/src/features/drone/**` | CONTRACTS §15, DESIGN.md, DRONE.md |
| Drone project boundary | `backend/app/domain/drone.py`, generated `drone_catalog.json`, `services/drone_bom.py` | API.md, DRONE.md |
| Drone metadata generation | `scripts/export-drone-catalog.mjs`, `content/drone-catalog.json` | Live board/component/config registries |

The existing worker scheduler owns virtual time for both firmware and 1 kHz mechanics. Mechanics
calls the separate reduced pack/ESC electrical model with motor load currents. That model reads the
existing compiled terminal nets; signal and I²C/UART paths use existing peripheral bindings. This
specialized radial-power branch does not replace the breadboard MNA solver or introduce another VM.
The new feature chunks load through WorkspacePage's drone branch; the deterministic engine remains
plain Node-compatible. Domain validation uses generated metadata without importing application
settings, transports, ORM or UI code. Generation/equality tests keep both metadata copies synchronized.

### Robotics and vision learning extensions

H2 owns `features/courses`, `features/robotics`, `features/vision`, `content/courses.json`,
`content/robotics.json` and `content/vision.json`. The deterministic model boundary owns
`engine/robotics` and `engine/vision`; no DOM or host scheduling belongs there. UI adapters own the
50 ms robotics timer, local OpenCV initialization, and separate connected-device simulation instances.
Courses expose a backend public catalogue; robotics/vision catalogues are frontend-only lazy content.
`StudyLesson` shares assessments and local progress across the advanced curricula. Distinct formats,
explicit replace confirmations and separate storage keys keep circuit/drone workspaces isolated.
The OpenCV dependency is prebuilt and locally emitted, not added to the firmware VM or Pi Python subset.

### HPC learning extension

H2 owns `features/hpc`, `content/hpc.json` and the native companion source generator. The pure
deterministic boundary owns `engine/hpc`; feature Worker adapters own lifetime and timeouts.
HPC pages and their model are separate lazy chunks. Existing course assessment/progress functions
are reused without changing their five-question exam contract. `scripts/check-hpc-native.mjs`
compiles the downloadable C17/C++17 programs on the developer host, including optional OpenMP/MPI;
it is a verification tool, not an application execution service. See [HPC.md](HPC.md).

### Cybersecurity learning extension

H2 owns `features/cybersecurity` and `content/cybersecurity.json`; the pure engine boundary owns
`engine/cybersecurity`. Small, bounded synchronous request handlers operate on fictional fixture
data without network, DOM, filesystem or backend execution. The UI owns requests, account state,
history, notebook persistence and confirmed replacement. Shared course assessment/progress code
retains its existing contract. The static promo card imports neither curriculum nor engine, keeping
other hubs light. Vite splits the engine into a dedicated lazy chunk. See [CYBERSECURITY.md](CYBERSECURITY.md).

### MATLAB learning extension

H2 owns `features/matlab`, `content/matlab.json` and `content/matlab-functions.json`. The pure
numerical boundary owns `engine/matlab`: parser, bounded column-major matrices, allowlisted
functions and interpretation. No eval, host object bridge or scheduling belongs in the engine.
The feature Worker owns deadlines and disposal; React owns editing, result invalidation, plotting,
confirmed notebook replacement and existing course progress. Pages and model are separate lazy
chunks; navigation-only cards import no curriculum. Desktop companion scripts require actual
MATLAB and their listed products; they are not executed by the app. See [MATLAB.md](MATLAB.md).

### AI agent learning extension

H2 owns `features/agents`, `content/ai-agents.json` and the downloadable JS/Python companions.
The pure harness boundary owns `engine/agents`: bounded fixture proposals, context accounting,
tool schemas/scopes, approval/question transitions, local app state and a versioned MCP subset.
React owns notebook persistence, replacement confirmation, traces and shared assessments.
Native source is imported as text and never evaluated in the browser. Companion transport
tests use mocks; Python behavior is verified by `scripts/check-agent-cli.py`. Static promos
do not import the curriculum. See [AI_AGENTS.md](AI_AGENTS.md).

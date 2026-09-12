# VoltQuest — agent handoff log

**Last verified: 2026-09-12.** This is the state document: what exists, what remains unfinished,
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
| `docs/ASSISTANT.md` | Before editing localization, the circuit AI guide or Claude Code/Codex MCP. |

## 1. Current build, not the target product

The main entry points are **`/`** (14 campaign quests), **`/sandbox`** (freeform projects), and **`/tutorials`** (guided lessons).
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

All product routes are implemented: campaign workspace, sandbox, public showcase and interactive
preview/fork, profile/account/cosmetics, and leaderboard. The workspace has a parts drawer, inspector,
local Monaco/Blockly editors, serial monitor, virtual ESP32 phone, IoT inspector, hints and success flow.
Sandbox supports save/load, JSON import, JSON/PNG/code/BOM exports, publish/unpublish and deletion.
Read `docs/IMPLEMENTATION_STATUS.md` for requirement-to-implementation evidence and verification limits.

A git repository now exists (baseline `ff79723`). Preserve existing changes. Do not initialize another
repository or commit without the user's explicit request.

## 2. Verification

Latest full `make check`:
- **750 frontend tests in 51 files pass.**
- **82 backend tests pass.**
- Production build succeeds; initial JS payload is **301.1 KiB gzipped**, below the 1500 KiB budget.
- ESLint has no errors. Two existing exhaustive-deps warnings remain in
  `features/campaign/CampaignMap.jsx:83`; these are unrelated to the assistant/localization work.
- Node prints the existing jsdom/localStorage warning; persistence tests use the memory-storage helper.

Browser verification uses the actual Web Worker path, separate from the inline/jsdom tests.
The desktop hub, home navigation, ESP32 serial commands, Raspberry Pi 5 Run/cable highlighting,
and mobile width were checked in isolated Chrome. The header now switches to a native select on
small screens; tutorial pages fit a 390 px viewport without page-level horizontal overflow.
Uno Run and the ESP32 virtual HTTP request were also verified; GET /on returns 200 and LED on.

Completion browser checks used an isolated local SQLite database. Verified saved-project opening,
publish → public preview → editable fork, account claim/logout/login, JSON import confirmation,
Monaco editing, Blockly delay edits regenerating both code and XML, and a 1416 × 1456 PNG export.
The virtual phone's link to `/on` returned HTTP 200, raised GPIO18 and lit the LED. Desktop and
390 px layouts fit without page-level horizontal overflow. A saved project reopened offline via
My projects, and Resume restored the exact sketch edited before navigation.

Latest placement check: real browser mouse drags in a temporary editable canvas connected to the
real document store verified LED snapping, one undo entry per move, a stationary viewport, Escape
cancellation and smooth Uno movement followed by its final grid snap. The temporary harness adds
no app route; tutorial circuits remain read-only. No browser application errors were reported.

Run the tests, not just a build, after touching source examples: compilation alone does not prove
their explanation or timing is correct. `features/tutorials/programming.test.js` asserts expected
numeric output, command dispatch and LED state transitions on all four C++ boards.

## 3. Completed in this continuation

### Indonesian localization, circuit AI guide and coding-agent MCP (2026-09-12)

English remains the default. The header language selector persists Indonesian in `vq.locale`,
updates HTML `lang`, and preserves the current code, circuit, simulation and tutorial step checks.
`frontend/src/i18n/id.json` contains 1,366 display messages, including all 35 tutorial narratives,
campaign guidance and 29 component learning cards. User content, pin identifiers, source code,
program output and raw runtime/API diagnostics retain their original text. Missing keys fall back
to English. Language changes must not clone/re-key a lesson or seed and reset its simulation.

The circuit sidebar has an AI tab and Ask AI button; tutorials show the same guide below their
prepared circuit with a selectable read-only inspector. Requests capture the latest unsaved project
name/code, actual parts and resolved pins/wiring, inspected selection, live measurements, recent
serial output, diagnostics, and tutorial steps/campaign goals. Hidden hints/reference solutions and
credentials are excluded. Chat clears/cancels on identity changes and page disposal. Snapshots are
bounded and mark truncation. Model text/code is escaped and never executed or automatically applied.

`backend/app/services/assistant.py` uses the official OpenAI Python SDK 2.x against OpenRouter:
`OPENROUTER_API_KEY`, `AI_BASE_URL=https://openrouter.ai/api/v1`, `AI_MODEL=openai/gpt-4.1-mini`.
The key is server-only (local `backend/.env`, root `.env` for Compose), with a 45-second deadline,
sanitized errors, no automatic paid retries and per-process rate/concurrency limits. No key leaves
the guide disabled with an explanation; the simulator and MCP remain available.

The same panel includes Claude Code `.mcp.json` and Codex `~/.codex/config.toml` configuration,
MCP token creation/replacement/revocation, and Share current context. `/api/mcp/` uses official
MCP SDK 1.x Streamable HTTP, separate hashed 30-day project credentials and explicit 24-hour context
snapshots. Tools read board/component metadata, shared context and owned saved projects, create
projects for all six boards, and update owned private projects with timestamp conflict detection.
There are no publish/delete/account/shell/firmware tools. Agent output is saved; open its sandbox
link or My projects to run it. Unsaved work in an existing browser tab is not overwritten.

Regenerate `content/mcp-catalog.json` with `node scripts/export-mcp-catalog.mjs` after board,
layout, footprint or default-property changes. A registry equality test catches drift. ESP32/S3
footprints span both breadboards and need validation in world coordinates. MCP Host/Origin checks
are separate from CORS; custom deployment domains need `MCP_ALLOWED_HOSTS`/`CORS_ORIGINS` entries.

Verified in isolated Chromium/SQLite: English default, Indonesian switching with edited code retained
and executed, tutorial LED selection, shared selected cable context, MCP create → edit → saved
sandbox opening, real Worker LED brightness cycling 0 ↔ 0.792, and desktop/390 px layouts without
page-level horizontal overflow or browser application errors. SDK/provider transport is mocked in
tests; a live paid OpenRouter response and actual Claude Code/Codex CLI sessions still require the
operator's credentials/configuration. See `docs/ASSISTANT.md` for the complete setup.

### Crawler files — sitemap and robots (2026-09-12)
`frontend/vite-sitemap.js` emits `dist/sitemap.xml` during `vite build` for the deployed origin
`https://pcb.nevatal.id`; `frontend/public/robots.txt` is static. The URL list is derived from
`content/` at build time, not committed, so newly authored quests and tutorials appear without a
second edit: 54 URLs today — `/`, the 14 campaign levels in worlds.json order, `/tutorials` plus its
35 lessons, `/sandbox`, `/showcase` and `/leaderboard`.

`/profile`, `/sandbox/:projectId` and `/showcase/:slug` are excluded and disallowed in robots.txt —
per-player or user-generated, with nothing enumerable from content. `/assets/` stays crawlable: this
is a client-rendered app, so blocking the bundle would render every route empty for a crawler.
Locked levels are listed on purpose — `campaign/gating.js` drives presentation only, so every
`/play/` URL is publicly reachable.

Still missing for search: `index.html` carries one hardcoded `<title>` and no description, so all 54
URLs share identical SERP text. Per-route titles/meta need either a prerender step or an SSR host;
do not paste a static `<link rel="canonical">` into `index.html`, which would declare every route
canonical to one URL.

### PRD completion — B / H1 / H2 (2026-09-12)
Authored the 11 missing quests, including Simon Says, the Uno→ESP32 voltage-divider challenge,
NeoPixels, HTTP and MQTT. All 14 references earn three stars. Headless actions now support serial,
HTTP and MQTT inputs alongside sensor controls.

`WorkspacePage` assembles the real canvas, engine, objectives, editors, controls, hints, reset/restart,
drafts, damage explanations/replacement and success/XP flow. Sidebar widths persist; mobile stacks
the panels. MCU switching resets Python/C++ editor state when the language changes.

Monaco and Blockly load from local npm assets. Text→blocks requires confirmation before replacing
manual code. The virtual phone renders sandboxed server HTML and bridges links/forms into virtual
HTTP requests; server scripts and external network requests are disabled. Reset invalidates responses.

Sandbox files validate all six boards, component geometry, terminal references, editor mode and size
before loading. Saved projects have independent drafts. The three most recently opened/saved projects have an
owner-checked offline cache; 401/403/404 never fall back to cached data. Explicit import/new confirmations protect
unsaved work. The gallery supports filters/pagination and public read-only previews with live controls.
Account claiming/login, cosmetics and leaderboard are connected to the existing backend.

Guest initialization is deduplicated. Progress handles the API's singular completion record, queues
mutations before sending, preserves operations added during a flush, and ignores stale identity
responses. Resource loading never exposes a previous project's data during route transitions.

Vite's shared preload helper must live outside the Monaco chunk. The build gate now rejects eager
Monaco/Blockly/phone imports in addition to enforcing the total payload budget.

### Device dragging and placement stability — G1 (2026-09-12)
Moves now resolve the actual release coordinates, including when a newer pointer move is still
waiting for its animation frame. Board snapping updates at hole boundaries within a half-pitch
cell and ranks nearby valid anchors by actual distance. Free-mounted device previews preserve
the grab offset and follow the pointer continuously, then snap to the grid on release.

Gestures belong to one pointer. Escape, window blur, pointer cancellation and lost capture clear
previews and queued frames without committing a move. Wheel/viewport hotkeys cannot shift the
breadboard during the drag. Select-mode wire drags retain the hole where the press began.
Twelve new adjacent regressions cover these cases; the full `make check` passes.

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
`engine/headless.test.js` executes all 14 authored reference solutions through solver,
runtime and validator; every solution earns three stars. This is the regression net for future authored quests.

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

## 4. Remaining verification and optional work

The in-scope product implementation is complete; the PRD's full nonfunctional browser/device matrix
has not been certified. Current browser checks use local Chromium. Safari, Firefox, Edge, real touch
hardware and throttled-network/frame-time measurements remain release verification work.

Search-engine metadata is one document deep: per-route `<title>`/description and canonical tags
remain unbuilt (see the sitemap entry in §3). The sitemap was verified through `vite preview`, not
against the live pcb.nevatal.id host.

Optional tutorial extensions: persistent lesson progress, lesson-to-lesson navigation, replacing the
lesson textarea with the shared full editor, and user-controlled rewiring. Tutorials still use prepared
circuits and do not grant campaign XP. Keep Pi's restricted syntax and schematic drawing explicit.

Educator Portal, Custom Component Creator, virtual oscilloscope, ESP32-S3 camera/AI levels,
and cloud compilation remain explicitly out of scope per CONTRACTS §13.

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

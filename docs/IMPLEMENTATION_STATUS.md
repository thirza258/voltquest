# PRD implementation verification

### AI agent learning extension (2026-09-19)

`/ai-agents` provides twenty courses, twenty guided tutorials, eighty theory sections with
independent checkpoints and twenty five-question exams. Topics include Codex, Claude Code,
Google Antigravity, skills, MCP, app integrations, context/token/cost management, harnesses,
retrieval, multimodal tools, subagents, durable workflows and evaluation. The capstone supplies
editable JavaScript and Python CLIs, with JavaScript as the main path and dated official references.

`/sandbox?bench=ai-agents` executes edited scripted proposals through real bounded virtual tools,
approval/question pauses and a token/cost ledger. Notebooks, exact downloads, confirmed replacement
and shared local assessment progress are implemented. Browser labs do not perform inference or
contact external apps. Native companions have offline demos and separately enabled model/GitHub
readers; their transport tests use controlled fixtures. See [AI_AGENTS.md](AI_AGENTS.md).

Full `make check` passed **1,496 frontend / 104 backend tests**, lint, production build and the
**545.8 KiB** initial gzip budget. A final control-validation refinement passed **88 targeted tests**
and a rebuild. Production Chrome verified all twenty presets, approval/question/artifact flows,
six regression cases, downloads, notebook replacement, exam persistence, locale retention and
desktop/390 px layouts without overflow or application errors. Both terminal demos completed.
The sitemap has **363 URLs**. Live paid calls, real account access, vendor clients and the full
browser/device matrix remain unverified.

### Expanded sitemap indexing (2026-09-18)

Expanded `frontend/vite-sitemap.js` and `frontend/public/sitemap.xml` to include crawlable entry points:
course tracks, tutorial board hubs & topic filters, all 106 tutorial board variants, dedicated sandbox benches
(MATLAB, Cybersecurity, HPC, Vision, Robotics), and 49 lesson sandbox presets. Sitemap index grew from 168 to
**300 URLs**. Full `make check` passes with all tests, production build, and payload budget.

### MATLAB learning extension (2026-09-17)

`/matlab` and `/sandbox?bench=matlab` provide eighteen courses, seventy-two theory sections and
section checkpoints, eighteen five-question exams, eighteen editable numeric scripts and desktop
companions. A curated 244-entry reference distinguishes 73 exact executable browser signatures
from desktop guidance and links to the complete MathWorks catalog. Edited scripts actually run
through a bounded numerical parser/engine and fresh Workers, with workspace inspection and plots.
Independent notebooks, confirmed replacement, exact `.m`/JSON export and existing assessment
progress are implemented. See [MATLAB.md](MATLAB.md) for contracts and compatibility limits.

Full `make check` passes **1,416 frontend / 104 backend tests**, production build and **527.9 KiB**
initial gzip budget. Final 174 targeted tests and rebuild pass after the small convolution/reference
refinement. Course/model chunks remain lazy and the sitemap contains 167 URLs. Existing warnings
are unchanged. Tests execute every browser starter and every supported reference example, plus
numerical oracles, bounded failures, worker disposal, notebook boundaries and assessment behavior.

Production Chromium with an isolated SQLite shell backend verified all eighteen real Worker runs,
edited outputs/plots, exact source/notebook/result downloads, save/reload and confirmed import,
unsupported-function errors, independent section practice, incomplete-exam rejection, persisted
80% grading and English/Indonesian state preservation. Desktop and 390 px layouts have no page
overflow; hub/navigation links work and no application errors were observed. Actual MATLAB and
optional toolbox execution is unverified here because MATLAB is not installed. The browser subset
does not claim full MATLAB/Simulink, complex-number support, native timings or parallel/GPU execution.
Other browsers and real-device performance remain release checks.

### Cybersecurity learning extension (2026-09-15)

`/cybersecurity` and `/sandbox?bench=cybersecurity` provide ten ordered web security courses, forty
theory sections, ten guided vulnerability labs, thirty practice questions and ten five-question
exams. Editable requests operate on fictional local fixtures; defense toggles change real handler
decisions and a 30-check capstone includes ordinary behavior and a stateful profile-to-admin chain.
Saved notebooks, confirmed imports, exact JSON/report exports and local assessment progress are
implemented. See [CYBERSECURITY.md](CYBERSECURITY.md) for contracts and explicit model boundaries.

Full `make check`: **1,241 frontend tests / 104 backend tests**, production build and **525.1 KiB**
initial gzip payload pass. Final targeted tests (59) and rebuild pass after the small media-type
and label refinement. Cybersecurity code stays lazy; the sitemap contains 148 URLs. Existing
CampaignMap hook warnings and the environment's localStorage notice remain.

Production Chromium with an isolated SQLite backend verified all ten normal/probe/patched flows,
actual stateful privilege change and its remediation, 30/30 capstone checks, exact notebook/report
downloads, save/reload and import confirmation, incomplete-exam rejection, an 80% pass persisted
through reload, English/Indonesian state preservation, hub links and desktop/390 px layouts without
page overflow. No browser application errors. The labs do not contact external targets, query a
database, render unsafe HTML or access host files. Cross-browser/real-device behavior remains
release verification.

### HPC learning extension (2026-09-14)

`/hpc` and `/sandbox?bench=hpc` add ten C17/C++17 courses, forty detailed sections, twenty formula
cards, ten experiments, thirty practice questions and ten exams. Editable native programs and
testing guides accompany every course. Local experiment files and existing self-study progress
remain separate from circuit/account APIs. See [HPC.md](HPC.md) for formats and explicit model limits.

Full shared-tree `make check`: **1,181 frontend tests / 104 backend tests**, production build and
**521.1 KiB** initial gzip payload pass. The native gate passes **20 builds / 126 executions**,
including OpenMP and MPI at 1/2/4 workers; **10 core builds / 36 executions** pass with ASan/UBSan.
Production Chromium verifies all ten actual Worker experiments, stale-halo detection, invalidation,
exact downloads, save/reload/import, 80% grading/persistence, translated controls with state retained,
and desktop/390 px fit. No browser application errors. Native execution was on a local Apple Silicon
host; multi-node performance, other browsers and real touch devices are not certified.

Verified 2026-09-12 against the original PRD, ESP32 addendum and Custom Drone Builder addendum, CONTRACTS.md, ARCHITECTURE.md,
QUEST_SCHEMA.md, API.md, DESIGN.md, TUTORIALS.md and RASPBERRY_PI.md. Current contracts supersede
the original avr8js/cloud-compiler/TypeScript/canvas-library choices. The application is plain
JavaScript, uses an SVG breadboard, and runs its teaching VM on the client.

| Requirement | Implementation and evidence | Status |
| --- | --- | --- |
| Six board profiles and complete component catalog | `engine/boards`, `engine/components`; board/component tests; all six project-file round trips | Implemented |
| Breadboard placement, wiring, simulation effects and controls | `canvas`; release-coordinate snapping, pointer ownership/cancellation, stationary viewport and free-device drag regressions; real browser mouse checks | Implemented |
| DC solver, Arduino VM, Pi GPIO and virtual networking | `engine`; deterministic and Worker checks; explicit supported-language/library subsets in contracts | Implemented teaching subsets |
| 41 tutorials / 106 board variants, programming path and exact wiring guides | `features/tutorials`; all reference examples run through the inline simulation | Implemented |
| All 32 campaign quests | `content/quests`; `engine/headless.test.js` discovers every world level and requires three stars for every reference solution; `content/campaign.test.js` covers the intermediate/hard expansion and alternate inputs | Implemented |
| Campaign play, briefing, success/XP, hints and damage recovery | `/play/:levelId`, `WorkspacePage`, `useLevelSession`, objective panel and stores; idle completion, three-star references, lifecycle/draft tests | Implemented |
| Parts drawer, inspector, circuit insights and responsive panels | `features/workspace`; valid placement, MCU/language switching, live values and controls, resistor bands, nets/current/warnings; 390 px and desktop browser checks | Implemented |
| Local Monaco/Blockly, safe mode switching and serial monitor | `features/code`; generator, confirmation, read-only, Pi mode, serial-clear/baud/input tests; browser Monaco and live Blockly delay edits | Implemented |
| Virtual phone and IoT inspector | `features/iot`; virtual-only address validation, sanitized sandbox HTML, source/channel guards and response invalidation tests; browser GET / and phone link /on return 200 and light the LED | Implemented |
| Sandbox, account save/load and independent drafts | `/sandbox`, `/sandbox/:projectId`; create-and-open regression, separate drafts and a bounded owner-checked offline cache; browser save/load and imported-file confirmation | Implemented |
| Optional sandbox 3D view and expanded parts | `canvas/three`, `CircuitViewport`, eight new registry definitions; 37 available types, actual switch/ADC behavior, preserved run/editor/undo/2D viewport, GPU cleanup and fallback; Chromium desktop/390 px, all six production board views and PNG export from 3D. See [SANDBOX_3D.md](SANDBOX_3D.md) | Implemented teaching visualization |
| JSON import; JSON, PNG, code and BOM exports | `features/sandbox`, `canvas/exportPng`; board/geometry/terminal/size validation, six-board and campaign-reference round trips, offline BOM and CSV escaping tests; browser PNG export produces a 1416 × 1456 image | Implemented |
| Gallery, publish/unpublish, preview and fork | `/showcase`, `/showcase/:slug`; search/filter/retry tests and backend ownership/round-trip tests; browser publish → preview → editable fork | Implemented |
| Guest/account UX, profile, cosmetics and leaderboard | `playerStore`, `features/profile`; deduplicated guests, real completion response shape, queue concurrency, identity-response guards, XP/cosmetics/leaderboard tests; browser claim/logout/login | Implemented |
| Offline drafts/progress/settings, keyboard, audio and runtime lifecycle | Existing helpers integrated into workspace; final-draft save/disposal, optimistic progress/replay and keyboard tests; browser offline reopen/Resume preserved the exact edited sketch | Implemented |
| English/Indonesian interface and learning guidance | `i18n`, translated UI/tutorial/quest/component cards; coverage and state-preservation tests; browser switch retains edited runnable code | Implemented; English default |
| Context-aware AI guide | `features/assistant`, backend OpenAI SDK → OpenRouter; latest code/inspector/circuit/runtime/lesson snapshot; request/error/cancellation tests with mocked provider transport | Implemented; live provider key required |
| Claude Code/Codex MCP project creation | In-panel configuration and scoped credentials; official MCP endpoint, all six boards, ownership/conflict/expiry tests; browser shared context → MCP create/edit → saved sandbox → real Worker LED blink | Implemented; individual CLI setup required |
| Initial payload and lazy editors | `vite.config.js`, `scripts/check.sh`; 423.1 KiB initial gzipped JS; build rejects eager Monaco/Blockly/phone chunks | Verified build budget |
| Custom Drone Builder D1–D3 | `engine/drone`, `features/drone`, six w5 quests and project/BOM boundaries; all 20 three-star references, two builds completing the boss, captured replay equality, sensor/electrical/UI/export/API regressions; real Worker course and browser save/publish/preview/fork + seven-file ZIP | Implemented teaching model; [limits and APIs](DRONE.md) |
| Full browser/device/performance matrix | Chromium desktop and 390 px checks; existing engine statement/notification performance guards | Not yet certified across Safari, Firefox, Edge, real touch devices or throttled connections |
| Educator Portal, custom components, oscilloscope, camera/AI and cloud compiler | CONTRACTS §13 | Explicitly deferred |

`make check`: 923 frontend tests in 62 files, 101 backend tests, ESLint without errors, successful
production build, and passing initial-JS budget. Two pre-existing CampaignMap exhaustive-deps
warnings and the environment's jsdom/localStorage warning remain.

The browser fixtures use an isolated local SQLite database, not existing user projects. Unit and
headless checks do not establish the PRD's full browser compatibility, real-device responsiveness,
or the under-three-second network target. Those remain release verification work.

Tutorial progress persistence, tutorial rewiring and moving the shared full editor into tutorial
pages are optional follow-ups. Tutorial circuits stay prepared/read-only and do not grant XP.
Pi remains a restricted Python GPIO learning model with a schematic 40-pin teaching diagram.

Drone checks additionally verified 390 px Build/Bench/Code tabs with a visible transmitter, desktop
assembly, real mouse part placement/undo, an intact seven-file ZIP and its 1200 × 2180 wiring PNG.
Coefficient scale uses UIUC static prop data; motor/pack/thermal and non-reference geometry fits
remain teaching assumptions. Optional GPS dynamics/gamepads and the 60 FPS/Chromebook benchmark
are not certified or claimed. See DRONE.md for the complete evidence boundary.


### Campaign expansion (2026-09-14)

Campaign expansion verified 2026-09-14: worlds 6–7 add six intermediate and six hard quests,
bringing the campaign to 32. Every reference earns three stars; alternate-input regressions cover
control/command failure cases and the API checks completion XP without duplicate replay rewards.
Isolated Chromium exercised the actual Uno/ESP32 Worker, hysteresis and greenhouse completion,
matching HTTP/MQTT output and desktop/390 px layouts with retained state after translation.
Full `make check` on the shared workspace passes 1,038 frontend / 103 backend tests and a 476.8 KiB
initial gzip budget. See [QUEST_SCHEMA.md](QUEST_SCHEMA.md) for the new challenge inventory.

### Learning extensions (2026-09-13)

22 electrical/IoT/drone courses plus five robotics and six vision course/tutorial units are implemented
with theory, 68 formula cards, 231 questions, 33 exams and browser-local progress. Six new firmware
labs bring the catalogue to 41 lessons / 106 board combinations. Robotics and vision have independent
editable sandbox formats, confirmed import, local save/load and export. The computer-vision capstone
uses actual virtual HTTP and serial firmware plus the shared differential-drive model. OpenCV runs
locally; transformer attention and ROS 2 are explicitly teaching concepts. Read COURSES.md, ROBOTICS.md
and VISION.md for full scope and verification boundaries. No backend hardware execution or Pi camera
emulation was introduced. Production Chromium checks include the device response chain and 390 px fit.

### Programming courses (2026-09-14)

The fifth course track adds twelve C/Arduino C++/ESP32 courses with 36 sections, 12 complete code
examples, 24 practice and 60 exam questions. `/courses?track=programming` connects to the existing
prepared tutorials, uses English/Indonesian content and browser-local assessments, and is included
in public API filters and the generated sitemap. There are now 34 standard courses, or 45 study
units including robotics/vision, with 80 formula cards, 315 questions and 45 exams across those units.

All 44 new example/board pairs run against the real inline simulator with output and damage checks;
additional tests cover timing, framing, HTTP and MQTT behavior. Full `make check` passes 1,127 frontend
and 104 backend tests and a 516.7 KiB initial gzip payload. Production Chromium verifies 80% grading
and reload, localization/state preservation, exact download, separate-tab Nano Worker execution,
ESP32-S3 HTTP LED control and an ESP32 MQTT command lease with matching live telemetry, at desktop
and 390 px widths without application errors. See COURSES.md for native-language and model limits.

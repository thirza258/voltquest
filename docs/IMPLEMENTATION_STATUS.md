# PRD implementation verification

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

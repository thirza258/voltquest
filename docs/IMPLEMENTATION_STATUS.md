# PRD implementation verification

Verified 2026-09-12 against the original PRD and ESP32 addendum, CONTRACTS.md, ARCHITECTURE.md,
QUEST_SCHEMA.md, API.md, DESIGN.md, TUTORIALS.md and RASPBERRY_PI.md. Current contracts supersede
the original avr8js/cloud-compiler/TypeScript/canvas-library choices. The application is plain
JavaScript, uses an SVG breadboard, and runs its teaching VM on the client.

| Requirement | Implementation and evidence | Status |
| --- | --- | --- |
| Six board profiles and complete component catalog | `engine/boards`, `engine/components`; board/component tests; all six project-file round trips | Implemented |
| Breadboard placement, wiring, simulation effects and controls | `canvas`; release-coordinate snapping, pointer ownership/cancellation, stationary viewport and free-device drag regressions; real browser mouse checks | Implemented |
| DC solver, Arduino VM, Pi GPIO and virtual networking | `engine`; deterministic and Worker checks; explicit supported-language/library subsets in contracts | Implemented teaching subsets |
| 35 tutorials / 90 board variants, programming path and exact wiring guides | `features/tutorials`; all reference examples run through the inline simulation | Implemented |
| All 14 campaign quests | `content/quests`; `engine/headless.test.js` discovers every world level and requires three stars for every reference solution | Implemented |
| Campaign play, briefing, success/XP, hints and damage recovery | `/play/:levelId`, `WorkspacePage`, `useLevelSession`, objective panel and stores; idle completion, three-star references, lifecycle/draft tests | Implemented |
| Parts drawer, inspector, circuit insights and responsive panels | `features/workspace`; valid placement, MCU/language switching, live values and controls, resistor bands, nets/current/warnings; 390 px and desktop browser checks | Implemented |
| Local Monaco/Blockly, safe mode switching and serial monitor | `features/code`; generator, confirmation, read-only, Pi mode, serial-clear/baud/input tests; browser Monaco and live Blockly delay edits | Implemented |
| Virtual phone and IoT inspector | `features/iot`; virtual-only address validation, sanitized sandbox HTML, source/channel guards and response invalidation tests; browser GET / and phone link /on return 200 and light the LED | Implemented |
| Sandbox, account save/load and independent drafts | `/sandbox`, `/sandbox/:projectId`; create-and-open regression, separate drafts and a bounded owner-checked offline cache; browser save/load and imported-file confirmation | Implemented |
| JSON import; JSON, PNG, code and BOM exports | `features/sandbox`, `canvas/exportPng`; board/geometry/terminal/size validation, six-board and 14-reference round trips, offline BOM and CSV escaping tests; browser PNG export produces a 1416 × 1456 image | Implemented |
| Gallery, publish/unpublish, preview and fork | `/showcase`, `/showcase/:slug`; search/filter/retry tests and backend ownership/round-trip tests; browser publish → preview → editable fork | Implemented |
| Guest/account UX, profile, cosmetics and leaderboard | `playerStore`, `features/profile`; deduplicated guests, real completion response shape, queue concurrency, identity-response guards, XP/cosmetics/leaderboard tests; browser claim/logout/login | Implemented |
| Offline drafts/progress/settings, keyboard, audio and runtime lifecycle | Existing helpers integrated into workspace; final-draft save/disposal, optimistic progress/replay and keyboard tests; browser offline reopen/Resume preserved the exact edited sketch | Implemented |
| Initial payload and lazy editors | `vite.config.js`, `scripts/check.sh`; 238.0 KiB initial gzipped JS; build rejects eager Monaco/Blockly/phone chunks | Verified build budget |
| Full browser/device/performance matrix | Chromium desktop and 390 px checks; existing engine statement/notification performance guards | Not yet certified across Safari, Firefox, Edge, real touch devices or throttled connections |
| Educator Portal, custom components, oscilloscope, camera/AI and cloud compiler | CONTRACTS §13 | Explicitly deferred |

`make check`: 722 frontend tests in 47 files, 45 backend tests, ESLint without errors, successful
production build, and passing initial-JS budget. Two pre-existing CampaignMap exhaustive-deps
warnings and the environment's jsdom/localStorage warning remain.

The browser fixtures use an isolated local SQLite database, not existing user projects. Unit and
headless checks do not establish the PRD's full browser compatibility, real-device responsiveness,
or the under-three-second network target. Those remain release verification work.

Tutorial progress persistence, tutorial rewiring and moving the shared full editor into tutorial
pages are optional follow-ups. Tutorial circuits stay prepared/read-only and do not grant XP.
Pi remains a restricted Python GPIO learning model with a schematic 40-pin teaching diagram.

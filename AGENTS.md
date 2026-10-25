# VoltQuest — agent handoff log

**Last verified: 2026-09-28.** This is the state document: what exists, what remains unfinished,
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
| `docs/HPC.md` | Before editing the C/C++ HPC curriculum, experiments or native source/testing. |
| `docs/CYBERSECURITY.md` | Before editing web security courses, local request labs, defenses or investigation notebooks. |
| `docs/MATLAB.md` | Before editing MATLAB courses, the numerical script interpreter, function reference or notebooks. |
| `docs/AI_AGENTS.md` | Before editing AI agent courses, harness experiments, skills/MCP fixtures or companion CLIs. |
| `docs/WINUI.md` | Before editing C++ / WinUI desktop courses, native source packs or their verification. |
| `docs/AVR.md` | Before editing the AVR assembly track, the assembler/simulator engine or the AVR IDE. |
| `docs/CUDA.md`, `docs/PYTORCH.md` | Before editing the CUDA/PyTorch reading tracks or the shared `ReadingTrack` shell. |
| `docs/KERNEL.md`, `docs/LOADBALANCER.md`, `docs/DISTRIBUTED.md`, `docs/KUBERNETES.md`, `docs/GAMEMODDING.md`, `docs/IOT_C.md` | Before editing the Linux-kernel, load-balancing, distributed-systems, Kubernetes, Game Modding, or Embedded IoT in C reading tracks. |
| `docs/COMMUNITY.md` | Before editing community discussions, their moderation limits or post rendering. |

## 1. Current build, not the target product

The main entry points are **`/`** (32 campaign quests), **`/sandbox`** (freeform projects), and **`/tutorials`** (guided lessons).

The sandbox has ten benches with one shell: header, bench rail, body and footer.
- **Names and descriptions:** each bench's name, title, description and save mode live in
  `features/sandbox/sandboxDirectory.js`. Descriptions state only what the bench executes.
- **Unsaved work:** the rail asks before leaving explicit-save work; only circuit and drone autosave
  drafts.
- **IDE benches:** MATLAB, AI agents, HPC, cybersecurity and AVR look like the tools they teach:
  - AVR is an AVR assembler IDE (Editor + Opcode listing + Machine state: registers, SREG, memory, stack, PORTB output).
  - MATLAB is a MATLAB-style desktop.
  - AI agents is an Antigravity-style agent IDE (Editor + Agent Manager).
  - HPC is a VS Code-style C/C++ workbench.
  - Cybersecurity is a security console: a Packet Tracer-style topology, a curl terminal and a
    DevTools-style inspector.
- **Scrolling benches:** computer, vision and robotics keep their page layout.
- **Rules:** read `docs/DESIGN.md`, "Sandbox benches and IDE shells", and `CONTRACTS.md` §26 before
  changing the shell.

**`/community`** is a discussion board reachable from the header nav, the landing footer and every
published showcase project. Reading is public; posting uses the player token the app already issues
to guests. Six fixed sections, one accepted answer per question, author-only editing, and author
withdrawal that preserves other people's replies. Post bodies are rendered as text, never as markup.
Rate limits are per process and are not moderation — there is no moderation, report or notification
path. Read `docs/COMMUNITY.md` before changing it.

Courses, Tutorials and the home footer now link to **`/winui`**: thirteen C++/WinUI 3
desktop courses, 52 section checkpoints and thirteen five-question exams. Each supplies
a guided Windows lab, XAML/C++ source ZIP and an applied challenge, ending in a task
notebook with local JSON save/load. Existing course progress, rewards and certificates
apply through the shared certificate flow. Native labs require Windows; VoltQuest does not
compile or simulate WinUI. Read `docs/WINUI.md` for source and verification boundaries.

The course directory (shown on both Courses and Tutorials), the home footer (CUDA, PyTorch) and the
sitemap link to three tracks added on 2026-10-11: **`/avr`**
(eight 8-bit AVR assembly courses on an in-browser assembler + ATmega simulator, with the Computer
Architecture sandbox retrofitted to the same IDE at `/sandbox?bench=computer&asm=1`), **`/cuda`**
(ten reading-only CUDA C++ GPU courses) and **`/pytorch`** (ten reading-only PyTorch courses, basics
to a full ML pipeline). CUDA and PyTorch share the content-driven `features/courses/ReadingTrack.jsx`
hub/course shell; each course has four checkpointed sections, a guided lab, one complete self-contained
program (copied or downloaded, never run in the browser), a challenge and a five-question 80% exam.
Progress, rewards, localization and certificates reuse the existing systems. There is no GPU, Python or
AVR hardware in the browser. Read `docs/AVR.md`, `docs/CUDA.md` and `docs/PYTORCH.md` for boundaries.

Three more reading-only tracks were added on 2026-10-12, all on the same `ReadingTrack` shell:
**`/kernel`** (eight Linux kernel-module courses; the modules compile against Linux 6.8 headers but are not
built or run in the browser), **`/loadbalancer`** (eight courses — NGINX, HAProxy, Kubernetes Services +
MetalLB, and the Gateway API, since the community ingress-nginx controller retired in March 2026), and
**`/distributed`** (ten courses with runnable, stdlib-only Python simulations that a backend test executes).
Each has four checkpointed sections, a guided lab, one downloadable artifact (`.c`, a config/manifest, or
`.py` — set per course), a challenge and a five-question 80% exam, with certificates. There is no kernel,
cluster or distributed runtime in the browser. Read `docs/KERNEL.md`, `docs/LOADBALANCER.md` and
`docs/DISTRIBUTED.md` for boundaries.

There are **41 firmware tutorials**, ordered Easy → Intermediate → Hard, with editable code,
real simulation, explanations of program and hardware concepts, exact breadboard placement,
cable endpoint tables and click-to-highlight wiring. The circuit is prepared/read-only, but
buttons, pots, touch and sensor controls remain interactive.

Tutorials and Courses also link to `/hpc`: ten detailed C17/C++17 HPC courses with forty theory
sections, twenty formula cards, ten numerical/model experiments, thirty practice questions and ten
exams. `/sandbox?bench=hpc` has separate local projects and editable/downloadable native source.
Native programs compile on the learner's computer; browser Run uses the bounded experiment controls.

Tutorials and Courses now also link to `/cybersecurity`: ten web security courses with forty theory
sections, ten guided vulnerability tutorials, thirty practice questions and ten five-question exams.
`/sandbox?bench=cybersecurity` offers editable requests against a fictional local shop, observed
data/state changes, nine configurable defenses, regression checks and separate saved notebooks/reports.
Labs have no network, host filesystem or script execution. Read `docs/CYBERSECURITY.md` for boundaries.

Tutorials and Courses also link to `/matlab`: eighteen courses with seventy-two detailed sections,
a question in each section, eighteen five-question exams and desktop companion scripts. The
244-entry function directory distinguishes 73 executable browser functions from desktop guidance.
`/sandbox?bench=matlab` executes edited scripts in a bounded MATLAB-style numeric interpreter,
with workspace inspection, plots and independent saved notebooks. It is not a full MATLAB/Simulink
runtime and does not run optional toolboxes or parallel/GPU code. Read `docs/MATLAB.md`.

Tutorials and Courses also link to `/ai-agents`: twenty courses, twenty guided tutorials,
eighty section checkpoints and twenty five-question exams, ending in a JavaScript-first CLI
with a Python companion. `/sandbox?bench=ai-agents` executes edited scripted proposals through
bounded virtual tools, permissions, approvals/questions, context and token/cost accounting.
Notebooks preserve JSON, skill text, both CLI sources and notes. Browser experiments use local
fixtures; native companions support separately enabled live model and read-only GitHub calls.
Read `docs/AI_AGENTS.md` for execution boundaries and verification limits.

Ten tutorials form an Arduino/ESP32 C++ programming path:
- Easy: setup/loop, variables/types, arithmetic, conditions.
- Intermediate: functions, loops, arrays.
- Hard: non-blocking timing, serial command parsing, state machines.

The other 31 lessons include circuit/Pi topics plus three IoT foundation labs and three drone labs.
Each Uno/Nano offers 22 lessons, each ESP32 offers 24, and each Pi offers seven.
All **106 tutorial/board combinations** are exercised through the real inline simulation.
The hub has search, board/difficulty filters and a programming-path shortcut.

Supported board ids: `uno`, `nano`, `esp32`, `esp32s3`, `raspberrypi4`, `raspberrypi5`.
The user explicitly requested **Raspberry Pi 4 / 5, not Pico**. Pi uses a restricted Python GPIO
learning model with a 40-pin header, not Linux/CPU emulation or arbitrary Python execution.
The canvas has a simplified Pi teaching diagram with all physical pin numbers.

All product routes are implemented: campaign workspace, sandbox, public showcase and interactive
preview/fork, profile/account/cosmetics, and leaderboard. The workspace has a parts drawer, inspector,
local Monaco/Blockly editors, serial monitor, virtual ESP32 phone, IoT inspector, hints and success flow.
Sandbox supports save/load, JSON import, JSON/PNG/code/BOM exports, publish/unpublish and deletion.
The breadboard sandbox also has a **2D / 3D** switch and **37 part types**. 3D offers orbit/zoom/pan,
live output, component/wire picking and inspector controls over the same running circuit; direct
placement/wiring stays in 2D. Read `docs/SANDBOX_3D.md` before extending this view or its new inputs.
Read `docs/IMPLEMENTATION_STATUS.md` for requirement-to-implementation evidence and verification limits.

A git repository now exists (baseline `ff79723`). Preserve existing changes. Do not initialize another
repository or commit without the user's explicit request.

## 2. Verification

Latest WinUI verification used an isolated copy of the completed baseline plus this path;
concurrent Qt files were still being authored in the shared tree. Full `make check`:

- **1,619 frontend tests in 93 files pass.** Includes the WinUI curriculum/UI, actual ZIP
  extraction and 18 compiled/executed portable C++ rule checks.
- **109 backend tests pass.** Certificates are issued and their exact PDFs parsed for all 134 courses in that snapshot.
- Production build succeeds; initial JS payload is **555.1 KiB gzipped**, below the 1500 KiB budget.
- ESLint has no errors. Two existing exhaustive-deps warnings remain in
  `features/campaign/CampaignMap.jsx:84`; these are unrelated to the assistant/localization work.
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

### Embedded IoT in C reading track (2026-10-22)

Added a comprehensive ten-course **Embedded IoT in C track** (`/iot-c`, `content/iot-c.json`) rendered on the shared `features/courses/ReadingTrack.jsx` shell and configured by `features/iot-c/IotCPage.jsx`:
- **10 courses**: `iot-c-architecture` (microcontroller Flash/RAM memory layout, cross-compilation toolchains, fixed-width types, bit manipulation, and non-blocking SysTick event loop scheduler),
  `iot-c-peripherals` (memory-mapped I/O, volatile pointers, GPIO push-pull vs open-drain, atomic BSRR bit set/reset, hardware ISR vector tables, and timer PWM generation),
  `iot-c-buses` (UART framing, lock-free single-producer single-consumer circular FIFO ring buffers, I2C master register read/write state machines with ACK/NACK, full-duplex SPI shift registers, and polynomial CRC-8 packet framing),
  `iot-c-rtos` (FreeRTOS preemptive priority scheduling, PendSV context switching, stack sizing, high-watermark monitoring, thread-safe message queues, binary/counting semaphores, and Priority Inheritance mutexes),
  `iot-c-networking` (lwIP lightweight TCP/IP stack, zero-copy chained packet buffers (pbufs), BSD sockets API, partial send loops, non-blocking I/O multiplexing with select(), and SNTP time synchronization over UDP),
  `iot-c-mqtt` (MQTT v3.1.1 binary packet framing, Variable Byte Integer length encoding, QoS 0/1 state machines with PUBACK tracking, Keep-Alive ping timers, Last Will and Testament, topic wildcard matching with + and #, and CoAP RFC 7252 4-byte binary headers over UDP),
  `iot-c-security` (IoT threat models, Hardware Root of Trust, Secure Boot, AES-128/256-GCM, HMAC-SHA256 message authentication, memory-constrained TLS 1.3 with mbedTLS, X.509 certificate validation, and anti-replay sequence number tracking),
  `iot-c-power` (microcontroller sleep modes: Active, Modem-sleep, Light-sleep, Deep-sleep, CMOS leakage currents, pin isolation, low-power RTC slow memory persistence across hardware resets, duty-cycle energy budgets, Coulomb counting, and Brown-Out Detection),
  `iot-c-ota` (Flash partition tables, dual-bank A/B partitioning (ota_0, ota_1, otadata), binary image headers with magic words, streaming SHA-256 verification, bootloader rollback guards with PENDING_VERIFY, and log-structured NVS wear leveling),
  and `iot-c-capstone` (production edge IoT firmware suite architecture: HAL/BSP layered design, multi-task watchdog supervision preventing deadlocks, naked assembly/C HardFault handlers with stacked register capture, telemetry circular queuing, and remote diagnostics).
- **Curriculum structure**: 40 checkpointed lessons (each with a 3-choice practice question), 10 guided setup labs with expected results, 10 complete self-contained C programs (downloadable as `<id>.c`), 10 applied challenges, and 10 five-question 80% exams (90 questions total, all IDs unique).
- **Verification**: `backend/tests/test_iot_c_content.py` parses the JSON, compiles all 10 C programs with `gcc -std=c11 -Wall -Wextra`, executes each binary ensuring exit code 0, asserts lesson/exam question structure and ensures all 90 question IDs and 40 lesson IDs are globally unique. Frontend tests in `iotC.test.jsx` (6/6 pass) verify hub rendering, C code downloads, exam submission, and 404 handling.
- **Wiring & Integration**: Route in `App.jsx`, nav active section in `AppHeader.jsx`, course directory card in `coursesDirectory.js` (`hardware` domain, `ALL_COURSES` count bumped to 19), landing footer link, sitemap updated (539 URLs, `vite-sitemap.test.js` passes), backend certificate catalogue updated (`iot-c.json`, total certificate courses bumped from 234 to 244, `test_certificates.py` passes), and 20+ Indonesian localization entries in `i18n/id.json`. Read `docs/IOT_C.md`.

### Game modding & reverse engineering reading track (2026-10-20)

Added a comprehensive ten-course **Game Modding & Reverse Engineering track** (`/game-modding`, `content/gamemodding.json`) rendered on the
shared `features/courses/ReadingTrack.jsx` shell and configured by `features/gamemodding/GameModdingPage.jsx`:
- **10 courses**: `mod-architecture` (game loops, fixed timesteps, ECS vs OOP, modding taxonomy, user/kernel anti-cheat boundaries),
  `mod-memory-internals` (process virtual memory, ASLR rebasing, multi-level pointer chains, memory scanning algorithms),
  `mod-reverse-engineering` (x86-64 assembly, calling conventions, VMT layout, shadow vtables, AoB wildcard signatures),
  `mod-native-hooking` (DLL injection, 64-bit far jumps, trampolines, `FlushInstructionCache`, DirectX `Present` hooks),
  `mod-unity-bepinex` (Mono vs IL2CPP, `Assembly-CSharp.dll` decompilation with dnSpy, BepInEx 5 plugins, `ConfigEntry`, IMGUI),
  `mod-harmony-patching` (dynamic runtime patching, Prefix short-circuiting, Postfix return modification with `__result`, CIL Transpilers),
  `mod-unreal-engine` (UE4/5 reflection, `UObject`, `GUObjectArray` iteration, universal `UObject::ProcessEvent` hooking, UE4SS),
  `mod-lua-scripting` (embedded Lua C API, virtual stack, C++ host function bindings, sandboxing unsafe packages, event dispatching),
  `mod-assets-savefiles` (asset virtual filesystems, PAK archive parsing/compression, binary save file serialization, CRC32 checksum recalculation),
  and `mod-capstone` (production mod suite architecture, Dear ImGui in-game menu overlay, thread-safe command queues, SEH exception safety, Thunderstore/Nexus packaging).
- **Curriculum structure**: 40 checkpointed lessons (each with a 3-choice practice question), 10 guided setup labs with expected
  results, 10 complete self-contained code artifacts in C++, C#, or Python (downloadable as `<id>.<ext>`), 10 applied challenges, and 10 five-question
  80% exams (90 questions total, all IDs unique).
- **Verification**: `backend/tests/test_gamemodding_content.py` parses the JSON, validates all multi-language code artifacts (syntax-checking all C++ code with `g++ -std=c++17 -fsyntax-only` and Python code with `ast.parse`), asserts lesson/exam question structure and ensures all 90 question IDs and 40 lesson IDs are unique. Frontend tests in `gamemodding.test.jsx` (6/6 pass) verify hub rendering, code downloads, exam submission, and 404 handling.
- **Wiring & Integration**: Route in `App.jsx`, nav section in `AppHeader.jsx`, course directory card in `coursesDirectory.js`
  (`desktop` domain, `ALL_COURSES` count bumped from 17 to 18), landing footer link, sitemap updated (528 URLs, `vite-sitemap.test.js` passes),
  backend certificate catalogue updated (`gamemodding.json`, total certificate courses bumped from 224 to 234, `test_certificates.py` passes),
  and 20+ Indonesian localization entries in `i18n/id.json`. Read `docs/GAMEMODDING.md`.

### Kubernetes reading track (2026-10-20)

Added a comprehensive ten-course **Kubernetes track** (`/kubernetes`, `content/kubernetes.json`) rendered on the
shared `features/courses/ReadingTrack.jsx` shell and configured by `features/kubernetes/KubernetesPage.jsx`:
- **10 courses**: `k8s-architecture` (control plane, node agents, reconciliation, quotas), `k8s-pods-workloads`
  (pod lifecycle, init/sidecar containers, ReplicaSets, rolling updates), `k8s-config-secrets` (ConfigMaps, Secrets,
  volume mounts vs env, immutability), `k8s-services-networking` (IP-per-pod, ClusterIP/NodePort/LB, Headless, CoreDNS,
  EndpointSlices), `k8s-ingress-gateway` (L7 routing, Ingress retirement, Gateway API with weighted canary splitting),
  `k8s-storage-persistence` (emptyDir/hostPath, PV/PVC, StorageClasses, WaitForFirstConsumer), `k8s-statefulsets-daemonsets`
  (StatefulSets, volumeClaimTemplates, DaemonSets, batch Jobs/CronJobs), `k8s-scheduling-resilience` (scheduler filtering/scoring,
  affinity/anti-affinity, taints/tolerations, startup/liveness/readiness probes, QoS, OOMKilled), `k8s-security-rbac` (least-privilege
  RBAC, ServiceAccounts, default-deny NetworkPolicies, Restricted PSS, securityContext), and `k8s-capstone` (production microservice
  architecture with PDB, HPA v2 autoscaling, Helm packaging, and GitOps workflows).
- **Curriculum structure**: 40 checkpointed lessons (each with a 3-choice practice question), 10 guided setup labs with expected
  results, 10 complete self-contained YAML manifests (downloadable as `<id>.yaml`), 10 applied challenges, and 10 five-question
  80% exams (90 questions total, all IDs unique).
- **Verification**: `backend/tests/test_kubernetes_content.py` parses all YAML documents across all 10 courses with PyYAML,
  asserting valid `apiVersion`, `kind`, `metadata.name`, selector-to-label consistency, valid container and port structures,
  and proper probe configurations. Frontend tests in `kubernetes.test.jsx` (6/6 pass) verify hub rendering, manifest downloads,
  exam submission, and 404 handling.
- **Wiring & Integration**: Route in `App.jsx`, nav section in `AppHeader.jsx`, course directory card in `coursesDirectory.js`
  (`systems` domain, `ALL_COURSES` count bumped to 17), landing footer link, sitemap updated (517 URLs, `vite-sitemap.test.js` passes),
  backend certificate catalogue updated (`kubernetes.json`, total certificate courses bumped from 214 to 224, `test_certificates.py` passes),
  and 20+ Indonesian localization entries in `i18n/id.json`. Read `docs/KUBERNETES.md`.

### Seeded showcase projects (2026-10-14)

Added eight rich, interactive seeded projects to `content/showcase.json` for the community showcase (`/showcase`),
covering Arduino Uno, Arduino Nano, ESP32, and Raspberry Pi 4:
- **Smart Crosswalk Controller** (`crosswalk`, Uno): intersection traffic signal and pedestrian crossing state machine.
- **IoT Climate & Weather Station** (`greenhouse`, ESP32): DHT22 temperature telemetry with WiFi/MQTT and LCD output.
- **Acro QuadX Racing Drone** (`quadxflight`, ESP32 drone): tuned 5-inch aerobatics quadcopter with MPU6050 and VoltFlight.
- **Night Owl Light-Activated Lamp** (`nightowl`, Uno): LDR photoresistor divider with analog reading and PWM drive.
- **Simon Says Memory Challenge** (`simongame`, Uno): three-color LED and pushbutton sequence memory game.
- **Capacitive Touch Lamp** (`touchlamp`, ESP32): capacitive touch input driving a desk lamp.
- **Python Traffic Signal Controller** (`pitraffic`, Raspberry Pi 4): UK/European traffic sequence using Python + gpiozero.
- **Morse Code Optical Beacon** (`nanomorse`, Nano): optical Morse code transmitter with timed dot/dash pulses.

Automatic idempotent database seeding runs during application startup (`app/main.py:lifespan` via
`seed_showcase_projects(db)`). All 8 projects pass both backend `validate_board` checks and frontend `validateProject`
rules, support direct fork and inspection, and can be linked to `/community` discussions.
Backend tests add `test_showcase_seed.py` (3/3 pass), frontend adds showcase sandbox assertions (3/3 pass).

### CUDA track expanded to 10 courses (2026-10-12)

The CUDA track went from 8 to 10 courses to match PyTorch's depth with more advanced material: added
**`cuda-libraries`** (Thrust + cuBLAS) and **`cuda-multigpu`** (device enumeration, peer-to-peer, NCCL) before
the capstone (streams stays 7, capstone → 10). Both are complete, self-contained `.cu` programs; all ten CUDA
programs compile with `nvcc` 12.6 in an `nvidia/cuda` container (10/10, no errors — compiling needs no GPU),
and both new pages render in Chromium with no console errors. Counts updated everywhere: `cuda.test.jsx`
(10), hub metrics and the `/courses` card (10 courses · 40 checkpoints · 10 exams), certificate catalogue
(now **214**, `test_certificates.py` bumped), sitemap (**506 URLs**), `docs/CUDA.md`, and Indonesian chrome.
Full suite **1,803 frontend / 123 backend pass**.

### Kernel, load-balancing and distributed-systems tracks (2026-10-12)

Three more reading-only tracks on the shared `features/courses/ReadingTrack.jsx` shell, all beyond the PRD.
**`/kernel`** (`content/kernel.json`, 8 courses) teaches Linux kernel modules with real, idiomatic C
(`register_chrdev`, `simple_read_from_buffer`/`simple_write_to_buffer`, `proc_ops`, mutexes around
`copy_*_user`, reverse-order cleanup). **`/loadbalancer`** (`content/loadbalancer.json`, 8 courses) covers
L4/L7, NGINX, HAProxy, Kubernetes Services + MetalLB and the **Gateway API** (ingress-nginx retired March
2026); each course carries its own `codeExt` (`conf`/`cfg`/`yaml`). **`/distributed`**
(`content/distributed.json`, 10 courses) uses runnable, stdlib-only Python simulations (clocks, quorums,
LWW, Raft election, consistent hashing, 2PC/sagas, a sharded replicated KV store).

`ReadingTrack` gained a per-course `codeExt` (`course.codeExt ?? track.codeExt`) and a per-track `codeNote`.
Verification used the real tools: all **8 kernel modules compiled** out-of-tree against Linux 6.8 headers in
a container (8 `.ko`, no errors); the **NGINX and HAProxy configs load and balance** across `traefik/whoami`
backends in Docker (`nginx -t` passes for every config incl. all algorithm variants; end-to-end alternates
backends); the built-in **Kubernetes** capstone passes `kubectl --dry-run=client`, and the MetalLB/Gateway
API CRD manifests are YAML-parsed and structurally checked only; and
`backend/tests/test_distributed_content.py` **executes all 10 Python programs** (exit 0, stdlib-only,
deterministic). A new `systems` domain groups the three in the `/courses` directory
(`ALL_COURSES` now 16). Wiring: routes, nav, sitemap (504 URLs), certificate catalogue (now **212** courses),
40 Indonesian chrome strings, and three UI test files. Full suite **1,803 frontend tests in 107 files / 123
backend tests pass**; `eslint src` clean apart from the pre-existing `qt/samples.js` errors; build **615.6
KiB** eager gzip (new routes lazy). See CONTRACTS.md §27, KERNEL.md, LOADBALANCER.md, DISTRIBUTED.md.

### AVR assembly track and CUDA / PyTorch reading tracks (2026-10-11)

Three new learning tracks, all beyond the PRD. **`/avr`** is eight 8-bit AVR assembly courses on an
in-browser teaching-subset assembler and deterministic ATmega simulator (`engine/avr/`), plus a retrofit
of the Computer Architecture sandbox into that assembler IDE at `/sandbox?bench=computer&asm=1`
(`docs/AVR.md`). **`/cuda`** (eight courses) and **`/pytorch`** (ten courses, tensors → autograd →
`nn.Module` → training loop → datasets → regression → MLP → CNN → eval/save → full pipeline) are
reading-only tracks sharing one content-driven `features/courses/ReadingTrack.jsx` hub/course shell, wrapped
by thin `CudaPage.jsx`/`PytorchPage.jsx` (`docs/CUDA.md`, `docs/PYTORCH.md`).

Each course has four checkpointed sections with questions, a guided lab with an expected result, a complete
self-contained program copied or downloaded as `<id>.cu`/`.py` (never run in the browser), an applied
challenge and a five-question 80% exam. torch and `nvcc` are not available in this repo, so nothing is
executed or compiled: each PyTorch program is parsed and checked for undefined names with `ast` + `symtable`
by `backend/tests/test_pytorch_content.py` (not run), and each CUDA program is a complete `nvcc` unit
reviewed by hand (not compiled). Progress, rewards,
localization and certificates reuse the existing systems; the certificate catalogue adds `avr.json`,
`cuda.json` and `pytorch.json`, and the three tracks were added to the `/courses` directory
(`coursesDirectory.js`), the nav section map and the sitemap. 40 Indonesian chrome strings were added.

Honesty is preserved: there is no GPU, Python or AVR hardware in the browser; the hub disclosures state
the NVIDIA GPU + CUDA Toolkit and Python 3 + torch requirements, and lab checkboxes record the learner's
own observations only. Full suite **1,787 frontend tests in 104 files / 122 backend tests pass**; `eslint
src` is clean apart from the pre-existing `qt/samples.js` errors; the production build is **613.0 KiB**
eager gzip (new routes lazy) and the sitemap has **475 URLs**. Backend issues and parses original
certificate PDFs for all **186** courses. Chromium at 1280 px verified both hubs and course pages. See
CONTRACTS.md §27 and IMPLEMENTATION_STATUS.md.

### Cybersecurity security console (2026-09-28)

The cybersecurity sandbox (`/sandbox?bench=cybersecurity`) is now a security workbench combining the
three tools the user named: a **Packet Tracer-style network topology** (`CyberTopology.jsx` +
`topology.js`), a **curl terminal** (`curl.js` parse/format) and a **browser DevTools-style inspector**
(Network list, Headers/Response/Preview/Elements/Security/Trace, plus the fixture account state).
The Elements tab renders an **inert DOM tree** (`inspectHtml.js`) so the XSS lesson shows injected
markup as element nodes with a flagged `onerror` handler, without ever creating a real element or
running a script. It sits on the shared VS Code-style workbench (dark/light) used by AI agents and HPC.

Course pages keep the form-based `CyberLab`; both it and `CyberConsole` share `useCyberNotebook.js`,
so requests, defenses, verification, save/load/import and reports behave identically and every
existing boundary holds: fictional local fixtures, inert HTML, no network and no code execution. The
terminal is ephemeral scrollback and does not change the saved notebook (lab, defenses, notes). New
pure modules have unit tests (`console.test.js`); the sandbox UI tests were rewritten to drive the
terminal and DevTools. Full suite **1,760 frontend / 121 backend**; eager payload 604.3 KiB gzip.

### Sandbox IDE benches and shell consistency (2026-09-28)

The request was a more consistent, truer and more detailed sandbox. "Truer" turned out to mean the
software look: MATLAB like the MATLAB IDE, AI agents like an IDE such as Antigravity, HPC as a
full-featured IDE.

**Shared pieces.** Three notebook hooks (`useMatlabNotebook`, `useAgentNotebook`, `useHpcNotebook`)
now own state for both the course labs, whose markup is unchanged, and the new IDE views.
`features/sandbox/ide/` holds:
- `CodeEditor` (labelled textarea, highlighted copy, gutter);
- tokenizers for MATLAB (from the real lexer rules), C/C++, JSON, Markdown, JS and Python;
- line edits and a line diff;
- `useElementSize`;
- the shared dark/light VS Code-style workbench (`Workbench.jsx`, `workbench.css`).

**MATLAB** (`MatlabIde`):
- Toolstrip, address bar and Current Folder with Details.
- Editor with a parser-backed code check.
- Command Window that replays the session. The rule is disclosed on the pane and in README.txt.
- Workspace table, PLOTS › plot, a real-pixel figure with data tips, Help search and Command
  History.

**AI agents** (`AgentIde`):
- Editor view: explorer, editors, panel (Problems, Trace, Ledger, Checks, Run locally) and an agent
  thread with approvals and questions.
- Agent Manager: conversations, the thread, and Plan/Changes/Ledger/Context artifacts.
- The model stays a scripted fixture, and the title bar says so.

**HPC** (`HpcIde`):
- Explorer with both drafts, BUILD.md and the run configuration.
- C/C++ editor with compare-to-example.
- Run configuration pane.
- Results, Output (a run log with no wall times) and Build (exact commands) panels.
- Project ZIP: sources, `build.sh`, README.

**Shell fixes:**
- Removed false copy: "Local work is saved", "Saved locally", FFT, ArUco, laser scans and "OpenMP
  multithreading".
- Directory counts are pinned to the registry and content by tests.
- One canonical name per bench.
- The rail is the only bench switcher: the circuit bench's Sandboxes tab and seven menu items are
  gone, `SandboxListPanel` is deleted, and `LEFT_TABS` drops `sandboxes`.
- Rail text is at least 11 px; invalid `py-0.2`/`shadow-xs`/`surface-subtle` classes are fixed.
- An unsaved-work guard covers seven benches.
- `saveDraft()` runs only when leaving circuit or drone.
- `SandboxBenchLayout` imports `workspace.css`. Before, a directly opened bench skipped the shell's
  viewport rules.

**Filenames:** MATLAB downloads use valid names (`matlab_start.m`, `matlab_ode_desktop.m`) on the
course page too. The Indonesian UI gets 273 new strings. Product panel names (Command Window,
Workspace, Explorer, Agent Manager) stay English, as in those tools.

**Verification:**
- `npx vitest run`: **1,697 tests in 98 files** pass (including a guard test that mounts all seven explicit-save benches and presets clean).
- `pytest`: **121** pass.
- `vite build` succeeds. Eager payload is **602.9 KiB** gzip against the 1,500 KiB budget; a clean
  HEAD build measures 595.0, the difference being the new strings. The IDEs are lazy chunks.
- `npx eslint src` has only the pre-existing 19 `qt/samples.js` errors and 2 CampaignMap warnings.
  `make check` would still stop there, so the steps were run individually.
- Chromium via Playwright (en-US), at 1440, 1024, 768/767/640 and 390 px, with no page-level
  horizontal overflow and no console errors:
  - MATLAB Run, commands, plots and workspace;
  - agent approve/deny, Agent Manager and themes;
  - HPC run, results and build;
  - the unsaved prompt, with no draft written.
- The stale `public/sitemap.xml` was missing eleven ethics URLs. It was regenerated, and its test,
  red on HEAD, now passes.

**Not verified or not done:**
- Safari, Firefox and real touch devices.
- Screen-reader passes.
- The other benches (circuit art, drone, computer, cybersecurity, vision, robotics) keep their
  existing look.
- Course pages still embed the classic labs rather than the IDEs.
- `coursesDirectory.js` repeats the false ArUco claim, and course/tutorial files still use
  `surface-subtle`/`shadow-xs`; both are outside the sandbox and untouched.

### Community discussions (2026-09-21)

Open **`/community`**, or `/community?project=<slug>` from a published showcase project's **Discuss**
link. Additive `discussion_threads` / `discussion_posts` tables are created by the existing startup
`create_all()`; no migration tool was introduced. New layers: `app/domain/community.py` (fixed
sections, text limits, normalizers — framework independent), `app/schemas/community.py`,
`app/services/community.py`, `app/api/routes/community.py`, and
`frontend/src/features/community/{CommunityPage,ThreadPage,PostBody}.jsx` + `timeAgo.js`.
`PermissionDenied` → 403 was added to the shared error taxonomy, because a public discussion must not
answer a non-author write with 404.

Reading is public; writing takes the player token the app already issues to guests — the rule
certificates and the assistant use, and the identity that may already publish to the showcase.
`is_deleted` means withdrawn by its author and is the only deletion: a withdrawn reply keeps its
place without its text, a withdrawn question with no replies 404s, and one with replies stays
readable with an empty body and takes no new replies. `reply_count` / `last_activity_at` are
denormalized and maintained on every reply create and withdrawal. `PostBody.jsx` rebuilds posts as
React elements — code fences, inline backticks and validated http(s) links — with no
`dangerouslySetInnerHTML` and no Markdown engine.

Individual verification (not one `make check` run, see below): **1,637 frontend tests in 95 files**
and **121 backend tests** pass, the production build succeeds at **556.9 KiB** eager gzip against the
1,500 KiB budget, and both community pages are lazy chunks. The sitemap now holds **435 URLs**;
`/community` is indexed and `/community/:threadId` is not, with `Disallow: /community/` in robots.txt.
Interface text is translated to Indonesian (65 new keys).

**Pre-existing failures found, not caused by this work and not fixed:** `npx eslint src` reports 19
`no-undef` errors in `src/features/qt/samples.js` (CMake snippets written as untagged template
literals), confirmed on a clean stash of HEAD. `make check` therefore stops at the lint step, which
is why the steps above were run individually. The checked-in `public/sitemap.xml` was also stale by
seventeen `/qt` URLs and its test was already red on HEAD; regenerating it here fixed that too.

The shared header changed for **every** route: a fifth nav segment does not fit in a 640 px header,
so its `SegmentedControl` now starts at `md:` and 640–767 px falls back to the native section select
that mobile already used. Reading a discussion costs a constant 9 SELECTs at any reply count.

**Not verified:** no browser session exercised these pages, so layout, mobile width and the real
network path are unconfirmed. The header breakpoint above was chosen from measured element widths,
not observation — no headless browser exists in this workspace and jsdom has no layout engine.
Check the header at 640/767/768 px in a real browser before release; it affects every route. The write budgets were exercised in one process only; a multi-worker
deployment gets one budget per worker. No load or abuse testing was done.

### C++ / WinUI desktop app courses (2026-09-20)

Open **`/winui`**, linked from Courses, Tutorials and the home footer. Thirteen courses
cover WinUI 3 setup, XAML, C++ events and validation, binding/collections, navigation,
dialogs, async lifetimes, files, HTTP API requests, accessibility/localization, testing,
deployment and a task notebook capstone. Each includes four sections with independent checkpoints,
a guided Windows lab, source files, an applied challenge and a five-question 80% exam:
**52 sections, 52 checkpoints and 65 exam questions**. Existing progress, rewards and
certificates apply; backend grading includes every new WinUI exam.
Interface text supports Indonesian with a disclosed English curriculum/source fallback.

Every course supplies an exact XAML/C++ ZIP with Visual Studio template instructions,
portable validation tests and a release checklist. Native labs require Windows and a
packaged C++ WinUI project; packs are replacement files, not standalone solutions. The
capstone adds/removes tasks and explicitly saves/loads validated local JSON. Browser
code does not compile, execute or simulate WinUI. Binding MVVM and Frame history are
documented extension exercises. The API course includes real C++ GET/POST source, a
local Python fixture and a runnable JavaScript `fetch` comparison; twelve regression cases
exercise actual loopback HTTP, including creation/readback. Native cancellation and HTTP
transport remain Windows verification work. Read `docs/WINUI.md` for execution and source boundaries.

Isolated full `make check`: **1,619 frontend tests / 93 files, 109 backend tests**, lint and the
production build pass, with **555.1 KiB** eager gzip. The WinUI route remains lazy; the
sitemap contains **417 URLs**. Tests independently extract all thirteen ZIPs and compile/
execute **18 portable C++ rule checks**. Certificate tests issue and parse PDFs for all
134 courses in that snapshot. Existing CampaignMap hook warnings and the Node localStorage notice remain.

Production Chrome with isolated SQLite verified all thirteen course routes and source ZIPs,
exact displayed/downloaded C++, search/stage filtering, independent checkpoints, incomplete
exam rejection, persisted 80% grading and retained learning/source state across Indonesian
switching. Capstone certificate issuance, its exact PDF hash and browser PDF verification
passed. The API course adds exact companion downloads, downloaded HTTP test execution,
its own exam/certificate and a wider mobile file selector. Courses/Tutorials/home navigation
and desktop/390 px layouts pass without page overflow. No browser application or console
errors occurred. Native Windows compilation,
launch, Narrator and MSIX install/update were not executed on this macOS host; source
structure checks and portable tests do not establish those results.

### AI agent courses, guided tutorials and a JavaScript/Python CLI (2026-09-19)

Open **`/ai-agents`**, linked from Tutorials, Courses and the home footer, or
**`/sandbox?bench=ai-agents`**. Twenty courses progress through agent foundations, Codex,
Claude Code, Google Antigravity, instructions, context, tokens, cost, tool schemas, using and
creating skills, MCP, app integrations, secure harnesses, retrieval, multimodal tools,
subagents, durable workflows and evaluation, ending in a personal CLI. Includes **80 sections,
80 independent checkpoints, 100 exam questions and 20 guided tutorials** with editable presets,
expected observations and applied challenges. Existing `vq.courses.v1` stores reading checks
and exam scores; incomplete/duplicate submissions do not add attempts. Sources reviewed on
2026-09-19 link to official documentation. The MCP fixture pins protocol 2025-11-25 explicitly;
it does not claim to implement every current MCP feature or a vendor agent.

`engine/agents/model.js` validates and executes scripted proposals against an in-memory workspace,
document search, issue tracker, skill loader and MCP lifecycle/tool/resource/prompt fixture.
Learners inspect real outcomes, approve or deny writes, answer questions, compact context, compare
cache/input/output estimates and run six behavioral regression checks. Limits, scopes and schemas
are enforced before tool execution. Token estimates and editable hypothetical prices are disclosed;
no browser inference, network, shell, host filesystem or arbitrary native source execution is added.

Independent `voltquest-ai-agents` notebooks preserve exact unfinished JSON, SKILL.md, JavaScript,
Python and notes under `vq.ai-agents.v1.<lesson>`. Load/import/reset/preset changes confirm replacement;
import discards invented evidence and approvals. Editing run inputs invalidates observed results.
Trace reports capture actual configuration and events. Interface text supports Indonesian with a
disclosed English curriculum/technical fallback, retaining working and assessment state on switching.

Both downloadable CLIs run offline with real question/approval prompts, virtual tools and verification.
Their optional live mode uses a chosen OpenAI model and environment credentials, with a separately
enabled read-only GitHub integration, fixed hosts, bounded requests/responses and no automatic retries.
Tests exercise both source files and mock their provider/integration transports. The virtual workspace
is an application boundary, not an OS sandbox; live mode has request/token bounds, not a hard dollar cap.
Live paid inference, real accounts and vendor CLI sessions were not executed in this workspace.

Full `make check`: **1,496 frontend / 104 backend** tests, lint, production build and **545.8 KiB**
initial gzip pass. The final input-validation refinement passes **88 targeted tests** and a production
rebuild. The new page and harness chunks remain lazy; sitemap contains **363 URLs**. Production Chrome
with isolated SQLite verified all twenty preset runs, the capstone question/approval/write/readback,
six regression checks, exact source/trace downloads, notebook save/load/import confirmation and a
390 px layout with preserved Indonesian state. Incomplete exams were rejected, an 80% pass and
reading check survived reload, and language switching retained selected answers. Both native demo
CLIs completed with actual terminal input and approved writes. See AI_AGENTS.md for verification limits.

### Expanded sitemap indexing for courses, tutorials, benches and variants (2026-09-18)

Expanded `frontend/vite-sitemap.js` and `frontend/public/sitemap.xml` to include crawlable entry points previously unindexed:
- **5 course track hubs**: `/courses?track=programming`, `electrical`, `iot-parts`, `iot-foundations`, `drone-foundations`.
- **6 tutorial board hubs** and **2 topic hubs**: `/tutorials?board=uno`, `nano`, `esp32`, `esp32s3`, `raspberrypi4`, `raspberrypi5`, plus `/tutorials?topic=iot-foundations`, `drone-foundations`.
- **65 tutorial board variants**: `/tutorials/:id?board=:board` covering all 106 interactive tutorial/board combinations.
- **5 dedicated sandbox benches**: `/sandbox?bench=matlab`, `cybersecurity`, `hpc`, `vision`, `robotics`.
- **49 sandbox bench lesson presets**: preconfigured interactive workbenches for each lesson/course in vision (6), robotics (5), HPC (10), MATLAB (18), and cybersecurity (10).

Total sitemap index increased from 168 to **300 unique URLs**. All URLs are well-formed XML with proper `&amp;` escaping, tested with Vitest and verified in production build.

### MATLAB courses, function reference and editable numerical sandbox (2026-09-17)

Open **`/matlab`**, linked from Tutorials/Courses, or **`/sandbox?bench=matlab`**. Eighteen ordered
courses progress through workspace/types, arrays, mathematics, programming, plots, linear algebra,
data/statistics, fitting, calculus, ODE simulation, signals, feedback/Simulink concepts, Monte Carlo,
optimization, performance, parallel/GPU concepts, specialist products and a thermal capstone.
Each has four substantial sections with an individual checkpoint, four guided steps, an editable
script, an applied challenge, a desktop companion and a five-question 80% exam: **72 sections,
72 section questions, 90 exam questions**. Existing `vq.courses.v1` stores checks and scores;
practice, incomplete and duplicate submissions do not add exam attempts.

`engine/matlab/{parser,numeric,functions,model}.js` implements a finite-real MATLAB-style subset:
one-based column-major arrays, matrix/element operators, indexed assignment, control flow,
anonymous captures, small pivoted/QR solves, statistics, interpolation, fitting, integration,
bracketed roots, deterministic random experiments and real plot data. No eval, host bridge,
network, filesystem, backend execution, toolbox runtime, complex arithmetic or GPU/parallel
execution is added. Work/allocation limits complement five-second Worker deadlines. Every Run
starts fresh; edits/cancellation/disposal stop the Worker and invalidate old results.

The searchable **244-entry** reference exposes **73 exact executable function signatures** and
links to official MathWorks documentation/full catalog. Desktop-only entries name required
products. Browser fzero uses bisection and rng a different generator from MATLAB; conv follows
the R2026a orientation rule. Native MATLAB/toolbox companions were not executed in this workspace
because MATLAB is not installed; all 18 browser scripts and 73 reference examples are executed
in tests. Do not describe the teaching subset as full MATLAB or claim measured native speedups.

`voltquest-matlab` notebooks retain exact source (including unfinished code) and notes under
`vq.matlab.v1.<courseId>`. Load/import/reset/preset changes confirm replacement; imports discard
fabricated results. `.m` exports match the editor; computed-result JSON captures actual source,
output, bounded workspace previews and full bounded plot series. Interactive plots offer sample
inspection and paginated data. Interface text supports Indonesian with a disclosed English
curriculum/reference fallback; changing locale preserves all working and assessment state.

Full `make check`: **1,416 frontend / 104 backend**, production build and **527.9 KiB** initial
gzip pass. Final targeted **174 tests** and production rebuild pass after the convolution/reference
refinement. MATLAB chunks remain lazy; sitemap has **167 URLs**. Only the two existing CampaignMap
hook warnings and Node localStorage notice remain. Production Chromium with isolated SQLite
verified all 18 actual Worker scripts, edited calculations and plot data, exact `.m`/JSON downloads,
save/reload/import confirmation, unsupported-call errors, independent section questions, incomplete
exam rejection, persisted 80% grading, locale preservation and desktop/390 px layouts without page
overflow. Tutorials/Courses/home navigation worked; no browser application errors were observed.
Cross-browser, real-device performance and actual MATLAB/toolbox execution remain verification limits.

### Cybersecurity courses and web vulnerability sandbox (2026-09-15)

Open **`/cybersecurity`**, linked from Tutorials/Courses, or **`/sandbox?bench=cybersecurity`**.
Ten ordered courses cover HTTP/information exposure, object authorization, session-role trust,
SQL injection, HTML/XSS, path traversal, CSRF, SSRF, mass assignment and a combined investigation.
Each has four detailed sections, four guided steps, an interactive lab, an applied challenge,
three practice questions and a five-question 80% exam. Existing `vq.courses.v1` stores section
checks and best/last scores; practice, incomplete submissions and duplicates don't add attempts.

`engine/cybersecurity/{model,scenarios}.js` executes bounded local request handlers with fictional
accounts, orders, products, files and service fixtures. Learners edit method/path/headers/body,
inspect actual responses and mutations, toggle nine defenses and retest. The profile-to-admin
chain uses changed fixture state between requests. The capstone starts with three independent
weaknesses and runs 30 checks including normal behavior and alternate probes. SQL has a small
documented parser; HTML is inert source with a structural indicator, not script-execution proof.
No proxy/scanner, real network, host filesystem, arbitrary code or backend execution is added.

`voltquest-cybersecurity` notebooks retain exact request drafts, controls and notes, with separate
`vq.cybersecurity.v1.<lab>` saves and confirmed load/import/reset/lab selection. Unfinished JSON
can be saved but cannot be sent. Imports discard fabricated evidence. Reports export the latest
30 captured exchanges (explicit truncation), current controls, regression results and notes.
Changing defenses resets shop state and invalidates verification; history remains inspectable.
The independent formats don't extend CircuitDoc, accounts, public course APIs, MCP or showcase.
133 interface translations support Indonesian; narratives/questions/technical traces use a stated
English fallback. Locale changes preserve the whole investigation and assessment choices.

Full `make check`: **1,241 frontend / 104 backend**, production build and **525.1 KiB** initial gzip
budget pass. Only the two existing CampaignMap hook warnings and Node localStorage notice remain.
The model/page chunks stay lazy, and the generated sitemap contains **148 URLs**. Final targeted
tests and production rebuild also pass after the response media-type/localized-label refinement.
Production Chromium with isolated SQLite verified all ten normal/probe/patched flows, the actual
privilege chain, 30/30 capstone checks, exact notebook/report downloads, save/reload/import with
confirmation, incomplete-exam rejection, 80% grading/persistence, language-state retention and
desktop/390 px layouts without page overflow. Tutorial/Course links work; no browser application
errors were reported. Other browsers and real-device performance remain release checks.

### High-performance computing in C / C++ (2026-09-14)

Open **`/hpc`**, linked from Tutorials and Courses, or **`/sandbox?bench=hpc`**. Ten ordered courses
cover native correctness/ownership, benchmarking, memory locality, matrix tiling, SIMD, OpenMP
reductions, scheduling, Amdahl/Roofline, MPI collectives and a distributed stencil. Each has four
detailed sections, two formula cards, four experiment steps, three practice questions, a five-question
80% exam, a native source walkthrough, executable test cases and an applied challenge. Existing
`vq.courses.v1` saves read sections and best/last exam scores. Standard course APIs remain separate.

`engine/hpc/model.js` implements actual bounded arithmetic and reference comparisons plus explicitly
labeled cache/scheduling/scaling/communication models. Fresh Workers have deadlines/cancellation and
ignore stale responses; parameter edits invalidate prior results. The independent `voltquest-hpc`
file preserves settings, C and C++ drafts and notes; import/load/reset confirm replacement. Saves
use `vq.hpc.v1.<lab>`, outside circuit/account/MCP/showcase storage. Source edits affect downloads,
not browser Run. New UI controls support Indonesian; HPC narratives/questions use English fallback.

The same source generator supplies twenty standalone native examples to the editor and verification
script. **20 native builds / 126 behavioral executions pass**, including real OpenMP and MPI with
one, two and four threads/processes. **10 core builds / 36 runs also pass with ASan/UBSan**. Tests
cover odd sizes, clipped tiles, vector tails, synchronized reductions, schedule variants, zero-count
MPI ranks and multi-step halos. Use `make test-hpc-native`; Apple Clang needs `HPC_OMP_PREFIX` pointing
to libomp. Multi-node network performance and GPU execution are not implemented or claimed.

Full `make check`: **1,181 frontend / 104 backend**, production build and **521.1 KiB** initial gzip
budget pass; only the two existing CampaignMap hook warnings and Node localStorage notice remain.
HPC page/model chunks stay lazy. The sitemap now has **137 URLs**. Production Chromium with an
isolated SQLite backend verified all ten Worker experiments, deliberate stale-halo failure, changed
settings clearing results, exact edited source/JSON downloads, import confirmation, save/reload,
80% exam grading/persistence, English/Indonesian state preservation and 390 px layouts without page
overflow. Tutorials/Courses links work and no browser application errors were reported. Read HPC.md
for models, limits, native setup and remaining cross-browser/real-device verification boundaries.

### C, C++ and Arduino / ESP32 programming courses (2026-09-14)

Open **`/courses?track=programming`**, also linked from Tutorials and Courses. Twelve ordered
courses cover C/C++ and framework distinctions, sketch lifecycle, numeric types/overflow, decisions,
functions/scope, arrays/C strings/pointer lifetime/bit flags, C++ objects/libraries, ADC/PWM portability,
millis/debounce/rollover, serial framing/debugging, state machines, ESP32 HTTP and an MQTT capstone.
There are **36 new lessons, 24 practice questions, 60 exam questions and 12 exams**, with worked
examples, application exercises, explicit expected output and guided experiments. The full Courses
catalogue now has **34 courses / 102 sections / 58 formula cards / 238 questions / 34 exams**.

Every new course includes a complete copyable/downloadable sketch with a supported-board selector
and separate-tab prepared-lab link. Learners explicitly paste into the lab editor; opening the link
keeps the tutorial's original example. Course answers/read checks survive that link and language
switching. All new instructional/assessment prose supports English and Indonesian. Existing course
ids/versions and local progress remain intact; guides gain exact programming-section readings.
The public API accepts `track=programming` and returns the same code-example metadata. The generated
sitemap contains **126 URLs**. There are still 41 firmware tutorials / 106 original board variants.

Keep native and simulated capabilities distinct: Arduino sketches use C++, ESP32 names a chip family,
and native ESP-IDF/FreeRTOS and general classes/templates/pointer access are outside the interpreter.
The courses explain native signed-overflow rules, hardware ADC calibration and newer versus legacy
LEDC APIs. Networking is virtual; the MQTT lease sample does not implement production reconnect or
authentication. See COURSES.md for the additive `codeExample` schema and instructional boundaries.

Full `make check`: **1,127 frontend / 104 backend**, production build and **516.7 KiB** initial gzip
budget pass, with the two existing CampaignMap hook warnings. All **44 course-example/board pairs**
run through the real inline solver/VM and prepared circuits. Regressions cover explained output,
fragmented/oversized serial recovery, state timing, rollover, repeatable HTTP/real LED state, exact
MQTT commands, renewal and expiry, translations, API discovery, progress preservation and sitemap.

Production Chromium with an isolated SQLite backend verified course/API discovery, incomplete-exam
rejection, an 80% pass restored after reload, preserved answers/read checks/board across Indonesian
switching, exact `.ino` download, and a separate-tab Nano Worker run of the copied sketch. ESP32-S3
HTTP returned matching ON/OFF with solved LED brightness 0.527/0.000; the ESP32 MQTT example published
matching state and expired ON to OFF. Desktop and 390 px layouts fit without page overflow, and no
browser application errors occurred. Other browsers and real-device performance remain release checks.

### Sandbox 3D view and eight additional parts (2026-09-14)

`/sandbox` and saved circuit projects now offer a **2D / 3D** switch above the workbench. Three.js
is pinned locally at 0.186.0 and loads only when 3D first opens. Geometry derives from the existing
registry, resolved terminals and CircuitDoc, including all six controllers and dual-board ESP32/S3
footprints. Camera controls support mouse orbit/pan, zoom, keyboard alternatives, Fit and Top view.
Click a part or cable for the existing inspector; a labelled select provides keyboard part selection.
LEDs/RGB, NeoPixels, displays, servos, input states and damage consume existing simulation snapshots.
Part heights, controller bodies and wire arcs are illustrative, not mechanical CAD.

The SVG remains mounted/measured but inert in 3D, preserving its viewport and PNG export. Switching
views retains the current document, editor, undo history, controls and Worker run. Hidden 3D views
do not render; disposal releases GPU resources, frames and input listeners. WebGL2 unavailability,
context loss or lazy-load failure offers Return to 2D. View choice lasts for the mounted workspace;
it is not saved inside projects. Campaign/tutorial/drone/robotics/vision interfaces are unchanged.

The drawer now contains **37 types**, with search and category filtering. New parts: SPST slide
switch, magnetic reed switch, tilt switch, trimpot, adjustable resistor, NTC thermistor, force-sensitive
resistor and flex sensor. They have actual switch/pot/resistor models, controls, 2D/3D artwork,
English/Indonesian learning notes and illustrative BOM entries. NTC/force/flex curves are deterministic
teaching approximations. Pi still has no ADC. MCP metadata was regenerated; existing project, import,
save/fork and BOM paths accept all eight, including trimpot resistance in BOM grouping.

Full `make check`: **1,038 frontend tests / 103 backend tests**, production build and **476.8 KiB**
initial gzip budget pass, with only the two existing CampaignMap hook warnings. The optional 3D
chunks are about 149 kB gzipped combined and remain outside the eager payload. New tests exercise
all controller pin positions/rotations, every part's finite mesh data/disposal, real-solver LED
emission, firmware switch/ADC behavior, import/BOM/MCP round trips, fallback, localization and
same-run view switching. Existing tutorial and campaign gates pass in the current shared tree.

Isolated Chromium/SQLite checks verified adding all eight parts, mouse picking and camera orbit,
slide switch → real Worker GPIO13 → LED brightness 0.792, NTC 25→100 °C → ADC 512→956, unchanged
run id and SVG viewport across mode switches, saved-project opening, a **1416 × 1728 wiring PNG**
export while in 3D, and Indonesian at 390 px without page overflow. Production preview loaded the
local 3D chunks, switched through all six boards and returned to 2D after simulated context loss
while firmware kept running. No browser application errors occurred. Cross-browser and real-touch
performance remain release checks. See SANDBOX_3D.md and integration notes for contracts and limits.

### Intermediate and hard campaign expansion (2026-09-14)

The campaign now has **32 quests across seven worlds**, with **96 available stars**. The original
20 level ids and ordering remain intact; w6-l1 follows w5-l6. Existing progress, drafts, Skip ahead,
completion XP and replay behavior retain their contracts.

- **Responsive Machines** (w6-l1…w6-l6, Uno, Intermediate): button debounce, ADC hysteresis,
  independent clocks, guarded servo positioning, shared-I²C climate display, and a crosswalk state machine.
- **Reliable Connections** (w7-l1…w7-l6, ESP32, Hard): framed serial parsing, expiring HTTP commands,
  exact MQTT commands/acknowledgements, combined sensor thresholds, median range filtering, and a
  greenhouse capstone with automatic/manual control and matching MQTT/HTTP telemetry.

Each starter has placed parts but no cables and an unsolved compilable sketch. Learn explains the
pin map, required behavior, reproducible input sequence and teaching-model limits. Every new title,
briefing, objective, hint and learning narrative has an Indonesian translation. Campaign cards show
difficulty badges; public quest summaries expose nullable `difficulty`. No firmware API, simulation
model or validator rule was added. Reference cables occupy free holes, and wiring selectors use
component types/properties/pins so parts can be replaced. The generated sitemap now has **114 URLs**.

All **32 reference solutions earn three stars** through the full headless solver/VM/validator.
`content/campaign.test.js` adds alternate-input regressions for held/bouncing buttons, both hysteresis
histories, clock responsiveness, servo limits, LCD text replacement, crossing exclusivity, malformed
serial/MQTT commands, renewed/expired leases, ADC1 setpoints, median outliers, sensor loss and remote
override priority. It also checks physical placements, unsolved starters and translations. API tests
load the actual seven worlds and verify detail/summary fields and non-duplicated completion XP.

Full `make check` on the shared workspace (including concurrent component/3D work): **1,038 frontend
/ 103 backend**, production build and **476.8 KiB** initial gzip budget pass. Only the two existing
CampaignMap hook warnings and the existing Node localStorage notice remain. Isolated Chromium/Vite
with a temporary SQLite backend verified the map, 390 px layouts, real Worker hysteresis and the
greenhouse control sequence, three-star completion, HTTP 200 with matching MQTT/servo/LED state,
and Indonesian switching that retains the exact circuit, code and run. No browser application errors.
Browser verification used the development server; production bundling passed the full build gate.
Cross-browser and real-device checks remain release verification work.

### Fundamentals connecting every tutorial to courses (2026-09-14)

Courses now has **Find the fundamentals for your tutorial**, covering all 41 firmware tutorials,
five robotics tutorials and six vision labs. `/courses?tutorial=<id>#tutorial-fundamentals` opens
the selected explanation, an observation to try, exact course-section links and a separate-tab lab
link. Course search also matches connected tutorial titles/topics; cards show tutorial counts.
Related course details include expandable **Tutorial fundamentals** guides, with
`#fundamentals-<tutorialId>` opening a specific explanation. All tutorial pages show the same guide
before their experiment, including the shared robotics/vision study shell.

`content/tutorial-fundamentals.json` contains 52 authored guides with canonical course/section ids;
`features/courses/learningCatalog.js` resolves their titles/routes from the actual catalogues.
All new guide prose and observations have Indonesian translations. These are browser learning
supplements: the 22-course public API, exams, progress versions and simulation models are unchanged.
Keep the guide module independent of the combined catalog in tutorial routes. Course and advanced
study pages scroll to section fragments after lazy content mounts. See COURSES.md and integration notes.

Full `make check`: **934 frontend / 101 backend**, production build and **444.2 KiB** initial gzip
budget pass; only the two existing CampaignMap hook warnings remain. New coverage checks every
tutorial/board guide, translated narrative and canonical reading target, plus filtering, separate-tab
links, expanded guide fragments and preserved assessment choices. Production Chromium with an
isolated SQLite backend verified course/robotics/vision section anchors, desktop and 390 px layouts,
Indonesian guides, preserved course answers/read checks, and a real Nano Worker run retaining edited
code, board and step checks across the course link. No browser application errors were reported.
Cross-browser and real-device checks remain release verification work.

### Courses, IoT/drone foundations, robotics and computer vision (2026-09-13)

The new study paths are linked from Tutorials and Courses:
- `/courses`: 10 electrical engineering courses, 10 IoT parts courses, IoT/Arduino foundations and
  drone foundations. These 22 courses have 66 theory sections, 46 formula cards, worked examples,
  application exercises, related labs, 2 practice questions and a 5-question exam each.
- Three new IoT firmware tutorials cover hysteresis, explicit telemetry and HTTP command/status;
  three drone tutorials cover IMU tilt, props-off ESC signals and assisted hover/landing, on both ESPs.
- `/robotics`: 5 Easy → Intermediate tutorials about motion, ROS 2 nodes/topics, sensor frames,
  services/parameters and waypoint actions. The user explicitly selected ROS 2 **concepts** with an
  interactive browser sandbox. `/sandbox?bench=robotics` has editable geometry/world JSON, real
  deterministic motion, graph wiring, Twist publishing, sensor messages, parameters and actions.
- `/vision`: 6 courses/labs on OpenCV/IoT fundamentals, HSV drone markers, Canny/ROS steering,
  transformer patches/attention, deployment integration and a distinct cross-device capstone.
  `/sandbox?bench=vision` has editable generated scenes and actual local OpenCV 4.12 processing.
  `/vision/vision-integration` routes a fresh observation through actual virtual ESP32 HTTP,
  props-off drone serial firmware and the shared robot motion model, showing observed responses.

Across the three catalogues there are 33 study units, 68 formula cards, 231 questions and 33 exams.
Assessments require complete answers, grade at 80%, reveal explanations on submit, permit retries and
persist best scores/section checks in `vq.courses.v1`. These are local self-study scores, not campaign
XP or secure certification. Robotics and vision settings have separate local save/load, import with
confirmation, and JSON exports. They do not extend CircuitDoc, account project APIs, MCP or showcase.
The 22-course public list/detail API is `/api/courses`; robotics/vision catalogues load in frontend routes.
All authored public paths are included in the generated sitemap: **102 URLs**.

OpenCV is pinned as `@techstark/opencv-js@4.12.0-release.1`; Vite emits its 10.9 MB raw JS/WASM as
an optional local asset. **Do not await the Emscripten `cv` module directly**: its self-resolving thenable
loops. Resolve `{cv}` after initialization; Node tests use `createRequire`. Every native Mat is deleted.
The transformer lab computes one fixed attention head and exposes token count, softmax and context;
it has no trained classifier or pretrained inference. The drone integration is a clamped signal adapter,
not autonomous landing. Pi remains the restricted GPIO model. See `docs/COURSES.md`, `ROBOTICS.md`,
`VISION.md`, CONTRACTS §16 and INTEGRATION_NOTES before extending these features.

English remains default. New electrical/IoT/drone course narratives and robotics narratives plus the
advanced UI are translated into Indonesian. Vision narratives/companion explanations use English
fallback where translations are not authored. Locale changes retain edited scenes, simulation and answers.
Six companion Python examples are viewable/downloadable; they pass syntax compilation but require
external OpenCV/NumPy or a sourced ROS 2 environment to run. They are never executed by the backend.

Full `make check`: **923 frontend / 101 backend**, production build and **423.1 KiB** initial gzip
budget pass; only the two existing CampaignMap hook warnings remain. New tests include all 106
firmware tutorial variants, actual OpenCV/WASM operations and allocation cleanup, robot mechanics,
message delivery/watchdogs/actions/collisions, assessments/persistence, and all three capstone ports.
Production Chromium verified local OpenCV loading, centered/right/no-target responses (HTTP 200,
1200/1250/1000 µs ESC, actual robot motion/stop), robot goal success and saved-project reload, drone
hover to 1.13 m then landing, plus desktop/390 px without overflow. No application errors occurred in
production checks. Browser/device performance beyond local Chromium remains release verification.


### Custom Drone Builder — D1 / D2 / D3 (2026-09-12)

Open **`/sandbox?bench=drone`** or Project → New custom drone. **Rotor Rising** adds six quests
(w5-l1…w5-l6), bringing the campaign to 20. All 20 references earn three stars through the shared
headless gate. The boss also passes with a materially different 3-inch build. Read `docs/DRONE.md`
and CONTRACTS §15 before changing drone behavior; they record APIs, model assumptions and limits.

`engine/drone/` implements validated quad-X specifications, 3/5/7-inch presets, named mounts,
typed connectors, live mass/TWR/current/hover estimates, pack/BEC/ESC/wire/motor failures and 1 kHz
quaternion rigid-body dynamics. The existing Worker scheduler advances mechanics during firmware
execution and sleeps; seeded sensor noise and inputs remain deterministic. ESP32 and ESP32-S3 use
existing board ids, interpreter, signal/peripheral bindings and local code editors. Flight firmware
exposes ESC µs/PWM/OneShot/DShot paths, MPU6050 raw output parameters/ranges, BMP280, VoltRC,
VoltFlight, PID and AHRS. The rate example calculates its own three PID corrections.

The drone UI includes configurable parts, socket wiring, mouse drag/drop and keyboard mount editing,
read-only preview inspection, thrust stand/tilt, flight/orbit view, transmitter, telemetry, blackbox
plots/scrubbing, disturbance, repair, course editing and replay/slow motion. Desktop has three
resizable columns; below 1280 px Build/Bench/Code tabs retain state and the transmitter remains
visible at the bottom. Replay records every virtual-clock input and requires unchanged build/code
and an untruncated timeline. Assembly edits stop the run and preserve damage; explicit reset/Run
repairs it. High-throttle/props-on bench arming is blocked; receiver loss fails safe.

Existing sandbox save/load/drafts/cache, import, showcase publish/preview/fork and BOM paths accept
`kind:'drone'`. Standalone specifications also import with confirmation. The export ZIP includes
project/config JSON, BOM CSV, actual wiring PNG/SVG, sketch.ino and printable checklist. Summaries
carry nullable `drone_config`; derived figures remain computed. The AI guide shares allowlisted
specification/links/current telemetry, and MCP guide/component/project tools support drone documents.
No backend firmware execution or new authentication/storage model was introduced.

Regenerate **both** `content/drone-catalog.json` and `backend/app/domain/drone_catalog.json` with
`node scripts/export-drone-catalog.mjs` after drone metadata changes; equality tests cover both.
The domain copy avoids an application-settings import. Also regenerate the existing MCP catalog
when board profiles or registry footprints/defaults change.

Verified through the real Chromium Worker: takeoff → both gates → gentle landing, no crash/runtime
error, desktop/390 px without page overflow, transmitter visible, save → publish → read-only preview
→ editable fork, actual mouse part drop and single undo, and an intact seven-file ZIP with a
1200 × 2180 wiring PNG (CRC checked). Tests cover input-delta/replay equality, I²C miswiring, raw IMU
values/ranges, S3 pins, electrical failure/damage, code replacement, malformed atomic project edits,
ownership and full BOM pricing. Latest `make check`: **801 frontend / 98 backend**, build budget
**331.0 KiB gzipped**, no lint errors; only the two pre-existing CampaignMap hook warnings remain.

Limits: the pack/wiring branch is a reduced radial electrical model, and accelerometer readings
use gravity projection. Prop coefficient scale references UIUC static data; motor efficiency/slip,
thermal thresholds, other prop geometries and pack curves remain explicit teaching assumptions,
not manufacturer-validated fits. Exported VoltQuest helpers need a verified hardware port. Optional
GPS fixes/gamepads, new airframes and new user-authored part types are not implemented. The PRD's
Chromebook/60 FPS and real-device/multi-browser performance matrix remains release verification.

### Indonesian localization, circuit AI guide and coding-agent MCP (2026-09-12)

English remains the default. The header language selector persists Indonesian in `vq.locale`,
updates HTML `lang`, and preserves the current code, circuit, simulation and tutorial step checks.
`frontend/src/i18n/id.json` contains 1,567 display messages, including all 35 tutorial narratives,
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
`https://pcb.nevatal.id`, serves `/sitemap.xml` dynamically during development, and keeps
`frontend/public/sitemap.xml` synchronized; `frontend/public/robots.txt` is static. The URL list is
derived from `content/` and public routes: 61 URLs today — `/` (Landing Page), `/campaign`,
the 20 campaign levels in worlds.json order, `/tutorials` plus its 35 lessons, `/sandbox`,
`/showcase` and `/leaderboard`.

`/profile`, `/sandbox/:projectId` and `/showcase/:slug` are excluded and disallowed in robots.txt (`Disallow: /showcase/`) —
per-player or user-generated, with nothing enumerable from content. `/assets/` stays crawlable: this
is a client-rendered app, so blocking the bundle would render every route empty for a crawler.
Locked levels are listed on purpose — `campaign/gating.js` drives presentation only, so every
`/play/` URL is publicly reachable.

Still missing for search: `index.html` carries one hardcoded `<title>` and no description, so all 61
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

The base product and Drone Builder D1–D3 implementation are complete as teaching subsets; the PRD's full nonfunctional browser/device matrix
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

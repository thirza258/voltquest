# Integration notes

## MATLAB path (2026-09-17)

- Source edits actually change browser computation here, unlike HPC's native-source panel.
  Always capture source for a run, cancel on edits and ignore stale responses. A fresh Worker
  owns each execution; the inline fallback uses the same work-bounded interpreter.
- Matrices store values in column-major order and use one-based indices. Relational operations
  retain logical type for masks. Indexed writes copy arrays, preserving ordinary assignment and
  anonymous-function capture semantics. Scalar expansion is supported; other implicit expansion
  and automatic growth are explicitly rejected. No MATLAB host runtime is embedded.
- MATLAB R2026a changed full-convolution orientation: output is a row unless both inputs are
  columns. This subset follows that rule. Browser `fzero` uses bracketed bisection, `rng` uses a
  local LCG, and full-rank small solves use pivoting/QR; these are documented teaching algorithms.
- The reference directory has 244 entries and its 73 browser signatures are checked against the
  runtime. Each supported example executes in tests. Desktop examples state required products;
  `imshow` is available in base MATLAB. Optional toolboxes are never claimed as browser features.
- Notebook saves use `vq.matlab.v1.<courseId>` and preserve unfinished source. Imports discard
  fabricated results. Course checks/exams reuse `vq.courses.v1`; a section checkpoint never adds an
  exam attempt. Locale changes retain all working state. Course narratives use English fallback.
- Keep `matlab-model` before Vite's generic engine chunk rule and keep promo cards independent of
  content. Curriculum and engine remain lazy; no firmware, backend API or CircuitDoc extension.

## Cybersecurity path (2026-09-15)

- The hub/course routes and `bench=cybersecurity` share one lazy page. Keep the promo card independent
  of content/engine imports. Vite needs the dedicated `cybersecurity-model` branch before generic
  engine chunking, otherwise the request engine becomes part of the eager circuit payload.
- Requests mutate only returned fixture state. Defense changes reset accounts before retesting;
  otherwise a previously promoted customer makes a correct profile fix look broken. Regression
  sequences retain their own state and never mutate the active investigation.
- Verification checks response data and state as well as status. SQL/XSS fixed probes can return
  200; their safe body contents matter. XSS output stays React text and carries no execution claim.
- Notebook drafts can contain unfinished JSON. Validate actual request syntax on Send, independently
  of save/export. Imported verification/history fields are discarded; replacements start fresh
  evidence. Latest-30 histories explicitly mark truncation in reports.
- Course ids share existing `vq.courses.v1` progress; notebooks use `vq.cybersecurity.v1.<lab>`.
  Neither enters circuit projects, the public course API, account storage, MCP or showcase.
- The app shell may initialize a guest, but lab requests make no network calls. Browser checks use
  an isolated SQLite backend for the shell. No real vulnerable server is added. Read [CYBERSECURITY.md](CYBERSECURITY.md).

## C / C++ HPC path (2026-09-14)

- `/hpc` and `?bench=hpc` keep content, model chunks, storage and Worker instances separate from
  circuit/robotics/vision documents. Preserve source/notes and exam state through locale changes.
- Model results belong to their captured parameters. Any parameter change clears old results and
  cancels the current Worker; generation checks ignore late delivery. Native source edits affect
  downloads only, as stated beside both workflows.
- Native timing on very small inputs can hit timer resolution. Print unavailable rates, never
  infinity or a fabricated minimum duration. Release measurements and sanitizer runs are separate.
- MPI Scatterv allows zero-count ranks; the native stencil explicitly requires ranks≤cells, while
  the browser stencil skips empty partitions. Do not silently equate these documented policies.
- Keep the native verification script importing the same source generator used by the editor so
  downloadable examples cannot drift from compiled/tested examples. Read [HPC.md](HPC.md).

## Programming courses (2026-09-14)

Twelve `programming-*` entries in the shared courses JSON add a fifth track and optional
`codeExample` fields. The backend course filter must allow `programming`; adding content alone
would otherwise leave the public filtered endpoint rejecting the new track. The existing sitemap
derives all 34 course paths automatically (126 public URLs overall).

The code panel links to an existing prepared tutorial and supported board in a separate tab;
learners explicitly paste the copied sketch. Do not label the expected output as a live result or
automatically replace a tutorial's edited code. Curriculum data remains confined to lazy course
routes; tutorial guides contain only canonical course/section references. Existing course records
and tutorial identities retain their versions and state across localization.

All 44 example/board pairs execute in the same inline solver/VM used by labs. The two connected
examples match the prepared GPIO18 LED on ESP32/S3. The serial example accepts semicolon in addition
to newline because the lab's serial input is a single-line HTML input. MQTT local test characters
1/0 use the same application function as the MQTT callback, enabling lease/LED experiments in the
tutorial; the Sandbox IoT inspector can exercise inbound MQTT. Runtime regressions assert real
incoming MQTT behavior separately, including malformed commands that must not renew the lease.

Preserve the native language distinction: signed overflow is undefined in real C/C++, even though
the teaching VM wraps it. General pointer access, reference parameters, user classes/templates and
native ESP-IDF/FreeRTOS remain beyond this runtime. Current pin-based and legacy channel-based LEDC
APIs must be identified in explanations before exporting examples to hardware.

## Sandbox 3D and expanded parts (2026-09-14)

The optional `canvas/three` viewer consumes the same CircuitDoc/SimState as the SVG. Convert world
coordinates to X/Z with one pitch per scene unit; use the negative Y-axis rotation to reproduce
the SVG's positive screen rotation. Never infer an ESP32/S3 pin from its anchor board alone: its
footprint can span bb1 and bb2. Camera fit uses all bounds corners in camera space.

Keep the measured SVG mounted with visibility hidden and an inert wrapper so switching preserves
the viewport and the existing PNG export. Global canvas hotkeys must ignore that inert ancestor.
The lazy Three.js module is absent from the eager payload. Geometry/texture creation only follows
document changes; live updates change existing objects. GPU resources, observers, pointer listeners
and queued frames are released on disposal; hidden/inactive views do not render.

Eight added parts reuse the switch/pot/resistor engine elements. NTC/force/flex resistance curves
live in `engine/components/sensorCurves.js`, not the UI. Update the generated MCP catalog together
with registry definitions and keep catalog ids equal to the new type ids. Trimpot BOM values include
resistance, so two resistance variants are not silently merged. See SANDBOX_3D.md for model limits.

## Campaign expansion (2026-09-14)

Worlds 6–7 append twelve intermediate/hard quests after the existing twenty. Keep old level ids and
their relative order so progress, drafts, XP and Continue remain valid. Campaign cards and public
quest summaries expose the optional authored `difficulty`; previous levels remain untiered.
The sitemap derives all 32 quest paths directly from the shared world/quest files.

New starter circuits contain placed parts without cables. Reference jumpers occupy free holes on
the actual strips resolved by the registry, including ESP32 pins spanning two breadboards. Wiring
rules use component type/property selectors instead of generated component ids, so replacing a
part does not make a quest impossible. Behavioral tests drive input sequences independently of the
reference actions, including debounce, hysteresis history, malformed serial/MQTT input, lease
renewal, median outliers, sensor loss, override priority and matching live telemetry.

The ESP32 greenhouse reference runs enough virtual time to exercise all three control/report paths.
Its headless host test allows 20 seconds; this does not change firmware timing or the authored run
deadline. Timed objectives retain the existing sticky semantics, while dedicated regressions check
the response and invariants across each full input sequence.

## Tutorial-to-course fundamentals (2026-09-14)

The 52 guides in `content/tutorial-fundamentals.json` are independent of assessment data and runtime
documents. `features/courses/fundamentals.js` is safe for tutorial routes; `learningCatalog.js` resolves
course/robotics/vision names and section links only in Courses. Match references by canonical ids and
test against every authored tutorial, rather than inferring fundamentals from titles or board presets.

Course and advanced-study pages must scroll to a requested fragment after lazy content mounts;
native browser fragment scrolling alone may happen before a section exists. A course fragment naming
a tutorial guide also opens its native details element. Guide links use a separate tab; translating
at render time preserves edited code, simulation, lesson checks, open guides and assessment choices.
The public course API and exam versions remain unchanged by these supplementary explanations.

## Course assessments (2026-09-13)

Courses share authored JSON between lazy frontend routes and the public API. Progress is a separate
versioned localStorage record, not player progress. Keep canonical answer/lesson identifiers when
translating; a locale change must not remount the course. Course identity does reset unsaved choices.
Only complete exam submissions record attempts; practice and duplicate submissions do not.
Lab links open separately so navigating to a simulator does not discard the course's current answers.

Cross-package facts discovered while building, that `docs/CONTRACTS.md` did not originally state.
Each was verified against the code. Read this before wiring packages together.

## Interpreter — native class methods take `(args, ctx)`, not `(self, args, ctx)`

`engine/interpreter/vm.js` invokes a native method as `fn.call(self, args, ctx)`. The receiver is
available as `this` and as `ctx.self`. Global natives were always `(args, ctx)`, so both forms now
agree. CONTRACTS §6 has been corrected to match the implementation.

Verified: 20/20 semantic conformance cases pass, including the four mandatory §6 cases
(`int a = 40; a * 1000` → −25536 at 16-bit and 40000 at 32-bit; `long big = 1000 * 1000` → 16960 vs
1000000; `float f = 3.0` prints `3.00`; `char c = 65` prints `A`).

## Canvas — three additive props beyond CONTRACTS §10

`<BreadboardCanvas>` accepts, in addition to the contract's props:

| Prop | Why | How the shell must wire it |
| --- | --- | --- |
| `toolbarExtra` (ReactNode) | The breadboard-layout switcher (Half / Full / Dual) belongs to the shell but renders inside the canvas toolbar. | Pass the SegmentedControl. |
| `onToolChange(tool)` | §10 requires the `V` and `W` hotkeys but gives the canvas no way to change `tool`, which it only receives. Without this the two hotkeys are dead. | Wire to `useWorkspaceStore.setTool`. |
| `onAddComponent(type, placement, props)` | A drawer drop may carry a JSON payload `{type, props}` so a 470 Ω resistor keeps its value. The third argument is `undefined` for a bare type string. | `documentStore.addComponent(type, placement, props)` already accepts it. |

The canvas also ships `canvas/CanvasStyles.jsx`, which injects the `vq-strip*`, `vq-pin`, `vq-wire*`
and `vq-ghost` classes as a `<style>` element **inside** the `<svg>` so that PNG export keeps the
styling. Do not move those rules into `index.css` — the export would lose them.

### Device placement stability (2026-09-12)

Pointer-up must resolve its own coordinates against the current document; a previously painted
preview can be stale while the last move waits for requestAnimationFrame. Cancel queued drag/wire
callbacks on every gesture ending so they cannot update a later gesture. Pointer ids must match,
and Escape, lost capture, pointer cancellation and window blur must all clear the preview/capture.
Keep wheel/zoom actions from shifting the breadboard during a device drag.

Do not cache board snaps by a rounded half-pitch origin: a hole midpoint can sit inside that cell,
so crossing it would leave the preview on the wrong hole. Rank distinct candidate anchors by their
actual distance after snapping, rather than by search-offset order. Free-mounted devices render
at the raw origin during the drag and snap only when committed. Select-mode wire drags keep the
original pressed hole as their source, even if the first move has already reached another hole.

Browser verification of editable placement uses a temporary in-browser mount of BreadboardCanvas
with createDocumentStore. At that stage the workspace was unfinished; editable placement is now
available in campaign and sandbox. Tutorials intentionally remain read-only.
Real mouse drags verified LED placement, one undo entry per move, a fixed viewport, Escape cleanup,
and continuous Uno preview movement before its final grid snap. The harness adds no application route.

## Circuit engine — verified against the CONTRACTS §5 reference numbers

Measured with the real registry through `compileCircuit` + `evaluateCircuit`:

| Scenario | Expected | Measured |
| --- | --- | --- |
| Red LED straight across 5 V | ≈ 317 mA, blows | 316.83 mA, `blow` + `overcurrent_component` + `led_no_resistor` |
| 5 V → 220 Ω → LED → GND | ≈ 13.9 mA, brightness ≈ 0.83 | 13.91 mA, 0.83, no warnings |
| D13 HIGH → 220 Ω → LED | ≈ 12.5 mA | 12.55 mA |
| D13 → LED direct | ≈ 91 mA, blows | 91.43 mA, `blow` + `overcurrent_pin` |
| 1 kΩ / 2.2 kΩ divider from 5 V | 3.44 V | 3.44 V |
| ESP32 GPIO tied to VIN | burnt pin | `burnt_pin` + `overvoltage_gpio` |
| `powered: false` | every net 0 V, no damage | 0 V, 0 events |

## Test environment gotchas

- vitest's jsdom exposes `globalThis.localStorage` as a **bare object with no Storage methods**.
  Anything asserting persistence must call `installMemoryStorage()` from
  `frontend/src/test-utils/localStorage.js` in `beforeEach`. Production code is unaffected because
  `lib/storage.js` guards every access in try/catch.
- Component tests need two docblock lines, in this order, as the first lines of the file:
  `// @vitest-environment jsdom` then `// @vitest-environment-options { "url": "http://localhost:5173" }`.
  Without the URL, jsdom runs on an opaque origin.
- `vite.config.js` no longer uses the deprecated `environmentMatchGlobs`; the docblock is the only
  way a test opts into jsdom.

## Deployment gotcha — never declare `types { }` in `frontend/nginx.conf`

A `types` block inside a `server`/`location` **replaces** nginx's inherited `mime.types` map rather
than extending it. The symptom is subtle and total: every asset is served as
`application/octet-stream`, and because the config also sends `X-Content-Type-Options: nosniff`, the
browser refuses to execute the app's module scripts and gzip never matches. The stock nginx map
already covers `js`, `css` and `wasm`. This was hit and fixed once; the config carries a comment.

## Seeds helper returns an object, not an id

`engine/components/seeds.js` exports `mcuOf(doc)` returning the **component object** (use `.id` to
build a TerminalRef), while `place()` and `placeFree()` return **id strings**. Mixing them up
silently produces wires to `"[object Object]:5V"` and a `no_ground` issue.

## Runtime assembly and previously absent library adapters

The old handoff understated the runtime blocker: not only was `runtime/index.js` a stub,
`runtime/libraries/index.js` imported implementation files that did not exist. The assembled runtime
and device/network adapters now run sketches through the real worker and deterministic inline path.
Regression coverage now includes all 14 authored quest solutions, not just the interpreter in isolation.

- Start the VM without executing its first slice synchronously. The simulation sends the initial
  environment after start; running setup immediately can bind sensors/displays before their circuit exists.
- Scheduled timers and virtual network events must advance while firmware sleeps. The scheduler
  splits sleeps at event deadlines and pumps pending callbacks/interrupts at safe points.
- Restart can occur inside a slice; scheduler generations prevent the old turn from continuing against
  a newly rebuilt VM. Deterministic mode never reads wall time.
- Pin/read/serial output is batched per slice. Repeated unchanged pin writes are deduplicated; event
  timestamps remain virtual microseconds. DAC output values are volts, not raw 8-bit integers.
- Decimal formatting must round once, not add half a unit before calling `toFixed`. Both the runtime
  formatter and interpreter formatting previously turned 3.14 into 3.15 and 60.0 into 60.01.
- Library adapters implement the documented teaching subset, not entire upstream libraries. OLED
  drawing uses a 1024-byte page framebuffer and a simplified font. Networking remains entirely virtual.

## Raspberry Pi and tutorial integration

The board registry and backend now include `raspberrypi4` and `raspberrypi5`. They have a real 40-pin
header map but a deliberately restricted Python/GPIO runtime, separate from Arduino source handling.
See `RASPBERRY_PI.md`; never treat Pi as Pico or give it AVR numeric pin aliases, an ADC or a built-in LED.
The Python translator emits the existing cooperative VM format, preserving original line numbers.
No user Python executes on the server or in a host Python process.

Tutorial content is shared by the frontend bundle and public API. Circuit presets use deterministic
component ids, so the same document drives simulation, component placement and cable instructions.
For ESP32-S3, auxiliary parts must live on the second breadboard: its 22-pin-wide footprint otherwise
collides with the lesson's row-20 sensor/button placements. Raspberry Pi controllers are free-mounted.

The browser lesson owns and disposes one simulation per tutorial/board pair. Switching boards remounts
the lab; code is restored for that variant. The real page uses a Web Worker. jsdom tests use the inline
fallback, so browser verification must also exercise Run, serial input and virtual HTTP requests.

Tutorial presets initially connected jumpers directly to component pin terminals. For physical
breadboard instructions this would suggest inserting a jumper into an already occupied hole.
Presets now allocate separate free holes on the same strip, using the registry's actual connectivity.
The regression suite checks that no cable hole is occupied by a component or another cable.

## Workspace, projects and account integration (2026-09-12)

- `useLevelSession` uses an optional seed for sandbox/public previews but assigns objectives and XP
  only in campaign mode. It synchronizes the current store document/code after initialization, offers
  drafts explicitly, and ignores reports from previous levels. The page owns runtime disposal.
- `useAsyncResource` hides old data on the render before a route/filter effect starts, and cancels
  obsolete responses. Otherwise a saved/forked project can initialize from the previous route's data.
- `/progress/{id}/complete` returns **one progress record**, whereas `/progress` returns a map.
  The player store merges those shapes separately. Queue entries are recorded before network calls;
  flushing removes only the sent entry so concurrent additions survive. Account changes invalidate
  in-flight completion/refresh responses. A rejected login does not expire the current guest token.
- Local drafts are `vq.draft.<levelId>`, `vq.draft.sandbox` for a new circuit, and
  `vq.draft.sandbox.<projectId>` for saved projects. Confirmed import/new replaces the unsaved slot;
  a saved project's own draft remains independent. JSON validation runs before loading either files
  or server projects. Pi imports require text mode, and the project/circuit/controller must agree.
- Monaco uses `loader.config({monaco})`, local editor workers and a lazy component. Blockly media is
  served from `frontend/public/blockly-media`. Vite's preload helper must stay in the shared vendor
  chunk, or importing that helper would pull Monaco into the initial page despite `React.lazy`.
- The virtual phone is an opaque `sandbox="allow-scripts"` iframe. Only the injected navigation
  bridge executes: supplied scripts/active embeds/event handlers are removed, CSP blocks network
  access, and the parent accepts messages only from that iframe with its current channel. Links
  and GET/POST forms become simulated HTTP requests. Stop/reset/run changes invalidate old replies.
- Reference solution actions may include `http`, `serial`, or `mqtt`. HTTP calls must be queued
  before advancing virtual time; awaiting them first would deadlock the inline server.

- A bounded cache retains the three most recently opened/saved server projects. Network/5xx
  failures can reopen a cached snapshot only for its owner, then offer the newer local draft.
  Server 401/403/404 responses never fall back to a private cached project. Offline My projects
  lists the available cached entries. This does not provide offline installation or a service worker.
- If a player starts editing while an older draft is offered, those explicit edits become the new
  local draft immediately. Autosave must not stay disabled while accepting fresh edits.

## Localization, AI guide and MCP (2026-09-12)

- Locale lives above the routes without a keyed remount; translating a cloned lesson/seed object
  would recreate its simulation. Translate only at rendering, retaining canonical source content.
  `t` supports interpolation and English fallback; use distinct hook aliases where callback variables
  already use `t`. Dictionary membership uses own properties, so identifiers such as `constructor`
  remain ordinary text. Learn cards and all tutorial narratives have catalog-coverage tests.
- Assistant requests capture current props at send time, including unsaved code/name, inspector
  selection, actual `resolvePins` results and live measurements. They exclude reference solutions.
  Clearing/leaving/changing player cancels responses; API abort signals stay attached until the body
  is consumed. The guide uses OpenRouter through the official OpenAI Python SDK, never a browser key.
- MCP 1.x FastMCP needs `session_manager.run()` in the FastAPI lifespan even in stateless mode.
  Each app factory owns its own instance. Mount `/api/mcp` with internal `/` and configure clients
  with `/api/mcp/`. Nginx can forward a bare `localhost` Host, so allow both bare and port forms.
- SDK transport security checks Origin independently of FastAPI CORS. Loopback browser verification
  needs `http://127.0.0.1:5173`; arbitrary deployment origins/hosts require configuration.
- MCP credentials are separate opaque, hashed, expiring tokens. Context is shared explicitly and
  expires for reading after 24 hours. Agents save owned private projects, then return a sandbox link;
  no live document mutation or simulation execution is claimed. Timestamp comparisons normalize
  SQLite's naive UTC values before conflict checking. Public edits are rejected by MCP.
- Footprints spanning two breadboards (ESP32/S3) must be validated in world coordinates, not solely
  against the anchor board's holes. `scripts/export-mcp-catalog.mjs` exports the actual registry,
  layouts and profiles; frontend equality tests reject drift. No deterministic engine imports React.

## Custom Drone Builder — 2026-09-12

- Chose D1–D3 full flight, quad-X only and existing ESP32/S3. Numeric known-part customization does
  not depend on the deferred Custom Component Creator. `docs/DRONE.md` records coefficient evidence,
  teaching assumptions and optional/unverified work; do not claim manufacturer-calibrated accuracy.
- Drone docs preserve empty breadboards: document normalization must not auto-seed a breadboard.
  Keep typed links and mounts through project/draft/undo/import/backend/share round trips. Default
  registry listings stay breadboard-only; named drone terminals resolve through `resolvePins`.
- Four logical ESC channels represent one 4-in-1 physical package in the BOM. Motor position follows
  the phase bundle, not merely signal-pin numbering. Runtime adapters resolve the real ESC binding.
  SDA/SCL presence alone is insufficient: they must match the board's actual I²C pins and power nets.
- Fixed 1 ms mechanics is a scheduler event, including inside VM sleeps. Idle electrical checks
  use the same compiled topology; the pack/BEC model is a reduced radial network, not full 1 kHz MNA.
  Gravity projection is the accelerometer teaching approximation. UI animation is never a clock.
- Mixing acts on thrust; assisted control converts mixed thrust to speed with square root. Hover
  compensation must use the voltage at hover equilibrium, not the full-throttle sagged voltage.
  Unfiltered gyro derivatives caused yaw oscillation: PID D terms use a low-pass derivative.
- Scalar address outputs require references into VM storage; copying a scalar to a temporary array
  silently breaks MPU6050.getMotion6. Existing array-address semantics are preserved and raw range
  outputs are asserted numerically through the actual interpreter.
- Sending only the last RC input per 20 ms loses intermediate stick events. Monotonic input ids,
  complete message deltas and replay-before-start preserve trajectories. Code/build edits invalidate
  replay; an input ring with a lost prefix cannot be replayed accurately and disables the control.
- Assembly edits stop drone runs, preserve damage for surviving parts/links and recompute rails.
  Reverse/short aborts after visible damage; Repair/Run reset intentionally clear it. Supply-off HUD
  must not show a powered FC or pack current. A code edit alone affects the next run.
- Frontend and domain validation metadata are generated together. Domain modules cannot import
  `app.core.config`; the generated adjacent JSON avoids that dependency and ships in the app image.
  Update-only board_mode changes still need merged-state validation for drone projects.
- Vite HMR may serve store modules with `?t=` timestamps. Browser instrumentation must use the actual
  loaded module URL (or reload cleanly); importing the bare URL can create an unused store instance.
  Real browser checks use the actual Worker, separately from the deterministic inline test suite.

### Robotics and vision integration (2026-09-13)

- The requested robotic OS environment is ROS 2 **concepts**, implemented by a deterministic 2D model,
  not an installed ROS process. Keep its JSON files and local storage outside CircuitDoc/account APIs.
- All new foundation tutorial examples run through the actual interpreter. Behavioral tests caught the
  reversed potentiometer orientation and unsupported network credentials; rising ADC controls and
  `WiFi.softAP` now match the authored experiments.
- Use an injected initialized OpenCV module for deterministic tests; all native Mats require `delete()`
  in `finally`. The pinned Emscripten module is a self-resolving thenable: resolve `{cv}`, never `cv`.
  Vitest imports must use `createRequire` for that package to avoid thenable assimilation.
- Vite `?url` emits the full OpenCV JS/WASM as a local optional asset. Check production loading as well
  as Node algorithms; browser script initialization differs from Node module initialization.
- An OpenCV result is valid only for its exact current configuration. Scene edits invalidate the prior
  observation until the new computation completes. Fixed transformer attention cannot send commands.
- The connected capstone sends one bounded observation through three actual teaching paths: virtual
  ESP32 HTTP, serial to props-off drone firmware, and the shared robot model. It shows observed responses.
  The drone adapter is deliberately not a flight controller; vision does not add Pi camera simulation.

# Integration notes

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
Regression coverage includes all three authored quest solutions, not just the interpreter in isolation.

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

# Custom Drone Builder

The Custom Drone Builder addendum ships through D1–D3: editable assemblies and numeric specifications,
firmware-controlled flight, six Rotor Rising quests, and sandbox sharing/export. Open
`/sandbox?bench=drone` or choose **New custom drone** in the sandbox Project menu. World 5 starts at
`/play/w5-l1`; existing campaign unlock rules still apply to map presentation.

This is a quad-X teaching simulator using the existing `esp32` and `esp32s3` profiles. It adds neither
an MCU id nor a compiler service. The simulator's C++ subset and flight helpers execute in the existing
Web Worker; the same modules run in plain Node for headless validation. Real hardware firmware needs
an independently verified port: the exported VoltQuest helpers are simulator APIs.

## Build, wire and fly

1. Pick a 3-, 5- or 7-inch preset, or edit frame, motor, prop, ESC and pack numbers. The six live figures
   show mass, TWR, hover throttle/time, peak pack current and full-throttle voltage. Warnings name the
   exceeded limit and a suggested correction. Poor performance figures do not block experimentation.
2. Select components or links for Inspect. Drag parts onto compatible free mounts, or use the mount
   selector. An occupied/incompatible destination rejects the move. One move creates one undo entry;
   Escape, pointer cancellation and window blur cancel it. Add parts by dragging from the drawer or
   using Add. Configure FC changes/preset replacement through a confirmation; the sketch is retained.
3. Connect typed sockets using Connector wiring: power, bundled three-phase, ESC signal, I²C or UART.
   The endpoint list and exported diagram come from the actual document. Select links to change AWG
   and length or remove them. CW/CCW is per motor and per prop; a mismatched fitted prop produces downforce.
4. For bench tests, leave the stand clamped and clear **Propeller fitted** on every prop. Run a sketch
   that holds each ESC at 1000 µs for one second. ARM with RC throttle below 5%. A fitted prop blocks
   bench arming with an explicit callout. A motor without firmware pulses or a phase bundle cannot spin.
5. For flight, use the assisted example, Run, ARM at low throttle, then select Flight. In hover mode,
   50% throttle holds height; higher/lower values command climb/descent. Zero requests a gentle descent.
   Use small positive pitch to traverse gates along +X. DISARM after landing. Rate and angle modes have
   different throttle behavior: throttle commands rotor speed, not vertical velocity.
6. Read the blackbox while tuning. It retains 60 seconds, displays the last 10 seconds of setpoint/gyro,
   four motor outputs and voltage, and has a sample scrubber. Tune inputs edit the actual sketch's
   `Flight.setGains(...)`; they take effect on the next Run. The rate example instead declares and
   computes its own three PID instances, which can be edited directly in the code editor.

The transmitter accepts pointer/touch sticks and accessible range controls. With the transmitter
panel focused: W/S throttle, arrows pitch/roll, A/D yaw, Space arm/disarm. A one-second yaw-right,
throttle-low gesture also arms; yaw-left at low throttle disarms. Receiver loss or window blur invokes
failsafe. Audio uses the existing audio switch and a pitch derived from actual motor RPM.

Below 1280 px, Build, Bench/flight and Code/tune tabs retain their mounted state while switching.
The compact transmitter stays at the bottom of the bench. Desktop keeps the existing resizable
three-column workspace. Campaign objectives, hints, ghost wiring, serial output, Monaco/Blockly,
undo, drafts and the AI context panel reuse the existing infrastructure.

## Document and boundary

A drone remains a CircuitDoc version 1, with `kind: 'drone'`. An absent `kind` still means breadboard.
`mcu` and `droneConfig.fc.board` must agree; `boardMode: 'half'` is a compatibility marker, with empty
`breadboards` and `wires`. All wiring is in `links` and all placement is in `mounts`:

```js
{
  kind: 'drone', version: 1, mcu: 'esp32', boardMode: 'half',
  breadboards: [], wires: [],
  components: [{ id: 'c_motor1', type: 'brushless_motor', props: { direction: 'ccw' }, rotation: 0 }],
  mounts: [{ componentId: 'c_motor1', mount: 'arm1' }],
  links: [{ id: 'w_phase1', from: 'c_esc1:phase', to: 'c_motor1:phase', kind: 'phase', awg: 16, lengthM: 0.15 }],
  droneConfig: { /* full version-1 specification: see DEFAULT_CONFIG in engine/drone/config.js */ },
  flight: { seed: 42, bench: false, wind: [0, 0, 0] },
  course: [{ x: 2, y: 0, z: 1.5, radius: 0.9 }]
}
```

This excerpt illustrates placement/link fields, not a complete importable assembly. Use
`createDroneDoc(config, { bench })` for complete templates, `validateDroneDoc(doc)` for validation,
`deriveConfig(config)` for derived numbers, and `feasibility(config)` for advisory warnings.
`CONFIG_FIELDS` defines allowed numeric intervals and UI increments; cell/blade counts are integers.
An optional `droneConfig.mixer` overrides four `[1, roll, pitch, yaw]` coefficient rows, each in [-1, 1].
Quad-X is the only accepted airframe. Unknown payloads and new user-authored part types are excluded.

There must be exactly one FC, one compatible mount per part, unique component/link ids, at most 32
parts, 100 typed links, 24 gates, and bounded finite geometry. Incomplete assemblies are accepted to
support wiring lessons. Browser import, backend save/update and MCP project tools validate before
mutation. Existing ownership, 200 KiB field limits and timestamp conflicts continue to apply.
Both complete project JSON and standalone `drone-config.json` import through the existing confirmation;
a standalone specification builds a fresh assembly with the assisted sketch.

`content/drone-catalog.json` and `backend/app/domain/drone_catalog.json` are generated together by
`node scripts/export-drone-catalog.mjs`. The second copy keeps domain validation independent of
application settings and HTTP layers. Equality tests cover both. Also run
`node scripts/export-mcp-catalog.mjs` after registry, port or footprint changes.

## Electrical and mechanical interface

`compileCircuit` resolves typed links into the existing terminal nets and PeripheralBinding role
mechanism. The drone branch uses a reduced pack/BEC/ESC electrical model on those nets instead of
running breadboard MNA at every physics step. No second signal-binding registry exists.

`createElectrical(doc, compiled, warn, damage).step(motorCurrentA, dt, damaged)` returns:
`{ V_bus, escEnabled[4], currentA, soc, becV, fcPowered, brownout, cutoff, capacityFactor }`.
`createDynamics(doc, compiled, damaged?)` consumes that result and returns motor currents on its next
step. It exposes `step()`, `nextUs`, `state`, `snapshot()`, `command(componentId, us)`, `setSticks`,
`setTilt`, `disturb`, `setTimeline`, `recordControl`, `imuRead` and `consumeReset`.

The mechanics use 1 ms fixed steps, a normalized quaternion, semi-implicit Euler translation,
body angular momentum, rotor inertia/gyroscopic terms, reaction torque, drag and first-order RPM lag.
The default firmware calls its controller every 4 ms plus interpreter execution cost. Scheduler event
boundaries advance physics during firmware sleeps as well as active execution. All sensor noise and
gusts draw from one seed-owned PRNG. No engine module reads a host clock or starts a host timer.

Electrical state integrates consumed mAh, pack resistance/sag, reduced conductor losses, per-channel
ESC heat and winding I²R. It models a regulated BEC and shared return paths. Conductor heat uses
AWG/length resistance and a simplified current allocation (rail load or one quarter of pack current).
This is a radial quad power approximation, not an arbitrary resistor network or switching transient
solver. A damaged power conductor disables the ESC supply. Pack open-circuit voltage falls linearly
from 4.2 to 3.2 V/cell; loaded cell voltage below 3.0 V cuts off and reduces capacity to 60% until reset.

Reversed polarity/pack shorts damage the FC and ESCs and abort Run. Sustained ESC overload, winding
heat, wire heat, BEC overload/brownout, prop mismatch, bench prop guards, receiver loss and desync have
visible explanations. Desync is a recoverable 100 ms commutation stall after an RPM command increase
above 12,000 RPM at speed. Brownout resets the VM at the current virtual time and disables outputs;
loss of lift can produce a crash. Damage persists through assembly edits; Repair/reset and Run's
existing implicit reset restore parts. Removing a damaged part removes its damage entry.

Ground impact above 1.8 m/s or landing tilt above 55° counts as a crash. All fitted props break;
impact energy above 2 J also damages the frame and above 8 J the FC. Hangar boundaries are ±16 m
horizontally and 9 m high; gate rims have 0.2 m collision thickness. These thresholds are teaching
choices, not structural certification. Crash state freezes at impact for inspection.

## Firmware, telemetry and replay

The ESP32 profiles add `MPU6050.h`, `Adafruit_BMP280.h`, `VoltRC.h`, `VoltFlight.h`, `PID.h`, `AHRS.h`.

| Surface | Supported calls and units |
| --- | --- |
| ESC | Servo/ESP32Servo `attach(pin)`, `writeMicroseconds(1000..2000)`; `ledcWrite` converts configured PWM duty/frequency, OneShot125 or DShot600 teaching values to µs |
| MPU6050 | `begin`, `initialize`, `testConnection`; `getGyroX/Y/Z` deg/s, `getAccX/Y/Z` m/s², `getRoll/getPitch` degrees; `getMotion6`, `getAcceleration`, `getRotation` write scalar address output parameters; range setters 0..3 and MPU6050 range constants |
| Raw IMU | Default accel ±2 g → 16384 LSB/g, gyro ±250 deg/s → 131 LSB/(deg/s); higher ranges divide scale by 2 per range; signed 16-bit saturation |
| BMP280 | `begin`, `readAltitude` metres, `readPressure` Pa, `readTemperature` °C |
| VoltRC / RC | `readChannel(0..5)`, `hasSignal`, `failsafe`, normalized `throttle/roll/pitch/yaw`, `armed`; channel order throttle, roll, pitch, yaw, arm, mode |
| VoltFlight / Flight | `begin`, `writeMotor(1..4, us)`, thrust-domain `mix(collective, roll, pitch, yaw)`, `setGains(p,i,d)`, `update()` for raw/rate/angle/assisted-hover modes |
| PID | constructor `(p,i,d)`, `setGains`, `compute(setpoint, measurement, dtSeconds)`, `reset`; bounded integral and filtered derivative |
| AHRS | complementary `update(gx,gy,gz,ax,ay,az,dtSeconds)`, `getRoll`, `getPitch` |

Default ESC GPIOs are 18/19/23/25 on ESP32 and 4/5/6/7 on S3. IMU/barometer require board-correct SDA
and SCL and power through actual connected nets. Receiver TX/RX must bind to FC pins and its power
must be present. Accelerometer output is a noisy gravity projection for the teaching attitude model;
it does not reproduce all translational accelerations. Gyro includes bias, scale error and RPM-linked
vibration. Barometer includes noise, slow drift and near-ground wash. Optional GPS fixes and gamepad
input are not implemented; the GPS part is available as an optional connector/mass placeholder.

Runtime output is `{ type: 'flight', t, state }` at no more than 50 Hz; the state contains attitude,
position, electrical telemetry, RPM, pulses, sensor snapshots, damage and bounded blackbox/input rows.
The UI interpolates flight poses with requestAnimationFrame; rendering does not advance mechanics.
ESC writes remain `{type:'peripheral', protocol:'esc', componentId, data:{us}}`.

Simulation methods add `setSticks(patch)`, `setFlightTimeline(actions)`, `setBenchTilt(patch)`,
`disturb([roll,pitch,yaw])`, `setSpeed(.25|.5|1)` and `replayFlight()`. Inputs are timestamped on the
virtual clock with monotonic ids. Every input between telemetry messages is retained, including
bench tilts and disturbances. Replay sends the whole timeline before the Worker starts. It requires
the same document and sketch and an untruncated recording (10,000 inputs maximum); editing either
invalidates replay. Inline tests prove identical position, quaternion and RPM with different stepping
chunks and with the captured recording. Cross-engine floating-point reproducibility is not certified.

## Coefficients, calibration evidence and limits

The SI equations follow the addendum: `n = RPM/60`, `D = diameterIn*0.0254`,
`T = CT*rho*n²*D⁴`, `Q = CQ*rho*n²*D⁵`, `I = Q*omega/(efficiency*V) + I0`.

The reference for the prop coefficient scale is the [UIUC Propeller Data Site, Volume 2](https://m-selig.ae.illinois.edu/props/volume-2/propDB-volume-2.html),
specifically the [5×3.75 two-blade static data](https://m-selig.ae.illinois.edu/props/volume-2/data/da4022_5x3.75_static_0642rb.txt)
and [three-blade static data](https://m-selig.ae.illinois.edu/props/volume-2/data/da4022_5x3.75_3b_static_0690md.txt).
These support a baseline CT near 0.15, CP near 0.094 and a roughly 1.4× three-blade factor in their
measured regime. CQ is CP/(2π), giving 0.015. Pitch scaling outside that reference is an approximation.

| Constant/choice | Value | Evidence class |
| --- | --- | --- |
| Air density | 1.225 kg/m³ | Standard sea-level teaching condition |
| CT / CQ | 0.15 / 0.015 | Prop static data scale above |
| Family multiplier | `(1 + .4*(blades-2))*sqrt((pitch/diameter)/.75)` | Three-blade scale informed by data; pitch/blade extrapolation heuristic |
| Loaded RPM slip / efficiency | .78 / .78 | Explicit engineering assumptions, not measured motor fits |
| Usable pack fraction | .8 | Teaching assumption |
| Translational drag | .16 kg/s | Teaching assumption |
| Carrier/sensors / ESC / cables | 18 / 15 / 12 g | Fixed illustrative subassembly masses |
| Default pack resistance | 12 mΩ, editable | Reference-build assumption, not a measured brand claim |
| Rotor lag | `.025 + propMassKg*(diameterIn/5)²*8` seconds | Inertia-dependent teaching response |

The stock 5-inch configuration computes 482 g, TWR about 6.6, roughly 36% hover throttle and 8.3 min
hover estimate. A separate 3-inch build has different mass, inertia, propulsion, hover behavior and BOM;
both complete the boss in real interpreter/headless tests. This is a reproducible coefficient model,
not a validated thrust-stand fit for every allowed motor, pack or 3–7 inch prop combination. High-RPM,
non-reference geometry and dynamic inflow predictions remain extrapolations. No figure certifies
flight-worthiness. Manufacturer thrust curves and measured electrical/thermal fits remain future
calibration work.

## Sharing and exports

Existing project endpoints save/load, publish/unpublish, preview and fork drones without migrations.
Summary cards carry `drone_config` and derive their spec sheet on the client. JSON, offline drafts,
owner-checked caches and BOM export use their existing paths.

**Build it for real — export pack** downloads one ZIP with `project.json`, `drone-config.json`,
`bill-of-materials.csv`, `wiring.png`, `wiring.svg`, `sketch.ino` and `pre-flight-checklist.html`.
The diagram includes the exact connector endpoint table and exports regardless of the selected tab.
BOM rows use the existing four-field catalog format, illustrative unit prices/vendor references,
actual counts, configured Kv/prop/pack specifications and a total. A 4-in-1 ESC prices one physical
board even though the simulator exposes four logical channels. The checklist includes props-off
bench work, LiPo care, polarity/current/fastener/failsafe checks, local aviation-rule considerations,
and the limits of the estimates and exported teaching APIs. User names/text are escaped in HTML/SVG.

## Verification boundary

Adjacent tests cover document validation and undo, electrical failures, firmware-to-motor coupling,
S3 signal mapping, raw sensor output parameters and range selection, I²C miswiring, PID disturbance
response, saturation, replay, two builds completing the course, read-only UI, code replacement
confirmation, archive contents and frontend/backend metadata equality. All six new references share
the existing campaign three-star headless gate. Backend tests exercise save/update/publish/fork,
malformed atomic updates, owner isolation and complete BOM pricing.

Local Chromium checks exercise the real Worker, 390 px tabs, desktop flight and project/export flows.
The PRD's 60 FPS/Chromebook/frame-time, real touch-device and multi-browser performance matrix is
not certified by those checks. Optional GPS dynamics, gamepad input, remote preset/flight-time APIs,
new airframe classes and new user-authored part definitions are not part of this implementation.

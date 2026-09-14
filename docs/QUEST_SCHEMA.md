# Quest content schema — `content/worlds.json`, `content/quests/<levelId>.json`

Level ids: `w1-l1` … ; world ids `w1` …. Pin names in content are PinNames (CONTRACTS §1/§2): `"D13"`, `"A0"`, `"GPIO4"`, `"3V3"`, `"VIN"`, `"GND"` (never `GND2`, labels or numbers). Component pin ids are the binding ids of CONTRACTS §4.3 (`c_r1:p1`, `c_led1:anode`).

## worlds.json
```json
{ "worlds": [
  { "id": "w1", "order": 1, "title": "The Spark of Life", "subtitle": "Power, LEDs, resistors, buttons", "theme": "amber", "board": "uno", "intro": "…", "levelIds": ["w1-l1","w1-l2","w1-l3","w1-l4"] },
  { "id": "w2", "order": 2, "title": "Signals and Rhythms", "subtitle": "Digital & analog I/O, PWM, transistors", "theme": "teal", "board": "uno", "intro": "…", "levelIds": ["w2-l1","w2-l2","w2-l3","w2-l4","w2-l5"] },
  { "id": "w3", "order": 3, "title": "The Power Swap", "subtitle": "Transition boss: 5 V → 3.3 V", "theme": "rose", "board": "esp32", "intro": "…", "levelIds": ["w3-l1"] },
  { "id": "w4", "order": 4, "title": "The Connected World", "subtitle": "ESP32 IoT Academy", "theme": "indigo", "board": "esp32", "intro": "…", "levelIds": ["w4-l1","w4-l2","w4-l3","w4-l4"] }
] }
```
**Required campaign (14 levels):**
w1-l1 First Glow (LED straight to 5 V → magic smoke; `damageExpected`), w1-l2 The Shield (220 Ω fixes it), w1-l3 The Gatekeeper (pushbutton in the LED path; `solution.actions` presses it),
w1-l4 Code Awakening (LED on D13 via 220 Ω + blink), w2-l1 The SOS Beacon (Morse: `pin_pattern` dot/dash), w2-l2 Night Owl (LDR divider → A0, analogRead + Serial), w2-l3 The Dimmer (pot → A0, analogWrite PWM on D9),
w2-l4 Motor Mayhem (NPN 2N2222 base ← D9 via 1 kΩ, dc_motor collector → 5 V; PWM speed), w2-l5 Simon Says (boss: 3 LEDs, 3 buttons with INPUT_PULLUP, random sequence),
w3-l1 The Power Swap (boss: `startBoard:"uno"`, `boardSwitcher:"enabled"`, target `board:"esp32"`; HC-SR04 echo through 1 kΩ / 2.2 kΩ divider; pot on GPIO34 with 12-bit mapping),
w4-l1 Touch Lamp (touchRead on GPIO4/T0), w4-l2 Status Ring (NeoPixel), w4-l3 Smart Switch (WiFi + WebServer toggles an LED; Virtual Phone), w4-l4 Weather Station (DHT22 → MQTT).

## Level file
```json
{
  "id": "w1-l4", "worldId": "w1", "order": 4, "title": "Code Awakening", "codeName": "Level 1-4",
  "board": "uno",                 // target board: header badge, palette grouping, headless test, `mcu_is`
  "startBoard": null,             // BoardId placed in the starter doc when starterCircuit is null (default = board)
  "boardSwitcher": "locked",      // "locked" | "enabled" — header board switcher (and breadboard layout control) enabled in campaign only when "enabled"
  "boardMode": "half",
  "difficulty": "intermediate",   // optional: intermediate | hard; worlds 6–7 expose this tier on campaign cards and API summaries
  "xp": 120, "estimatedMinutes": 5,
  "summary": "…", "concepts": ["digitalWrite","pinMode","delay"],
  "briefing": [ { "mood": "happy", "text": "…" }, { "mood": "thinking", "text": "…" } ],
  "learn": { "title": "Why pinMode?", "body": "plain text / light markdown", "links": [] },
  "starterCircuit": CircuitDoc | null,   // null → MCU only, at registry.defaultMcuPlacement(startBoard ?? board, boardMode). When a starter circuit carries a blown part from the previous level, damage is cleared on load.
  "starterCode": "void setup() {\n\n}\n\nvoid loop() {\n\n}\n",
  "starterBlocklyXml": null,             // optional Blockly workspace XML for novices
  "allowedComponents": ["uno","led","resistor"] | null,   // drawer filter (null = all); MCU types listed here are the board switcher options when boardSwitcher is enabled
  "objectives": [
    { "id": "led_pin13", "text": "Connect the LED anode to pin 13 through a 220 Ω resistor",
      "rules": [ { "type": "path", "from": { "mcuPin": "D13" }, "to": { "componentType": "led", "pin": "anode" }, "through": [ { "componentType": "resistor", "props": { "ohms": 220 } } ] } ],
      "hints": { "tier1": "Concept nudge …", "tier2": { "mcuPins": ["D13"], "componentTypes": ["resistor"], "text": "optional" }, "tier3": true } }
  ],
  "starCriteria": { "damageExpected": false, "three": [ { "type": "code_max_lines", "max": 14 } ], "threeText": "Blink it in 14 lines or fewer" },
  "solution": { "circuit": CircuitDoc, "code": "…", "blocklyXml": null,
                "actions": [ { "atMs": 500, "select": { "componentType": "pushbutton" }, "patch": { "pressed": true } }, { "atMs": 1500, "select": { "componentType": "pushbutton" }, "patch": { "pressed": false } } ] },
  "solutionRunMs": 6000,
  "successText": "…",
  "chipOnSmoke": "Whoa! Too much current. …"    // optional override of the smoke callout (default = the warning's hint)
}
```
Tier-2 target: `{ mcuPins?, componentTypes?, terminals?, text? }` → canvas `highlights`. Tier-3 `true` → ghost = `solution.circuit`. Hints are per objective (`hintTier[objectiveId]`) and never affect stars.
Headless test (F): loads `solution.circuit` + `solution.code`, applies `solution.actions` at their virtual times via `sim.setControl`, and requires `allPassed` within `solutionRunMs`.
Actions may also contain `http: { method, path, body?, headers? }`, `serial: string`, or
`mqtt: { topic, payload }`; these use the same virtual network/serial controller methods as the UI.
HTTP requests are queued without blocking virtual time, so the firmware can handle them on its next slice.

## Rule JSON
Selectors: `{ "mcuPin": "D13" }` · `{ "componentType": "led", "pin": "anode", "props": { "color": "red" }, "index": 0 }` · `{ "terminal": "bb1:e12" }`.
```
component_present   { componentType, props?, min?=1 }
component_absent    { componentType }
mcu_is              { board }
path                { from: Sel, to: Sel, through?: [ { componentType, props? } ], exact?: false }
net_has             { net: Sel, contains: Sel }
pin_connected_to    { pin, componentType, componentPin }
pin_toggles         { pin, minEdges, windowMs? }
pin_period          { pin, periodMs, toleranceMs, minCycles?=2 }
pin_pattern         { pin, pattern: [ { level: 0|1, ms } ], toleranceRatio?: 0.35, repeat?: 1 }     // contiguous run of level/duration segments (trace.segmentsOf)
pin_state           { pin, level, forMs?: 0 }
pwm_varies          { pin, minDistinctDuties: 3 }
pwm_duty_between    { pin, min, max }
analog_read_seen    { pin, min?, max?, minSamples?=1 }          // trace.analogReads
touch_used          { pin? }                                    // trace.touchReads
serial_matches      { pattern, flags? }
code_matches        { pattern, flags? } / code_not_matches { pattern }
code_max_lines      { max }                                     // non-empty, non-comment lines
max_components      { max, excludeTypes?: ["uno"] }
led_lit             { props?, minBrightness?: 0.2, count?: 1 }
component_blown     { componentType }                           // sticky since reset (events)
no_damage           {}
no_warning          { code }                                    // warningCodesSeen[code] absent (since reset)
warning_seen        { code }
voltage_between     { at: Sel, min, max }
peripheral_state    { componentType, path: "data.angle", min?, max?, equals? }   // also "data.pixels.length"
wifi_connected      {}
http_route_exists   { path }
http_response_matches { path, pattern }                          // http.log bodies
mqtt_published      { topic, pattern?, minCount?=1 }
control_state       { componentType, field, equals }
all_of / any_of     { rules } ; not { rule }
```

## Drone quest extension (World 5)

World `w5` uses `esp32`, theme `violet`, and levels w5-l1 through w5-l6. Each starter/solution is an
ordinary level CircuitDoc with `kind:'drone'`; use the document constructor and validation in
`engine/drone/document.js`. Full schema and firmware APIs are in [DRONE.md](DRONE.md). Use the same
briefing/learn/objectives/hints/starCriteria structure and `all_of`/`any_of`/`not` composition.

| Predicate | Fields |
| --- | --- |
| `drone_config_between` | `field` (derived value), optional `min`, `max` |
| `esc_pulse_between` | `motor:1..4`, `minUs`, `maxUs`, optional `forMs` |
| `esc_armed_before_spin` | none; requires an armed ESC to have actually spun |
| `motor_direction` | `motor:1..4`, `direction:'cw'|'ccw'` |
| `prop_fitted` | `fitted:boolean`; true requires all four props, false accepts removed/unfitted props |
| `armed_state` | `armed:boolean`, optional historical `atMs` |
| `attitude_within` | `axis:'roll'|'pitch'|'yaw'`, `maxDeg`, `forMs` |
| `hover_held` | `minAltitudeM`, `maxDriftM`, `forMs` |
| `gates_passed` | `count`, `withinMs` |
| `landed_safely` | `maxImpactMs2` |
| `no_crash` | none |
| `blackbox_oscillation` | `axis`, `maxAmplitudeDeg`, `windowMs`; peak-to-peak attitude span |
| `imu_read_seen` | `minSamples`; only connected/powered IMU reads count |

Timed windows use 50 Hz blackbox samples, not UI frames. Firmware-dependent rules require a running
sketch through the existing running-rule gate; static config/direction/prop checks may pass at idle.
IMU teaching goals also combine `serial_matches` with scripted tilt to verify numerical output.

`solution.actions` additionally accepts `{atMs,sticks:{throttle,roll,pitch,yaw,arm,mode,signal}}`,
`{atMs,tilt:{roll,pitch,yaw}}` and `{atMs,disturbance:[roll,pitch,yaw]}`. Headless stepping ends exactly
at action boundaries; no real timers are used. Sticks are normalized (throttle 0..1, other axes -1..1).
Disturbance units are body deg/s impulses; tilt is degrees on the clamped stand. Reference solutions
must hold 1000 µs before arming/spinning and use props-off on bench levels. The boss permits editing
its build and never swaps in a reference circuit on Run. Keep two materially different builds in the
boss regression. All 32 campaign solutions must earn three stars in the shared headless gate.

## Intermediate and hard expansion (worlds 6–7)

Append worlds after w5 without renumbering or reordering existing quests. World 6 **Responsive
Machines** uses Uno and `difficulty:'intermediate'`; world 7 **Reliable Connections** uses ESP32
and `difficulty:'hard'`. Each has six quests, bringing the campaign to 32 levels and 96 stars.

| Level | Challenge | Main behavior |
| --- | --- | --- |
| w6-l1 | One Press, One Count | 30 ms debounce, stable falling edges, held-button rejection |
| w6-l2 | Steady Threshold | 700/300 ADC hysteresis with both midpoint histories |
| w6-l3 | Two Clocks | Independent 400/700 ms LED periods and responsive button input |
| w6-l4 | Guarded Servo | Hold-to-enable, analog angle mapping, 30–150° limits, release parks at 90° |
| w6-l5 | Climate Display | BME280 + LCD on shared I²C, refreshed readings and cleared text |
| w6-l6 | Crosswalk Controller | Timed state machine, exclusive traffic/walk signals, held request ignored |
| w7-l1 | Framed Serial Dimmer | Complete lines, exact decimal validation, bounded buffer and recovery |
| w7-l2 | Fresh Command Only | HTTP on/off/status, renewable 750 ms lease, expiry to off |
| w7-l3 | MQTT Command Desk | Exact ON/OFF commands, applied-state acknowledgements and errors |
| w7-l4 | Dual Sensor Watch | Temperature/humidity hysteresis, adjustable ADC1 setpoint, live HTTP |
| w7-l5 | Range Sentry | Protected echo, five-sample median, timeout clears history, independent heartbeat |
| w7-l6 | Connected Greenhouse | Automatic vent hysteresis, manual modes, MQTT reports, matching HTTP status |

Star criteria reward non-blocking scheduling or a bounded parts count. Solutions and starters use
the same placed parts; starters have no cables and an unsolved compilable sketch. Learn supplies
the exact pin map, program behavior, experiment sequence and relevant teaching-model limits.
All new display prose and hints have Indonesian translations. Cable endpoints occupy separate
free holes on the component's actual strip, and objective selectors use types/properties/pins so
replacement parts can satisfy the wiring requirements. No new validator rule or firmware API is needed.

`frontend/src/content/campaign.test.js` checks content, translations, physical placement, unsolved
starters and behavior under input sequences distinct from `solution.actions`. It includes negative
checks for a one-threshold alarm and missing I²C wiring. `engine/headless.test.js` runs every reference
through the complete solver/VM/validator with a 20-second per-test host timeout for the integrated
ESP32 quests; simulation deadlines remain the authored virtual `solutionRunMs`.

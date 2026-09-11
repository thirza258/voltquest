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

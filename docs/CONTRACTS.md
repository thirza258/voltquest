# VoltQuest — Module Contracts (v2, post-review)

All shapes are plain JS objects / JSON. Files are ES modules. Names below are **binding**: other packages import
exactly these exports from exactly these paths. Where a stub exists in the scaffold, keep the export names.

---------------------------------------------------------------------------------------------------------------
## 1. Identifiers & units

- Component ids: `c_<6 alnum>`; wire ids `w_<6>`; breadboard ids `bb1`, `bb2`. (`frontend/src/lib/ids.js` → `newId(prefix)`.) Quest content may use readable ids (`c_uno`, `c_led1`).
- **TerminalRef** (string): `"<ownerId>:<pinName>"`. Owner is a breadboard (`bb1:e12`, `bb1:TP7`) or a component (`c_ab12cd:anode`, `c_uno:D13`).
- **PinName** = `PinDef.name` (§2), e.g. `'D13'`, `'A0'`, `'GPIO4'`, `'5V'`, `'3V3'`, `'GND'`, `'VIN'`. **Every pin-keyed field in this document** — MCU footprint pin `id`s, TerminalRef pinName for MCU components, `pinNet`, `mcuPinVoltages`, `pinCurrents`, `dynamicState.mcuPins`, `burntPins`, every `pin` field in runtime messages, `SimState.mcuPins/tones`, Trace, `PeripheralBinding.pins` values, and every quest rule `pin`/`mcuPin`/`mcuPins` — is a PinName. Sketch pin numbers/aliases are converted by the runtime (`resolvePinNumber`) before anything is posted. Labels ('D4') and aliases ('T0') never appear in data.
- Ground: a board's ground pins are named `GND`, `GND2`, `GND3` (silkscreen order). The circuit engine merges all `kind:'ground'` pins into one net with fixed id `n_gnd` and label `'GND'` (the MNA reference). Quest selectors always write `{ "mcuPin": "GND" }`.
- World coordinates are px at zoom 1. **PITCH = 24 px** = 0.1 in. Export `PITCH` from `frontend/src/engine/components/breadboard.js`.
- Electrical units SI (V, A, Ω); UI formats mA/kΩ. Interpreter/runtime time = virtual **microseconds** (integer). Messages carry `t` = virtual µs.
- `registry` and `boards` parameters anywhere below are **module namespaces** (`import * as registry from 'engine/components/registry.js'`, `import * as boards from 'engine/boards/index.js'`); they are optional and default to those modules (they exist for test injection).

```js
/** @typedef Placement */ { anchor: { board: 'bb1', hole: 'e12' }, rotation?: 0|90|180|270 }   // mount:'board'
                        | { position: { x, y }, rotation?: 0|90|180|270 }                     // mount:'free'
```

---------------------------------------------------------------------------------------------------------------
## 2. Boards — `frontend/src/engine/boards/index.js` (package C)

```js
export const BOARDS = { uno, nano, esp32, esp32s3, raspberrypi4, raspberrypi5 }
export const BOARD_IDS = ['uno','nano','esp32','esp32s3','raspberrypi4','raspberrypi5']
export function getBoard(boardId) → BoardProfile
export function resolvePinNumber(board, n) → PinDef|null      // Arduino number → pin (Uno 14 → A0; ESP32 4 → GPIO4)
export function resolvePinName(board, nameOrAlias) → PinDef|null   // 'D13' | 'LED_BUILTIN' | 'A0' | 'T0' → pin
export function pinLabel(board, pinName) → string
```
```js
/** @typedef BoardProfile */
{
  id: 'uno', name: 'Arduino Uno R3', family: 'avr' | 'esp32' | 'raspberrypi', componentType: 'uno',
  vcc: 5 | 3.3, gpioMaxV: 5.5 | 3.6, adcBits: 10 | 12, intBits: 16 | 32, statementCostUs: 1 | 0.25,
  pinOutputResistance: 25 | 40, pinMaxSourceMa: 40, pullupOhms: 35000 | 45000, usbSupplyMaxMa: 500,
  ledBuiltin: 'D13' | 'GPIO2', i2c: { sda: 'A4', scl: 'A5' } | { sda: 'GPIO21', scl: 'GPIO22' } | { sda:'GPIO8', scl:'GPIO9' },
  pins: PinDef[],                    // ALL header pins incl. power, in silkscreen order (this order is also the MCU footprint pin order, §4.2)
  pwmDefault: { freqHz: 490 | 1000, bits: 8 },
  libraries: string[],               // headers available: uno/nano: ['Servo.h','LiquidCrystal_I2C.h','Wire.h','Adafruit_NeoPixel.h','DHT.h','Adafruit_SSD1306.h','Adafruit_GFX.h','Adafruit_BME280.h','Adafruit_Sensor.h'] ; esp32: those + ['WiFi.h','WebServer.h','PubSubClient.h','ESP32Servo.h']
  notes: string[]
}
/** @typedef PinDef */
{ name: PinName, label: string, kind: 'digital'|'analog'|'power'|'ground'|'other', number: number|null,
  aliases: string[], caps: ('digital'|'pwm'|'adc'|'dac'|'touch'|'input_only'|'i2c_sda'|'i2c_scl'|'interrupt'|'serial')[],
  adcChannel: number|null, touchChannel: number|null, dacChannel: number|null, volts: number|null, side: 'left'|'right'|'top'|'bottom', index: number }
```
**Uno** (free-mounted): top header left→right: `SCL, SDA, AREF, GND, D13, D12, D11, D10, D9, D8, D7, D6, D5, D4, D3, D2, D1, D0`; bottom header left→right: `IOREF, RESET, 3V3, 5V, GND2, GND3, VIN, A0, A1, A2, A3, A4, A5`. D3,D5,D6,D9,D10,D11 pwm; D2,D3 interrupt; A0–A5 numbers 14–19 (also digital); A4 i2c_sda, A5 i2c_scl; D0/D1 serial. `ledBuiltin='D13'`.
**Nano** (board-mounted, two rows of 15, second row dy=+6): row 1 (dy=0), dx 0..14: `D13, 3V3, AREF, A0, A1, A2, A3, A4, A5, A6, A7, 5V, RESET, GND, VIN`; row 2 (dy=6), dx 0..14: `D12, D11, D10, D9, D8, D7, D6, D5, D4, D3, D2, GND2, RESET2, D0, D1`. A6/A7 adc only.
**ESP32 DevKit V1** (board-mounted, 30 pins, two rows of 15, second row dy=+10): row 1 (dy=0), dx 0..14: `3V3, GND, GPIO15, GPIO2, GPIO4, GPIO16, GPIO17, GPIO5, GPIO18, GPIO19, GPIO21, GPIO3, GPIO1, GPIO22, GPIO23` (labels: 3V3, GND, D15, D2, D4, RX2, TX2, D5, D18, D19, D21, RX0, TX0, D22, D23); row 2 (dy=10), dx 0..14: `VIN, GND2, GPIO13, GPIO12, GPIO14, GPIO27, GPIO26, GPIO25, GPIO33, GPIO32, GPIO35, GPIO34, GPIO39, GPIO36, EN` (labels VIN, GND, D13, D12, D14, D27, D26, D25, D33, D32, D35, D34, VN, VP, EN). Touch: T0=GPIO4,T2=GPIO2,T3=GPIO15,T4=GPIO13,T5=GPIO12,T6=GPIO14,T7=GPIO27,T8=GPIO33,T9=GPIO32. ADC1 (usable with WiFi): 32,33,34,35,36,39; ADC2: 2,4,12,13,14,15,25,26,27. DAC 25,26. Input-only 34,35,36,39. GPIO1/3 serial. VIN volts 5 (USB-powered), 3V3 3.3. `ledBuiltin='GPIO2'`.
**ESP32-S3 DevKitC-1** (board-mounted, 44 pins, two rows of 22, dy=+10): row 1: `3V3, 3V3_2, RST, GPIO4, GPIO5, GPIO6, GPIO7, GPIO15, GPIO16, GPIO17, GPIO18, GPIO8, GPIO3, GPIO46, GPIO9, GPIO10, GPIO11, GPIO12, GPIO13, GPIO14, 5V, GND`; row 2: `GND2, GPIO43, GPIO44, GPIO1, GPIO2, GPIO42, GPIO41, GPIO40, GPIO39, GPIO38, GPIO37, GPIO36, GPIO35, GPIO0, GPIO45, GPIO48, GPIO47, GPIO21, GPIO20, GPIO19, GND3, GND4`. Touch T1–T14 = GPIO1–14; ADC 12-bit on GPIO1–20; no DAC; i2c sda GPIO8 scl GPIO9; `ledBuiltin='GPIO48'`; 5V volts 5.
Nano/ESP32 `5V`/`VIN` pins are `kind:'power'` with `volts: 5`; `3V3` volts 3.3.

---------------------------------------------------------------------------------------------------------------
## 3. Breadboard geometry — `frontend/src/engine/components/breadboard.js` (package C)

Long axis horizontal. Rows `1..N` left→right (N = 30 half, 63 full). Columns (letters) top→bottom `a b c d e` (upper block) and `f g h i j` (lower block). Rails: `TP` (red +) and `TN` (blue −) above; `BN` (blue −) and `BP` (red +) below.
Hole center (local px): `x = (1.5 + (row-1)) * PITCH`, `y = yIdx * PITCH`, `yIdx = {a:4,b:5,c:6,d:7,e:8, f:11,g:12,h:13,i:14,j:15}` (a→j = 11 pitches, as on real boards). Rails: `TP` yIdx 1, `TN` yIdx 2, `BN` yIdx 17, `BP` yIdx 18; rail holes in groups of 5 aligned to rows `2..6, 8..12, 14..18, …` (half: 5 groups = 25 holes/rail; full: 10 groups = 50); rail hole `k` (1-based) has the x of row `2 + 6*floor((k-1)/5) + ((k-1) % 5)`. Board size `width = (N + 2) * PITCH`, `height = 20 * PITCH`. Rails are electrically continuous along the whole board.
Strips: `"row<r>:upper"` (a–e), `"row<r>:lower"` (f–j), `"TP"`, `"TN"`, `"BN"`, `"BP"` (prefix with `<bb>:` when global).

```js
export const PITCH = 24
export const BREADBOARD_TYPES = { half: { rows: 30, tiePoints: 400 }, full: { rows: 63, tiePoints: 830 } }
export function boardSize(type) → { width, height }
export function boardHoles(type) → Hole[]            // memoized; Hole = { name:'e12'|'TP7', x, y, strip:'row12:upper'|'TP', kind:'main'|'rail', rail:'+'|'-'|null }
export function holeByName(type, name) → Hole|null
export function holeAt(type, localX, localY, tolerance = PITCH*0.45) → Hole|null
export function stripOf(type, holeName) → string
export function holesInStrip(type, strip) → Hole[]
export function layoutBreadboards(boardMode) → Breadboard[]    // 'half' → [bb1 half (0,0)]; 'full' → [bb1 full]; 'dual' → [bb1 half (0,0), bb2 half (0, 21*PITCH)]  (bb1 row j → bb2 row a = 10 pitches)
export function holeWorldPosition(doc, boardId, holeName) → {x,y}|null
export function terminalPosition(doc, terminalRef, registry?) → {x,y}|null   // holes AND component pins (uses registry.resolvePins)
export function holeAtWorld(doc, x, y, tolerance?) → { board: 'bb1', hole: Hole }|null
```

---------------------------------------------------------------------------------------------------------------
## 4. Circuit document & component registry (package C, consumed by everyone)

### 4.1 CircuitDoc (persisted JSON; `documentStore.doc`)
```js
{
  version: 1,
  boardMode: 'half' | 'full' | 'dual',
  breadboards: [ { id:'bb1', type:'half'|'full', x:0, y:0 }, ... ],   // = layoutBreadboards(boardMode)
  mcu: 'uno' | 'nano' | 'esp32' | 'esp32s3' | 'raspberrypi4' | 'raspberrypi5' | null,
  components: [ Component ],
  wires: [ { id:'w_x', from: TerminalRef, to: TerminalRef, color: 'red'|'black'|'yellow'|'green'|'blue'|'orange'|'white'|'purple' } ],
  meta: { name?: string }
}
/** @typedef Component */ { id, type, props: {...}, rotation: 0|90|180|270, anchor?: { board, hole }, position?: { x, y } }   // exactly one of anchor/position
```
At most one MCU component (category 'mcu'). Board-mounted components must have every footprint pin on a hole (canvas refuses invalid drops). Wires reference any TerminalRef; several wires may share a terminal.

### 4.2 Footprint geometry (binding for C, G1, G2, D)
- **Board mount**: origin `O` = world center of the anchor hole. Pin *i* world position = `O + R(rot)·(dx_i·PITCH, dy_i·PITCH)` with `R(0)(x,y)=(x,y)`, `R(90)(x,y)=(−y,x)`, `R(180)=(−x,−y)`, `R(270)=(y,−x)` (SVG screen convention, y down — identical to `rotate(rot)`). `footprint.pins[0]` is at `(0,0)` (the anchor pin). Un-rotated local body bbox = `[−PITCH/2, −PITCH/2] … [(width−0.5)·PITCH, (height−0.5)·PITCH]`; `componentBounds` = axis-aligned bbox of its 4 corners after `R(rot)`, translated by `O`.
- **Free mount**: `O` = `position` (top-left of the un-rotated body). Pins at `(dx_i·PITCH, dy_i·PITCH)` from `O` (fractional allowed, pin[0] need not be (0,0)); rotation about `O` with the same `R`; local bbox `[0,0] … [width·PITCH, height·PITCH]`.
- The renderer (§10) is mounted at `<g transform="translate(Ox,Oy) rotate(rot)">` and draws pin *i* at `(dx_i·PITCH, dy_i·PITCH)` — for both mounts.
- G1 validates drops/moves ONLY by building a candidate Component and calling `registry.resolvePins(candidate, doc).valid`.

### 4.3 Registry — `frontend/src/engine/components/registry.js`
```js
export const REGISTRY = { [type]: ComponentDef }
export function getDef(type) → ComponentDef
export function listDefs({ category?, board? } = {}) → ComponentDef[]
export function createComponent(type, placement: Placement, propsOverride?) → Component
export function resolvePins(component, doc) → { pins: { [pinId]: { terminal: TerminalRef, hole: TerminalRef|null, x, y } }, valid: boolean, invalidPins: string[] }
     // board mount: terminal === hole ref (`bb1:e12`) — the pin and the hole are the same electrical point; the engine also aliases `${comp.id}:${pinId}` onto the same net.
     // free mount: terminal = `${comp.id}:${pinId}`, hole = null.
export function pinPositions(component) → { [pinId]: { x, y } }        // world px (rotation applied), both mounts
export function componentBounds(component, doc) → { x, y, width, height }
export function defaultMcuPlacement(boardId, boardMode) → Placement    // uno → { position: { x: 0, y: -(504 + 2*PITCH) } } (above bb1); nano → { anchor:{board:'bb1', hole:'b1'} }; esp32 → half/full: { anchor:{board:'bb1', hole:'a1'} } ; dual: { anchor:{board:'bb1', hole:'j1'} }; esp32s3 same as esp32
export function describeValue(type, props) → string                    // '220 Ω', 'Red LED', '10 kΩ pot'
export function resistorBands(ohms) → [c1, c2, c3, 'gold']             // 4-band; 100 Ω..1 MΩ
export const RESISTOR_VALUES = [100,220,330,470,1000,2200,4700,10000,22000,47000,100000]
export const WIRE_COLORS = ['red','black','yellow','green','blue','orange','white','purple']   // hotkeys 1..5 = first five
```
```js
/** @typedef ComponentDef */
{
  type, name, category: 'mcu'|'output'|'input'|'passive'|'module', mount: 'board'|'free',
  recommendedBoards: BoardId[],                                     // grouping only, never blocks placement
  footprint: { pins: [ { id, label, dx, dy } ], width, height },     // pitch units; see §4.2
  props: { [key]: { type:'enum'|'number'|'boolean', label, options?, default, unit?, min?, max?, step?, format?: 'ohms' } },
  model: ModelElement[],                                            // §5.2 — every element names its pins by footprint pin id
  control: null | { kind:'momentary', field:'pressed' } | { kind:'knob', field:'value', min:0, max:1, default:0.5, label }
                | { kind:'slider', field, min, max, step, default, unit, label } | { kind:'toggle', field, label },
  peripheral: null | { protocol, roles: { [pinId]: Role }, i2cAddress?: number },   // §7.3
  learn: { summary, pinout: string[], tips: string[], formulas?: string[], pitfalls?: string[] },
  bom: { partName, catalogId }
}
```
**Required types, pin ids (binding for quest content) and footprints** (dx along rows/x, dy along columns/y):
| type | mount | pins (id@dx,dy) | props | model (§5.2) | control / peripheral |
| --- | --- | --- | --- | --- | --- |
| `uno` | free (27×21 pitch = 648×504 px) | ids = BOARDS.uno.pins[].name in that order; top header at dy=0.5, dx = 2.5 + i for i=0..17; bottom header at dy=20.5, dx = 8.5 + i for i=0..12 | — | mcu (engine adds sources/drivers) | — |
| `nano` | board (15×7) | ids = BOARDS.nano.pins[].name; row1 dy=0 dx 0..14, row2 dy=6 dx 0..14 | — | mcu | — |
| `esp32` | board (15×11) | ids = BOARDS.esp32.pins[].name; row1 dy=0, row2 dy=10 | — | mcu | — |
| `esp32s3` | board (22×11) | ids = BOARDS.esp32s3.pins[].name; row1 dy=0, row2 dy=10 | — | mcu | — |
| `resistor` | board (5×1) | p1@0,0 p2@4,0 | ohms (enum RESISTOR_VALUES, 220) | `[{kind:'resistor', pins:{a:'p1',b:'p2'}, ohms:'$props.ohms'}]` | — |
| `led` | board (2×1) | anode@0,0 cathode@1,0 | color (red/green/blue/yellow/white) | `[{kind:'diode', pins:{anode:'anode',cathode:'cathode'}, led:true, vf:'$color', rOn:'$color', ratedMa:20, maxMa:30}]` (vf/rOn by color: red 1.8/10, yellow 2.0/10, green 2.1/10, blue 2.7/20, white 2.8/20) | — |
| `rgb_led` | board (4×1) | r@0,0 cathode@1,0 g@2,0 b@3,0 | — | 3 diodes r/g/b → cathode (vf 1.8/2.1/2.7, rOn 10/10/20) | — |
| `capacitor` | board (2×1) | pos@0,0 neg@1,0 | uF (number, 100) | `[{kind:'capacitor', pins:{a:'pos',b:'neg'}}]` | — |
| `diode` | board (5×1) | anode@0,0 cathode@4,0 | — | diode vf 0.7 rOn 1 maxMa 1000 | — |
| `transistor_npn` | board (3×1) | e@0,0 b@1,0 c@2,0 | — | `[{kind:'npn', pins:{e:'e',b:'b',c:'c'}, beta:100}]` | — |
| `pushbutton` | board (3×2) | a1@0,0 a2@0,1 b1@2,0 b2@2,1 (a-group in row r, b-group in row r+2 — never the same strip) | — | `[{kind:'switch', pins:{a:'a1',b:'b1'}, closedWhen:{control:'pressed'}, rOn:0.1, bonds:[['a1','a2'],['b1','b2']]}]` | momentary pressed |
| `potentiometer` | board (3×1) | end1@0,0 wiper@1,0 end2@2,0 | ohms (10000) | `[{kind:'pot', pins:{end1:'end1',wiper:'wiper',end2:'end2'}, ohms:'$props.ohms', wiper:{control:'value'}}]` | knob value 0..1 |
| `ldr` | board (3×1) | p1@0,0 p2@2,0 | — | `[{kind:'resistor', pins:{a:'p1',b:'p2'}, ohms:{fromControl:'lightLevel', curve:'ldr'}}]` (0 % → 200 kΩ, 100 % → 1 kΩ, log) | slider lightLevel 0..100 % (default 60) |
| `buzzer` | board (3×1) | pos@0,0 neg@2,0 | — | resistor 1 kΩ | peripheral buzzer roles {pos:'signal', neg:'gnd'} |
| `servo` | board (3×1) | signal@0,0 vcc@1,0 gnd@2,0 | — | `[{kind:'module_power', pins:{vcc:'vcc',gnd:'gnd'}, minV:4.5}]` | peripheral servo {signal, vcc, gnd} |
| `lcd16x2_i2c` | board (4×1) | gnd@0,0 vcc@1,0 sda@2,0 scl@3,0 | addr (0x27) | module_power minV 4.5 | peripheral lcd_i2c {sda, scl, vcc, gnd} |
| `oled_ssd1306` | board (4×1) | vcc@0,0 gnd@1,0 scl@2,0 sda@3,0 | addr (0x3C) | module_power minV 3.0 | peripheral oled_i2c |
| `seven_segment` | board (5×4) | top dy=0: seg_g@0 seg_f@1 com@2 seg_a@3 seg_b@4; bottom dy=3: seg_e@0 seg_d@1 com2@2 seg_c@3 seg_dp@4 | — | 8 diodes `{anode: seg_x, cathode:'com'}` (vf 1.8, rOn 10, ratedMa 20, maxMa 30) + `bonds:[['com','com2']]` | — (componentStates.segments) |
| `neopixel_ring` | board (3×1) | din@0,0 vcc@1,0 gnd@2,0 | count (12) | module_power minV 4.5 | peripheral neopixel {din:'din'} |
| `ultrasonic_hcsr04` | board (4×1) | vcc@0,0 trig@1,0 echo@2,0 gnd@3,0 | — | module_power minV 4.5 + `{kind:'logic_out', pins:{out:'echo'}, highV:'vcc', rOut:50, level:{moduleOutput:'echo'}}` | slider distanceCm 2..400 (default 50); peripheral ultrasonic {trig, echo} |
| `pir` | board (3×1) | vcc@0,0 out@1,0 gnd@2,0 | — | module_power minV 4.5 + logic_out {out:'out'} highV 3.3 level {moduleOutput:'out'} | toggle motion; peripheral pir {out:'signal'} |
| `dht22` | board (3×1) | vcc@0,0 data@1,0 gnd@2,0 | — | module_power minV 3.0 + logic_out {out:'data'} highV 'vcc' level {moduleOutput:'data'} | sliders temperatureC −10..50 (24.5), humidity 0..100 (55); peripheral dht {data} |
| `bme280` | board (4×1) | vin@0,0 gnd@1,0 scl@2,0 sda@3,0 | addr (0x76) | module_power minV 3.0 | sliders temperatureC, pressureHpa 950..1050 (1013), humidity; peripheral bme280_i2c |
| `touch_pad` | board (1×2) | pad@0,0 | — | none (high-Z) | toggle touched; peripheral touch {pad:'signal'} |
| `level_shifter` | board (6×4) | top dy=0: hv@0 hv1@1 hv2@2 hv3@3 hv4@4 gnd_h@5; bottom dy=3: lv@0 lv1@1 lv2@2 lv3@3 lv4@4 gnd_l@5 | — | `[{kind:'level_shifter', pins:{hv:'hv',lv:'lv',gnd_h:'gnd_h',gnd_l:'gnd_l'}, channels:[['hv1','lv1'],['hv2','lv2'],['hv3','lv3'],['hv4','lv4']]}]` | — |
| `relay_5v` | board (6×1) | vcc@0,0 gnd@1,0 in@2,0 com@3,0 no@4,0 nc@5,0 | — | module_power minV 4.5 + `{kind:'switch', pins:{a:'com',b:'no'}, closedWhen:{relayOn:true}}` + `{kind:'switch', pins:{a:'com',b:'nc'}, closedWhen:{relayOn:false}}`; relayOn = powered && V(in)−V(gnd) > 0.6·Vmodule | — (componentStates.state on/off) |
| `dc_motor` | board (3×1) | p1@0,0 p2@2,0 | — | resistor 20 Ω, maxMa 1000 | — (spins ∝ current) |
Wire endpoints in content use these pin ids (`c_r1:p1`). Standard footprints above are what quest solutions assume.
**Invariant** (registry test): for every `mount:'board'` def, no two pins belonging to different internal groups (different model elements' terminals, or different `bonds` groups) may resolve to the same breadboard strip at any valid anchor/rotation.

### 4.4 Catalog — `content/catalog.json` (package B writes; C & backend read)
`{ "<catalogId>": { "name", "unitPriceUsd", "vendors": [ { "name", "url" } ], "notes" } }` with ids: `resistor_<ohms>` for every RESISTOR_VALUES entry, `led_<color>`, `rgb_led`, `capacitor`, `diode_1n4007`, `transistor_2n2222`, `pushbutton`, `potentiometer_10k`, `ldr`, `buzzer`, `servo_sg90`, `lcd16x2_i2c`, `oled_ssd1306`, `seven_segment`, `neopixel_ring_12`, `hcsr04`, `pir`, `dht22`, `bme280`, `touch_pad`, `level_shifter`, `relay_5v`, `dc_motor`, `arduino_uno`, `arduino_nano`, `esp32_devkit_v1`, `esp32_s3`, `breadboard_half`, `breadboard_full`, `jumper_wires`.

### 4.5 Cosmetics — `content/cosmetics.json`
`{ "skins": [ { "id":"classic","name":"Classic","unlockLevel":1,"description" }, { "id":"mint",…,"unlockLevel":3 }, { "id":"slate",…,"unlockLevel":6 } ], "wirePalettes": [ { "id":"standard","unlockLevel":1 }, { "id":"neon","unlockLevel":4 } ] }`. Unlocked when `unlockLevel <= player.level`.

---------------------------------------------------------------------------------------------------------------
## 5. Circuit engine — `frontend/src/engine/circuit/index.js` (package D)

```js
export function compileCircuit(doc, registry?, boards?) → CompiledCircuit
export function evaluateCircuit(compiled, dynamicState) → Evaluation
export function findPath(compiled, fromTerminal, toTerminal, opts?) → { nets: netId[], components: [{ id, type, props }] } | null
export function describeNet(compiled, netId) → { id, label, terminals, componentPins: [{componentId, pinId}] }
export function terminalsOfComponent(compiled, componentId) → { [pinId]: netId }
```
### 5.1 CompiledCircuit
```js
{ nets: [ { id, terminals: TerminalRef[], label: 'GND'|'5V'|'3V3'|'VIN'|PinName|null } ],   // n_gnd always exists when an MCU is present; power labels win over pin names
  terminalToNet: { [TerminalRef]: netId },        // holes, `${comp}:${pin}` aliases, MCU pins
  mcu: null | { componentId, board: BoardProfile, pinNet: { [PinName]: netId } },
  elements: Element[],                            // static elements from registry models (pins resolved to netIds)
  peripheralMap: PeripheralBinding[],             // §7.3
  issues: [ { code: 'no_mcu'|'unplaced_pin'|'vcc_gnd_short'|'floating_component', message, componentIds?, terminals?, severity } ] }
```
### 5.2 Model elements (`def.model[]` → `Element`s). Every element names footprint pin ids under `pins`.
```
{ kind:'resistor', pins:{a,b}, ohms: number | { fromControl:'lightLevel', curve:'ldr' } | '$props.ohms' }
{ kind:'diode', pins:{anode,cathode}, vf, rOn, ratedMa, maxMa, led?: true }      // LED vf/rOn by color: red 1.8/10, yellow 2.0/10, green 2.1/10, blue 2.7/20, white 2.8/20 (low-current knee values so LEDs light on 3.3 V boards). PWL: off = open, on = Vf source + rOn. Blow when iMa >= maxMa.
{ kind:'switch', pins:{a,b}, closedWhen: { control:'pressed' } | { relayOn: true|false }, rOn: 0.1, bonds?: [[pinId,pinId],...] }   // closed = rOn (0.1 Ω), open = absent; bonds = permanently joined pins
{ kind:'pot', pins:{end1,wiper,end2}, ohms, wiper: { control:'value' } }         // end1–wiper = max(ohms*(1−w), 1); wiper–end2 = max(ohms*w, 1). No element may contribute more than 1e3 S.
{ kind:'capacitor', pins:{a,b} }                                                   // DC open (info warning 'dc_only' once)
{ kind:'npn', pins:{e,b,c}, beta:100, vbeOn:0.7, vceSat:0.2, maxMa:800 }          // three-region: off (open) / active (B–E: 0.7 V + 10 Ω; Ic = beta·Ib current source, Ic ≥ 0) / saturated (B–E as above; C–E: 0.2 V source + 1 Ω, Ic clamped ≥ 0)
{ kind:'logic_out', pins:{out}, highV: number | 'vcc', rOut:50, level: { moduleOutput: pinId } }   // 'vcc' = operating-point voltage of the module's vcc net (0 when unpowered → high-Z); level from dynamicState.moduleOutputs[componentId][pinId]. hcsr04.echo highV 'vcc'; pir.out 3.3; dht22.data 'vcc'.
{ kind:'module_power', pins:{vcc,gnd}, minV }                                     // powered = V(vcc)−V(gnd) ≥ minV; no current draw
{ kind:'level_shifter', pins:{hv,lv,gnd_h,gnd_l}, channels:[[hvPin,lvPin],...] }  // two-pass: pass 1 — each channel side has a 10 kΩ pull-up to its own reference (hv / lv) and no driver; pass 2 — a side that pass 1 shows < 0.3·V(ref) (externally driven LOW) drives the opposite side LOW through 50 Ω; otherwise both sides idle HIGH via their pull-ups (a 5 V HIGH on HVn appears as V(lv) on LVn). Unpowered (hv or lv < 1 V) → channels open + 'unpowered_module'. Shifter outputs are never forced in the stress solve.
MCU (added by the engine when dynamicState.powered): power pins → { kind:'power_source', volts, rSeries: 0.1 } to n_gnd; GPIO by mcuPins[pin].mode:
   'output' → Thevenin V = level ? vcc : 0, R = board.pinOutputResistance; 'pwm' → discrete-state averaging (below); 'dac' → V = value; 'input' → none (high-Z);
   'input_pullup' → pullupOhms to vcc; 'input_pulldown' → pullupOhms to GND. Burnt pins → high-Z regardless of mode.
```
Every net gets `gmin = 1e-12` S to ground. A net with no path to any source or pull is `floating`.
**PWM**: for k ≤ 3 PWM pins enumerate the 2^k HIGH/LOW combinations (each pin at vcc or 0 through pinOutputResistance), weight each solve by Π duty_i / (1−duty_i), and report time-averaged node voltages and currents (brightness from I_avg); `overcurrent_*` and blow use the worst case (all HIGH). For k > 3: per-pin two-solve `I_avg = d·I_HIGH + (1−d)·I_LOW` with other PWM pins at their average voltage. `mcuPinVoltages` for PWM pins are averages.
**PWL iteration**: state vector s (diode off|on; npn off|active|sat) warm-started from the previous evaluation (all-off on the first solve). Loop ≤ 64: solve the linear system; violations: diode off & Vak > vf → on; diode on & I < 0 → off; npn off & Vbe > 0.7 → active; active & Vce < 0.2 → sat; sat & (Ic > β·Ib or Ic < 0) → active; active/sat & Ib ≤ 0 → off. Flip only the single largest violator per iteration; keep visited state vectors; on revisit or cap return the solution with the smallest total violation, `converged:false`, and warning `solver_unstable`.
### 5.3 dynamicState
```js
{ powered: boolean,                                                 // false → no sources/drivers at all (nets 0 V; only structural issues/warnings)
  mcuPins: { [PinName]: { mode:'input'|'input_pullup'|'input_pulldown'|'output'|'pwm'|'dac', level:0|1, duty:0..1, value: volts } },   // unlisted pins = 'input'
  controls: { [componentId]: { pressed?, value?, lightLevel?, distanceCm?, temperatureC?, humidity?, pressureHpa?, motion?, touched? } },
  damaged: { [componentId]: true }, burntPins: { [PinName]: true },
  moduleOutputs: { [componentId]: { [pinId]: 0|1 } } }              // derived by the controller (§8): pir.out = motion?1:0; dht22.data = 1 (idle high); hcsr04.echo = 0; absent → 0
```
### 5.4 Evaluation
```js
{ ok, converged, nodeVoltages: { [netId]: V }, mcuPinVoltages: { [PinName]: V }, supplyCurrentA,
  componentStates: { [componentId]: { voltage, current, power, brightness: 0..1, state: 'ok'|'blown'|'on'|'off', powered?: bool, segments?: { [segPinId]: bool }, channels?: { r, g, b }, warnings: string[] } },
  pinCurrents: { [PinName]: A },   // positive = sourcing
  warnings: Warning[], events: Event[] }
/** Warning */ { code, message, hint, componentIds?, pinNames?, terminals?, severity:'error'|'warning'|'info' }
/** Event */ { type:'blow', componentId, reason:'overcurrent', currentMa } | { type:'burnt_pin', pinName, volts } | { type:'short' }
```
brightness for LEDs = `min(1, iMa / ratedMa) ** 0.5` with iMa = current·1000 (0 when blown or iMa < 0.1): 220 Ω from a 5 V pin → 12.5 mA → 0.79; 1 kΩ → 3.2 mA → 0.40; ESP32 + 220 Ω blue → 2.2 mA → 0.33. Learn-card formula: `I = (Vsrc − Vf) / (R + Rpin + rOn)`. Warning codes (exact): `solver_unstable`, `divider_too_weak`, `short_circuit`, `power_overload`, `overcurrent_component`, `overcurrent_pin`, `overvoltage_gpio`, `floating_input`, `no_ground`, `unpowered_module`, `reverse_led`, `led_no_resistor`, `adc2_wifi` (from runtime, not D), `input_only_pin` (runtime), `dc_only`.
Overvoltage uses **two solves**: operating point, then a stress solve with every `logic_out` whose resolved highV > board.gpioMaxV forced HIGH (never shifter outputs); any ESP32 GPIO net > `gpioMaxV` in either → `overvoltage_gpio` + `burnt_pin` event. Damage is sticky via dynamicState (controller adds events → re-evaluates).
Expected numbers (tests): 5V→LED(red) direct→GND: (5−1.8)/(10+0.1) ≈ 317 mA → blow; 5V→220Ω→LED→GND: ≈ 13.9 mA; D13(HIGH, 25 Ω)→220Ω→LED: ≈ 12.5 mA; D13→LED direct: ≈ 91 mA → blow + overcurrent_pin; 5V→1kΩ→node→2.2kΩ→GND: 3.44 V (from an HC-SR04 echo with rOut 50: 3.38 V; safe for ESP32 < 3.6); ESP32 GPIO wired to VIN: burnt; red LED direct on an ESP32 GPIO (3.3−1.8)/(40+10) = 30.0 mA → blows (>= maxMa).
### 5.5 findPath
`findPath(compiled, from, to, { through: [{ type, props? }], exact?: false, maxHops: 6 })` — BFS across two-terminal edges: resistor, led/diode (each rgb/7-seg anode→cathode is an edge), switch (regardless of state), capacitor, ldr, buzzer, dc_motor, pot end↔wiper and end↔end; returns the first path whose component sequence contains `through` in order (extra components allowed unless `exact`).

---------------------------------------------------------------------------------------------------------------
## 6. Interpreter core — `frontend/src/engine/interpreter/index.js` (package E1)

```js
export function compile(source, { intBits }) → { ok, program?, errors: Diagnostic[], warnings: Diagnostic[], includes: string[], macros: {}, classesUsed: string[], globalsUsed: string[] }
export function createVM(program, host) → VM
export function formatValue(value, type, base?) → string      // char → character, float → 2 decimals (or `base` digits), ints DEC/HEX/OCT/BIN (base 10/16/8/2), bool → 1/0, String → text, object → obj.__toString?.() ?? '[object]'
```
Language subset: comments; `#include` (recorded); object-like `#define`; `#ifdef/#ifndef/#if defined()/#else/#endif/#undef`; types `void bool boolean char byte word int unsigned int short long unsigned long float double uint8_t int8_t uint16_t int16_t uint32_t int32_t size_t String`, `const static volatile unsigned`; `T*`/`const T*` parameter and variable types (treated as array/String values); 1-D/2-D arrays with initializers + `sizeof`; block scoping; functions in any order (hoisted), prototypes accepted, recursion; `if/else for while do…while switch/case/default break continue return`; all C operators incl. ternary, comma, compound assignment, bitwise/shifts; C-style and functional casts (`int(x)`, `String(x)`, `String(x, HEX)`, `String(f, decimals)`); string/char literals with escapes; raw string literals `R"delim(...)delim"`; `PROGMEM` and `F(x)` as no-ops; lambdas `[](){…}`/`[&](){…}` (by reference) and `[=](){…}` (by value snapshot); function names as values; object declarations `Ident name(args);`/`Ident name;` for classes in `host.classes`; member call `obj.method(args)`; basic `struct` and `enum`.
Integer semantics: the result of every arithmetic/bitwise operator (`+ - * / % << >> ~` unary −, compound assignment, `++/--`) wraps to the static result type's width (8-bit types promote to int per C rules) AND numbers wrap on store per declared type (`int` = intBits signed, `long` 32 signed, `unsigned int` intBits unsigned, `unsigned long` 32 unsigned, `byte/uint8_t/char` 0..255, int16_t/uint16_t, int32_t/uint32_t, `bool` 0/1). Integer/integer division truncates; `%` on ints; division by zero → runtime error. Static expression types (literals, declarations, return types, operator rules) are exposed as `ctx.argTypes`.
**String is language-level (E1)**: JS primitive strings; `+` concatenation with numbers/chars (formatted like Arduino: float 2 decimals, char as character), and ALL String methods (`length charAt indexOf lastIndexOf substring toInt toFloat equals equalsIgnoreCase toUpperCase toLowerCase trim startsWith endsWith replace concat c_str compareTo isEmpty remove setCharAt reserve`) are implemented by E1 in `values.js`.
```js
/** host */ { intBits, statementCostUs, natives: { [fn]: NativeFn }, globals: { [name]: any }, classes: { [className]: NativeClass }, onError(err) }
/** NativeFn */ ((args, ctx) => any|Generator) | { fn: (args, ctx) => any|Generator, returns: CType, params?: CType[] }     // CType ∈ the §6 type list; plain functions have unknown return type → fallback formatting: Number.isInteger(v) ? integer : 2 decimals, never char
/** NativeClass */ { construct: (args, ctx) => object /* with __class */, methods: { [name]: NativeFn }, fields?: (self) => object }
// IMPORTANT (as implemented): a class method's NativeFn is invoked as `fn.call(self, args, ctx)` — i.e. the
// signature is `(args, ctx)`, exactly like a global native, with the receiver available as `this` and as
// `ctx.self`. Do NOT write `(self, args, ctx)`. `ctx.argTypes` are the static types of `args`.
/** NativeCtx */ { vm, argTypes: string[], now(): µs, sleep(us): Yield, invoke(callable, args): Generator, line }
/** VM */ { start(), step(maxStatements) → { status:'running'|'sleeping'|'halted'|'error', wakeAtUs?, error?:{message,line} }, now(), advanceTo(us), call(callable, args) → { status, value?, error? } /* run to completion at a safe point */, getGlobal(name), setGlobal(name, v), halted, lastLine }
```
Yields: `{type:'sleep', untilUs}` and `{type:'tick'}` (at least every 64 statements). `step` never exceeds `maxStatements`. Virtual time is an integer: keep a statement counter and `now = floor(count × statementCostUs) + sleeps`; all `t` fields are integers. Tests must include: `int a = 40; Serial.println(a * 1000);` → -25536 on intBits 16 (40000 on 32); `long big = 1000 * 1000;` → 16960 on 16 (1000000 on 32); `float f = 3.0; Serial.print(f)` → "3.00"; `char c = 65; Serial.print(c)` → "A". Missing `setup`/`loop` → compile error. Runtime errors carry the line. Performance ≥ 2 M statements/s in Node.

---------------------------------------------------------------------------------------------------------------
## 7. Runtime (Arduino API + libraries) — `frontend/src/engine/runtime/index.js` (package E2)

```js
export function createRuntime({ board: BoardProfile, post, realtime = true, now? }) → Runtime
/** Runtime */ { load(source) → { ok, errors, warnings }, start(), stop(), reset(), handle(msg), advance(ms) /* realtime:false only, synchronous */, getPinStates(), getSnapshot() }
```
`load()` cross-checks `compile().includes/classesUsed/globalsUsed` against `board.libraries` and emits: `"'<Class>' does not name a type; did you forget #include <X.h>?"` and, for avr boards, `"'WiFi' was not declared in this scope — WiFi.h is not available on Arduino Uno"` (same for WebServer/PubSubClient/touchRead/ledc*).
Raspberry Pi extension: `board.language === 'python'` selects the restricted Python GPIO frontend
and adapters documented in `RASPBERRY_PI.md`. Its header model, approximation limits, supported
syntax, source-line mapping and persistence requirements are binding additions to §2/§4/§7.
Other profiles default to Arduino C++. Raspberry Pi has `adcBits: 0`, `ledBuiltin: null`, no
Arduino libraries, and software PWM. `getSnapshot()` includes `status`, `error`, `millis`,
`running`, `tones` and `wifi`; `getPinStates()` returns detached copies.

### 7.1 Inbound (main → worker)
```js
{ type:'load', source, board: BoardId } | { type:'start' } | { type:'stop' } | { type:'reset' }
{ type:'env', digital: { [PinName]: 0|1 }, analog: { [PinName]: volts }, touch: { [PinName]: number }, peripherals: { [componentId]: {...controls} }, peripheralMap: PeripheralBinding[], wifiAllowed: boolean }
{ type:'serialInput', text } | { type:'httpRequest', id, method, path, body?, headers? } | { type:'mqttInbound', topic, payload }
```
### 7.2 Outbound (worker → main); every message has `t` (virtual µs at post time)
```js
{ type:'compiled', ok, errors, warnings }
{ type:'status', status:'running'|'stopped'|'halted'|'error', error? }
{ type:'pins', changes: [ { t, pin, mode?, level?, duty?, freq?, value? } ] }   // ONE entry per actual change, in execution order, each with its own t (a write to the current level produces no entry); at most one 'pins' message per 4 ms slice
{ type:'read', reads: [ { t, kind:'analog'|'touch', pin, value } ] }              // every analogRead/touchRead call (batched per slice)
{ type:'serial', text } | { type:'serialBegin', baud }
{ type:'tone', pin, freq }                                                        // 0 = noTone
{ type:'peripheral', componentId: string|null, protocol, data }                   // worker resolves componentId via env.peripheralMap (null when unbound → controller logs once and drops). data: servo {angle}; lcd_i2c {lines:[..], backlight}; oled_i2c {width:128,height:64, pixels: number[] /* 1024 bytes, SSD1306 page layout */}; neopixel {pixels:[[r,g,b],…], brightness}
{ type:'wifi', status:'idle'|'connecting'|'connected'|'failed'|'ap', ssid, ip, rssi, mode }
{ type:'http', event:'serverStarted'|'route', port, routes: string[] } | { type:'httpResponse', id, status, contentType, headers: {}, body }
{ type:'mqtt', event:'connect'|'disconnect'|'publish'|'subscribe'|'deliver', host?, topic?, payload?, clientId?, ok? }
{ type:'interrupt', pin, mode } | { type:'tick', millis } | { type:'log', level:'info'|'warn', code?: 'adc2_wifi'|'input_only_pin'|'unbound_device'|..., message }
```
### 7.3 PeripheralBinding (produced by D; sent to the worker inside `env`)
```js
{ componentId, type, protocol, pins: { [role]: PinName|null }, powered: boolean, i2cAddress?: number, props: {} }
```
Role table (binding): servo → `signal`; buzzer → `signal` (pos); touch → `signal` (pad); pir → `signal` (out); neopixel → `din`; dht → `data`; ultrasonic → `trig`, `echo`; lcd_i2c / oled_i2c / bme280_i2c → `sda`, `scl` + `i2cAddress`. Power roles `vcc`/`gnd` → `powered`. Binding rule: for each role pin search `findPath(rolePin, mcuPin, { maxHops: 2 })` across resistors and level_shifter channels (0 hops = same net). Module INPUT roles (signal, din, trig, in, sda, scl) bind to the MCU pin reached. Module OUTPUT roles (echo, out, data) are confirmed electrically: force that logic_out HIGH (stress solve) and bind to the input-mode MCU pin whose net rises ≥ 0.6·vcc and falls ≤ 0.3·vcc when forced LOW (1 kΩ/2.2 kΩ divider → 3.38 V ✓; a 10 kΩ/1 kΩ divider → 0.45 V → unbound + warning `divider_too_weak`). `dc_motor`, `seven_segment`, `relay_5v`, `level_shifter` produce no binding. Libraries find devices by pin (`Servo.attach(9)` → binding with `pins.signal === resolvePinNumber(9).name`) or by I2C address (sda/scl on the board's `i2c` pins and matching address). Unbound/unpowered → calls still run, one `log` warn, sensors return error values (DHT → NaN; BME `begin()` → false; LCD/OLED/NeoPixel draw nothing).
### 7.4 API surface — required
Core: `pinMode digitalWrite digitalRead analogRead analogWrite analogReadResolution analogWriteResolution delay delayMicroseconds millis micros tone noTone pulseIn map constrain min max abs pow sqrt sq round floor ceil sin cos tan random randomSeed bit bitRead bitWrite bitSet bitClear lowByte highByte isDigit isAlpha isSpace attachInterrupt detachInterrupt digitalPinToInterrupt interrupts noInterrupts yield`; constants `HIGH LOW INPUT OUTPUT INPUT_PULLUP INPUT_PULLDOWN LED_BUILTIN A0..A7 T0..T9 PI HALF_PI TWO_PI DEG_TO_RAD RAD_TO_DEG RISING FALLING CHANGE DEC HEX OCT BIN`.
`Serial` (`begin print println write available read peek readString readStringUntil parseInt parseFloat flush setTimeout`, `printf` on the esp32 family) — printing via `formatValue`. `Serial.begin` posts `serialBegin`. **UART timing**: a 64-byte TX FIFO drained at 10 bits/baud per byte (1.04 ms/char at 9600, 87 µs at 115200; default 9600 when begin was never called); print/write enqueue and `yield ctx.sleep` only while the FIFO is full — so print-heavy loops run at realistic speed. `serial` messages are coalesced per slice into one text chunk. Also `snprintf sprintf dtostrf itoa` writing into `char[]` buffers (char arrays coerce to String when passed to natives), `WiFiClient.print/println`.
Libraries: `Servo`, `LiquidCrystal_I2C`, `Wire` (no-op), `Adafruit_NeoPixel`, `DHT` (+ constants DHT11/DHT22), `Adafruit_BME280`, `Adafruit_SSD1306` (+ `Adafruit_GFX` colours `WHITE BLACK SSD1306_WHITE`), `WiFi` (+ WL_* / WIFI_* constants), `WebServer(port)` (`on(path, handler)`, `on(path, method, handler)`, `onNotFound`, `begin`, `handleClient`, `send(code, type, body)`, `sendHeader(name, value)`, `setContentLength` no-op, `arg`, `argName`, `args`, `hasArg`, `uri`, `method`, `client`), `HTTP_GET HTTP_POST HTTP_ANY`, `WiFiClient`, `PubSubClient`, ESP32 extras `touchRead ledcSetup ledcAttachPin ledcWrite ledcAttach ledcDetach dacWrite hallRead analogSetAttenuation analogSetPinAttenuation analogReadMilliVolts ESP.getFreeHeap ESP.getChipModel ESP.restart esp_random`, constants `ADC_0db ADC_2_5db ADC_6db ADC_11db` (full scale 1.1/1.5/2.2/3.3 V, default 11 dB). `IPAddress` prints "192.168.4.1".
Semantics: network per v1 (SSIDs `VoltNet`/`VoltNet-Guest`, 500 ms connect, ip 192.168.4.1, wrong SSID → `WL_NO_SSID_AVAIL` after 3 s; `softAP` immediate 'ap'; MQTT connect 200 ms; retained topics; inbound delivered in `loop()` via callback `(topic: String, payload: byte[], length)`). `handleClient()` pops queued requests, invokes the handler via `yield* ctx.invoke`, `send()` posts `httpResponse` with collected `sendHeader`s (no send → 500; unmatched → onNotFound or 404). `delay(ms)` sleeps; `pulseIn(pin, level, timeout=1e6)`: echo of an `ultrasonic` binding → sleep then return `round(distanceCm*58.3)` µs; else wait until the env level matches, then return the duration until it changes back (from subsequent env updates) or 0 at timeout. `analogRead` → `round(min(v,fs)/fs · (2^adcBits−1))` (fs = vcc on AVR; attenuation full scale on ESP32); non-ADC pin → 0 + log; ADC2 while WiFi connected → 0 + `log code 'adc2_wifi'`. `touchRead` → `touch[pin] ?? 70`. AVR `analogWrite` on a non-PWM pin → `digitalWrite(value < 128 ? LOW : HIGH)` + log; ESP32 `analogWrite` supported (ledc). `INPUT_PULLDOWN` on AVR → posts mode 'input' + log. `tone(pin, f, duration?)`. `attachInterrupt` ISRs run at the next slice after a matching env edge via `vm.call`. `random()` seedable (mulberry32).

---------------------------------------------------------------------------------------------------------------
## 8. Worker & SimulationController — `frontend/src/engine/sim/` (package F)

`sim.worker.js`: thin wrapper (only file allowed to use `self`): on `load` create `createRuntime({ board: getBoard(msg.board), post })`, then `runtime.load(source)`; forward other messages to `runtime.handle`.

```js
// frontend/src/engine/sim/index.js
export { createSimulation, createTrace, deriveEnv }
export function createSimulation({ createWorker?, inline? }) → Simulation
/** Simulation */ {
  setDocument(doc), setCode(source),                                // board is derived from compiled.mcu.board (run() fails with diagnostics 'no_mcu' when absent)
  run() → Promise<{ ok, errors }>,                                  // run() performs an implicit reset() first and increments runId
  stop(), reset(),                                                  // reset: clears damaged, burntPins, events, warningCodesSeen, trace, serial, tones, peripherals, wifi/http/mqtt state, runtime; keeps doc/code/controls
  setControl(componentId, patch), setPowered(bool),                 // powered default true when an MCU exists ("USB is plugged in"); the sandbox toolbar toggles it
  serialWrite(text), httpRequest({ method, path, body?, headers? }) → Promise<{ status, contentType, headers, body }> /* rejects { status:0, error:'timeout' } after 3000 ms wall */, mqttPublish(topic, payload),
  advance(ms) /* inline only */, getState() → SimState, subscribe(listener) → unsubscribe, dispose()
}
/** SimState (immutable snapshot) */
{ status: 'idle'|'compiling'|'running'|'stopped'|'error', runId, diagnostics: Diagnostic[], runtimeError: {message,line}|null, millis,
  powered: boolean, compiled: CompiledCircuit, evaluation: Evaluation,
  mcuPins: { [PinName]: { mode, level, duty, freq, value, voltage } }, controls, damaged: { [id]: true }, burntPins: { [PinName]: true },
  warnings: Warning[]  /* = evaluation.warnings, current */, warningCodesSeen: { [code]: count } /* since reset */, events: Event[] /* since reset, max 200 */,
  serial: [ { t, text } ] /* ring 2000 */, serialSeq: number, serialBaud: number|null, tones: { [PinName]: freq },
  peripherals: { [componentId]: { protocol, data } },
  wifi: { status, ssid, ip, mode, rssi }, http: { started: boolean, routes: string[], log: [ { t, method, path, status, contentType, body /* ≤16 kB */ } ] },
  mqtt: { connected, topics: { [topic]: { value, t, count } }, log: [ { t, dir:'pub'|'sub'|'in', topic, payload } ] },
  trace: Trace }
```
`Trace` (`sim/trace.js`): `createTrace()` → `{ pinEvents: [{t,pin,level|duty}], analogReads: [{t,pin,value}], touchReads: [{t,pin,value}], serialText /* tail-capped at 64 kB */, record(msg), edgesOf(pin, sinceUs?) → n, periodOf(pin) → µs|null (mean of the last ≤8 rising-edge intervals), distinctDuties(pin) → number[], segmentsOf(pin) → [{ level, fromUs, toUs }], reset() }`; ring max 20 000 pin events.
Env derivation (`deriveEnv(compiled, evaluation, controls, board, prevEnv)`): input-mode pins: `digital = v > 0.6·vcc ? 1 : v < 0.3·vcc ? 0 : prev ?? 0`; `analog` = voltage for adc pins; `touch[pin]` = 15 if a bound touch_pad is touched else 70; `peripherals[id]` = control values; `moduleOutputs` per §5.3. Send `env` only when changed — but clear the cache on load/start/reset and always send one full `env` immediately after `start` (before the first VM slice; synchronously in inline mode). Pins on a `floating` net get `digital[pin]` from a seeded PRNG re-drawn on every `tick` so a button without a pull visibly flickers until a pull is added.
Publication cadence: evaluate on every `pins`/env/control/doc change, but notify subscribers at most once per animation frame (rAF in browsers, 16 ms timer in Node) with the latest snapshot. Trace records every edge regardless.
`setDocument` while running keeps running (recompile, drop damaged/burnt entries of removed parts, re-send env + peripheralMap).

---------------------------------------------------------------------------------------------------------------
## 9. Validator — `frontend/src/engine/validator/index.js` (package F)

```js
export function evaluateObjectives(level, ctx) → { objectives: [ { id, text, passed, rules: [ { rule, passed, detail } ] } ], allPassed, stars: 0..3, starReasons: string[], efficiency: { codeLines, componentCount } }
export function evaluateRule(rule, ctx) → { passed, detail? }
/** ctx */ { doc, compiled, sim: SimState, code, board, sticky: { [objectiveId]: true } }
```
Sticky semantics: while `sim.status === 'running'` a passed objective stays passed (caller keeps `sticky`, cleared on `run()`/`reset()`); while idle objectives are recomputed live (sticky ignored). Rules that need firmware (`pin_*`, `pwm_*`, `analog_read_seen`, `serial_matches`, `wifi_*`, `http_*`, `mqtt_*`, `touch_used`, `peripheral_state`) can only pass while running. Wiring/electrical rules work at idle too because power is on.
Stars: 1 = allPassed; 2 = 1 and (`level.starCriteria.damageExpected` or (no `blow`/`burnt_pin` events and `!warningCodesSeen.short_circuit` in this run)); 3 = 2 and all `starCriteria.three` rules pass. Hints never affect stars. Rule types: see QUEST_SCHEMA.md (incl. `pin_pattern`, `warning_seen`).

---------------------------------------------------------------------------------------------------------------
## 10. Canvas — `frontend/src/canvas/` (G1 core, G2 renderers)

```jsx
<BreadboardCanvas doc readOnly simState ghost highlights selectedIds tool wireColor
  onSelect onAddComponent(type, placement: Placement) onMoveComponent(id, placement) onRotateComponent(id) onRemove(ids)
  onAddWire(from,to,color) onRemoveWire(id) onControl(componentId, patch) onWireColorChange(color) onDropRejected(reason) onEspNeedsDualBoard()
  cosmetics={{ skin, wirePalette }} />
```
- Root: `<div tabIndex={0} role="application" aria-label="Breadboard canvas" data-canvas-root>` containing `<svg data-canvas-svg>`. Canvas hotkeys (`V` select, `W` wire, `R` rotate, `Delete/Backspace`, `1–5` wire colors → `onWireColorChange`, `Esc`, `+/-/0` zoom, `F` fit) fire only when focus is inside the canvas root or on `body`.
- `readOnly`: no add/move/rotate/delete/wire/drops (`onDropRejected('readOnly')`), but hover tooltips and `onControl` (buttons/knobs/sliders) stay live.
- Device drags preserve the grab offset and update previews at most once per animation frame. Free-mounted previews follow the pointer continuously, with the final position snapped to a half-pitch grid; board-mounted previews snap to the nearest valid anchor in the local search area. Resolve and validate the release coordinates again before committing one move. Only the initiating pointer owns a gesture; Escape, pointer cancellation/lost capture and window blur cancel it and clear queued previews. Wheel and viewport hotkeys do not move the view during a drag.
- Tooltips show voltages whenever `simState.evaluation` exists (power is on at idle); "—" when `!simState.powered`.
- Renderer mounting per §4.2. Missing renderer → `GenericPartRenderer` (labelled box + pin pads). `React.memo` every renderer; pass only its own slices. Hole layers memoized per board type; hover highlight via CSS classes on a single overlay, not React state per hole.
- Tone for a component: `simState.tones[binding.pins.signal] ?? 0` where `binding` is the component's entry in `compiled.peripheralMap`.
- ESP32 drop on a non-dual board → place if valid and call `onEspNeedsDualBoard()`.
```jsx
<Renderer comp def state peripheral control running powered selected ghost damaged burntPins board tone onControl interactive />
```
Effects (`canvas/effects/index.js`, G2): `<SmokePuff x y onDone/>`, `<CrackOverlay width height/>`, `<GlowFilter id/>`, `<Sparkle x y/>`. `exportCanvasPng(svgElement, scale=2) → Promise<Blob>` (G1, `canvas/exportPng.js`).

---------------------------------------------------------------------------------------------------------------
## 11. Stores, routes & app glue (package H1) — `frontend/src/store/*.js`

### 11.1 Routes (react-router-dom, `App.jsx`)
`/` campaign map · `/play/:levelId` · `/sandbox` (new; `?from=<levelId>` seeds from the level draft) · `/sandbox/:projectId` · `/showcase` · `/showcase/:slug` (public read-only interactive preview) · `/profile` · `/leaderboard` · `*` NotFound. All modes share the header shell: logo (→ `/`), nav SegmentedControl "Campaign · Sandbox · Showcase", mode-specific centre, right cluster, avatar chip menu (Profile, Claim account / Log in, Log out, Audio, Shortcuts `?`).
Tutorial extension: `/tutorials` and `/tutorials/:tutorialId?board=<boardId>` share the header shell.
The header adds a Tutorials navigation item. The content, filters, difficulty progression, runnable
examples and derived wiring-guide contract live in `TUTORIALS.md`. Tutorials do not grant campaign XP.

### 11.2 Stores
```js
useDocumentStore: { doc, selectedIds, past, future, setDoc, load(doc), clear(), setBoardMode(mode) /* refuses shrink when parts sit on bb2 → returns { ok:false, blocking:[ids] } */,
  setMcu(boardId|null) → { removedWires, remapped } /* replaces the MCU at registry.defaultMcuPlacement; keeps wires whose pin name exists on the new board; maps 5V↔VIN, A0..A5 → first ADC pins; removes the rest */,
  addComponent(type, placement, props?) → id, updateComponent, setProps, moveComponent, rotateComponent, removeComponents, addWire → id, updateWire, removeWires, select, undo, redo }
useSimStore: { sim, state, objectives, run, stop, reset, setControl, setPowered, serialWrite }   // subscribes to controller; validator run in campaign mode after each notify; sticky map cleared on run/reset
usePlayerStore: { player, token, progress, online, pendingOps, settings: { audio, skin, wirePalette, monitorBaud }, seenWorlds, ensureGuest(), login, claim, logout, completeLevel(levelId, payload) → { xpGained, levelUp, unlocked }, recordAttempt, setSettings, refresh() }
   // offline-first: everything mirrored to localStorage 'vq.player'; failed complete/attempt/settings calls are queued in pendingOps and flushed on load, on 'online', and after any successful call; `online` = last call ok (health poll every 30 s while offline); 401 for a guest → new guest + replay; for a claimed user → clear token + toast
useWorkspaceStore: { mode:'campaign'|'sandbox'|'showcase', levelId, code, editorMode:'text'|'blocks', blocklyXml, leftTab:'objectives'|'parts'|'inspect'|'learn', rightTab:'code'|'phone'|'iot', tool, wireColor,
  hintTier: { [objectiveId]: 0..3 }, showGhost, hintTargets, requestHint() /* first unpassed objective, tier++ */, resetHints(), setCode, setEditorMode, setTool, setWireColor, setLeftTab, setRightTab, drafts }
```
Drafts: `vq.draft.<levelId>` / `vq.draft.sandbox` (new) / `vq.draft.sandbox.<projectId>` (saved projects) = `{ doc, code, blocklyXml, editorMode, savedAt }` debounced 1 s; offered on open for explicit Resume / Start fresh, then shown with a Callout "Resumed your work · Start over". Header sim button is "Reset sim"; overflow menu "Restart level" restores starterCircuit/starterCode.
Level gating: available if first in LEVEL_ORDER or `progress[prev].stars ≥ 1`; locked cards offer "Skip ahead". Briefing auto-opens on first open (`vq.player.seenLevels`); header ⓘ reopens. Success modal opens once per `runId` on the false→true `allPassed` transition; "Replay" = Restart level; last level → "Back to map". `ensureGuest()` is fire-and-forget.
`lib/xp.js`: `xpForLevel(n) = 100·(n−1)·n/2` cumulative; `levelForXp(xp)`; `xpForCompletion(level, stars, prevStars) = round(level.xp · (1 + 0.25·(stars−1))) − round(level.xp · (1 + 0.25·(prevStars−1)))` (prevStars 0 → full). Backend `xp.py` mirrors both.
`frontend/src/api/client.js`: `api.get/post/put/del`, `ApiError { status, detail }`, base `import.meta.env.VITE_API_URL ?? '/api'`, helpers `api.players.guest/me/update/claim`, `api.auth.login`, `api.quests.list/get`, `api.progress.list/complete/attempt`, `api.projects.list/create/get/update/remove/publish`, `api.showcase.list/get/fork`, `api.exports.bom/bomJson`, `api.leaderboard`, `api.health`.
`frontend/src/content/index.js`: `WORLDS, LEVELS, LEVEL_ORDER, CATALOG, COSMETICS, getLevel, getWorld, nextLevelId, prevLevelId`.
Project file (`features/sandbox`): `{ format:'voltquest-project', version:1, name, board, boardMode, circuit, code, blocklyXml, editorMode, exportedAt }`.
Blockly policy: in `blocks` mode every change regenerates `code` (Monaco read-only with banner "Generated from blocks"); text→blocks when `code !== generated` asks to confirm; blocks→text silent.

---------------------------------------------------------------------------------------------------------------
## 12. UI kit — `frontend/src/ui/index.js` (package J)
`Button({ variant:'primary'|'secondary'|'ghost'|'danger'|'success', size:'sm'|'md'|'lg', icon, iconRight, loading, disabled, block })`, `IconButton({ icon, label, size, variant, active })`, `Panel({ title, subtitle, actions, children, className, padded, collapsible, defaultOpen, footer })`, `Tabs({ tabs:[{id,label,icon,badge}], value, onChange, size })`, `Modal({ open, onClose, title, description, size, children, footer, closeOnOverlay })` (focus trap, Esc, aria-labelledby, restore focus), `Tooltip({ content, children, side })`, `Badge({ tone:'neutral'|'brand'|'success'|'warning'|'danger'|'volt'|'info', children, dot })`, `ProgressBar({ value, max, tone, label, showValue, size })`, `Toaster()` (`role="status"`) + `useToast()`, `Kbd`, `Stat({ label, value, unit, hint, tone })`, `EmptyState({ icon, title, description, action })`, `Spinner`, `Switch({ checked, onChange, label })`, `Select({ value, onChange, options, label, size, disabled })`, `NumberField`, `Slider({ value, onChange, min, max, step, label, unit, marks })`, `TextInput`, `Field({ label, hint, error, children })`, `Stars({ value, max=3, size, animated })` (aria-label "2 of 3 stars"), `ChipMascot({ mood:'happy'|'thinking'|'alert'|'celebrate'|'sleepy', size, className })`, `SpeechBubble({ children, tone })`, `Card({ children, className, hover, onClick })`, `Divider`, `SegmentedControl({ options:[{value,label,icon}], value, onChange, size })`, `Callout({ tone, title, children, icon, action })`, `Menu({ trigger, items:[{label, icon, onSelect, danger}] })`.
Informational text uses `#64748B` (slate-500) minimum; `#94A3B8` only decorative/disabled.

---------------------------------------------------------------------------------------------------------------
## 13. Deferred (explicitly out of scope for this build)
Educator Portal (classes/assignments), Custom Component Creator, virtual oscilloscope, ESP32-S3 camera/AI levels, cloud compilation. README lists them.

## 14. Localization and circuit assistant extension (2026-09-12)

`i18n/index.jsx` exports `LocaleProvider`, `useI18n() → { locale, setLocale, t }`, `LanguageSelect`,
`translate(locale, message, values?)`, and `LOCALES`. Default is `en`; supported alternative is `id`.
The provider persists the choice in `vq.locale`, updates HTML `lang`, and never remounts a workspace
on a language change. Source content and engine data stay locale-neutral. UI labels, including
accessible canvas names, are translated at rendering; identifiers/code/output are preserved.

`features/assistant/context.js` exports `buildAssistantContext({ mode, title, doc, code, selectedIds,
state, lesson, objectives, completedSteps })`. It returns `{ mode, title, board, code, circuit,
selection, simulation, lesson, truncated }` from the current implementation, with resolved pins,
live values and visible learning goals. Hidden solutions/hints and credentials must not be included.
The frontend targets an 80,000-byte UTF-8 snapshot; the API rejects contexts over 96 KiB.

`AssistantPanel` accepts these same props; it builds context when sending or explicitly sharing.
`useWorkspaceStore.leftTab` additionally accepts `assistant`. Campaign/sandbox/showcase mount the
panel inside the circuit sidebar, retaining chat while switching to Inspect. Tutorials render it
below the canvas; read-only selection and live controls remain available. `WorkspacePage.projectName`
supplies the unsaved sandbox or public project's name independently of its rendered header title.

`api.assistant` exports `status`, `chat(body, {signal})`, `mcpAccess`, `mcpToken`, `revokeMcp`,
`shareContext(context)`; `mcpUrl()` resolves the API's `/mcp/` endpoint. Request cancellation/deadlines
remain active through response-body consumption. Chat does not edit code or circuits. MCP exposes
only catalog/context and owned project creation/update tools; it never executes firmware or publishes.
Wire protocol, credentials and limits are binding in `API.md`; usage is described in `ASSISTANT.md`.

## 15. Custom Drone Builder extension (2026-09-12)

`engine/drone/{config,document,electrical,dynamics,rules,bom,examples}.js` defines the quad-X teaching
subsystem. The complete schema, units, coefficients, firmware subset and verification limits are in
[DRONE.md](DRONE.md). These additions extend §§3–9 and §11; existing breadboard shapes remain valid.

- `CircuitDoc.kind` is optional (`breadboard` by default) or `drone`. Drone docs retain `version:1`,
  matching `mcu`/`droneConfig.fc.board`, and `boardMode:'half'` as a storage compatibility marker.
  Empty `breadboards`/`wires` accompany `mounts:[{componentId,mount}]`, typed
  `links:[{id,from,to,kind,awg,lengthM}]`, a version-1 `droneConfig`, `course:[{x,y,z,radius}]`,
  and `flight:{seed,bench,wind:[x,y,z]}`. No new board id exists. Limit: 32 parts, 100 links, 24 gates.
- `listDefs({bench:'drone'})` selects frame, brushless motor, prop, ESC, LiPo and sensor/receiver
  definitions; default `listDefs()` remains breadboard-only. `getDef` resolves either kind.
  `resolvePins` uses named mounts and component terminals for drones, never synthetic breadboard holes.
  `createDroneDoc`, `validateDroneDoc`, `deriveConfig`, `feasibility`, `CONFIG_FIELDS`, `PRESETS` and
  `DEFAULT_CONFIG` are named exports from their respective document/config modules.
- Link kinds are `power|phase|signal|i2c|uart`; phase is one bundle. Existing terminal-net and
  PeripheralBinding resolution adds ESC (`signal,vbat,gnd`), IMU/baro (`sda,scl,vcc,gnd`, addresses
  0x68/0x76), receiver and optional GPS connector roles (`tx,rx,vcc,gnd`). The analytical drone power
  branch runs on this compiled topology; breadboard MNA and its timing are unchanged.
- Electrical → dynamics: `V_bus` in V, `escEnabled[4]` booleans, FC rail/brownout/cutoff.
  Dynamics → electrical: `motorCurrentA[4]` in A. Physics fixes its step at 1000 µs, owns the seed/PRNG,
  and is pumped at scheduler event boundaries during firmware sleeps. UI interpolation never drives it.
- Runtime accepts optional `droneDoc` at construction/load. Inbound messages add `sticks`,
  `flightTimeline`, `benchTilt`, `disturbance`, `flightSpeed`. `env` adds `imu`, `baro`, `rc`, `rpm`
  (reserved optional `gps`). ESC writes use the existing `peripheral` message with protocol `esc`,
  componentId and `{us}`. Sensor APIs require actual binding/power and board-correct I²C pins.
- Outbound `{type:'flight',t,state}` carries bounded deltas at ≤50 Hz. `SimState.flight` merges them
  into immutable telemetry: µs `t`, SI `position/velocity`, quaternion, rad/s body `rates`, degree
  `attitude`, RPM, µs pulses, currents/thrust, electrical state, RC, armed/crashed/landed/gates,
  sensor snapshots, damage/events, blackbox (3000 rows) and inputs (10000 rows). Inputs have monotonic
  ids and virtual `atMs`, with `sticks`, `tilt` or `disturbance`. Replay requires complete input history.
- `Simulation.run({flightTimeline}?)` still implies reset; `replayFlight()` captures the current
  recording and starts it before execution. `setSticks`, `setFlightTimeline`, `setBenchTilt`, `disturb`
  and `setSpeed(.25|.5|1)` are additive methods. Drone assembly edits stop firmware, invalidate replay,
  recompile topology and retain damage until explicit repair/reset; changing code invalidates replay.
- Warning vocabulary adds `reverse_polarity`, `esc_overcurrent`, `motor_overheat`, `wire_overcurrent`,
  `bec_overload`, `brownout`, `lipo_overdischarge`, `prop_direction_mismatch`, `no_prop_guard`, `desync`,
  `crash`, `receiver_loss`, `arm_throttle_high`; all have corrective explanations. Pack shorts use
  `short_circuit`. Reverse/short abort; brownout resets firmware at the current virtual time.
- Scalar unary address expressions (`&ax`) can be passed as writable one-element references to
  teaching native libraries; existing array-address behavior remains unchanged. This does not add
  general pointer arithmetic or arbitrary native memory access.
- `/sandbox?bench=drone` uses the existing project/draft/save/import/showcase flows. Imports accept a
  complete project or standalone validated drone specification; code examples replace code only with
  confirmation. The build ZIP contains project/config JSON, BOM CSV, wiring PNG/SVG, `.ino`, checklist.
  `ProjectSummary.drone_config` is nullable; all displayed estimates remain derived, never persisted.
- Assistant snapshots add allowlisted drone specification, mounts, connectors, course and flight
  telemetry. MCP guide/component metadata describes the same drone schema, with the same existing
  ownership and private-project/timestamp constraints. No firmware executes on the backend.

Custom numeric parameters of known drone parts are in scope. The deferred Custom Component Creator
in §13 still means authoring entirely new part definitions; this feature does not implement it.

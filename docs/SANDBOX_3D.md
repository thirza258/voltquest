# Sandbox 3D view and additional parts

The breadboard sandbox (`/sandbox` and saved `/sandbox/:projectId` projects) offers **2D / 3D**
above the circuit. 2D remains the default editing view. 3D displays the current CircuitDoc with
raised components, controller headers, breadboard holes and curved jumpers. Drag to orbit, scroll
or pinch to zoom, and right-drag or move two fingers to pan. Camera buttons and arrow/+/−/F keys
on the focused view provide keyboard alternatives. **Fit circuit** restores an angled overview;
**Top view** looks straight down.

Click a component or wire to open the existing inspector. The labelled part select offers the same
component selection without pointing at a small mesh. Inspector controls, properties and live values
work in either view; positioning parts and drawing cables use the 2D canvas. Parts added through the
drawer also appear immediately in 3D. The drawer has 37 types, with search and a category filter.

## Integration contract

- `canvas/three/model.js` derives its geometry from `resolvePins`, `terminalPosition`, `boardSize`
  and the current document. World X/Y become scene X/Z; one 3D unit equals `PITCH`. Board-mounted
  and free-mounted rotations use the same origin and pin placement as the SVG. All six controllers
  and Half/Full/Dual layouts work; body heights and jumper arcs are illustrative.
- `createCircuitScene(doc, {surface}?)` builds Node-compatible Three.js geometry and exposes
  `{root, model, update(simState, selectedIds), dispose()}`. The optional surface painter belongs to
  the browser. LED/RGB emission, NeoPixels, display data, servo angles, controls and damage indications
  consume the existing simulation snapshots. The renderer does not calculate circuit behavior.
- `createCircuitViewer(host, {onSelect, onUnavailable})` owns WebGL2, OrbitControls, resizing,
  picking and rendering. It paints only on changes, caps pixel ratio at 2, pauses rendering while
  hidden, and disposes controls, listeners, frames, textures, geometries and GPU context on unmount.
- `CircuitViewport` keeps the original SVG mounted and measured. Its hidden wrapper is `inert`
  and excluded from accessibility; canvas hotkeys ignore an inert ancestor. Switching views does not
  reload the document, restart firmware, modify undo history or replace the editor. The 2D viewport
  remains available to the existing **Export PNG** action, which exports the wiring drawing.
- Three.js is pinned locally as `three@0.186.0`, behind a lazy feature boundary and a separate
  `three` build chunk. There are no CDN models/textures. Missing WebGL2, context loss and failed lazy
  loading offer **Return to 2D**. Camera/view choice is local to the mounted workspace, not a new
  CircuitDoc field or backend setting.
- Campaign, prepared tutorials, drone, robotics and vision retain their respective view interfaces.
  New part definitions are in the shared registry; campaign allowlists still control availability.

The new view is a teaching visualization, not a mechanical CAD or PCB routing tool. Body geometry,
cable heights and proportions are illustrative. It does not add Linux/CPU emulation or an ADC to Pi.

## Eight additional parts

| Type | Terminals | Control and electrical model |
| --- | --- | --- |
| `slide_switch` | `p1@0`, `p2@2` | `closed` toggle; SPST, 0.1 Ω closed |
| `reed_switch` | `p1@0`, `p2@4` | `magnetNear` toggle; normally open, 0.1 Ω closed |
| `tilt_switch` | `p1@0`, `p2@2` | `tilted` toggle; 0.1 Ω closed, orientation expressed as a binary input |
| `trimpot` | `end1@0`, `wiper@1`, `end2@2` | `value` 0…1; existing potentiometer branches, default 10 kΩ |
| `variable_resistor` | `p1@0`, `p2@4` | `resistanceOhms` 100…100000 Ω, default 10000 |
| `thermistor_ntc` | `p1@0`, `p2@2` | `temperatureC` −20…100 °C, default 25; nominal 10 kΩ / beta 3950 |
| `force_sensor` | `p1@0`, `p2@2` | `forcePercent` 0…100%, default 0; 1 MΩ unloaded, 1 kΩ at maximum |
| `flex_sensor` | `p1@0`, `p2@2` | `bendDegrees` 0…90°, default 0; 10 kΩ flat, 30 kΩ bent |

All pins have `dy=0`; all parts use board mounts, with a body one pitch tall and one pitch wider
than the final pin's dx. The three contacts are ideal switches without contact bounce. Resistive
sensor models use ordinary MNA resistor branches; no library or firmware special case is required.

`engine/components/sensorCurves.js` defines deterministic, clamped teaching curves:

- NTC: `R = 10000 × exp(3950 × (1/(T°C + 273.15) − 1/298.15))`.
- Force: `R = 1000000 / (1 + 999 × forcePercent/100)`.
- Flex: `R = 10000 + 20000 × bendDegrees/90`.

These omit self-heating, hysteresis and manufacturer tolerances. Put a fixed resistor in a divider
to read the sensors with an ADC. Feed ESP32 dividers from 3V3. Pi can use the contacts as GPIO inputs
but has no built-in ADC for the analog sensors. English and Indonesian learning notes explain these
boundaries. Catalog prices are illustrative estimates without vendor-quote claims.

Definitions, 2D renderers and 3D geometry ship together. Project JSON uses the existing schema and
validates against the registry. `content/mcp-catalog.json` is regenerated from those definitions;
MCP project validation, save/open, public preview/fork and frontend/backend BOM exports accept the
parts without a database migration. Trimpot resistance is included in BOM grouping.

## Verification

Adjacent tests cover all six controllers' geometry, rotated origins, every registered part's mesh
data and cleanup, LED output from the real solver, digital/ADC firmware behavior for the new inputs,
import validation, BOM pricing, keyboard controls, WebGL fallback, localization, and view switching
with the same running simulation and undo history. Backend tests cover MCP metadata/validation →
save → public fork → BOM for all eight new parts. See AGENTS.md for the latest complete gate and
browser verification results; physical-device and cross-browser performance remain release checks.

Renderer API references: [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)
and [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html).

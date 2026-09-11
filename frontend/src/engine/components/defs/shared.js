/**
 * Helpers and constants shared by the component definitions (CONTRACTS §4.3).
 */

/** E-series resistor values offered in the drawer (Ω). */
export const RESISTOR_VALUES = [100, 220, 330, 470, 1000, 2200, 4700, 10000, 22000, 47000, 100000]

/** Jumper wire colours; the first five map to hotkeys 1..5. */
export const WIRE_COLORS = ['red', 'black', 'yellow', 'green', 'blue', 'orange', 'white', 'purple']

/** LED colours offered in the drawer. */
export const LED_COLORS = ['red', 'green', 'blue', 'yellow', 'white']

/**
 * LED forward voltage / on-resistance by colour (low-current knee values so LEDs light on 3.3 V boards — §5.2).
 * @type {Record<string, { vf: number, rOn: number }>}
 */
export const LED_PARAMS = {
  red: { vf: 1.8, rOn: 10 },
  yellow: { vf: 2.0, rOn: 10 },
  green: { vf: 2.1, rOn: 10 },
  blue: { vf: 2.7, rOn: 20 },
  white: { vf: 2.8, rOn: 20 },
}

/** LDR resistance range (Ω): 0 % light → 200 kΩ, 100 % → 1 kΩ, logarithmic in between. */
export const LDR_DARK_OHMS = 200000
export const LDR_BRIGHT_OHMS = 1000

/**
 * LDR resistance for a light level in percent (log interpolation between the dark and bright extremes).
 * @param {number} lightLevel 0..100
 */
export function ldrOhms(lightLevel) {
  const t = Math.min(100, Math.max(0, Number(lightLevel) || 0)) / 100
  return LDR_DARK_OHMS * Math.pow(LDR_BRIGHT_OHMS / LDR_DARK_OHMS, t)
}

/**
 * Footprint pin (pitch units). `dy` defaults to 0 for single-row parts.
 * @returns {{ id: string, label: string, dx: number, dy: number }}
 */
export function pin(id, dx, dy = 0, label = id) {
  return { id, label, dx, dy }
}

/**
 * Footprint from a list of pins and a body size in pitches. Pin 0 must sit at (0,0) for board-mounted parts.
 */
export function footprint(pins, width, height) {
  return { pins, width, height }
}

/** Enum prop descriptor. */
export function enumProp(label, options, def, extra = {}) {
  return { type: 'enum', label, options, default: def, ...extra }
}

/** Number prop descriptor. */
export function numberProp(label, def, { min, max, step = 1, unit } = {}) {
  return { type: 'number', label, default: def, min, max, step, unit }
}

/** Slider control descriptor (single). */
export function slider(field, label, min, max, def, { step = 1, unit = '' } = {}) {
  return { kind: 'slider', field, min, max, step, default: def, unit, label }
}

/** Several controls on one part (sensor modules) — see `controlsOf` in registry.js. */
export function multiControl(...controls) {
  return { kind: 'multi', controls }
}

/** Module power element: powered when V(vcc) − V(gnd) ≥ minV, draws no current. */
export function modulePower(vcc, gnd, minV) {
  return { kind: 'module_power', pins: { vcc, gnd }, minV }
}

/** Open-drain-free logic output driven by the controller's `moduleOutputs` (sensor signal pins). */
export function logicOut(out, highV, rOut = 50) {
  return { kind: 'logic_out', pins: { out }, highV, rOut, level: { moduleOutput: out } }
}

/** LED-style diode element (default parameters of a 5 mm indicator LED). */
export function ledDiode(anode, cathode, vf, rOn, extra = {}) {
  return { kind: 'diode', pins: { anode, cathode }, led: true, vf, rOn, ratedMa: 20, maxMa: 30, ...extra }
}

/** All boards — for parts that work identically at 5 V and 3.3 V. */
export const ALL_BOARDS = ['uno', 'nano', 'esp32', 'esp32s3', 'raspberrypi4', 'raspberrypi5']
export const AVR_BOARDS = ['uno', 'nano']
export const ESP_BOARDS = ['esp32', 'esp32s3']

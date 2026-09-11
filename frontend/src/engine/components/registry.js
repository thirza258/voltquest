/**
 * Component registry — CONTRACTS §4.2/§4.3.
 *
 * Definitions live in `./defs/*`; this module adds geometry (rotation, board/free mounts), placement validation,
 * value formatting and model-placeholder resolution. Pure: no DOM, runs under vitest in Node.
 */
import { newId } from '../../lib/ids.js'
import { PITCH, holeAtWorld, holeLocalPosition, holeWorldPosition, layoutBreadboards } from './geometry.js'
import { ALL_DEFS } from './defs/index.js'
import { LED_PARAMS, RESISTOR_VALUES, WIRE_COLORS, ldrOhms } from './defs/shared.js'

export { RESISTOR_VALUES, WIRE_COLORS, LED_PARAMS, ldrOhms }

/** @type {Record<string, import('./defs/shared.js').ComponentDef>} */
export const REGISTRY = Object.freeze(Object.fromEntries(ALL_DEFS.map((def) => [def.type, def])))

const CATEGORY_ORDER = ['mcu', 'passive', 'output', 'input', 'module']
const BAND_COLORS = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'gray', 'white']
/** Tolerance used when snapping a footprint pin onto a hole (pins land exactly on hole centres). */
const PIN_SNAP_TOLERANCE = PITCH * 0.3

/**
 * Definition by type.
 * @returns {ComponentDef|null}
 */
export function getDef(type) {
  return REGISTRY[type] ?? null
}

/**
 * Definitions, optionally filtered by category and/or recommended board, in drawer order.
 * @param {{ category?: string, board?: string }} [filter]
 */
export function listDefs({ category, board } = {}) {
  return ALL_DEFS.filter((def) => (!category || def.category === category) && (!board || def.recommendedBoards.includes(board))).sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  )
}

/** Default prop values of a definition. */
export function propDefaults(def) {
  return Object.fromEntries(Object.entries(def?.props ?? {}).map(([key, spec]) => [key, spec.default]))
}

/**
 * New Component from a type and Placement (§1). Props default from the def and are overridden by `propsOverride`.
 * @param {string} type
 * @param {{ anchor?: {board:string,hole:string}, position?: {x:number,y:number}, rotation?: 0|90|180|270 }} placement
 * @param {object} [propsOverride]
 * @param {{ id?: string }} [options]
 */
export function createComponent(type, placement, propsOverride = {}, { id } = {}) {
  const def = getDef(type)
  if (!def) throw new Error(`Unknown component type "${type}"`)
  const component = {
    id: id ?? newId('c'),
    type,
    props: { ...propDefaults(def), ...propsOverride },
    rotation: normalizeRotation(placement?.rotation),
  }
  if (placement?.anchor) component.anchor = { board: placement.anchor.board, hole: placement.anchor.hole }
  else if (placement?.position) component.position = { x: placement.position.x, y: placement.position.y }
  else if (def.mount === 'free') component.position = { x: 0, y: 0 }
  else throw new Error(`Component "${type}" needs an anchor (board mount)`)
  return component
}

function normalizeRotation(rotation) {
  const r = ((Number(rotation) || 0) % 360 + 360) % 360
  return r === 90 || r === 180 || r === 270 ? r : 0
}

/**
 * Rotate a local offset by 0/90/180/270° (SVG convention, y down): R(90)(x,y) = (−y, x).
 */
export function rotatePoint(x, y, rotation) {
  switch (normalizeRotation(rotation)) {
    case 90:
      return { x: -y, y: x }
    case 180:
      return { x: -x, y: -y }
    case 270:
      return { x: y, y: -x }
    default:
      return { x, y }
  }
}

/** Board offset for a breadboard id — from the doc, or from the standard layout when the doc lacks it. */
function boardOffset(doc, boardId) {
  const fromDoc = doc?.breadboards?.find((b) => b.id === boardId)
  if (fromDoc) return { x: fromDoc.x, y: fromDoc.y }
  return layoutBreadboards('dual').find((b) => b.id === boardId) ?? { x: 0, y: 0 }
}

/**
 * World origin `O` of a component (anchor hole centre for board mount, `position` for free mount).
 * Returns `{ origin, anchored }` where `anchored` is false when a board-mounted anchor cannot be found in `doc`
 * (the origin is then a best-effort guess from the standard layout so positions still exist).
 */
function componentOrigin(component, doc) {
  if (component.anchor) {
    const exact = holeWorldPosition(doc, component.anchor.board, component.anchor.hole)
    if (exact) return { origin: exact, anchored: true }
    const offset = boardOffset(doc, component.anchor.board)
    const local = holeLocalPosition(component.anchor.hole) ?? { x: 0, y: 0 }
    return { origin: { x: offset.x + local.x, y: offset.y + local.y }, anchored: false }
  }
  const position = component.position ?? { x: 0, y: 0 }
  return { origin: { x: position.x, y: position.y }, anchored: true }
}

/**
 * World position of every footprint pin (rotation applied), both mounts. `doc` is optional and only needed for
 * board-mounted parts on a breadboard that is not at its standard layout position.
 * @returns {{ [pinId]: { x: number, y: number } }}
 */
export function pinPositions(component, doc = null) {
  const def = getDef(component?.type)
  if (!def) return {}
  const { origin } = componentOrigin(component, doc)
  const out = {}
  for (const p of def.footprint.pins) {
    const r = rotatePoint(p.dx * PITCH, p.dy * PITCH, component.rotation)
    out[p.id] = { x: origin.x + r.x, y: origin.y + r.y }
  }
  return out
}

/**
 * Permanently joined pin groups of a definition (`bonds` on any model element), as a pin → group-id map.
 * Pins that are not bonded are their own group.
 */
export function bondsOf(def) {
  const bonds = []
  for (const element of def?.model ?? []) if (Array.isArray(element.bonds)) bonds.push(...element.bonds)
  return bonds
}

function bondGroups(def) {
  const parent = new Map()
  const find = (p) => {
    while (parent.has(p) && parent.get(p) !== p) p = parent.get(p)
    return p
  }
  for (const pair of bondsOf(def)) {
    for (const p of pair) if (!parent.has(p)) parent.set(p, p)
    const root = find(pair[0])
    for (const p of pair.slice(1)) parent.set(find(p), root)
  }
  return (pinId) => find(pinId)
}

/**
 * Resolve a component's pins to terminals (§4.3). Board mount: every pin must land on a hole of some breadboard
 * in `doc`, and pins that are not internally bonded must not share a strip (that would be an internal short —
 * e.g. a pushbutton rotated 90° inside one block). Free mount: terminals are `${id}:${pin}` aliases.
 * @returns {{ pins: { [pinId]: { terminal: string, hole: string|null, x: number, y: number } }, valid: boolean, invalidPins: string[], shorts: string[][] }}
 */
export function resolvePins(component, doc) {
  const def = getDef(component?.type)
  if (!def) return { pins: {}, valid: false, invalidPins: [], shorts: [] }
  const positions = pinPositions(component, doc)
  const pins = {}
  const invalid = new Set()
  const shorts = []
  const alias = (pinId) => `${component.id}:${pinId}`

  if (!component.anchor) {
    for (const p of def.footprint.pins) pins[p.id] = { terminal: alias(p.id), hole: null, x: positions[p.id].x, y: positions[p.id].y }
    return { pins, valid: true, invalidPins: [], shorts }
  }

  const { anchored } = componentOrigin(component, doc)
  const byStrip = new Map()
  for (const p of def.footprint.pins) {
    const { x, y } = positions[p.id]
    const found = anchored ? holeAtWorld(doc, x, y, PIN_SNAP_TOLERANCE) : null
    if (!found) {
      pins[p.id] = { terminal: alias(p.id), hole: null, x, y }
      invalid.add(p.id)
      continue
    }
    const holeRef = `${found.board}:${found.hole.name}`
    pins[p.id] = { terminal: holeRef, hole: holeRef, x, y }
    const stripKey = `${found.board}:${found.hole.strip}`
    if (!byStrip.has(stripKey)) byStrip.set(stripKey, [])
    byStrip.get(stripKey).push(p.id)
  }

  const groupOf = bondGroups(def)
  for (const pinIds of byStrip.values()) {
    if (pinIds.length < 2) continue
    for (let i = 0; i < pinIds.length; i++) {
      for (let j = i + 1; j < pinIds.length; j++) {
        if (groupOf(pinIds[i]) === groupOf(pinIds[j])) continue
        shorts.push([pinIds[i], pinIds[j]])
        invalid.add(pinIds[i])
        invalid.add(pinIds[j])
      }
    }
  }

  const invalidPins = def.footprint.pins.map((p) => p.id).filter((id) => invalid.has(id))
  return { pins, valid: invalidPins.length === 0, invalidPins, shorts }
}

/**
 * Axis-aligned world bbox of a component body after rotation (§4.2).
 * Board mount: local `[−P/2, −P/2] … [(w−0.5)P, (h−0.5)P]`; free mount: `[0,0] … [wP, hP]`.
 */
export function componentBounds(component, doc = null) {
  const def = getDef(component?.type)
  if (!def) return { x: 0, y: 0, width: 0, height: 0 }
  const { origin } = componentOrigin(component, doc)
  const { width, height } = def.footprint
  const [x0, y0, x1, y1] = component.anchor
    ? [-PITCH / 2, -PITCH / 2, (width - 0.5) * PITCH, (height - 0.5) * PITCH]
    : [0, 0, width * PITCH, height * PITCH]
  const corners = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ].map(([x, y]) => rotatePoint(x, y, component.rotation))
  const xs = corners.map((c) => c.x)
  const ys = corners.map((c) => c.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return { x: origin.x + minX, y: origin.y + minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY }
}

/**
 * Where a freshly selected MCU goes (§4.3): Uno floats above bb1; Nano straddles b/f; ESP32 family anchors at
 * a1 (single board, exposing row j) or at j1 in dual mode (bridging bb1 and bb2).
 * @returns {import('./defs/shared.js').Placement}
 */
export function defaultMcuPlacement(boardId, boardMode = 'half') {
  switch (boardId) {
    case 'uno':
    case 'raspberrypi4':
    case 'raspberrypi5': {
      const boardHeight = REGISTRY[boardId].footprint.height * PITCH
      return { position: { x: 0, y: -(boardHeight + 2 * PITCH) } }
    }
    case 'nano':
      return { anchor: { board: 'bb1', hole: 'b1' } }
    case 'esp32':
    case 'esp32s3':
      return { anchor: { board: 'bb1', hole: boardMode === 'dual' ? 'j1' : 'a1' } }
    default:
      return { position: { x: 0, y: 0 } }
  }
}

/**
 * Human-readable resistance: 220 → '220 Ω', 10000 → '10 kΩ', 1e6 → '1 MΩ', 4700 → '4.7 kΩ'.
 */
export function formatOhms(ohms) {
  const value = Number(ohms)
  if (!Number.isFinite(value)) return '— Ω'
  const trim = (n) => String(Number(n.toFixed(2)))
  if (Math.abs(value) >= 1e6) return `${trim(value / 1e6)} MΩ`
  if (Math.abs(value) >= 1e3) return `${trim(value / 1e3)} kΩ`
  return `${trim(value)} Ω`
}

function capitalize(text) {
  return typeof text === 'string' && text ? text[0].toUpperCase() + text.slice(1) : ''
}

function hex(n) {
  return `0x${Number(n).toString(16).toUpperCase().padStart(2, '0')}`
}

/**
 * Short value description for the inspector / tooltips: '220 Ω', 'Red LED', '10 kΩ pot'.
 */
export function describeValue(type, props = {}) {
  const def = getDef(type)
  if (!def) return String(type)
  const p = { ...propDefaults(def), ...props }
  switch (type) {
    case 'resistor':
      return formatOhms(p.ohms)
    case 'led':
      return `${capitalize(p.color)} LED`
    case 'potentiometer':
      return `${formatOhms(p.ohms)} pot`
    case 'capacitor':
      return `${p.uF} µF capacitor`
    case 'neopixel_ring':
      return `${p.count}-pixel NeoPixel ring`
    case 'lcd16x2_i2c':
    case 'oled_ssd1306':
    case 'bme280':
      return `${def.name} @ ${hex(p.addr)}`
    default:
      return def.name
  }
}

/**
 * 4-band colour code for a resistor (100 Ω … 1 MΩ, other values handled best-effort): 220 → red red brown gold.
 * @returns {[string, string, string, 'gold']}
 */
export function resistorBands(ohms) {
  let value = Math.round(Number(ohms))
  if (!Number.isFinite(value) || value <= 0) return ['black', 'black', 'black', 'gold']
  let exponent = 0
  while (value >= 100) {
    value = Math.round(value / 10)
    exponent++
  }
  while (value < 10) {
    value *= 10
    exponent--
  }
  const multiplier = exponent === -1 ? 'gold' : exponent === -2 ? 'silver' : BAND_COLORS[Math.min(exponent, 9)]
  return [BAND_COLORS[Math.floor(value / 10)], BAND_COLORS[value % 10], multiplier, 'gold']
}

/**
 * Concrete model elements for a component: the def's raw model with `'$props.<key>'` replaced by the
 * component's prop value (falling back to the def default) and `'$color'` replaced by the LED parameter of the
 * same field name (`vf`/`rOn`) for the component's colour. Everything else (e.g. `highV: 'vcc'`,
 * `ohms: { fromControl }`) is passed through untouched for the circuit engine to resolve at solve time.
 * @returns {object[]}
 */
export function modelElements(component) {
  const def = getDef(component?.type)
  if (!def) return []
  const props = { ...propDefaults(def), ...(component.props ?? {}) }
  const ledParams = LED_PARAMS[props.color] ?? LED_PARAMS.red
  const resolve = (value, key) => {
    if (typeof value === 'string') {
      if (value.startsWith('$props.')) {
        const raw = props[value.slice(7)]
        const num = Number(raw)
        return Number.isFinite(num) && raw !== '' && raw !== null ? num : raw
      }
      if (value === '$color') return ledParams[key]
      return value
    }
    if (Array.isArray(value)) return value.map((v) => resolve(v, key))
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, k)]))
    return value
  }
  return def.model.map((element) => resolve(element, null))
}

/**
 * Flat list of a definition's user controls (`control` may be null, a single control, or `{ kind:'multi', controls }`).
 */
export function controlsOf(def) {
  const control = def?.control
  if (!control) return []
  return control.kind === 'multi' ? control.controls : [control]
}

/**
 * Default control values for a component type, e.g. `{ lightLevel: 60 }`, `{ pressed: false }`,
 * `{ temperatureC: 24.5, humidity: 55 }` — the initial `dynamicState.controls[id]` entry.
 */
export function defaultControls(type) {
  const out = {}
  for (const c of controlsOf(getDef(type))) {
    out[c.field] = c.kind === 'momentary' || c.kind === 'toggle' ? false : (c.default ?? c.min ?? 0)
  }
  return out
}

/**
 * BOM entry for a concrete component: `resistor_<ohms>` / `led_<color>` depend on props, everything else uses the
 * def's static `bom`.
 * @returns {{ partName: string, catalogId: string }}
 */
export function bomEntry(component) {
  const def = getDef(component?.type)
  if (!def) return { partName: String(component?.type), catalogId: String(component?.type) }
  const props = { ...propDefaults(def), ...(component.props ?? {}) }
  switch (def.type) {
    case 'resistor':
      return { partName: `Resistor ${formatOhms(props.ohms)}`, catalogId: `resistor_${Math.round(Number(props.ohms))}` }
    case 'led':
      return { partName: `${capitalize(props.color)} LED`, catalogId: `led_${props.color}` }
    default:
      return { ...def.bom }
  }
}

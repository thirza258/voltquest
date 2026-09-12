// Pure canvas geometry: viewport math, footprint rotation, snapping and drop payload parsing.
// No DOM access here so everything is unit-testable in Node.
import { PITCH, boardSize, holeAtWorld, holeWorldPosition } from '../engine/components/breadboard.js'
import * as defaultRegistry from '../engine/components/registry.js'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 3
export const ZOOM_STEP = 1.2
/** Default viewport size used before the element has been measured (jsdom / first paint). */
export const FALLBACK_SIZE = { width: 800, height: 600 }
/** Pointer travel (screen px) before a press turns into a drag. */
export const DRAG_THRESHOLD = 4
/** HTML5 drag type used by the parts drawer. */
export const DND_MIME = 'application/x-voltquest-component'

/** @typedef {{ x: number, y: number, zoom: number }} View  screen = world * zoom + (x, y) */

/** Clamp a zoom factor to the supported range. */
export function clampZoom(zoom) {
  if (!Number.isFinite(zoom)) return 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** Screen (svg-local px) → world px. */
export function screenToWorld(view, pt) {
  return { x: (pt.x - view.x) / view.zoom, y: (pt.y - view.y) / view.zoom }
}

/** World px → screen (svg-local px). */
export function worldToScreen(view, pt) {
  return { x: pt.x * view.zoom + view.x, y: pt.y * view.zoom + view.y }
}

/** Return a view with `zoom` applied while keeping the world point under `screenPt` fixed. */
export function zoomAround(view, zoom, screenPt) {
  const next = clampZoom(zoom)
  const world = screenToWorld(view, screenPt)
  return { zoom: next, x: screenPt.x - world.x * next, y: screenPt.y - world.y * next }
}

/** Pan the view by a screen-space delta. */
export function panBy(view, dx, dy) {
  return { ...view, x: view.x + dx, y: view.y + dy }
}

/** View that fits `bounds` (world) inside `size` (screen) with padding, centred. */
export function fitView(bounds, size, padding = 48) {
  const w = Math.max(size?.width || 0, 1)
  const h = Math.max(size?.height || 0, 1)
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return { x: w / 2, y: h / 2, zoom: 1 }
  const zoom = clampZoom(Math.min((w - 2 * padding) / bounds.width, (h - 2 * padding) / bounds.height))
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  return { zoom, x: w / 2 - cx * zoom, y: h / 2 - cy * zoom }
}

/** Axis-aligned union of rectangles `{x,y,width,height}`; null for an empty list. */
export function unionBounds(rects) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.y)) continue
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + (r.width || 0))
    maxY = Math.max(maxY, r.y + (r.height || 0))
  }
  if (minX === Infinity) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** World bounds of everything in the document (breadboards + components). */
export function docBounds(doc, registry = defaultRegistry) {
  const rects = []
  for (const bb of doc?.breadboards ?? []) {
    const size = boardSize(bb.type)
    rects.push({ x: bb.x, y: bb.y, width: size.width, height: size.height })
  }
  for (const comp of doc?.components ?? []) {
    try {
      const b = registry.componentBounds(comp, doc)
      if (b && b.width > 0 && b.height > 0) rects.push(b)
    } catch {
      // a component the registry cannot place yet contributes nothing to the bounds
    }
  }
  return unionBounds(rects) ?? { x: 0, y: 0, width: 32 * PITCH, height: 20 * PITCH }
}

/** Rotate a local vector by an SVG rotation (§4.2: R(90)(x,y) = (−y,x), y down). */
export function rotateVec(x, y, rotation) {
  switch (((rotation % 360) + 360) % 360) {
    case 90: return { x: -y, y: x }
    case 180: return { x: -x, y: -y }
    case 270: return { x: y, y: -x }
    default: return { x, y }
  }
}

/** Next rotation step clockwise. */
export function nextRotation(rotation) {
  return (((rotation ?? 0) + 90) % 360)
}

/**
 * Un-rotated local body box of a footprint per §4.2.
 * Board mount: [−P/2, −P/2] … [(w−0.5)P, (h−0.5)P]; free mount: [0,0] … [wP, hP].
 */
export function localBodyBox(def) {
  const width = (def?.footprint?.width ?? 1) * PITCH
  const height = (def?.footprint?.height ?? 1) * PITCH
  if (def?.mount === 'free') return { x: 0, y: 0, width, height }
  return { x: -PITCH / 2, y: -PITCH / 2, width, height }
}

/** World origin `O` of a component (anchor hole centre or free position), or null when unplaceable. */
export function componentOrigin(comp, doc, holeWorldPosition) {
  if (comp.anchor) return holeWorldPosition(doc, comp.anchor.board, comp.anchor.hole)
  if (comp.position) return { x: comp.position.x, y: comp.position.y }
  return null
}

/** Snap a value to a grid step. */
export function snap(value, step) {
  return Math.round(value / step) * step
}

/** Placement object (§1) for a component, without any other component fields. */
export function placementOf(comp) {
  const rotation = comp.rotation ?? 0
  return comp.anchor
    ? { anchor: { board: comp.anchor.board, hole: comp.anchor.hole }, rotation }
    : { position: { x: comp.position.x, y: comp.position.y }, rotation }
}

/** True when two placements put a component at the same place. */
export function samePlacement(a, b) {
  if (!a || !b) return false
  if ((a.rotation ?? 0) !== (b.rotation ?? 0)) return false
  if (a.anchor || b.anchor) return a.anchor?.board === b.anchor?.board && a.anchor?.hole === b.anchor?.hole
  return a.position?.x === b.position?.x && a.position?.y === b.position?.y
}

/**
 * Build a candidate component for `def` whose origin is at (or snapped near) `world`.
 * Board mounts snap pin 0 to the nearest hole; free mounts snap to a half-pitch grid.
 * Returns `{ candidate, reason }` — candidate null when there is no hole under the point.
 */
export function candidateAt(base, def, world, doc, rotation = base.rotation ?? 0) {
  if (def?.mount === 'free') {
    const position = { x: snap(world.x, PITCH / 2), y: snap(world.y, PITCH / 2) }
    const { anchor: _anchor, ...rest } = base
    return { candidate: { ...rest, position, rotation }, reason: null }
  }
  const hit = holeAtWorld(doc, world.x, world.y, PITCH * 0.75)
  if (!hit) return { candidate: null, reason: 'off_board' }
  const { position: _position, ...rest } = base
  return { candidate: { ...rest, anchor: { board: hit.board, hole: hit.hole.name }, rotation }, reason: null }
}

/**
 * Validate a placement candidate ONLY via `registry.resolvePins` (§4.2). The component being moved
 * is removed from the document first so it is never compared against itself.
 */
export function validateCandidate(candidate, doc, registry = defaultRegistry) {
  if (!candidate) return { valid: false, invalidPins: [] }
  const others = { ...doc, components: (doc.components ?? []).filter((c) => c.id !== candidate.id) }
  try {
    const res = registry.resolvePins(candidate, others)
    return { valid: !!res?.valid, invalidPins: res?.invalidPins ?? [] }
  } catch {
    return { valid: false, invalidPins: [] }
  }
}

/** Offsets (in pitches) searched around a drop point, nearest first. */
const SEARCH_OFFSETS = (() => {
  const out = []
  for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) out.push({ dx, dy })
  return out.sort((a, b) => a.dx * a.dx + a.dy * a.dy - (b.dx * b.dx + b.dy * b.dy))
})()

/**
 * Find the nearest placement whose origin `O` sits at — or within a few pitches of — `origin`.
 * Free mounts land exactly on the snapped origin; board mounts search outwards for a valid anchor.
 * Returns `{ candidate, valid, reason }`.
 */
export function nearestValidOrigin(base, def, origin, doc, registry = defaultRegistry) {
  if (def?.mount === 'free') {
    const { candidate } = candidateAt(base, def, origin, doc)
    const { valid } = validateCandidate(candidate, doc, registry)
    return { candidate, valid, reason: valid ? null : 'invalid_placement' }
  }
  const candidates = new Map()
  for (const off of SEARCH_OFFSETS) {
    const pt = { x: origin.x + off.dx * PITCH, y: origin.y + off.dy * PITCH }
    const { candidate } = candidateAt(base, def, pt, doc)
    if (!candidate) continue
    const key = `${candidate.anchor.board}:${candidate.anchor.hole}`
    if (candidates.has(key)) continue
    const pos = holeWorldPosition(doc, candidate.anchor.board, candidate.anchor.hole)
    candidates.set(key, { candidate, distance: Math.hypot(pos.x - origin.x, pos.y - origin.y) })
  }
  // Offset order is not distance order after snapping, especially near the trench and board edges.
  // Rank distinct anchors by their actual distance so a farther valid hole never wins first.
  const ranked = [...candidates.values()].sort((a, b) => a.distance - b.distance)
  for (const { candidate } of ranked) {
    if (validateCandidate(candidate, doc, registry).valid) return { candidate, valid: true, reason: null }
  }
  const first = ranked[0]?.candidate ?? null
  return { candidate: first, valid: false, reason: first ? 'invalid_placement' : 'off_board' }
}

/**
 * Find the nearest anchor around `world` for which the candidate resolves validly.
 * Free-mounted parts are centred under the pointer (drops from the parts drawer).
 * Returns `{ candidate, valid, reason }`.
 */
export function nearestValidCandidate(base, def, world, doc, registry = defaultRegistry) {
  if (def?.mount === 'free') {
    const box = localBodyBox(def)
    return nearestValidOrigin(base, def, { x: world.x - box.width / 2, y: world.y - box.height / 2 }, doc, registry)
  }
  return nearestValidOrigin(base, def, world, doc, registry)
}

/** Parse a parts-drawer drop payload: plain type string or JSON `{ type, props }`. */
export function parseDropPayload(text) {
  if (!text) return null
  const trimmed = String(text).trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed)
      if (obj && typeof obj.type === 'string') return { type: obj.type, props: obj.props ?? undefined }
    } catch {
      return null
    }
    return null
  }
  return { type: trimmed, props: undefined }
}

/** Human label for a breadboard strip id: 'row12:upper' → 'Row 12 (a–e)', 'TP' → 'Top + rail'. */
export function describeStrip(strip) {
  const bare = strip?.includes(':') && !strip.startsWith('row') ? strip.slice(strip.indexOf(':') + 1) : strip
  const m = /^row(\d+):(upper|lower)$/.exec(bare ?? '')
  if (m) return `Row ${m[1]} (${m[2] === 'upper' ? 'a–e' : 'f–j'})`
  switch (bare) {
    case 'TP': return 'Top + rail'
    case 'TN': return 'Top − rail'
    case 'BN': return 'Bottom − rail'
    case 'BP': return 'Bottom + rail'
    default: return bare ?? ''
  }
}

/** Format volts for tooltips: 4.98 V; '—' when unknown. */
export function formatVolts(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${(Math.abs(v) < 0.005 ? 0 : v).toFixed(2)} V`
}

/** Format amps for tooltips in mA (or µA below 0.1 mA). */
export function formatAmps(a) {
  if (a === null || a === undefined || !Number.isFinite(a)) return '—'
  const ma = a * 1000
  if (Math.abs(ma) < 0.1) return `${(ma * 1000).toFixed(0)} µA`
  return `${ma.toFixed(ma >= 100 ? 0 : 1)} mA`
}

/** Format watts for tooltips (mW below 1 W). */
export function formatWatts(w) {
  if (w === null || w === undefined || !Number.isFinite(w)) return '—'
  const abs = Math.abs(w)
  if (abs < 1) return `${(w * 1000).toFixed(abs * 1000 >= 100 ? 0 : 1)} mW`
  return `${w.toFixed(2)} W`
}

/** Normalise the `highlights` prop (object | array | null) into an array of tier-2 targets. */
export function normalizeHighlights(highlights) {
  if (!highlights) return []
  const list = Array.isArray(highlights) ? highlights : [highlights]
  return list.filter((h) => h && typeof h === 'object')
}

/** Net id + label + voltage for a terminal, from a SimState (null fields when unknown). */
export function netInfoForTerminal(simState, terminal) {
  const compiled = simState?.compiled
  const netId = compiled?.terminalToNet?.[terminal] ?? null
  const net = netId ? compiled?.nets?.find((n) => n.id === netId) ?? null : null
  const label = net?.label ?? (netId ? netId : null)
  const hasEval = !!simState?.evaluation
  const voltage = hasEval && netId ? simState.evaluation.nodeVoltages?.[netId] ?? null : null
  return { netId, label, voltage, hasEval, powered: simState?.powered !== false }
}

/** Tooltip line for a net: '5 V · 4.98 V' / 'GND · 0.00 V' / 'not connected'. */
export function netLine(info) {
  if (!info.hasEval) return null
  if (!info.netId) return { label: 'Net', value: 'not connected' }
  const v = info.powered ? formatVolts(info.voltage) : '—'
  return { label: info.label ?? 'Net', value: v }
}

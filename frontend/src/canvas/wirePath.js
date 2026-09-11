// Wire rendering math: gently sagging cubic Béziers plus the colour palette (DESIGN.md).

/** Wire colour name → hex (standard palette). */
export const WIRE_HEX = {
  red: '#EF4444',
  black: '#1F2937',
  yellow: '#F59E0B',
  green: '#10B981',
  blue: '#3B82F6',
  orange: '#F97316',
  white: '#E5E7EB',
  purple: '#8B5CF6',
}

/** Neon cosmetic palette overrides (unlockable `wirePalette: 'neon'`). */
export const NEON_HEX = {
  red: '#FF3D71',
  blue: '#00E5FF',
  yellow: '#FFEA00',
  green: '#00FF9C',
  purple: '#7C4DFF',
}

export const WIRE_STROKE = 4
export const WIRE_OUTLINE = 1
/** Invisible hit stroke so thin wires stay easy to grab. */
export const WIRE_HIT_STROKE = 12

/** Resolve a wire colour name to its hex for the active palette. */
export function wireHex(color, palette = 'standard') {
  if (palette === 'neon' && NEON_HEX[color]) return NEON_HEX[color]
  return WIRE_HEX[color] ?? WIRE_HEX.red
}

/** Darken a `#rrggbb` colour by mixing towards black (0..1). */
export function darken(hex, amount = 0.35) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return '#111827'
  const n = parseInt(m[1], 16)
  const ch = (shift) => Math.round(((n >> shift) & 0xff) * (1 - amount))
  const toHex = (v) => v.toString(16).padStart(2, '0')
  return `#${toHex(ch(16))}${toHex(ch(8))}${toHex(ch(0))}`
}

/** Outline colour: a darker shade of the wire, or gray for white wires. */
export function wireOutlineHex(color, palette = 'standard') {
  if (color === 'white') return '#9CA3AF'
  return darken(wireHex(color, palette), 0.35)
}

function length(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Sag amplitude for a wire of a given length (px): gentle, capped. */
export function sagFor(len) {
  if (len <= 0) return 0
  return Math.min(30, Math.max(3, len * 0.14))
}

/**
 * Control points for the wire Bézier. The bulge is perpendicular to the chord and points
 * "downwards" (positive y — like a slack jumper), or to the right for vertical wires.
 */
export function wireControls(a, b) {
  const len = length(a, b)
  if (len === 0) return { c1: { ...a }, c2: { ...b } }
  const dx = (b.x - a.x) / len
  const dy = (b.y - a.y) / len
  let nx = -dy
  let ny = dx
  if (ny < 0 || (ny === 0 && nx < 0)) {
    nx = -nx
    ny = -ny
  }
  const sag = sagFor(len)
  return {
    c1: { x: a.x + (b.x - a.x) / 3 + nx * sag, y: a.y + (b.y - a.y) / 3 + ny * sag },
    c2: { x: a.x + (2 * (b.x - a.x)) / 3 + nx * sag, y: a.y + (2 * (b.y - a.y)) / 3 + ny * sag },
  }
}

const fmt = (v) => (Math.round(v * 100) / 100).toString()

/** SVG path `d` for a wire between two world points. */
export function wirePathD(a, b) {
  const { c1, c2 } = wireControls(a, b)
  return `M ${fmt(a.x)} ${fmt(a.y)} C ${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(b.x)} ${fmt(b.y)}`
}

/** Point on the wire curve at parameter t (default: midpoint). */
export function wirePoint(a, b, t = 0.5) {
  const { c1, c2 } = wireControls(a, b)
  const u = 1 - t
  const w0 = u * u * u
  const w1 = 3 * u * u * t
  const w2 = 3 * u * t * t
  const w3 = t * t * t
  return {
    x: w0 * a.x + w1 * c1.x + w2 * c2.x + w3 * b.x,
    y: w0 * a.y + w1 * c1.y + w2 * c2.y + w3 * b.y,
  }
}

/** Wire colour name for text ("green wire"). */
export function describeWireColor(color) {
  return `${color ?? 'red'} wire`
}

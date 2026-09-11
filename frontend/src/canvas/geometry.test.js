import { describe, expect, it } from 'vitest'
import { PITCH, holeWorldPosition } from '../engine/components/breadboard.js'
import * as registry from '../engine/components/registry.js'
import { makeDoc, place } from '../engine/components/seeds.js'
import {
  DND_MIME,
  MAX_ZOOM,
  MIN_ZOOM,
  candidateAt,
  clampZoom,
  describeStrip,
  docBounds,
  fitView,
  formatAmps,
  formatVolts,
  formatWatts,
  localBodyBox,
  nearestValidCandidate,
  nearestValidOrigin,
  nextRotation,
  parseDropPayload,
  placementOf,
  rotateVec,
  samePlacement,
  screenToWorld,
  snap,
  unionBounds,
  validateCandidate,
  worldToScreen,
  zoomAround,
} from './geometry.js'
import { wireControls, wireHex, wireOutlineHex, wirePathD, wirePoint, sagFor } from './wirePath.js'

const SIZE = { width: 800, height: 600 }

describe('viewport maths', () => {
  it('clamps zoom to the supported range', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
    expect(clampZoom(Number.NaN)).toBe(1)
    expect(clampZoom(1.5)).toBe(1.5)
  })

  it('round-trips screen and world coordinates', () => {
    const view = { x: 120, y: -40, zoom: 1.75 }
    const world = { x: 333, y: -12.5 }
    const back = screenToWorld(view, worldToScreen(view, world))
    expect(back.x).toBeCloseTo(world.x, 6)
    expect(back.y).toBeCloseTo(world.y, 6)
  })

  it('keeps the point under the cursor fixed while zooming', () => {
    const view = { x: 10, y: 20, zoom: 1 }
    const cursor = { x: 400, y: 300 }
    const before = screenToWorld(view, cursor)
    const after = screenToWorld(zoomAround(view, 2.5, cursor), cursor)
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
  })

  it('never zooms past the clamp when anchoring', () => {
    expect(zoomAround({ x: 0, y: 0, zoom: 1 }, 50, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM)
  })

  it('fits bounds centred inside the viewport', () => {
    const bounds = { x: 0, y: 0, width: 400, height: 200 }
    const view = fitView(bounds, SIZE, 50)
    const centre = worldToScreen(view, { x: 200, y: 100 })
    expect(centre.x).toBeCloseTo(400, 6)
    expect(centre.y).toBeCloseTo(300, 6)
    expect(view.zoom).toBeLessThanOrEqual((SIZE.height - 100) / 200)
  })

  it('unions rectangles and ignores broken ones', () => {
    expect(unionBounds([])).toBeNull()
    expect(unionBounds([{ x: 0, y: 0, width: 10, height: 10 }, null, { x: 20, y: -5, width: 5, height: 5 }])).toEqual({
      x: 0,
      y: -5,
      width: 25,
      height: 15,
    })
  })

  it('bounds a half-board document around the breadboard', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const b = docBounds(doc)
    expect(b.width).toBeCloseTo(32 * PITCH, 6)
    expect(b.height).toBeCloseTo(20 * PITCH, 6)
  })
})

describe('footprint geometry (§4.2)', () => {
  it('rotates like the SVG rotate() transform', () => {
    const near = (v, x, y) => {
      expect(v.x).toBeCloseTo(x, 9)
      expect(v.y).toBeCloseTo(y, 9)
    }
    near(rotateVec(1, 0, 0), 1, 0)
    near(rotateVec(1, 0, 90), 0, 1)
    near(rotateVec(1, 0, 180), -1, 0)
    near(rotateVec(1, 0, 270), 0, -1)
    near(rotateVec(2, 3, 90), -3, 2)
  })

  it('steps rotation clockwise and wraps', () => {
    expect(nextRotation(0)).toBe(90)
    expect(nextRotation(270)).toBe(0)
    expect(nextRotation(undefined)).toBe(90)
  })

  it('uses the mount-specific local body box', () => {
    expect(localBodyBox(registry.getDef('resistor'))).toEqual({ x: -PITCH / 2, y: -PITCH / 2, width: 5 * PITCH, height: PITCH })
    expect(localBodyBox(registry.getDef('uno'))).toEqual({ x: 0, y: 0, width: 27 * PITCH, height: 21 * PITCH })
  })
})

describe('snapping and placement validation', () => {
  const doc = makeDoc({ boardMode: 'half' })
  const resistorDef = registry.getDef('resistor')
  const base = { id: 'c_test1', type: 'resistor', props: { ohms: 220 }, rotation: 0 }

  it('snaps a board-mounted part to the hole under the pointer', () => {
    const hole = holeWorldPosition(doc, 'bb1', 'e10')
    const { candidate } = candidateAt(base, resistorDef, { x: hole.x + 3, y: hole.y - 4 }, doc)
    expect(candidate.anchor).toEqual({ board: 'bb1', hole: 'e10' })
    expect(candidate.position).toBeUndefined()
  })

  it('reports off_board when no hole is close enough', () => {
    const { candidate, reason } = candidateAt(base, resistorDef, { x: -500, y: -500 }, doc)
    expect(candidate).toBeNull()
    expect(reason).toBe('off_board')
  })

  it('snaps a free-mounted part to a half-pitch grid', () => {
    const unoDef = registry.getDef('uno')
    const { candidate } = candidateAt({ id: 'c_uno', type: 'uno', props: {}, rotation: 0 }, unoDef, { x: 37, y: -19 }, doc)
    expect(candidate.position).toEqual({ x: snap(37, PITCH / 2), y: snap(-19, PITCH / 2) })
    expect(candidate.anchor).toBeUndefined()
  })

  it('validates only through registry.resolvePins', () => {
    const good = { ...base, anchor: { board: 'bb1', hole: 'e5' } }
    expect(validateCandidate(good, doc).valid).toBe(true)
    expect(registry.resolvePins(good, doc).valid).toBe(true)

    const hangingOff = { ...base, anchor: { board: 'bb1', hole: 'e28' } }
    expect(validateCandidate(hangingOff, doc).valid).toBe(false)
    expect(validateCandidate(hangingOff, doc).invalidPins.length).toBeGreaterThan(0)
  })

  it('never compares a moving component against its own old position', () => {
    const placed = makeDoc({ boardMode: 'half' })
    place(placed, 'resistor', 'bb1', 'e5', { ohms: 220 }, 0)
    const comp = placed.components[0]
    const moved = { ...comp, anchor: { board: 'bb1', hole: 'e6' } }
    expect(validateCandidate(moved, placed).valid).toBe(true)
  })

  it('searches outwards for the nearest valid anchor', () => {
    const hole = holeWorldPosition(doc, 'bb1', 'e28')
    const { candidate, valid } = nearestValidCandidate(base, resistorDef, hole, doc)
    expect(valid).toBe(true)
    expect(candidate.anchor.board).toBe('bb1')
    expect(registry.resolvePins(candidate, doc).valid).toBe(true)
  })

  it('centres free mounts under the drop point but keeps the origin for moves', () => {
    const unoDef = registry.getDef('uno')
    const unoBase = { id: 'c_uno', type: 'uno', props: {}, rotation: 0 }
    const box = localBodyBox(unoDef)
    const dropped = nearestValidCandidate(unoBase, unoDef, { x: 0, y: 0 }, doc)
    expect(dropped.candidate.position).toEqual({ x: snap(-box.width / 2, PITCH / 2), y: snap(-box.height / 2, PITCH / 2) })
    const moved = nearestValidOrigin(unoBase, unoDef, { x: 0, y: 0 }, doc)
    expect(moved.candidate.position).toEqual({ x: 0, y: 0 })
  })

  it('describes placements and compares them', () => {
    const ledDoc = makeDoc({ boardMode: 'half' })
    place(ledDoc, 'led', 'bb1', 'e5', {}, 90)
    const comp = ledDoc.components[0]
    expect(placementOf(comp)).toEqual({ anchor: { board: 'bb1', hole: 'e5' }, rotation: 90 })
    expect(samePlacement(placementOf(comp), { anchor: { board: 'bb1', hole: 'e5' }, rotation: 90 })).toBe(true)
    expect(samePlacement(placementOf(comp), { anchor: { board: 'bb1', hole: 'e5' }, rotation: 0 })).toBe(false)
    expect(samePlacement(null, undefined)).toBe(false)
  })
})

describe('drop payloads', () => {
  it('accepts a bare registry type', () => {
    expect(parseDropPayload('led')).toEqual({ type: 'led', props: undefined })
  })

  it('accepts a JSON payload with props', () => {
    expect(parseDropPayload('{"type":"resistor","props":{"ohms":330}}')).toEqual({ type: 'resistor', props: { ohms: 330 } })
  })

  it('rejects empty and malformed payloads', () => {
    expect(parseDropPayload('')).toBeNull()
    expect(parseDropPayload(null)).toBeNull()
    expect(parseDropPayload('{ nope')).toBeNull()
    expect(parseDropPayload('{"props":{}}')).toBeNull()
  })

  it('exposes the drawer mime type', () => {
    expect(DND_MIME).toBe('application/x-voltquest-component')
  })
})

describe('tooltip formatting', () => {
  it('names strips the way a beginner reads the board', () => {
    expect(describeStrip('row12:upper')).toBe('Row 12 (a–e)')
    expect(describeStrip('row3:lower')).toBe('Row 3 (f–j)')
    expect(describeStrip('bb2:TP')).toBe('Top + rail')
    expect(describeStrip('TN')).toBe('Top − rail')
    expect(describeStrip('BN')).toBe('Bottom − rail')
    expect(describeStrip('BP')).toBe('Bottom + rail')
  })

  it('formats volts, amps and watts', () => {
    expect(formatVolts(4.9812)).toBe('4.98 V')
    expect(formatVolts(null)).toBe('—')
    expect(formatAmps(0.0125)).toBe('12.5 mA')
    expect(formatAmps(0.00002)).toBe('20 µA')
    expect(formatWatts(0.0225)).toBe('22.5 mW')
    expect(formatWatts(1.5)).toBe('1.50 W')
    expect(formatWatts(undefined)).toBe('—')
  })
})

describe('wire path generation', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 120, y: 0 }

  it('emits a cubic Bézier through both endpoints', () => {
    const d = wirePathD(a, b)
    expect(d.startsWith('M 0 0 C ')).toBe(true)
    expect(d.endsWith('120 0')).toBe(true)
    expect(wirePoint(a, b, 0)).toEqual(a)
    const end = wirePoint(a, b, 1)
    expect(end.x).toBeCloseTo(b.x, 6)
    expect(end.y).toBeCloseTo(b.y, 6)
  })

  it('sags downwards between the endpoints', () => {
    const mid = wirePoint(a, b, 0.5)
    expect(mid.x).toBeCloseTo(60, 6)
    expect(mid.y).toBeGreaterThan(0)
    expect(mid.y).toBeLessThanOrEqual(sagFor(120))
  })

  it('caps the sag on very long wires and keeps a minimum on short ones', () => {
    expect(sagFor(10000)).toBe(30)
    expect(sagFor(1)).toBe(3)
    expect(sagFor(0)).toBe(0)
  })

  it('degenerates safely when both ends coincide', () => {
    const { c1, c2 } = wireControls(a, a)
    expect(c1).toEqual(a)
    expect(c2).toEqual(a)
    expect(wirePathD(a, a)).toBe('M 0 0 C 0 0, 0 0, 0 0')
  })

  it('resolves colours per palette with a darker outline', () => {
    expect(wireHex('green')).toBe('#10B981')
    expect(wireHex('green', 'neon')).toBe('#00FF9C')
    expect(wireHex('nonsense')).toBe('#EF4444')
    expect(wireOutlineHex('white')).toBe('#9CA3AF')
    expect(wireOutlineHex('red')).not.toBe(wireHex('red'))
  })
})

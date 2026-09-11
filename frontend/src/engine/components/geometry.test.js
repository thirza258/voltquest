/**
 * Geometry + registry invariants (CONTRACTS §3, §4.2, §4.3).
 *
 * These are the assumptions every quest solution circuit is authored against, so a regression here
 * silently breaks content rather than failing loudly. Kept in one file so it runs early and fast.
 */
import { describe, it, expect } from 'vitest'
import {
  PITCH,
  BREADBOARD_TYPES,
  COLUMN_Y,
  boardHoles,
  boardSize,
  holeByName,
  holeAt,
  holeAtWorld,
  holesInStrip,
  layoutBreadboards,
  stripOf,
  terminalPosition,
} from './breadboard.js'
import { REGISTRY, createComponent, resolvePins, componentBounds, defaultMcuPlacement, resistorBands, modelElements } from './registry.js'
import { getBoard, BOARD_IDS } from '../boards/index.js'

const ROTATIONS = [0, 90, 180, 270]

/** A doc with two half breadboards so board-mounted parts always have somewhere to land. */
function dualDoc() {
  return { version: 1, boardMode: 'dual', breadboards: layoutBreadboards('dual'), mcu: null, components: [], wires: [], meta: {} }
}

describe('breadboard geometry', () => {
  it('has the tie-point counts of real boards', () => {
    for (const [type, spec] of Object.entries(BREADBOARD_TYPES)) {
      const holes = boardHoles(type)
      expect(holes, type).toHaveLength(spec.tiePoints)
      expect(holes.filter((h) => h.kind === 'main'), `${type} main`).toHaveLength(spec.rows * 10)
      // Four rails, each with 5 holes per complete group of 6 rows.
      expect(holes.filter((h) => h.kind === 'rail'), `${type} rail`).toHaveLength(4 * 5 * Math.floor(spec.rows / 6))
    }
  })

  it('places columns a→j 11 pitches apart with a 3-pitch centre channel', () => {
    const a = holeByName('half', 'a12')
    const j = holeByName('half', 'j12')
    expect((j.y - a.y) / PITCH).toBe(11)
    expect(COLUMN_Y.f - COLUMN_Y.e).toBe(3)
    expect(a.x).toBe(j.x)
  })

  it('gives every hole a unique name and a strip that contains it', () => {
    for (const type of Object.keys(BREADBOARD_TYPES)) {
      const holes = boardHoles(type)
      expect(new Set(holes.map((h) => h.name)).size, type).toBe(holes.length)
      for (const hole of holes.slice(0, 40)) {
        expect(stripOf(type, hole.name)).toBe(hole.strip)
        expect(holesInStrip(type, hole.strip).map((h) => h.name)).toContain(hole.name)
      }
    }
  })

  it('shares one strip across a–e and a separate strip across f–j', () => {
    expect(holesInStrip('half', 'row7:upper').map((h) => h.name)).toEqual(['a7', 'b7', 'c7', 'd7', 'e7'])
    expect(holesInStrip('half', 'row7:lower').map((h) => h.name)).toEqual(['f7', 'g7', 'h7', 'i7', 'j7'])
    expect(stripOf('half', 'e7')).not.toBe(stripOf('half', 'f7'))
  })

  it('runs each rail continuously along the whole board', () => {
    const tp = holesInStrip('half', 'TP')
    expect(tp).toHaveLength(25)
    expect(tp[0].name).toBe('TP1')
    expect(tp.at(-1).name).toBe('TP25')
    expect(new Set(tp.map((h) => h.y)).size).toBe(1)
  })

  it('round-trips hole hit-testing', () => {
    const hole = holeByName('half', 'c9')
    expect(holeAt('half', hole.x, hole.y).name).toBe('c9')
    expect(holeAt('half', hole.x + PITCH * 0.2, hole.y - PITCH * 0.2).name).toBe('c9')
    expect(holeAt('half', hole.x + PITCH * 0.5, hole.y)).not.toMatchObject({ name: 'c9' })
  })

  it('offsets the second dual-mode board so bb1 row j meets bb2 row a', () => {
    const boards = layoutBreadboards('dual')
    expect(boards.map((b) => b.id)).toEqual(['bb1', 'bb2'])
    const doc = dualDoc()
    const j = terminalPosition(doc, 'bb1:j5')
    const a = terminalPosition(doc, 'bb2:a5')
    expect((a.y - j.y) / PITCH).toBe(10)
    expect(a.x).toBe(j.x)
  })

  it('lays out single-board modes with one board of the right size', () => {
    expect(layoutBreadboards('half')).toEqual([{ id: 'bb1', type: 'half', x: 0, y: 0 }])
    expect(layoutBreadboards('full')).toEqual([{ id: 'bb1', type: 'full', x: 0, y: 0 }])
    expect(boardSize('half')).toEqual({ width: 32 * PITCH, height: 20 * PITCH })
    expect(boardSize('full')).toEqual({ width: 65 * PITCH, height: 20 * PITCH })
  })

  it('locates world positions for holes and component pins', () => {
    const doc = dualDoc()
    const led = createComponent('led', { anchor: { board: 'bb2', hole: 'c4' } }, {}, { id: 'c_led' })
    doc.components.push(led)
    expect(terminalPosition(doc, 'bb2:c4')).toEqual(terminalPosition(doc, 'c_led:anode'))
    expect(terminalPosition(doc, 'bb1:nope')).toBeNull()
    expect(terminalPosition(doc, 'c_missing:anode')).toBeNull()
  })
})

describe('component footprints', () => {
  const boardDefs = Object.values(REGISTRY).filter((d) => d.mount === 'board')

  it('covers every type required by the contract', () => {
    const required = [
      'uno', 'nano', 'esp32', 'esp32s3', 'resistor', 'led', 'rgb_led', 'capacitor', 'diode', 'transistor_npn',
      'pushbutton', 'potentiometer', 'ldr', 'buzzer', 'servo', 'lcd16x2_i2c', 'oled_ssd1306', 'seven_segment',
      'neopixel_ring', 'ultrasonic_hcsr04', 'pir', 'dht22', 'bme280', 'touch_pad', 'level_shifter', 'relay_5v', 'dc_motor',
    ]
    for (const type of required) expect(REGISTRY[type], type).toBeTruthy()
  })

  it('anchors pin[0] at the origin and names pins uniquely', () => {
    for (const def of boardDefs) {
      const [first, ...rest] = def.footprint.pins
      expect({ type: def.type, dx: first.dx, dy: first.dy }).toEqual({ type: def.type, dx: 0, dy: 0 })
      const ids = [first, ...rest].map((p) => p.id)
      expect(new Set(ids).size, def.type).toBe(ids.length)
    }
  })

  it('references only real footprint pins from models and peripheral roles', () => {
    for (const def of Object.values(REGISTRY)) {
      const ids = new Set(def.footprint.pins.map((p) => p.id))
      for (const element of def.model ?? []) {
        for (const pinId of Object.values(element.pins ?? {})) expect(ids, `${def.type}.${element.kind}`).toContain(pinId)
        for (const [a, b] of element.bonds ?? []) {
          expect(ids, `${def.type} bond`).toContain(a)
          expect(ids, `${def.type} bond`).toContain(b)
        }
      }
      for (const pinId of Object.keys(def.peripheral?.roles ?? {})) expect(ids, `${def.type} role`).toContain(pinId)
    }
  })

  /**
   * CONTRACTS §4.3 invariant: no two pins of different internal groups may land on the same strip.
   * A violation shorts the part through the breadboard — a pushbutton wired that way can never open.
   */
  it('never shorts two internal groups through one strip, at any anchor or rotation', () => {
    const doc = dualDoc()
    for (const def of boardDefs) {
      // Group pins by the model element that owns them; bonded pins are intentionally one group.
      const groupOf = new Map()
      ;(def.model ?? []).forEach((element, index) => {
        const bonded = new Map()
        for (const [a, b] of element.bonds ?? []) bonded.set(b, a)
        for (const [role, pinId] of Object.entries(element.pins ?? {})) groupOf.set(pinId, `${index}:${role}`)
        for (const [b, a] of bonded) if (groupOf.has(a)) groupOf.set(b, groupOf.get(a))
      })
      if (new Set(groupOf.values()).size < 2) continue // single-group parts cannot self-short

      for (const rotation of ROTATIONS) {
        for (const hole of ['a1', 'b3', 'c5', 'd7', 'e9', 'f11', 'g13', 'h15', 'i17', 'j19']) {
          const candidate = createComponent(def.type, { anchor: { board: 'bb1', hole }, rotation }, {}, { id: 'c_probe' })
          const probeDoc = { ...doc, components: [candidate] }
          const resolved = resolvePins(candidate, probeDoc)
          if (!resolved.valid) continue // this anchor/rotation is simply not a legal placement
          const stripByGroup = new Map()
          for (const [pinId, group] of groupOf) {
            const terminal = resolved.pins[pinId]?.terminal
            if (!terminal) continue
            const [boardId, holeName] = terminal.split(':')
            const strip = `${boardId}:${stripOf(probeDoc.breadboards.find((b) => b.id === boardId).type, holeName)}`
            const owner = stripByGroup.get(strip)
            expect(owner === undefined || owner === group, `${def.type} @${hole} rot${rotation}: groups ${owner} and ${group} share strip ${strip}`).toBe(true)
            stripByGroup.set(strip, group)
          }
        }
      }
    }
  })

  it('rotates pins about the anchor with the screen-convention matrix', () => {
    const doc = dualDoc()
    const at = (rotation) => {
      const comp = createComponent('resistor', { anchor: { board: 'bb1', hole: 'c10' }, rotation }, {}, { id: 'c_r' })
      const pins = resolvePins(comp, { ...doc, components: [comp] }).pins
      return { p1: pins.p1, p2: pins.p2 }
    }
    const zero = at(0)
    expect(zero.p1.terminal).toBe('bb1:c10')
    expect(zero.p2.terminal).toBe('bb1:c14') // dx 4 runs along rows
    const half = at(180)
    expect(half.p2.terminal).toBe('bb1:c6')
    // 90° maps (dx,dy) -> (-dy,dx): a 5-wide part becomes 5 tall, spanning columns.
    const quarter = at(90)
    expect(quarter.p1.x).toBe(quarter.p2.x)
    expect(quarter.p2.y - quarter.p1.y).toBe(4 * PITCH)
  })

  it('reports invalid placements instead of guessing', () => {
    const doc = { version: 1, boardMode: 'half', breadboards: layoutBreadboards('half'), mcu: null, components: [], wires: [], meta: {} }
    // A 5-wide resistor anchored at row 29 runs off the end of a 30-row board.
    const comp = createComponent('resistor', { anchor: { board: 'bb1', hole: 'c29' } }, {}, { id: 'c_r' })
    const resolved = resolvePins(comp, { ...doc, components: [comp] })
    expect(resolved.valid).toBe(false)
    expect(resolved.invalidPins.length).toBeGreaterThan(0)
  })

  it('fits an ESP32 across the channel on one board and across two in dual mode', () => {
    const esp = getBoard('esp32')
    expect(esp.pins).toHaveLength(30)
    const single = { version: 1, boardMode: 'half', breadboards: layoutBreadboards('half'), mcu: null, components: [], wires: [], meta: {} }
    const onA = createComponent('esp32', defaultMcuPlacement('esp32', 'half'), {}, { id: 'c_esp' })
    const resolvedA = resolvePins(onA, { ...single, components: [onA] })
    expect(resolvedA.valid).toBe(true)
    // Row 1 sits in column a, row 2 ten pitches lower in column i, leaving column j free.
    expect(resolvedA.pins['3V3'].terminal).toBe('bb1:a1')
    expect(resolvedA.pins.VIN.terminal).toBe('bb1:i1')

    const doc = dualDoc()
    const spanning = createComponent('esp32', defaultMcuPlacement('esp32', 'dual'), {}, { id: 'c_esp2' })
    const resolvedB = resolvePins(spanning, { ...doc, components: [spanning] })
    expect(resolvedB.valid).toBe(true)
    expect(resolvedB.pins['3V3'].terminal).toBe('bb1:j1')
    expect(resolvedB.pins.VIN.terminal).toBe('bb2:a1')
  })

  it('mirrors MCU footprint pin ids onto board pin names, in order', () => {
    for (const id of BOARD_IDS) {
      const board = getBoard(id)
      const def = REGISTRY[board.componentType]
      expect(def, id).toBeTruthy()
      expect(def.footprint.pins.map((p) => p.id), id).toEqual(board.pins.map((p) => p.name))
    }
  })

  it('keeps bounds around every pin', () => {
    const doc = dualDoc()
    for (const def of boardDefs) {
      const comp = createComponent(def.type, { anchor: { board: 'bb1', hole: 'a1' } }, {}, { id: 'c_b' })
      const probeDoc = { ...doc, components: [comp] }
      const resolved = resolvePins(comp, probeDoc)
      if (!resolved.valid) continue
      const bounds = componentBounds(comp, probeDoc)
      for (const pin of Object.values(resolved.pins)) {
        expect(pin.x, def.type).toBeGreaterThanOrEqual(bounds.x - 0.01)
        expect(pin.x, def.type).toBeLessThanOrEqual(bounds.x + bounds.width + 0.01)
        expect(pin.y, def.type).toBeGreaterThanOrEqual(bounds.y - 0.01)
        expect(pin.y, def.type).toBeLessThanOrEqual(bounds.y + bounds.height + 0.01)
      }
    }
  })

  it('locates free-mounted MCU pins in world space', () => {
    const doc = { version: 1, boardMode: 'half', breadboards: layoutBreadboards('half'), mcu: 'uno', components: [], wires: [], meta: {} }
    const uno = createComponent('uno', defaultMcuPlacement('uno', 'half'), {}, { id: 'c_uno' })
    const resolved = resolvePins(uno, { ...doc, components: [uno] })
    expect(resolved.valid).toBe(true)
    for (const name of ['D13', '5V', 'GND', 'A0']) expect(resolved.pins[name], name).toBeTruthy()
    expect(resolved.pins.D13.hole).toBeNull() // free mount: pins are their own terminals
    expect(resolved.pins.D13.terminal).toBe('c_uno:D13')
  })

  it('resolves resistor colour bands and model values from props', () => {
    expect(resistorBands(220)).toEqual(['red', 'red', 'brown', 'gold'])
    expect(resistorBands(1000)).toEqual(['brown', 'black', 'red', 'gold'])
    expect(resistorBands(10000)).toEqual(['brown', 'black', 'orange', 'gold'])
    const r = createComponent('resistor', { anchor: { board: 'bb1', hole: 'a1' } }, { ohms: 2200 })
    expect(modelElements(r)[0]).toMatchObject({ kind: 'resistor', ohms: 2200 })
    const blue = createComponent('led', { anchor: { board: 'bb1', hole: 'a1' } }, { color: 'blue' })
    expect(modelElements(blue)[0]).toMatchObject({ kind: 'diode', vf: 2.7, rOn: 20 })
  })

  it('finds holes from world coordinates across both dual-mode boards', () => {
    const doc = dualDoc()
    const target = terminalPosition(doc, 'bb2:h9')
    const hit = holeAtWorld(doc, target.x, target.y)
    expect(hit.board).toBe('bb2')
    expect(hit.hole.name).toBe('h9')
  })
})

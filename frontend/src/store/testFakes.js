// Minimal engine fakes for store tests (no DOM, no real registry). Mirrors just enough of CONTRACTS §2–4.
import { newId } from '../lib/ids.js'

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
const ROWS = { half: 30, full: 63 }

const pin = (name, kind, caps = [], extra = {}) => ({ name, label: name, kind, caps, aliases: [], number: null, adcChannel: null, touchChannel: null, dacChannel: null, volts: null, side: 'top', index: 0, ...extra })

export const fakeBoards = {
  BOARD_IDS: ['uno', 'nano', 'esp32', 'esp32s3'],
  getBoard(id) {
    if (id === 'uno' || id === 'nano') {
      return {
        id, name: id === 'uno' ? 'Arduino Uno R3' : 'Arduino Nano', family: 'avr', vcc: 5, usbSupplyMaxMa: 500,
        pins: [pin('D13', 'digital', ['digital']), pin('D9', 'digital', ['digital', 'pwm']), pin('GND', 'ground'), pin('GND2', 'ground'), pin('GND3', 'ground'),
          pin('5V', 'power', [], { volts: 5 }), pin('3V3', 'power', [], { volts: 3.3 }), pin('VIN', 'power', [], { volts: 5 }),
          ...['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map((n) => pin(n, 'analog', ['digital', 'adc']))],
      }
    }
    if (id === 'esp32' || id === 'esp32s3') {
      return {
        id, name: 'ESP32 DevKit V1', family: 'esp32', vcc: 3.3, usbSupplyMaxMa: 500,
        pins: [pin('3V3', 'power', [], { volts: 3.3 }), pin('GND', 'ground'), pin('GPIO2', 'digital', ['digital', 'pwm', 'adc']), pin('GPIO4', 'digital', ['digital', 'adc', 'touch']),
          pin('VIN', 'power', [], { volts: 5 }), pin('GND2', 'ground'), pin('GPIO34', 'digital', ['adc', 'input_only']), pin('GPIO35', 'digital', ['adc', 'input_only'])],
      }
    }
    return null
  },
}

export const fakeBreadboard = {
  PITCH: 24,
  layoutBreadboards(mode) {
    return mode === 'dual'
      ? [{ id: 'bb1', type: 'half', x: 0, y: 0 }, { id: 'bb2', type: 'half', x: 0, y: 21 * 24 }]
      : [{ id: 'bb1', type: mode === 'full' ? 'full' : 'half', x: 0, y: 0 }]
  },
  holeByName(type, name) {
    const rows = ROWS[type] ?? 30
    const rail = /^(TP|TN|BN|BP)(\d+)$/.exec(name)
    if (rail) return Number(rail[2]) <= (rows === 30 ? 25 : 50) ? { name } : null
    const m = /^([a-j])(\d+)$/.exec(name)
    if (!m || Number(m[2]) < 1 || Number(m[2]) > rows) return null
    return { name, x: 0, y: 0, strip: `row${m[2]}:${LETTERS.indexOf(m[1]) < 5 ? 'upper' : 'lower'}`, kind: 'main', rail: null }
  },
  boardHoles(type) {
    const rows = ROWS[type] ?? 30
    const holes = []
    for (const letter of LETTERS) for (let r = 1; r <= rows; r++) holes.push({ name: `${letter}${r}`, x: (1.5 + r - 1) * 24, y: 0, strip: `row${r}:${LETTERS.indexOf(letter) < 5 ? 'upper' : 'lower'}`, kind: 'main', rail: null })
    return holes
  },
}

const DEFS = {
  uno: { type: 'uno', name: 'Arduino Uno R3', category: 'mcu', mount: 'free', footprint: { pins: [], width: 27, height: 21 }, props: {} },
  nano: { type: 'nano', name: 'Arduino Nano', category: 'mcu', mount: 'board', footprint: { pins: [{ id: 'D13', dx: 0, dy: 0 }, { id: 'VIN', dx: 14, dy: 0 }, { id: 'D1', dx: 14, dy: 6 }], width: 15, height: 7 }, props: {} },
  esp32: { type: 'esp32', name: 'ESP32 DevKit V1', category: 'mcu', mount: 'board', footprint: { pins: [{ id: '3V3', dx: 0, dy: 0 }, { id: 'GPIO23', dx: 14, dy: 0 }, { id: 'EN', dx: 14, dy: 10 }], width: 15, height: 11 }, props: {} },
  led: { type: 'led', name: 'LED', category: 'output', mount: 'board', footprint: { pins: [{ id: 'anode', dx: 0, dy: 0 }, { id: 'cathode', dx: 1, dy: 0 }], width: 2, height: 1 }, props: { color: { type: 'enum', default: 'red', options: ['red', 'green'] } }, learn: { summary: 'Light emitting diode', pinout: ['anode (+)', 'cathode (−)'], tips: [] } },
  resistor: { type: 'resistor', name: 'Resistor', category: 'passive', mount: 'board', footprint: { pins: [{ id: 'p1', dx: 0, dy: 0 }, { id: 'p2', dx: 4, dy: 0 }], width: 5, height: 1 }, props: { ohms: { type: 'enum', default: 220, options: [100, 220, 1000], format: 'ohms' } }, learn: { summary: 'Limits current', pinout: [], tips: [] } },
}

function defaults(def) {
  return Object.fromEntries(Object.entries(def?.props ?? {}).map(([k, v]) => [k, v.default]))
}

export const fakeRegistry = {
  REGISTRY: DEFS,
  RESISTOR_VALUES: [100, 220, 1000],
  WIRE_COLORS: ['red', 'black', 'yellow', 'green', 'blue', 'orange', 'white', 'purple'],
  getDef: (type) => DEFS[type] ?? null,
  listDefs: () => Object.values(DEFS),
  createComponent(type, placement, props = {}) {
    const comp = { id: newId('c'), type, props: { ...defaults(DEFS[type]), ...props }, rotation: placement?.rotation ?? 0 }
    if (placement?.anchor) comp.anchor = { ...placement.anchor }
    else comp.position = { ...(placement?.position ?? { x: 0, y: 0 }) }
    return comp
  },
  resolvePins(comp, doc) {
    const def = DEFS[comp.type]
    if (!comp.anchor) return { pins: Object.fromEntries((def?.footprint.pins ?? []).map((p) => [p.id, { terminal: `${comp.id}:${p.id}`, hole: null, x: 0, y: 0 }])), valid: true, invalidPins: [] }
    const bb = (doc?.breadboards ?? []).find((b) => b.id === comp.anchor.board)
    const m = /^([a-j])(\d+)$/.exec(comp.anchor.hole ?? '')
    if (!bb || !m) return { pins: {}, valid: false, invalidPins: (def?.footprint.pins ?? []).map((p) => p.id) }
    const rows = ROWS[bb.type] ?? 30
    const pins = {}
    const invalidPins = []
    for (const p of def?.footprint.pins ?? []) {
      const row = Number(m[2]) + p.dx
      const letterIdx = LETTERS.indexOf(m[1]) + p.dy
      const letter = LETTERS[letterIdx]
      const ok = row >= 1 && row <= rows && letter
      if (!ok) invalidPins.push(p.id)
      const hole = ok ? `${bb.id}:${letter}${row}` : null
      pins[p.id] = { terminal: hole ?? `${comp.id}:${p.id}`, hole, x: 0, y: 0 }
    }
    return { pins, valid: invalidPins.length === 0, invalidPins }
  },
  defaultMcuPlacement(boardId, boardMode) {
    if (boardId === 'uno') return { position: { x: 0, y: -(504 + 48) } }
    if (boardId === 'nano') return { anchor: { board: 'bb1', hole: 'b1' } }
    return boardMode === 'dual' ? { anchor: { board: 'bb1', hole: 'j1' } } : { anchor: { board: 'bb1', hole: 'a1' } }
  },
  describeValue: (type, props) => (type === 'resistor' ? `${props?.ohms ?? 220} Ω` : type === 'led' ? `${props?.color ?? 'red'} LED` : type),
  resistorBands: () => ['red', 'red', 'brown', 'gold'],
}

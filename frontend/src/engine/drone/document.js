import { DEFAULT_CONFIG, clone, validateConfig } from './config.js'
import { getBoard } from '../boards/index.js'

export const MOUNTS = { frame: [300, 260], stack: [300, 235], strap: [300, 360], imu: [245, 275], baro: [355, 275], rx: [300, 135], gps: [300, 65], accessory: [460, 360], arm1: [440, 110], arm2: [160, 110], arm3: [160, 390], arm4: [440, 390], esc1: [395, 190], esc2: [205, 190], esc3: [205, 330], esc4: [395, 330], prop1: [440, 110], prop2: [160, 110], prop3: [160, 390], prop4: [440, 390] }
export const DIRECTIONS = ['ccw', 'cw', 'ccw', 'cw']
const part = (type, name, mounts, ports, peripheral = null) => ({ type, name, mounts, ports, peripheral, category: 'module', bench: 'drone', mount: 'free', recommendedBoards: ['esp32', 'esp32s3'], footprint: { width: 3, height: 2, pins: Object.keys(ports).map((id, dx) => ({ id, label: id, dx, dy: 0 })) }, props: {}, model: [], control: null, learn: { summary: name, pinout: Object.keys(ports), tips: ['Use the frame mounts and typed connectors on the drone bench.'] }, bom: { partName: name, catalogId: type } })
export const DRONE_DEFS = [
  part('drone_frame', 'Quad-X frame', ['frame'], {}),
  part('brushless_motor', 'Brushless motor', [1, 2, 3, 4].map(i => `arm${i}`), { phase: 'phase' }),
  part('drone_prop', 'Propeller', [1, 2, 3, 4].map(i => `prop${i}`), {}),
  part('esc', 'ESC channel', [1, 2, 3, 4].map(i => `esc${i}`), { vbat: 'power', gnd: 'power', signal: 'signal', phase: 'phase', bec: 'power' }, { protocol: 'esc', roles: { signal: 'signal', vbat: 'vbat', gnd: 'gnd' } }),
  part('lipo', 'LiPo pack', ['strap'], { pos: 'power', neg: 'power' }),
  part('imu_mpu6050', 'MPU6050 IMU', ['imu'], { sda: 'i2c', scl: 'i2c', vcc: 'power', gnd: 'power' }, { protocol: 'imu_i2c', i2cAddress: 0x68, roles: { sda: 'sda', scl: 'scl', vcc: 'vcc', gnd: 'gnd' } }),
  part('baro_bmp280', 'BMP280 barometer', ['baro'], { sda: 'i2c', scl: 'i2c', vcc: 'power', gnd: 'power' }, { protocol: 'baro_i2c', i2cAddress: 0x76, roles: { sda: 'sda', scl: 'scl', vcc: 'vcc', gnd: 'gnd' } }),
  part('rx_elrs', 'ELRS receiver', ['rx'], { tx: 'uart', rx: 'uart', vcc: 'power', gnd: 'power' }, { protocol: 'rc_serial', roles: { tx: 'tx', rx: 'rx', vcc: 'vcc', gnd: 'gnd' } }),
  part('gps', 'GPS module', ['gps'], { tx: 'uart', rx: 'uart', vcc: 'power', gnd: 'power' }, { protocol: 'gps_uart', roles: { tx: 'tx', rx: 'rx', vcc: 'vcc', gnd: 'gnd' } }),
  part('drone_accessory', 'Bench accessory', ['accessory'], {}),
]
export const droneDef = type => DRONE_DEFS.find(d => d.type === type)
export const mountOf = (doc, id) => doc.mounts.find(m => m.componentId === id)?.mount
export const positionOf = (doc, id) => MOUNTS[mountOf(doc, id)] ?? [300, 260]
export function portsOf(component) {
  const board = getBoard(component.type)
  return board ? Object.fromEntries(board.pins.map(p => [p.name, ['power', 'ground'].includes(p.kind) ? 'power' : 'gpio'])) : droneDef(component.type)?.ports ?? {}
}
export function compatibleLink(doc, from, to, kind) {
  if (![from, to].every(ref => typeof ref === 'string' && ref.split(':').length === 2)) return false
  const port = ref => { const [id, pin] = String(ref).split(':'); const c = doc.components.find(c => c.id === id); return c && portsOf(c)[pin] }
  const a = port(from), b = port(to)
  if (!a || !b || from === to || from.split(':')[0] === to.split(':')[0]) return false
  return ['power', 'phase', 'signal', 'i2c', 'uart'].includes(kind) && [a, b].every(p => p === kind || (p === 'gpio' && ['signal', 'i2c', 'uart'].includes(kind)))
}

export function createDroneDoc(config = DEFAULT_CONFIG, { bench = false } = {}) {
  const c = clone(config), board = getBoard(c.fc.board)
  const doc = { version: 1, kind: 'drone', mcu: c.fc.board, boardMode: 'half', breadboards: [], components: [], wires: [], mounts: [], links: [], droneConfig: c, course: [{ x: 2, y: 0, z: 1.5, radius: 0.9 }, { x: 4, y: 0, z: 1.5, radius: 0.9 }], flight: { seed: 42, bench, wind: [0, 0, 0] }, meta: { name: c.name } }
  const add = (id, type, mount, props = {}) => { doc.components.push({ id, type, props, rotation: 0 }); doc.mounts.push({ componentId: id, mount }) }
  const link = (from, to, kind = 'power') => doc.links.push({ id: `w_link${doc.links.length}`, from, to, kind, awg: 16, lengthM: 0.15 })
  add('c_frame', 'drone_frame', 'frame')
  add('c_fc', c.fc.board, 'stack')
  add('c_pack', 'lipo', 'strap')
  for (let i = 1; i <= 4; i++) {
    add(`c_motor${i}`, 'brushless_motor', `arm${i}`, { direction: DIRECTIONS[i - 1] })
    add(`c_prop${i}`, 'drone_prop', `prop${i}`, { direction: DIRECTIONS[i - 1], fitted: !bench })
    add(`c_esc${i}`, 'esc', `esc${i}`)
    link('c_pack:pos', `c_esc${i}:vbat`); link('c_pack:neg', `c_esc${i}:gnd`)
    link(`c_esc${i}:phase`, `c_motor${i}:phase`, 'phase')
    link(`c_fc:GPIO${[18, 19, 23, 25][i - 1]}`, `c_esc${i}:signal`, 'signal')
    if (c.fc.board === 'esp32s3') doc.links.at(-1).from = `c_fc:GPIO${[4, 5, 6, 7][i - 1]}`
  }
  link('c_esc1:bec', `c_fc:${c.fc.board === 'esp32' ? 'VIN' : '5V'}`)
  link('c_pack:neg', 'c_fc:GND')
  for (const [id, type, mount] of [['c_imu', c.fc.imu, 'imu'], ['c_baro', c.fc.baro, 'baro']]) if (type) {
    add(id, type, mount)
    link(`c_fc:${board.i2c.sda}`, `${id}:sda`, 'i2c'); link(`c_fc:${board.i2c.scl}`, `${id}:scl`, 'i2c')
    link('c_fc:3V3', `${id}:vcc`); link('c_fc:GND', `${id}:gnd`)
  }
  if (c.extras.some(e => e.id === 'rx_elrs_2400')) {
    add('c_rx', 'rx_elrs', 'rx')
    link('c_rx:tx', 'c_fc:GPIO16', 'uart'); link('c_rx:rx', 'c_fc:GPIO17', 'uart')
    link('c_fc:3V3', 'c_rx:vcc'); link('c_fc:GND', 'c_rx:gnd')
  }
  return doc
}

export function validateDroneDoc(doc) {
  const assert = (v, m) => { if (!v) throw new Error(m) }
  assert(doc?.kind === 'drone' && doc.version === 1, 'Invalid drone document.')
  validateConfig(doc.droneConfig)
  assert(doc.mcu === doc.droneConfig.fc.board && doc.boardMode === 'half', 'Drone controller must match its configuration.')
  assert(Array.isArray(doc.breadboards) && !doc.breadboards.length && Array.isArray(doc.wires) && !doc.wires.length, 'Drone benches use mounts and links.')
  assert(Array.isArray(doc.components) && doc.components.length <= 32 && Array.isArray(doc.mounts) && Array.isArray(doc.links) && doc.links.length <= 100, 'Invalid drone assembly size.')
  const ids = new Set(), occupied = new Set()
  for (const c of doc.components) {
    assert(c && typeof c.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(c.id) && !ids.has(c.id), 'Duplicate or invalid part ID.')
    ids.add(c.id)
    const def = droneDef(c.type)
    assert(def || c.type === doc.mcu, 'Unsupported drone part.')
    const mounts = doc.mounts.filter(m => m.componentId === c.id)
    const mount = mounts[0]?.mount
    assert(mounts.length === 1 && !occupied.has(mount) && (def?.mounts ?? ['stack']).includes(mount), 'A part must occupy one compatible, free mount.')
    occupied.add(mount)
    assert(c.props && typeof c.props === 'object' && !Array.isArray(c.props), 'Invalid part properties.')
    if (['brushless_motor', 'drone_prop'].includes(c.type)) assert(DIRECTIONS.includes(c.props.direction), 'Choose CW or CCW.')
    if (c.type === 'drone_prop') assert(typeof c.props.fitted === 'boolean', 'Prop fitted must be boolean.')
  }
  assert(doc.mounts.length === doc.components.length && doc.components.filter(c => c.type === doc.mcu).length === 1, 'A drone needs exactly one FC.')
  const ends = new Set()
  for (const link of doc.links) {
    assert(link && typeof link.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(link.id) && !ids.has(link.id), 'Duplicate or invalid link ID.')
    ids.add(link.id)
    assert(compatibleLink(doc, link.from, link.to, link.kind), 'Connector types or endpoints do not match.')
    const key = [link.from, link.to].sort().join('|')
    assert(!ends.has(key), 'Duplicate connector link.'); ends.add(key)
    assert([12, 14, 16, 18, 20, 22, 24].includes(link.awg) && Number.isFinite(link.lengthM) && link.lengthM >= 0.01 && link.lengthM <= 2, 'Invalid wire gauge or length.')
  }
  assert(Array.isArray(doc.course) && doc.course.length <= 24, 'Use at most 24 gates.')
  for (const g of doc.course) assert(g && ['x', 'y', 'z', 'radius'].every(k => Number.isFinite(g[k])) && Math.abs(g.x) <= 15 && Math.abs(g.y) <= 15 && g.z >= 0.5 && g.z <= 8 && g.radius >= 0.3 && g.radius <= 3, 'Invalid gate geometry.')
  assert(doc.flight && Number.isInteger(doc.flight.seed) && doc.flight.seed >= 0 && doc.flight.seed <= 4294967295 && typeof doc.flight.bench === 'boolean' && Array.isArray(doc.flight.wind) && doc.flight.wind.length === 3 && doc.flight.wind.every(n => Number.isFinite(n) && Math.abs(n) <= 10), 'Invalid flight environment.')
  return doc
}

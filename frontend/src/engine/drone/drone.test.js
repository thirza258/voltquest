import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createDroneDoc, validateDroneDoc, MOUNTS, DRONE_DEFS } from './document.js'
import { clone, DEFAULT_CONFIG, PRESETS, deriveConfig, feasibility, CONFIG_FIELDS, MODEL } from './config.js'
import { ASSISTED_CODE, BENCH_CODE, RATE_CODE } from './examples.js'
import { createSimulation } from '../sim/index.js'
import { compileCircuit } from '../circuit/index.js'
import { createDynamics, mix } from './dynamics.js'
import { runLevelSolution } from '../headless.js'
import { validateProject, projectFile, parseProjectFile } from '../../features/sandbox/projectFile.js'
import { createDocumentStore } from '../../store/documentStore.js'

async function run(doc, code = ASSISTED_CODE, timeline = [], duration = 3000, chunks = [duration]) {
  const sim = createSimulation({ inline: true })
  try {
    sim.setDocument(doc); sim.setCode(code)
    expect(await sim.run()).toEqual({ ok: true, errors: [] })
    sim.setFlightTimeline(timeline)
    for (const ms of chunks) sim.advance(ms)
    expect(sim.getState().runtimeError).toBeNull()
    return sim.getState().flight
  } finally { sim.dispose() }
}
const arm = [{ atMs: 100, sticks: { arm: true, mode: 'raw' } }, { atMs: 1400, sticks: { throttle: .25 } }]

describe('drone documents and estimates', () => {
  it.each(PRESETS)('$id is importable and produces finite derived values', p => {
    const doc = createDroneDoc(p.config)
    expect(validateProject(projectFile({ name: 'Build', circuit: doc, code: ASSISTED_CODE })).circuit).toEqual(doc)
    const d = deriveConfig(p.config)
    expect(d.twr).toBeGreaterThan(1.5); expect(d.twr).toBeLessThan(10)
    expect(d.hoverMinutes).toBeGreaterThan(2)
  })
  it('imports a standalone configuration as a fully editable assisted project', () => {
    const imported = parseProjectFile(JSON.stringify(PRESETS[1].config))
    expect(imported.circuit.droneConfig).toEqual(PRESETS[1].config); expect(imported.code).toBe(ASSISTED_CODE); expect(imported.editorMode).toBe('text')
  })
  it('accounts for component mass and pack inertia', () => {
    const a = deriveConfig(DEFAULT_CONFIG), b = clone(DEFAULT_CONFIG); b.battery.massG += 100
    const heavier = deriveConfig(b)
    expect(heavier.auwG - a.auwG).toBe(100); expect(heavier.inertia[2]).toBeGreaterThan(a.inertia[2]); expect(heavier.hoverThrottle).toBeGreaterThan(a.hoverThrottle)
  })
  it('reports poor but structurally valid builds without blocking import', () => {
    const doc = createDroneDoc(); doc.droneConfig.motors.kv = 500; doc.droneConfig.props.diameterIn = 7
    expect(validateDroneDoc(doc)).toBe(doc); expect(feasibility(doc.droneConfig).some(w => w.code === 'prop_clearance')).toBe(true)
  })
  it.each([
    d => { d.droneConfig.battery.cells = 4.5 },
    d => { d.droneConfig.motors.kv = Infinity },
    d => { d.mounts[1].mount = 'strap' },
    d => { d.links[0].to = 'missing:vbat' },
    d => { d.links[0].kind = 'i2c' },
    d => { d.links[0].awg = 0 },
    d => { d.course[0].radius = -1 },
    d => { d.components.push(d.components[0]) },
  ])('rejects malformed geometry or numeric data before loading', mutate => { const d = createDroneDoc(); mutate(d); expect(() => validateDroneDoc(d)).toThrow() })
  it('uses the same undo history for configuration, placement and connector edits', () => {
    const store = createDocumentStore(), d = createDroneDoc(); store.getState().load(d)
    const edited = clone(d); edited.droneConfig.motors.kv = 1800; edited.links.pop()
    store.getState().setDoc(edited); expect(store.getState().doc.breadboards).toEqual([])
    store.getState().undo(); expect(store.getState().doc).toEqual(d); store.getState().redo(); expect(store.getState().doc).toEqual(edited)
  })
  it('keeps the shared API schema synchronized', () => {
    const catalog = JSON.parse(readFileSync(new URL('../../../../content/drone-catalog.json', import.meta.url), 'utf8'))
    expect(JSON.parse(readFileSync(new URL('../../../../backend/app/domain/drone_catalog.json', import.meta.url), 'utf8'))).toEqual(catalog)
    expect(catalog).toMatchObject({ fields: CONFIG_FIELDS, defaultConfig: DEFAULT_CONFIG, presets: PRESETS, model: MODEL, parts: DRONE_DEFS, mounts: MOUNTS })
  })
})

describe('real sketch → ESC → electrical → dynamics → sensor loop', () => {
  it('only spins after a sketch writes valid low pulses and the receiver arms', async () => {
    const doc = createDroneDoc(DEFAULT_CONFIG, { bench: true })
    const live = await run(doc, BENCH_CODE, arm)
    expect(live.rpm[0]).toBeGreaterThan(100); expect(live.escArmed[0]).toBe(true); expect(live.thrustN).toEqual([0, 0, 0, 0])
    const stopped = await run(doc, 'void setup() {} void loop() { delay(4); }', arm)
    expect(stopped.rpm).toEqual([0, 0, 0, 0]); expect(stopped.escArmed).toEqual([false, false, false, false])
  })
  it('a missing phase bundle disables the corresponding motor', async () => {
    const d = createDroneDoc(); d.links = d.links.filter(l => l.to !== 'c_motor1:phase')
    const f = await run(d, ASSISTED_CODE, arm)
    expect(f.rpm[0]).toBe(0); expect(f.rpm[1]).toBeGreaterThan(0)
  })
  it('bench safety, receiver loss and high-throttle arming are enforced', async () => {
    const d = createDroneDoc(); d.flight.bench = true
    const blocked = await run(d, ASSISTED_CODE, arm)
    expect(blocked.warningCodesSeen.no_prop_guard).toBeTruthy(); expect(blocked.rpm).toEqual([0, 0, 0, 0])
    const lost = await run(createDroneDoc(), ASSISTED_CODE, [...arm, { atMs: 2200, sticks: { signal: false } }])
    expect(lost.armed).toBe(false); expect(lost.warningCodesSeen.receiver_loss).toBeTruthy()
    const high = await run(createDroneDoc(), ASSISTED_CODE, [{ atMs: 1500, sticks: { throttle: .7, arm: true } }])
    expect(high.armed).toBe(false)
  })
  it('reverse polarity destroys ESCs and FC and persists damage until repair', () => {
    const d = createDroneDoc(); d.links = d.links.map(l => ({ ...l, from: l.from === 'c_pack:pos' ? 'c_pack:neg' : l.from === 'c_pack:neg' ? 'c_pack:pos' : l.from }))
    const f = createDynamics(d, compileCircuit(d)).state
    expect(f.warningCodesSeen.reverse_polarity).toBeTruthy(); expect(f.damaged.c_fc).toBe(true); expect(f.damaged.c_esc1).toBe(true)
  })
  it('reversed props create downforce instead of silently generating lift', async () => {
    const d = createDroneDoc(); d.components.find(p => p.id === 'c_prop1').props.direction = 'cw'
    const f = await run(d, ASSISTED_CODE, arm)
    expect(f.warningCodesSeen.prop_direction_mismatch).toBeTruthy(); expect(f.thrustN[0]).toBeLessThan(0)
  })
  it('BOM and model change with both materially different builds completing the course', async () => {
    const level = JSON.parse(readFileSync(new URL('../../../../content/quests/w5-l6.json', import.meta.url), 'utf8'))
    for (const preset of [PRESETS[0], PRESETS[1]]) {
      const l = clone(level); l.solution.circuit = createDroneDoc(preset.config)
      if (preset.id === 'micro') l.solution.actions.find(a => a.sticks?.pitch === .1).sticks.pitch = .22
      const result = await runLevelSolution(l)
      expect(result.allPassed, JSON.stringify(result)).toBe(true); expect(result.stars).toBe(3)
    }
  })
  it('replays a seed and input timeline identically across advance chunk sizes', async () => {
    const timeline = [...arm, { atMs: 1777, sticks: { pitch: .02 } }]
    const a = await run(createDroneDoc(), ASSISTED_CODE, timeline)
    const b = await run(createDroneDoc(), ASSISTED_CODE, timeline, 3000, Array(300).fill(10))
    expect(a.position).toEqual(b.position); expect(a.quaternion).toEqual(b.quaternion); expect(a.rpm).toEqual(b.rpm)
  })
  it('supports MPU6050 integer output parameters in the interpreter', async () => {
    const code = '#include <MPU6050.h>\nMPU6050 imu; int ax,ay,az,gx,gy,gz; void setup(){Serial.begin(115200);} void loop(){imu.getMotion6(&ax,&ay,&az,&gx,&gy,&gz); Serial.println(az); delay(10);}'
    const f = await run(createDroneDoc(DEFAULT_CONFIG, { bench: true }), code)
    expect(f.imuReads).toBeGreaterThan(200)
  })
  it('scales saturated differential outputs into valid bounds', () => { const m = mix(.8, 1, -.7, .4); expect(m.saturated).toBe(true); expect(m.outputs.every(n => n >= 0 && n <= 1)).toBe(true) })
  it('the player-written PID responds to a scripted disturbance', async () => {
    const f = await run(createDroneDoc(), RATE_CODE, [{ atMs: 100, sticks: { arm: true, mode: 'rate' } }, { atMs: 1400, sticks: { throttle: .325 } }, { atMs: 2000, disturbance: [40, -20, 0] }], 5000)
    expect(f.crashed).toBe(false); expect(Math.max(...f.attitude.slice(0, 2).map(Math.abs))).toBeLessThan(8)
    expect(Math.max(...f.blackbox.map(r => Math.abs(r.gyro[0])))).toBeGreaterThan(10)
  })
})

describe('drone failure, sensor and replay regressions', () => {
  it('captures every input inside a telemetry interval and replays its exact trajectory', async () => {
    const sim = createSimulation({ inline: true })
    try {
      sim.setDocument(createDroneDoc()); sim.setCode(ASSISTED_CODE); await sim.run()
      sim.setFlightTimeline([...arm, { atMs: 1771, sticks: { pitch: .01 } }, { atMs: 1772, sticks: { pitch: .02 } }, { atMs: 1773, disturbance: [1, 0, 0] }])
      sim.advance(3000)
      const original = sim.getState().flight
      expect(original.timeline).toHaveLength(5)
      expect(await sim.replayFlight()).toEqual({ ok: true, errors: [] }); sim.advance(3000)
      const replay = sim.getState().flight
      expect(replay.position).toEqual(original.position); expect(replay.quaternion).toEqual(original.quaternion); expect(replay.rpm).toEqual(original.rpm)
      sim.setCode(ASSISTED_CODE + '\n// edited')
      expect(sim.getState().flight.replayAvailable).toBe(false); expect(await sim.replayFlight()).toEqual({ ok: false })
    } finally { sim.dispose() }
  })
  it('makes swapped I²C lines and missing sensor power observable to firmware', async () => {
    for (const edit of [d => { d.links.forEach(l => { if (l.to === 'c_imu:sda') l.from = 'c_fc:GPIO22'; if (l.to === 'c_imu:scl') l.from = 'c_fc:GPIO21' }) }, d => { d.links = d.links.filter(l => l.to !== 'c_imu:vcc') }]) {
      const d = createDroneDoc(); edit(d)
      const f = await run(d, '#include <MPU6050.h>\nMPU6050 imu; void setup(){} void loop(){imu.getGyroX(); delay(4);}')
      expect(f.sensors.imu).toBeNull(); expect(f.imuReads).toBe(0)
    }
  })
  it('writes real integer output parameters and honors accelerometer range', async () => {
    const sim = createSimulation({ inline: true })
    try {
      sim.setDocument(createDroneDoc(DEFAULT_CONFIG, { bench: true }))
      sim.setCode('#include <MPU6050.h>\nMPU6050 imu; int ax,ay,az; void setup(){Serial.begin(115200);imu.setFullScaleAccelRange(MPU6050_ACCEL_FS_4);} void loop(){imu.getAcceleration(&ax,&ay,&az);Serial.println(az);delay(10);}')
      expect((await sim.run()).ok).toBe(true); sim.advance(100)
      const values = sim.getState().serial.map(r => r.text).join('').trim().split(/\s+/).map(Number)
      expect(values.length).toBeGreaterThan(3); expect(values.every(n => n > 8170 && n < 8220)).toBe(true)
    } finally { sim.dispose() }
  })
  it('retains damage during assembly edits and clears it with explicit reset', () => {
    const sim = createSimulation({ inline: true }), d = createDroneDoc()
    try {
      const bad = clone(d); bad.links.forEach(l => { if (l.from === 'c_pack:pos') l.from = 'c_pack:neg'; else if (l.from === 'c_pack:neg') l.from = 'c_pack:pos' })
      sim.setDocument(bad); expect(sim.getState().damaged.c_fc).toBe(true)
      sim.setDocument(d); expect(sim.getState().damaged.c_fc).toBe(true); expect(sim.getState().flight.electrical.fcPowered).toBe(false)
      sim.reset(); expect(sim.getState().damaged).toEqual({}); expect(sim.getState().flight.electrical.fcPowered).toBe(true)
      sim.setPowered(false); expect(sim.getState().flight.electrical.V_bus).toBe(0)
    } finally { sim.dispose() }
  })
  it('cuts off an exhausted pack, resets a browned-out FC and burns an undersized ESC', () => {
    for (const [configure, currents, code] of [
      [c => { c.battery.internalResistanceMohm = 200 }, [30, 30, 30, 30], 'lipo_overdischarge'],
      [c => { c.esc.continuousA = 1; c.esc.burstA = 1 }, [5, 5, 5, 5], 'esc_overcurrent'],
    ]) {
      const d = createDroneDoc(); configure(d.droneConfig)
      const physics = createDynamics(d, compileCircuit(d)); physics.state.motorCurrentA = currents; physics.step()
      expect(physics.state.warningCodesSeen[code]).toBeTruthy(); expect(Object.keys(physics.state.damaged).length).toBeGreaterThan(0)
      if (code === 'lipo_overdischarge') { expect(physics.state.electrical.cutoff).toBe(true); expect(physics.state.electrical.capacityFactor).toBe(.6); expect(physics.consumeReset()).toBe(true) }
    }
  })
  it('runs an ESP32-S3 assisted sketch through its actual signal and I²C pins', async () => {
    const config = clone(DEFAULT_CONFIG); config.fc.board = 'esp32s3'
    const f = await run(createDroneDoc(config), ASSISTED_CODE, arm)
    expect(f.sensors.imu).not.toBeNull(); expect(f.rpm.every(n => n > 100)).toBe(true)
  })
})

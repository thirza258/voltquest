import { clamp, clone, deriveConfig, rotor, MODEL, GRAVITY, DEFAULT_MIXER } from './config.js'
import { mountOf } from './document.js'
import { createElectrical, FAILURE_HINTS } from './electrical.js'

export const STEP_US = 1000
export const TELEMETRY_US = 20000
export const MIXER = DEFAULT_MIXER
export function mix(throttle, roll, pitch, yaw, matrix = MIXER) {
  const differential = matrix.map(row => row[1] * roll + row[2] * pitch + row[3] * yaw)
  const span = Math.max(...differential) - Math.min(...differential)
  const scaled = differential.map(v => v / Math.max(1, span))
  const t = clamp(throttle, -Math.min(...scaled), 1 - Math.max(...scaled))
  return { outputs: scaled.map(v => clamp(t + v, 0, 1)), saturated: span > 1 || Math.abs(t - throttle) > 1e-9 }
}
const RAD = Math.PI / 180, DEG = 1 / RAD
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export function attitudeOf([w, x, y, z]) {
  return [Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)), Math.asin(clamp(2 * (w * y - z * x), -1, 1)), Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))].map(v => v * DEG)
}
function quaternion(roll, pitch, yaw) {
  const [r, p, y] = [roll, pitch, yaw].map(v => v * RAD / 2), [cr, cp, cy] = [r, p, y].map(Math.cos), [sr, sp, sy] = [r, p, y].map(Math.sin)
  return [cr * cp * cy + sr * sp * sy, sr * cp * cy - cr * sp * sy, cr * sp * cy + sr * cp * sy, cr * cp * sy - sr * sp * cy]
}

/** No host clock or timers. All noise and inputs are sampled on the 1 ms clock. */
export function createDynamics(doc, compiled, damaged = {}) {
  const c = doc.droneConfig, derived = deriveConfig(c)
  let seed = doc.flight.seed >>> 0, tick = 0
  const random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  const s = { t: 0, mixer: c.mixer ?? MIXER, position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [1, 0, 0, 0], rates: [0, 0, 0], attitude: [0, 0, 0], rpm: [0, 0, 0, 0], motorCurrentA: [0, 0, 0, 0], thrustN: [0, 0, 0, 0], pulses: [1000, 1000, 1000, 1000], escArmed: [false, false, false, false], armed: false, mode: 'hover', crashed: false, airborne: false, landed: false, impactMs2: 0, gatesPassed: 0, gateTimes: [], damaged: { ...damaged }, events: [], warnings: [], warningCodesSeen: {}, blackbox: [], timeline: [], imuReads: 0, setpoint: [0, 0, 0], saturated: false, rc: { throttle: 0, roll: 0, pitch: 0, yaw: 0, arm: false, mode: 'hover', signal: true }, electrical: null, sensors: null, derived, resetCount: 0 }
  const wantedRpm = [0, 0, 0, 0], stalledUntil = [0, 0, 0, 0]
  const seen = new Set(), lowMs = [0, 0, 0, 0], hasCommand = [false, false, false, false]
  const props = [1, 2, 3, 4].map(i => doc.components.find(p => mountOf(doc, p.id) === `prop${i}`))
  const warn = (code, id) => {
    if (seen.has(`${code}:${id ?? ''}`)) return
    seen.add(`${code}:${id ?? ''}`); s.warningCodesSeen[code] = (s.warningCodesSeen[code] ?? 0) + 1
    s.warnings.push({ code, message: FAILURE_HINTS[code] ?? code, hint: FAILURE_HINTS[code], componentIds: id ? [id] : [], severity: 'warning' })
  }
  const damage = (id, reason) => { if (s.damaged[id]) return; s.damaged[id] = true; s.events.push({ type: 'blow', componentId: id, reason, t: s.t }); if (s.events.length > 200) s.events.shift() }
  const electric = createElectrical(doc, compiled, warn, damage)
  let imu = doc.components.find(p => p.type === 'imu_mpu6050'), baro = doc.components.find(p => p.type === 'baro_bmp280')
  const receiver = doc.components.find(p => p.type === 'rx_elrs')
  let resetRequested = false, gestureMs = 0, tilt = [0, 0, 0]
  let inputs = [], nextInput = 0, inputId = 0
  function record(input) { s.timeline.push({ id: ++inputId, atMs: tick, ...clone(input) }); if (s.timeline.length > 10000) s.timeline.shift() }

  function applySticks(patch = {}, shouldRecord = true) {
    const next = { ...s.rc }
    for (const key of ['throttle', 'roll', 'pitch', 'yaw']) if (Number.isFinite(patch[key])) next[key] = clamp(patch[key], key === 'throttle' ? 0 : -1, 1)
    for (const key of ['arm', 'signal']) if (typeof patch[key] === 'boolean') next[key] = patch[key]
    if (['raw', 'rate', 'angle', 'hover'].includes(patch.mode)) next.mode = patch.mode
    if (next.arm && !s.rc.arm && next.throttle > 0.05) { next.arm = false; warn('arm_throttle_high') }
    s.rc = next
    if (shouldRecord) record({ sticks: patch })
  }
  function crash(impact) {
    if (s.crashed) return
    s.crashed = true; s.armed = false; s.impactMs2 = impact * impact / 0.1
    warn('crash')
    const energy = 0.5 * derived.auwG / 1000 * impact * impact
    for (const p of props) if (p?.props.fitted) damage(p.id, 'crash')
    if (energy > 2) damage('c_frame', 'crash')
    if (energy > 8) damage('c_fc', 'crash')
    s.events.push({ type: 'crash', t: s.t, energyJ: energy })
  }
  function step() {
    while (nextInput < inputs.length && inputs[nextInput].atMs <= tick) { const a = inputs[nextInput++]; if (a.sticks) applySticks(a.sticks); if (a.disturbance) disturb(a.disturbance); if (a.tilt) setTilt(a.tilt) }
    tick++; s.t = tick * STEP_US
    const dt = 0.001
    s.electrical = electric.step(s.motorCurrentA, dt, s.damaged)
    if (s.electrical.brownout && !s.resetCount) { s.resetCount++; resetRequested = true; s.escArmed.fill(false); hasCommand.fill(false); s.pulses.fill(1000) }
    const receiverBinding = compiled.peripheralMap.find(b => b.protocol === 'rc_serial' && b.pins.tx && b.pins.rx)
    const signal = s.rc.signal && Boolean(receiverBinding && electric.poweredModule(receiver) && s.electrical.fcPowered)
    if (!signal && s.armed) { warn('receiver_loss'); s.rc.arm = false }
    gestureMs = s.rc.throttle < 0.05 && s.rc.yaw > 0.9 ? gestureMs + 1 : 0
    if (gestureMs >= 1000) s.rc.arm = true
    if (s.rc.throttle < 0.05 && s.rc.yaw < -0.9) s.rc.arm = false
    const benchGuard = doc.flight.bench && props.some(p => p?.props.fitted)
    if (benchGuard && s.rc.arm) warn('no_prop_guard')
    s.armed = s.rc.arm && signal && !s.crashed && !benchGuard && !s.electrical.cutoff && s.electrical.fcPowered
    s.mode = s.rc.mode
    s.pulses.forEach((us, i) => {
      lowMs[i] = us <= 1050 && hasCommand[i] && s.electrical.escEnabled[i] ? lowMs[i] + 1 : 0
      if (lowMs[i] >= 1000) s.escArmed[i] = true
    })
    const torque = [0, 0, 0], totalThrust = [0, 0, 0]
    let rotorMomentum = 0
    const currents = [0, 0, 0, 0]
    s.thrustN.fill(0)
    for (let i = 0; i < 4; i++) {
      const motorIndex = electric.phase[i], m = electric.motors[motorIndex]
      const enabled = s.armed && s.escArmed[i] && s.electrical.escEnabled[i]
      const desired = enabled ? (s.pulses[i] - 1000) / 1000 : 0
      let target = c.motors.kv * s.electrical.V_bus * clamp(desired, 0, 1) * MODEL.slip
      // A deliberately severe step at speed loses commutation for 100 ms.
      if (enabled && s.rpm[i] > 1000 && target - wantedRpm[i] > 12000) { stalledUntil[i] = tick + 100; warn('desync', m?.id) }
      wantedRpm[i] = target
      if (tick < stalledUntil[i]) target = 0
      const before = s.rpm[i]
      const tau = 0.025 + c.props.massG / 1000 * (c.props.diameterIn / 5) ** 2 * 8
      s.rpm[i] += (target - before) * (1 - Math.exp(-dt / tau))
      const prop = props[motorIndex], fitted = prop?.props.fitted && !s.damaged[prop.id]
      const r = rotor(c, s.rpm[i], s.electrical.V_bus, fitted)
      currents[i] = r.currentA
      if (!m) continue
      const mismatch = fitted && prop.props.direction !== m.props.direction
      if (mismatch && r.rpm > 100) warn('prop_direction_mismatch', prop.id)
      const thrust = r.thrustN * (mismatch ? -1 : 1)
      s.thrustN[motorIndex] = thrust; totalThrust[2] += thrust
      const [sx, sy] = [[1, 1], [-1, 1], [-1, -1], [1, -1]][motorIndex]
      torque[0] += sy * derived.arm * thrust; torque[1] -= sx * derived.arm * thrust
      const sign = m.props.direction === 'ccw' ? 1 : -1
      const rotorInertia = c.props.massG / 1000 * (c.props.diameterIn * 0.0254 / 2) ** 2 / 3
      torque[2] += sign * (r.torqueNm + rotorInertia * (s.rpm[i] - before) / 60 * 2 * Math.PI / dt)
      rotorMomentum += sign * rotorInertia * r.omega
    }
    s.motorCurrentA = currents
    if (!doc.flight.bench && !s.crashed) {
      const angularMomentum = s.rates.map((v, i) => v * derived.inertia[i]), gyro = cross(s.rates, angularMomentum)
      const spin = cross(s.rates, [0, 0, rotorMomentum])
      s.rates = s.rates.map((v, i) => clamp(v + (torque[i] - gyro[i] - spin[i] - v * derived.inertia[i] * 2) / derived.inertia[i] * dt, -30, 30))
      const [w, x, y, z] = s.quaternion, [p, q, r] = s.rates
      const dq = [-x * p - y * q - z * r, w * p + y * r - z * q, w * q + z * p - x * r, w * r + x * q - y * p]
      s.quaternion = s.quaternion.map((v, i) => v + dq[i] * dt / 2)
      const norm = Math.hypot(...s.quaternion); s.quaternion = s.quaternion.map(v => v / norm)
      const [qw, qx, qy, qz] = s.quaternion
      const up = [2 * (qx * qz + qw * qy), 2 * (qy * qz - qw * qx), 1 - 2 * (qx * qx + qy * qy)]
      const gust = (random() - 0.5) * 0.02
      const acceleration = up.map((v, i) => v * totalThrust[2] / (derived.auwG / 1000) - (i === 2 ? GRAVITY : 0) - MODEL.drag * (s.velocity[i] - doc.flight.wind[i] - gust) / (derived.auwG / 1000))
      const previous = [...s.position]
      s.velocity = s.velocity.map((v, i) => v + acceleration[i] * dt)
      s.position = s.position.map((v, i) => v + s.velocity[i] * dt)
      if (s.position[2] > 0.2) s.airborne = true
      if (s.position[2] <= 0) {
        if (s.airborne && (Math.abs(s.velocity[2]) > 1.8 || Math.max(...attitudeOf(s.quaternion).slice(0, 2).map(Math.abs)) > 55)) crash(Math.hypot(...s.velocity))
        else if (s.airborne) { s.landed = true; s.impactMs2 = s.velocity[2] ** 2 / 0.1 }
        s.position[2] = 0; s.velocity = [0, 0, 0]
        if (!s.airborne && !s.armed) { s.quaternion = [1, 0, 0, 0]; s.rates.fill(0) }
      }
      if (Math.abs(s.position[0]) > 16 || Math.abs(s.position[1]) > 16 || s.position[2] > 9) crash(Math.max(2, Math.hypot(...s.velocity)))
      const gate = doc.course[s.gatesPassed]
      if (gate && previous[0] < gate.x && s.position[0] >= gate.x) {
        const fraction = (gate.x - previous[0]) / (s.position[0] - previous[0])
        const radius = Math.hypot(previous[1] + (s.position[1] - previous[1]) * fraction - gate.y, previous[2] + (s.position[2] - previous[2]) * fraction - gate.z)
        if (radius < gate.radius) { s.gatesPassed++; s.gateTimes.push(tick) }
        else if (radius < gate.radius + 0.2) crash(Math.max(2, Math.hypot(...s.velocity)))
      }
    } else if (doc.flight.bench) { s.quaternion = quaternion(...tilt); s.rates.fill(0) }
    s.attitude = attitudeOf(s.quaternion)
    const [roll, pitch] = s.attitude.map(v => v * RAD)
    const noise = () => (random() - 0.5)
    const vibration = s.rpm.reduce((a, b) => a + b, 0) / 100000
    const accel = [-Math.sin(pitch) * GRAVITY, Math.sin(roll) * Math.cos(pitch) * GRAVITY, Math.cos(roll) * Math.cos(pitch) * GRAVITY].map(v => v + noise() * (0.02 + vibration * 0.03))
    const gyro = s.rates.map(v => v * DEG * 1.001 + 0.02 + noise() * (0.08 + vibration * 0.12))
    const i2c = compiled.mcu.board.i2c
    const bound = protocol => compiled.peripheralMap.some(b => b.protocol === protocol && b.pins.sda === i2c.sda && b.pins.scl === i2c.scl)
    const imuBound = bound('imu_i2c')
    const baroBound = bound('baro_i2c')
    s.sensors = { imu: imu && imuBound && electric.poweredModule(imu) && s.electrical.fcPowered ? { accel, gyro } : null, baro: baro && baroBound && electric.poweredModule(baro) && s.electrical.fcPowered ? { altitude: s.position[2] + noise() * 0.04 + Math.sin(tick / 5000) * 0.015 + vibration * Math.exp(-s.position[2]) * 0.02 } : null, rc: { ...s.rc, signal }, rpm: s.rpm.slice() }
    if (tick % 20 === 0) {
      s.blackbox.push({ t: s.t, attitude: s.attitude.slice(), gyro: gyro.slice(), setpoint: s.setpoint.slice(), motorOutputs: s.pulses.map(us => (us - 1000) / 1000), batteryV: s.electrical.V_bus, position: s.position.slice(), armed: s.armed, saturated: s.saturated })
      if (s.blackbox.length > 3000) s.blackbox.shift()
    }
  }
  function disturb(values) { if (Array.isArray(values) && values.length === 3 && values.every(Number.isFinite)) { s.rates = s.rates.map((v, i) => v + clamp(values[i], -180, 180) * RAD); record({ disturbance: values }) } }
  function setTilt(patch = {}) { tilt = ['roll', 'pitch', 'yaw'].map((key, i) => Number.isFinite(patch[key]) ? clamp(patch[key], -80, 80) : tilt[i]); record({ tilt: patch }) }
  step()
  return {
    step, get nextUs() { return (tick + 1) * STEP_US }, get state() { return s }, snapshot: () => clone(s),
    consumeReset() { const value = resetRequested; resetRequested = false; return value },
    setSticks: applySticks,
    setTimeline(timeline) { inputs = clone(Array.isArray(timeline) ? timeline : []).filter(a => Number.isFinite(a.atMs) && a.atMs >= 0).sort((a, b) => a.atMs - b.atMs).slice(0, 10000); nextInput = 0 },
    setTilt,
    disturb,
    command(id, us) { const i = electric.escs.findIndex(e => e?.id === id); if (i < 0 || !Number.isFinite(us)) return; hasCommand[i] = true; s.pulses[i] = clamp(us, 1000, 2000) },
    recordControl(setpoint, saturated) { s.setpoint = setpoint; s.saturated = saturated },
    imuRead() { s.imuReads++ },
  }
}

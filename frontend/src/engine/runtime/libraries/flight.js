import { native, noop } from './helpers.js'
import { clamp, GRAVITY } from '../../drone/config.js'
import { mix } from '../../drone/dynamics.js'

/** Teaching library; sensors and ESC outputs always go through the connected peripheral map. */
export function createFlightLibrary(core) {
  const imu = () => { if (!core.bindings.byAddress('imu_i2c', 0x68)) return null; if (core.env.imu) core.drone?.imuRead(); return core.env.imu }
  const gyro = axis => imu()?.gyro[axis] ?? 0
  const angle = axis => {
    const a = imu()?.accel
    if (!a) return 0
    return (axis === 0 ? Math.atan2(a[1], a[2]) : Math.atan2(-a[0], Math.hypot(a[1], a[2]))) * 180 / Math.PI
  }
  const rc = () => core.env.rc ?? { signal: false, throttle: 0, roll: 0, pitch: 0, yaw: 0, arm: false, mode: 'hover' }
  const emit = (index, us) => {
    const pin = core.board.id === 'esp32s3' ? [4, 5, 6, 7][index] : [18, 19, 23, 25][index]
    core.peripheral(core.bindings.byPin('esc', 'signal', `GPIO${pin}`), 'esc', { us: clamp(us, 1000, 2000) })
  }
  function output(throttle, roll, pitch, yaw) {
    const mixed = mix(throttle, roll, pitch, yaw, core.drone?.state.mixer)
    // Mixing acts on thrust (RPM squared), then converts to speed commands.
    mixed.outputs.forEach((v, i) => emit(i, 1000 + Math.sqrt(v) * 1000))
    core.drone?.recordControl([rc().roll * 100, rc().pitch * 100, rc().yaw * 100], mixed.saturated)
  }
  let lastAlt = 0, lastTime = 0, filteredVz = 0
  let tune = { p: .0015, i: .0002, d: .00003 }, integrals = [0, 0, 0], previousGyro = [0, 0, 0], derivative = [0, 0, 0]
  const imuClass = { construct: () => ({ __class: 'MPU6050', accelRange: 0, gyroRange: 0 }), methods: {
    begin: native('bool', () => Boolean(core.bindings.byAddress('imu_i2c', 0x68) && core.env.imu)), initialize: noop, testConnection: native('bool', () => Boolean(core.bindings.byAddress('imu_i2c', 0x68) && core.env.imu)),
    getGyroX: native('float', () => gyro(0)), getGyroY: native('float', () => gyro(1)), getGyroZ: native('float', () => gyro(2)),
    getAccX: native('float', () => imu()?.accel[0] ?? 0), getAccY: native('float', () => imu()?.accel[1] ?? 0), getAccZ: native('float', () => imu()?.accel[2] ?? 0),
    getRoll: native('float', () => angle(0)), getPitch: native('float', () => angle(1)),
    setFullScaleGyroRange: native('void', function ([range]) { this.gyroRange = clamp(Math.trunc(range), 0, 3) }),
    setFullScaleAccelRange: native('void', function ([range]) { this.accelRange = clamp(Math.trunc(range), 0, 3) }),
    getAcceleration: native('void', function (refs) { const a = imu()?.accel ?? [0, 0, 0]; refs.forEach((ref, i) => { if (Array.isArray(ref)) ref[0] = clamp(Math.round(a[i] / GRAVITY * 16384 / 2 ** this.accelRange), -32768, 32767) }) }),
    getRotation: native('void', function (refs) { const g = imu()?.gyro ?? [0, 0, 0]; refs.forEach((ref, i) => { if (Array.isArray(ref)) ref[0] = clamp(Math.round(g[i] * 131 / 2 ** this.gyroRange), -32768, 32767) }) }),
    getMotion6: native('void', function (refs) { const sample = imu(); const values = [...(sample?.accel ?? [0, 0, 0]).map(v => v / GRAVITY * 16384 / 2 ** this.accelRange), ...(sample?.gyro ?? [0, 0, 0]).map(v => v * 131 / 2 ** this.gyroRange)]; refs.forEach((ref, i) => { if (Array.isArray(ref)) ref[0] = clamp(Math.round(values[i]), -32768, 32767) }) }),
  } }
  const rcClass = { construct: () => ({ __class: 'VoltRC' }), methods: {
    begin: noop, hasSignal: native('bool', () => rc().signal), failsafe: native('bool', () => !rc().signal),
    readChannel: native('int', ([n]) => n === 0 ? 1000 + rc().throttle * 1000 : n >= 1 && n <= 3 ? 1500 + rc()[['', 'roll', 'pitch', 'yaw'][n]] * 500 : n === 4 ? rc().arm ? 2000 : 1000 : ({ raw: 1000, rate: 1250, angle: 1750, hover: 2000 }[rc().mode])),
    throttle: native('float', () => rc().throttle), roll: native('float', () => rc().roll), pitch: native('float', () => rc().pitch), yaw: native('float', () => rc().yaw), armed: native('bool', () => rc().arm && rc().signal),
  } }
  const flightClass = { construct: () => ({ __class: 'VoltFlight' }), methods: {
    begin: noop,
    setGains: native('void', ([p, i, d]) => { tune = { p, i, d } }),
    writeMotor: native('void', ([n, us]) => { if (n >= 1 && n <= 4) emit(Math.trunc(n) - 1, us) }),
    mix: native('void', ([t, r, p, y]) => output(t, r, p, y)),
    update: native('void', () => {
      const state = core.drone?.state
      if (!state) return
      if (!rc().arm || !rc().signal || core.now() < 1200000) { for (let i = 0; i < 4; i++) emit(i, 1000); return }
      const throttle = rc().throttle
      if (rc().mode === 'raw') { for (let i = 0; i < 4; i++) emit(i, 1000 + throttle * 1000); return }
      const roll = angle(0), pitch = angle(1)
      const targetRoll = rc().mode === 'rate' ? rc().roll * 100 : (rc().roll * 20 - roll) * 4
      const targetPitch = rc().mode === 'rate' ? rc().pitch * 100 : (rc().pitch * 20 - pitch) * 4
      let collective = throttle * throttle
      if (rc().mode === 'hover') {
        const alt = core.env.baro?.altitude ?? 0, dt = Math.max(0.004, (core.now() - lastTime) / 1e6)
        filteredVz = filteredVz * 0.92 + clamp((alt - lastAlt) / dt, -10, 10) * 0.08
        lastAlt = alt; lastTime = core.now()
        const targetVz = throttle < 0.08 ? -0.6 : (throttle - 0.5) * 3
        const accel = clamp((targetVz - filteredVz) * 3, -GRAVITY * 0.7, GRAVITY)
        const compensation = Math.max(0.5, Math.cos(roll * Math.PI / 180) * Math.cos(pitch * Math.PI / 180))
        collective = state.derived.hoverThrottle ** 2 * (1 + accel / GRAVITY) / compensation * (state.derived.hoverBusV / Math.max(1, state.electrical.V_bus)) ** 2
      }
      const corrections = [targetRoll, targetPitch, rc().yaw * 100].map((target, i) => { const measured = gyro(i), error = target - measured; integrals[i] = clamp(integrals[i] + error * .004, -100, 100); derivative[i] = derivative[i] * .9 + .1 * (measured - previousGyro[i]) / .004; const correction = error * tune.p + integrals[i] * tune.i - derivative[i] * tune.d; previousGyro[i] = measured; return clamp(correction, -.5, .5) })
      output(collective, ...corrections)
    }),
  } }
  const pidClass = { construct: (args = []) => ({ __class: 'PID', p: args[0] ?? 0.0015, i: args[1] ?? 0.0002, d: args[2] ?? 0.00003, sum: 0, previous: 0, derivative: 0 }), methods: {
    setGains: native('void', function ([p, i, d]) { this.p = p; this.i = i; this.d = d }),
    reset: native('void', function () { this.sum = 0; this.previous = 0; this.derivative = 0 }),
    compute: native('float', function ([setpoint, measurement, dt = 0.004]) { dt = clamp(dt, 0.001, 1); const error = setpoint - measurement; this.sum = clamp(this.sum + error * dt, -100, 100); this.derivative = .9 * this.derivative + .1 * (measurement - this.previous) / dt; const out = this.p * error + this.i * this.sum - this.d * this.derivative; this.previous = measurement; return clamp(out, -0.5, 0.5) }),
  } }
  const baroClass = { construct: () => ({ __class: 'Adafruit_BMP280' }), methods: { begin: native('bool', () => Boolean(core.env.baro)), readAltitude: native('float', () => core.env.baro?.altitude ?? 0), readPressure: native('float', () => 101325 * (1 - (core.env.baro?.altitude ?? 0) / 44330) ** 5.255), readTemperature: native('float', () => 24) } }
  const ahrsClass = { construct: () => ({ __class: 'AHRS', roll: 0, pitch: 0 }), methods: {
    update: native('void', function ([gx, gy, _gz, ax, ay, az, dt = 0.004]) { this.roll = 0.98 * (this.roll + gx * dt) + 0.02 * Math.atan2(ay, az) * 180 / Math.PI; this.pitch = 0.98 * (this.pitch + gy * dt) + 0.02 * Math.atan2(-ax, Math.hypot(ay, az)) * 180 / Math.PI }),
    getRoll: native('float', function () { return this.roll }), getPitch: native('float', function () { return this.pitch }),
  } }
  return { classes: { MPU6050: imuClass, VoltRC: rcClass, VoltFlight: flightClass, PID: pidClass, AHRS: ahrsClass, Adafruit_BMP280: baroClass }, globals: { MPU6050_ACCEL_FS_2: 0, MPU6050_ACCEL_FS_4: 1, MPU6050_ACCEL_FS_8: 2, MPU6050_ACCEL_FS_16: 3, MPU6050_GYRO_FS_250: 0, MPU6050_GYRO_FS_500: 1, MPU6050_GYRO_FS_1000: 2, MPU6050_GYRO_FS_2000: 3, Flight: flightClass.construct(), RC: rcClass.construct() } }
}

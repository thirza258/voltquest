// SI rotor model shared by the configurator and dynamics. See docs/DRONE.md for calibration.
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
export const clone = value => JSON.parse(JSON.stringify(value))
export const DEFAULT_MIXER = [[1, 1, -1, 1], [1, 1, 1, -1], [1, -1, 1, 1], [1, -1, -1, -1]]
export const GRAVITY = 9.80665
export const MODEL = Object.freeze({ rho: 1.225, ct: 0.15, cq: 0.015, slip: 0.78, efficiency: 0.78, usable: 0.8, drag: 0.16 })
export const CONFIG_FIELDS = {
  airframe: { wheelbaseMm: [100, 500, 1], frameMassG: [20, 500, 1], maxPropIn: [2, 10, 0.1] },
  motors: { kv: [500, 8000, 50], massG: [5, 100, 1], maxCurrentA: [1, 100, 1], phaseResistanceMohm: [5, 500, 1], noLoadCurrentA: [0.1, 5, 0.1] },
  props: { diameterIn: [2, 10, 0.1], pitchIn: [1, 8, 0.1], blades: [2, 4, 1], massG: [1, 20, 0.1] },
  esc: { continuousA: [1, 100, 1], burstA: [1, 150, 1], becVolts: [3, 6, 0.1], becAmps: [0.1, 5, 0.1] },
  battery: { cells: [2, 6, 1], capacityMah: [300, 6000, 50], cRating: [1, 150, 1], massG: [30, 800, 1], internalResistanceMohm: [1, 200, 1] },
}
export const DEFAULT_CONFIG = {
  schemaVersion: 1, name: 'My 5-inch freestyle',
  airframe: { class: 'quad_x', wheelbaseMm: 220, frameMassG: 110, maxPropIn: 5.1 },
  motors: { count: 4, kv: 1750, stator: '2207', massG: 32, maxCurrentA: 35, phaseResistanceMohm: 65, noLoadCurrentA: 1.1 },
  props: { diameterIn: 5.1, pitchIn: 4.6, blades: 3, massG: 4.5 },
  esc: { kind: '4in1', continuousA: 45, burstA: 55, protocol: 'pwm', becVolts: 5, becAmps: 2 },
  battery: { cells: 4, chemistry: 'lipo', capacityMah: 1500, cRating: 95, massG: 178, internalResistanceMohm: 12 },
  fc: { board: 'esp32', carrier: 'fc_carrier_esp32', imu: 'imu_mpu6050', baro: 'baro_bmp280' },
  extras: [{ id: 'rx_elrs_2400', massG: 3 }], payloadG: 0,
}
export const PRESETS = [
  { id: 'freestyle', config: DEFAULT_CONFIG },
  { id: 'micro', config: { ...clone(DEFAULT_CONFIG), name: '3-inch trainer', airframe: { class: 'quad_x', wheelbaseMm: 150, frameMassG: 45, maxPropIn: 3.1 }, motors: { ...DEFAULT_CONFIG.motors, kv: 4600, stator: '1404', massG: 9, maxCurrentA: 20 }, props: { diameterIn: 3, pitchIn: 2.5, blades: 3, massG: 1.5 }, battery: { ...DEFAULT_CONFIG.battery, cells: 3, capacityMah: 850, massG: 75 } } },
  { id: 'cruiser', config: { ...clone(DEFAULT_CONFIG), name: '7-inch cruiser', airframe: { class: 'quad_x', wheelbaseMm: 320, frameMassG: 160, maxPropIn: 7.1 }, motors: { ...DEFAULT_CONFIG.motors, kv: 1300, stator: '2806', massG: 48, maxCurrentA: 45 }, props: { diameterIn: 7, pitchIn: 4, blades: 2, massG: 8 }, battery: { ...DEFAULT_CONFIG.battery, cells: 4, capacityMah: 2200, massG: 240 } } },
]

export function validateConfig(config) {
  const fail = message => { throw new Error(message) }
  if (!config || config.schemaVersion !== 1 || config.airframe?.class !== 'quad_x' || config.motors?.count !== 4) fail('Use a version 1 quad-X configuration with four motors.')
  for (const [section, fields] of Object.entries(CONFIG_FIELDS)) for (const [key, [lo, hi]] of Object.entries(fields)) {
    const n = config[section]?.[key]
    if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi) fail(`${section}.${key} must be between ${lo} and ${hi}.`)
  }
  if (!Number.isInteger(config.battery.cells) || !Number.isInteger(config.props.blades)) fail('Cell and blade counts must be whole numbers.')
  if (typeof config.name !== 'string' || config.name.length > 80) fail('Build name must be text up to 80 characters.')
  if (!['esp32', 'esp32s3'].includes(config.fc?.board) || config.fc.carrier !== 'fc_carrier_esp32') fail('Choose an ESP32 carrier.')
  if (!['imu_mpu6050', null].includes(config.fc.imu) || !['baro_bmp280', null].includes(config.fc.baro)) fail('Unknown flight sensor.')
  if (!['4in1', 'single'].includes(config.esc.kind) || !['pwm', 'oneshot125', 'dshot600'].includes(config.esc.protocol) || config.battery.chemistry !== 'lipo') fail('Unsupported ESC or battery type.')
  if (!['1404', '2207', '2806'].includes(config.motors.stator)) fail('Unknown motor stator.')
  if (!Array.isArray(config.extras) || config.extras.length > 8 || config.extras.some(e => !e || !['rx_elrs_2400', 'gps', 'prop_guards', 'smoke_stopper', 'thrust_stand'].includes(e.id) || !Number.isFinite(e.massG) || e.massG < 0 || e.massG > 200)) fail('Invalid accessory list.')
  if (config.mixer !== undefined && (!Array.isArray(config.mixer) || config.mixer.length !== 4 || config.mixer.some(row => !Array.isArray(row) || row.length !== 4 || row[0] !== 1 || row.some(n => !Number.isFinite(n) || Math.abs(n) > 1)))) fail('Mixer must contain four [1, roll, pitch, yaw] rows with coefficients between -1 and 1.')
  if (!Number.isFinite(config.payloadG) || config.payloadG !== 0) fail('Payloads are outside the drone teaching model.')
  return config
}

export function rotor(config, rpm, voltage, fitted = true) {
  const d = config.props.diameterIn * 0.0254
  const n = rpm / 60
  const family = (1 + 0.4 * (config.props.blades - 2)) * Math.sqrt(config.props.pitchIn / config.props.diameterIn / 0.75)
  const thrustN = fitted ? MODEL.ct * family * MODEL.rho * n * n * d ** 4 : 0
  const torqueNm = fitted ? MODEL.cq * family * MODEL.rho * n * n * d ** 5 : 0
  const currentA = rpm > 1 ? torqueNm * n * 2 * Math.PI / (MODEL.efficiency * Math.max(voltage, 1)) + config.motors.noLoadCurrentA : 0
  return { rpm, omega: n * 2 * Math.PI, thrustN, torqueNm, currentA }
}

export function deriveConfig(c) {
  // Carrier 18 g (includes FC/IMU/baro), ESC 15 g, cabling/connectors 12 g.
  const auwG = c.airframe.frameMassG + 4 * (c.motors.massG + c.props.massG) + c.battery.massG + 45 + c.extras.reduce((n, e) => n + e.massG, 0)
  const voc = c.battery.cells * 3.8
  const at = throttle => {
    let bus = voc
    for (let i = 0; i < 24; i++) {
      const r = rotor(c, c.motors.kv * bus * throttle * MODEL.slip, bus)
      bus = (bus + Math.max(0, voc - (4 * r.currentA + 0.3) * (c.battery.internalResistanceMohm / 1000 + 0.006))) / 2
    }
    const r = rotor(c, c.motors.kv * bus * throttle * MODEL.slip, bus)
    return { ...r, bus, totalCurrentA: r.currentA * 4 + 0.3 }
  }
  const max = at(1), weightN = auwG / 1000 * GRAVITY
  let lo = 0, hi = 1
  for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (4 * at(mid).thrustN < weightN) lo = mid; else hi = mid }
  const hoverThrottle = (lo + hi) / 2, hover = at(hoverThrottle)
  const arm = c.airframe.wheelbaseMm / 1000 / 2 / Math.sqrt(2)
  const centerMass = (c.battery.massG + 45 + c.extras.reduce((n, e) => n + e.massG, 0)) / 1000
  const inertiaXY = Math.max(0.0001, 4 * (c.motors.massG + c.props.massG) / 1000 * arm * arm + c.airframe.frameMassG / 1000 * arm * arm / 3 + centerMass * 0.035 ** 2)
  return { auwG, twr: 4 * max.thrustN / weightN, hoverThrottle, hoverMinutes: c.battery.capacityMah * MODEL.usable / (hover.totalCurrentA * 1000) * 60, peakCurrentA: max.totalCurrentA, motorPeakA: max.currentA, busV: max.bus, hoverBusV: hover.bus, rpm: max.rpm, thrustN: max.thrustN, hoverCurrentA: hover.totalCurrentA, inertia: [inertiaXY, inertiaXY, inertiaXY * 2], arm }
}

export function feasibility(c) {
  const d = deriveConfig(c), warnings = []
  const add = (code, message, hint) => warnings.push({ code, message, hint, severity: 'warning' })
  if (d.twr < 1.5) add('low_twr', `TWR ${d.twr.toFixed(2)} is below 1.5.`, 'Reduce mass or increase rotor thrust.')
  if (d.twr > 10) add('high_twr', `TWR ${d.twr.toFixed(2)} exceeds 10.`, 'Use lower Kv motors for finer throttle control.')
  if (d.motorPeakA > c.esc.continuousA) add('esc_rating', `Peak ${d.motorPeakA.toFixed(1)} A per motor exceeds ESC ${c.esc.continuousA} A.`, 'Choose a higher-current ESC or smaller prop.')
  if (d.motorPeakA > c.motors.maxCurrentA) add('motor_rating', `Peak ${d.motorPeakA.toFixed(1)} A exceeds motor ${c.motors.maxCurrentA} A.`, 'Reduce prop size or Kv.')
  const packLimit = c.battery.capacityMah / 1000 * c.battery.cRating
  if (d.peakCurrentA > packLimit) add('pack_rating', `Pack peak ${d.peakCurrentA.toFixed(1)} A exceeds ${packLimit.toFixed(1)} A.`, 'Use a higher C rating or capacity.')
  if (c.props.diameterIn > c.airframe.maxPropIn || c.props.diameterIn * 25.4 > c.airframe.wheelbaseMm / Math.sqrt(2)) add('prop_clearance', `Prop ${c.props.diameterIn} in exceeds frame clearance.`, 'Fit smaller props or a wider frame.')
  if (d.hoverMinutes < 2) add('short_flight', `Estimated hover ${d.hoverMinutes.toFixed(1)} min is below 2 min.`, 'Increase pack capacity or reduce mass.')
  const maxRpm = { '1404': 65000, '2207': 45000, '2806': 35000 }[c.motors.stator]
  if (c.motors.kv * c.battery.cells * 4.2 > maxRpm) add('kv_cells', 'Kv × pack voltage exceeds this stator teaching range.', 'Reduce Kv or cell count.')
  if (!c.fc.imu) add('missing_imu', 'No IMU is selected.', 'Add an MPU6050 for feedback control.')
  if (!c.extras.some(e => e.id === 'rx_elrs_2400')) add('missing_receiver', 'No receiver is fitted.', 'Add a receiver before arming.')
  return warnings
}

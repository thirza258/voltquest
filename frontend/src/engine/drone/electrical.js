import { clamp } from './config.js'
import { mountOf } from './document.js'

export const FAILURE_HINTS = {
  arm_throttle_high: 'Lower throttle below 5% before arming.',
  wire_overcurrent: 'Power-wire heating exceeded its rating. Use a thicker or shorter conductor, then Repair.',
  reverse_polarity: 'XT60 polarity is reversed. Disconnect the pack, connect positive to VBAT and negative to GND, then Repair.',
  short_circuit: 'The pack terminals are shorted. Remove the bridging power link, then Repair.',
  esc_overcurrent: 'ESC current exceeded its rating long enough to burn it. Reduce load or increase the ESC rating.',
  motor_overheat: 'Motor winding heat exceeded the limit. Use a smaller prop or a motor with a higher current rating.',
  bec_overload: 'The BEC cannot supply the FC and receiver. Increase its amp rating; the FC has reset.',
  brownout: 'FC supply fell below 3.3 V. Check BEC wiring, pack sag and BEC capacity, then Repair.',
  lipo_overdischarge: 'Pack cell voltage fell below 3.0 V. Cutoff stopped the motors; the pack lost capacity for this run. Repair before reuse.',
  prop_direction_mismatch: 'Prop handedness opposes motor rotation: it produces downforce. Match CW/CCW before takeoff.',
  no_prop_guard: 'Remove all propellers before arming on the thrust stand.',
  desync: 'The requested motor step exceeds its response. Ramp ESC pulses more gradually.',
  crash: 'Impact damaged the airframe. Inspect the blackbox, correct the build or control gains, then Repair.',
  receiver_loss: 'Receiver signal was lost. Failsafe disarmed the motors. Restore the receiver and re-arm at low throttle.',
}

/** Pack/ESC model is separate from mechanics. Currents enter; bus voltage and enable flags leave. */
export function createElectrical(doc, compiled, warn, damage) {
  const c = doc.droneConfig, net = t => compiled.terminalToNet[t]
  const same = (a, b) => net(a) != null && net(a) === net(b)
  const partAt = mount => doc.components.find(p => mountOf(doc, p.id) === mount)
  const pack = partAt('strap'), fc = partAt('stack')
  const escs = [1, 2, 3, 4].map(i => partAt(`esc${i}`))
  const motors = [1, 2, 3, 4].map(i => partAt(`arm${i}`))
  const plus = `${pack?.id}:pos`, minus = `${pack?.id}:neg`
  const reversed = escs.some(e => e && same(plus, `${e.id}:gnd`) && same(minus, `${e.id}:vbat`))
  const shorted = same(plus, minus)
  const connected = escs.map(e => Boolean(e && same(plus, `${e.id}:vbat`) && same(minus, `${e.id}:gnd`)))
  const phase = escs.map(e => motors.findIndex(m => m && e && same(`${e.id}:phase`, `${m.id}:phase`)))
  const hasBec = escs.some((e, i) => e && connected[i] && same(`${e.id}:bec`, `${fc?.id}:${doc.mcu === 'esp32' ? 'VIN' : '5V'}`)) && same(minus, `${fc?.id}:GND`)
  const poweredModule = p => p && fc && same(`${p.id}:vcc`, `${fc.id}:3V3`) && same(`${p.id}:gnd`, `${fc.id}:GND`)
  const wireR = doc.links.filter(l => l.kind === 'power').reduce((r, l) => r + 0.0132 * 2 ** ((l.awg - 16) / 3) * l.lengthM, 0) / 4
  const powerWires = doc.links.filter(l => l.kind === 'power'), wireHeat = {}
  const heat = [0, 0, 0, 0], motorHeat = [0, 0, 0, 0]
  let soc = 1, capacityFactor = 1, cutoff = false, bus = c.battery.cells * 4.2
  let everPowered = false, brownout = false
  function step(currents, dt, damaged) {
    const currentA = currents.reduce((a, b) => a + b, 0) + (hasBec ? 0.3 : 0)
    soc = Math.max(0, soc - currentA * dt / (c.battery.capacityMah * capacityFactor * 3.6))
    const voc = c.battery.cells * (3.2 + soc)
    bus = pack && !reversed && !shorted ? Math.max(0, voc - currentA * (c.battery.internalResistanceMohm / 1000 + wireR)) : 0
    if (reversed || shorted) {
      const code = reversed ? 'reverse_polarity' : 'short_circuit'
      warn(code); for (const p of [fc, ...escs]) if (p) damage(p.id, code)
      cutoff = true
    }
    const becLoad = 0.35 + c.extras.length * 0.06
    const becV = hasBec && bus > c.battery.cells * 2.7 ? Math.min(bus - 1, c.esc.becVolts) * Math.min(1, c.esc.becAmps / becLoad) : 0
    const fcPowered = becV >= 3.3 && !damaged[fc?.id] && !cutoff
    if (hasBec && becLoad > c.esc.becAmps) warn('bec_overload')
    if (!fcPowered && everPowered && !brownout) { brownout = true; warn('brownout') }
    everPowered ||= fcPowered
    if (pack && !reversed && !shorted && bus / c.battery.cells < 3 && !cutoff) {
      cutoff = true; capacityFactor = 0.6; warn('lipo_overdischarge'); damage(pack.id, 'lipo_overdischarge')
    }
    currents.forEach((a, i) => {
      heat[i] = Math.max(0, heat[i] + (Math.max(0, (a / c.esc.continuousA) ** 2 - 1) - 0.15) * dt)
      motorHeat[i] = Math.max(0, motorHeat[i] + (a * a * c.motors.phaseResistanceMohm / 1000 - c.motors.maxCurrentA ** 2 * c.motors.phaseResistanceMohm / 1000 * 0.5) * dt)
      if (escs[i] && (heat[i] > 1.5 || a > c.esc.burstA * 1.5)) { warn('esc_overcurrent', escs[i].id); damage(escs[i].id, 'esc_overcurrent') }
      const m = motors[phase[i]]
      if (m && motorHeat[i] > 80) { warn('motor_overheat', m.id); damage(m.id, 'motor_overheat') }
    })
    for (const wire of powerWires) {
      const rating = 70 / 2 ** ((wire.awg - 12) / 3)
      const isRail = [wire.from, wire.to].some(t => /:(vcc|3V3|bec|VIN|5V)$/.test(t))
      const amps = isRail ? becLoad : currentA / 4
      const resistance = .0132 * 2 ** ((wire.awg - 16) / 3) * wire.lengthM
      wireHeat[wire.id] = Math.max(0, (wireHeat[wire.id] ?? 0) + (amps * amps - rating * rating) * resistance * dt)
      if (wireHeat[wire.id] > 2) { warn('wire_overcurrent', wire.id); damage(wire.id, 'wire_overcurrent') }
    }
    const burntWire = powerWires.some(w => damaged[w.id])
    return { V_bus: bus, escEnabled: escs.map((e, i) => Boolean(e && connected[i] && phase[i] >= 0 && fcPowered && !damaged[e.id] && !damaged[motors[phase[i]]?.id] && !burntWire)), currentA, soc: clamp(soc, 0, 1), becV, fcPowered, brownout, cutoff, capacityFactor }
  }
  return { step, escs, motors, phase, poweredModule }
}

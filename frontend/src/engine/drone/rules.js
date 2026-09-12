import { deriveConfig } from './config.js'
import { mountOf } from './document.js'

const result = (passed, detail) => ({ passed: Boolean(passed), detail })
const axisOf = axis => ['roll', 'pitch', 'yaw'].indexOf(axis)
function windowRows(f, ms) { return f.blackbox.filter(r => r.t >= f.t - ms * 1000) }
function held(f, ms, predicate) {
  const rows = windowRows(f, ms)
  return rows.length > 0 && f.t - rows[0].t >= ms * 1000 - 20000 && f.t >= ms * 1000 && rows.every(predicate)
}
export const DRONE_RULES = {
  drone_config_between(r, ctx) { const n = ctx.doc?.kind === 'drone' ? deriveConfig(ctx.doc.droneConfig)[r.field] : NaN; return result(Number.isFinite(n) && n >= (r.min ?? -Infinity) && n <= (r.max ?? Infinity), `${r.field}: ${Number(n).toFixed(2)}; target ${r.min ?? '−∞'}…${r.max ?? '∞'}`) },
  prop_fitted(r, ctx) { const props = ctx.doc.components.filter(p => p.type === 'drone_prop'); return result((!r.fitted || props.length === 4) && props.every(p => p.props.fitted === r.fitted), r.fitted ? 'Fit all four props for flight.' : 'Remove all four props for bench testing.') },
  motor_direction(r, ctx) { const motor = ctx.doc.components.find(p => mountOf(ctx.doc, p.id) === `arm${r.motor}`); return result(motor?.props.direction === r.direction, `Motor ${r.motor} must rotate ${r.direction}.`) },
  esc_pulse_between(r, ctx) { const f = ctx.sim.flight, i = r.motor - 1; return result(f && held(f, r.forMs ?? 0, row => { const us = 1000 + row.motorOutputs[i] * 1000; return us >= r.minUs && us <= r.maxUs }), `Motor ${r.motor}: hold ${r.minUs}–${r.maxUs} µs for ${r.forMs ?? 0} ms.`) },
  esc_armed_before_spin(r, ctx) { const f = ctx.sim.flight; return result(f && f.rpm.some((rpm, i) => rpm > 100 && f.escArmed[i]), 'Hold a low ESC pulse for one second, then ARM and spin a motor.') },
  armed_state(r, ctx) { const f = ctx.sim.flight, state = r.atMs == null ? f : f?.blackbox.find(row => Math.abs(row.t / 1000 - r.atMs) <= 20); return result(state?.armed === r.armed, `Arm state must be ${r.armed}${r.atMs == null ? '' : ` at ${r.atMs} ms`}.`) },
  attitude_within(r, ctx) { const f = ctx.sim.flight, axis = axisOf(r.axis); return result(f && axis >= 0 && held(f, r.forMs, row => Math.abs(row.attitude[axis]) <= r.maxDeg), `Keep ${r.axis} within ±${r.maxDeg}° for ${r.forMs} ms.`) },
  hover_held(r, ctx) { const f = ctx.sim.flight, rows = f ? windowRows(f, r.forMs) : [], origin = rows[0]?.position; return result(f && !f.crashed && held(f, r.forMs, row => row.position[2] >= r.minAltitudeM && Math.hypot(row.position[0] - origin[0], row.position[1] - origin[1]) <= r.maxDriftM), `Hover above ${r.minAltitudeM} m with drift below ${r.maxDriftM} m for ${r.forMs} ms.`) },
  gates_passed(r, ctx) { const f = ctx.sim.flight; return result(f && f.gatesPassed >= r.count && (f.gateTimes[r.count - 1] ?? Infinity) <= (r.withinMs ?? Infinity), `Fly through ${r.count} gates in order.`) },
  landed_safely(r, ctx) { const f = ctx.sim.flight; return result(f?.landed && !f.crashed && f.impactMs2 <= r.maxImpactMs2, 'Take off, then land with a gentle impact.') },
  no_crash(r, ctx) { return result(ctx.sim.flight && !ctx.sim.flight.crashed, 'Finish without a crash.') },
  blackbox_oscillation(r, ctx) { const f = ctx.sim.flight, axis = axisOf(r.axis), rows = f ? windowRows(f, r.windowMs) : [], values = rows.map(row => row.attitude[axis]); return result(f && axis >= 0 && held(f, r.windowMs, () => true) && Math.max(...values) - Math.min(...values) <= r.maxAmplitudeDeg, `Reduce ${r.axis} oscillation below ${r.maxAmplitudeDeg}° over ${r.windowMs} ms.`) },
  imu_read_seen(r, ctx) { return result((ctx.sim.flight?.imuReads ?? 0) >= r.minSamples, `Read at least ${r.minSamples} connected IMU samples.`) },
}
export const DRONE_RUNNING_RULES = Object.keys(DRONE_RULES).filter(k => !['drone_config_between', 'prop_fitted', 'motor_direction'].includes(k))

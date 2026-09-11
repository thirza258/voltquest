/**
 * Model elements → MNA branches — CONTRACTS §5.2.
 *
 * `compileCircuit` turns every component's registry model into `Element`s whose pins are net ids. This module
 * turns those elements, plus the dynamic state (controls, MCU pin modes, module outputs) and a solve
 * configuration (PWM combination, probe pass, forced logic outputs), into the linear branches the solver
 * stamps. Piecewise-linear parts (diodes, NPN transistors) read their region from the state vector; the
 * violation helpers below tell the PWL loop which region to move to.
 */
import { ldrOhms } from '../components/registry.js'
import { conductance, gBranch, iBranch, vccsBranch } from './mna.js'

/** Base-emitter resistance of a conducting NPN (Ω). */
export const NPN_RBE = 10
/** Collector-emitter resistance in saturation (Ω). */
export const NPN_RCE = 1
/** Pull-up each level-shifter channel side has to its own reference rail (Ω). */
export const SHIFTER_PULLUP_OHMS = 10000
/** Series resistance a level-shifter channel drives the opposite side LOW through (Ω). */
export const SHIFTER_DRIVE_OHMS = 50
/** Series resistance of an MCU power pin (Ω). */
export const SUPPLY_SERIES_OHMS = 0.1
/** A level-shifter rail below this many volts counts as unpowered. */
export const SHIFTER_MIN_RAIL_V = 1
/** Fraction of the rail below which a shifter channel side counts as externally driven LOW. */
export const SHIFTER_LOW_RATIO = 0.3

/** Diode / NPN region codes used in the PWL state vector. */
export const DIODE_OFF = 0
export const DIODE_ON = 1
export const NPN_OFF = 0
export const NPN_ACTIVE = 1
export const NPN_SAT = 2

/** Element kinds that carry a piecewise-linear region in the state vector. */
export function isPwlKind(kind) {
  return kind === 'diode' || kind === 'npn'
}

/**
 * Per-evaluation context: net index lookup, resolved controls, damage sets and the element → net index table.
 * Built once per `evaluateCircuit` call and reused by every solve.
 *
 * @param {object} compiled CompiledCircuit (§5.1)
 * @param {object} dynamicState §5.3
 */
export function createContext(compiled, dynamicState) {
  const netIndex = new Map()
  compiled.nets.forEach((net, i) => netIndex.set(net.id, i))
  const elements = compiled.elements ?? []
  const elementNets = elements.map((el) => {
    const out = {}
    for (const [role, netId] of Object.entries(el.pins ?? {})) out[role] = netIndex.has(netId) ? netIndex.get(netId) : -1
    return out
  })
  const controls = dynamicState?.controls ?? {}
  const componentIndex = compiled.componentIndex ?? {}
  const damaged = new Set(Object.entries(dynamicState?.damaged ?? {}).filter(([, on]) => on).map(([id]) => id))
  const burntPins = new Set(Object.entries(dynamicState?.burntPins ?? {}).filter(([, on]) => on).map(([name]) => name))

  return {
    compiled,
    elements,
    elementNets,
    netIndex,
    netCount: compiled.nets.length,
    refIndex: netIndex.has(compiled.groundNet) ? netIndex.get(compiled.groundNet) : -1,
    board: compiled.mcu?.board ?? null,
    vcc: compiled.mcu?.board?.vcc ?? 5,
    powered: dynamicState?.powered !== false && Boolean(compiled.mcu),
    mcuPins: dynamicState?.mcuPins ?? {},
    moduleOutputs: dynamicState?.moduleOutputs ?? {},
    damaged,
    burntPins,
    componentIndex,
    /** Control value with the registry default as fallback (`lightLevel`, `pressed`, `value`, …). */
    control(componentId, field) {
      const own = controls[componentId]
      if (own && own[field] !== undefined) return own[field]
      return componentIndex[componentId]?.controls?.[field]
    },
  }
}

/** Resistance of a resistor element: a number, `$props` already resolved, or an LDR curve from a control. */
export function resolveOhms(element, ctx) {
  const ohms = element.ohms
  if (typeof ohms === 'number') return ohms
  if (ohms && typeof ohms === 'object' && ohms.fromControl) {
    const value = ctx.control(element.componentId, ohms.fromControl)
    if (ohms.curve === 'ldr') return ldrOhms(value)
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
  }
  const numeric = Number(ohms)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
}

/** Whether a `switch` element is closed for the current controls / relay states. */
function switchClosed(element, ctx, config) {
  const when = element.closedWhen ?? {}
  if (when.control) return Boolean(ctx.control(element.componentId, when.control))
  if (when.relayOn !== undefined) return Boolean(config.relayOn?.[element.componentId]) === Boolean(when.relayOn)
  return false
}

/** Wiper position of a pot element, clamped to 0..1. */
export function wiperOf(element, ctx) {
  const raw = element.wiper?.control ? ctx.control(element.componentId, element.wiper.control) : element.wiper
  const value = Number(raw)
  if (!Number.isFinite(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}

/** The two pot branch resistances (§5.2 floors at 1 Ω so a wiper at 0 or 1 never divides by zero). */
export function potResistances(element, ctx) {
  const w = wiperOf(element, ctx)
  const ohms = resolveOhms(element, ctx)
  return { upper: Math.max(ohms * (1 - w), 1), lower: Math.max(ohms * w, 1), w }
}

/** Logic level a `logic_out` element drives (forced by the caller, else `dynamicState.moduleOutputs`). */
export function logicLevel(element, ctx, config) {
  const pinId = element.pinIds?.out ?? element.pins?.out
  const forced = config.forceLogicOut?.[element.componentId]?.[pinId]
  if (forced !== undefined) return forced ? 1 : 0
  return ctx.moduleOutputs?.[element.componentId]?.[pinId] ? 1 : 0
}

/**
 * HIGH voltage of a `logic_out`: a fixed number, or the operating-point voltage of the module's own vcc net
 * (resolved by the probe pass and handed in through `config.moduleVcc`). Returns 0 when unresolved.
 */
export function resolveHighV(element, ctx, config) {
  if (typeof element.highV === 'number') return element.highV
  if (element.highV === 'vcc') return config.moduleVcc?.[element.componentId] ?? 0
  return 0
}

/** MCU pin driver description for the current mode / PWM combination, or null for a high-Z pin. */
function pinDriver(pin, ctx, config) {
  if (ctx.burntPins.has(pin.name)) return null
  const board = ctx.board
  const state = ctx.mcuPins?.[pin.name] ?? {}
  const mode = state.mode ?? 'input'
  const vcc = ctx.vcc
  switch (mode) {
    case 'output':
      return { volts: state.level ? vcc : 0, ohms: board.pinOutputResistance }
    case 'pwm': {
      const duty = Math.min(1, Math.max(0, Number(state.duty ?? 0)))
      const phase = config.pwm?.[pin.name] ?? 'avg'
      const volts = phase === 'high' ? vcc : phase === 'low' ? 0 : duty * vcc
      return { volts, ohms: board.pinOutputResistance }
    }
    case 'dac': {
      const value = Math.min(vcc, Math.max(0, Number(state.value ?? 0)))
      return { volts: value, ohms: board.pinOutputResistance }
    }
    case 'input_pullup':
      return { volts: vcc, ohms: board.pullupOhms }
    case 'input_pulldown':
      return { volts: 0, ohms: board.pullupOhms }
    default:
      return null
  }
}

/**
 * Build every branch of one solve.
 *
 * @param {object} ctx from `createContext`
 * @param {Uint8Array} state PWL region per element
 * @param {object} config `{ probe, pwm, forceLogicOut, relayOn, moduleVcc, modulePowered, shifter }`
 * @returns {object[]} branches for `solveBranches`
 */
export function buildBranches(ctx, state, config = {}) {
  const branches = []
  const { elements, elementNets, refIndex } = ctx
  const idx = (ei, role) => {
    const netIdx = elementNets[ei][role]
    return netIdx === undefined ? -1 : netIdx
  }

  for (let ei = 0; ei < elements.length; ei++) {
    const el = elements[ei]
    if (ctx.damaged.has(el.componentId)) continue
    switch (el.kind) {
      case 'resistor': {
        const g = conductance(resolveOhms(el, ctx))
        branches.push(gBranch(idx(ei, 'a'), idx(ei, 'b'), g, 0, { element: ei, primary: true }))
        break
      }
      case 'diode': {
        if (state[ei] !== DIODE_ON) break
        branches.push(gBranch(idx(ei, 'anode'), idx(ei, 'cathode'), conductance(el.rOn), el.vf, { element: ei, primary: true }))
        break
      }
      case 'switch': {
        if (!switchClosed(el, ctx, config)) break
        branches.push(gBranch(idx(ei, 'a'), idx(ei, 'b'), conductance(el.rOn ?? 0.1), 0, { element: ei, primary: true }))
        break
      }
      case 'pot': {
        const { upper, lower } = potResistances(el, ctx)
        branches.push(gBranch(idx(ei, 'end1'), idx(ei, 'wiper'), conductance(upper), 0, { element: ei, primary: true }))
        branches.push(gBranch(idx(ei, 'wiper'), idx(ei, 'end2'), conductance(lower), 0, { element: ei }))
        break
      }
      case 'npn': {
        const region = state[ei]
        if (region === NPN_OFF) break
        const b = idx(ei, 'b')
        const e = idx(ei, 'e')
        const c = idx(ei, 'c')
        branches.push(gBranch(b, e, conductance(NPN_RBE), el.vbeOn ?? 0.7, { element: ei }))
        if (region === NPN_SAT) {
          branches.push(gBranch(c, e, conductance(NPN_RCE), el.vceSat ?? 0.2, { element: ei }))
        } else {
          const beta = el.beta ?? 100
          const gm = beta / NPN_RBE
          branches.push(vccsBranch(c, e, b, e, gm, { element: ei }))
          branches.push(iBranch(e, c, (beta * (el.vbeOn ?? 0.7)) / NPN_RBE, { element: ei }))
        }
        break
      }
      case 'logic_out': {
        if (!ctx.powered) break
        if (config.modulePowered && config.modulePowered[el.componentId] === false) break
        const level = logicLevel(el, ctx, config)
        const highV = resolveHighV(el, ctx, config)
        if (level && (config.probe ? el.highV === 'vcc' : highV <= 0)) break
        const gnd = el.gndNet !== undefined && ctx.netIndex.has(el.gndNet) ? ctx.netIndex.get(el.gndNet) : refIndex
        branches.push(
          gBranch(idx(ei, 'out'), gnd, conductance(el.rOut ?? 50), level ? highV : 0, { element: ei, primary: true, drive: true }),
        )
        break
      }
      case 'level_shifter': {
        if (!ctx.powered) break
        const shifter = config.shifter?.[el.componentId]
        if (shifter && shifter.powered === false) break
        const hv = idx(ei, 'hv')
        const lv = idx(ei, 'lv')
        const gndH = idx(ei, 'gnd_h')
        const gndL = idx(ei, 'gnd_l')
        const pullup = conductance(SHIFTER_PULLUP_OHMS)
        const drive = conductance(SHIFTER_DRIVE_OHMS)
        const channels = el.channelNets ?? []
        channels.forEach((channel, ci) => {
          const hvSide = ctx.netIndex.has(channel.hv) ? ctx.netIndex.get(channel.hv) : -1
          const lvSide = ctx.netIndex.has(channel.lv) ? ctx.netIndex.get(channel.lv) : -1
          branches.push(gBranch(hvSide, hv, pullup, 0, { element: ei }))
          branches.push(gBranch(lvSide, lv, pullup, 0, { element: ei }))
          if (config.probe) return
          const driven = shifter?.drive?.[ci]
          if (driven === 'lv') branches.push(gBranch(lvSide, gndL, drive, 0, { element: ei, channel: ci }))
          else if (driven === 'hv') branches.push(gBranch(hvSide, gndH, drive, 0, { element: ei, channel: ci }))
        })
        break
      }
      default:
        break
    }
  }

  // MCU power pins and GPIO drivers.
  const mcu = ctx.compiled.mcu
  if (ctx.powered && mcu) {
    for (const pin of mcu.board.pins) {
      const netId = mcu.pinNet[pin.name]
      if (!netId) continue
      const node = ctx.netIndex.has(netId) ? ctx.netIndex.get(netId) : -1
      if (node === -1 || node === refIndex) continue
      if (pin.kind === 'power' && pin.volts != null) {
        branches.push(
          gBranch(node, refIndex, conductance(SUPPLY_SERIES_OHMS), pin.volts, { pinName: pin.name, source: true, supply: true }),
        )
        continue
      }
      if (pin.kind !== 'digital' && pin.kind !== 'analog') continue
      const driver = pinDriver(pin, ctx, config)
      if (!driver) continue
      branches.push(gBranch(node, refIndex, conductance(driver.ohms), driver.volts, { pinName: pin.name, source: true }))
    }
  }
  return branches
}

/** Operating point of an NPN element for the current region and voltages. */
export function npnOperating(element, region, v, nets) {
  const vb = nets.b >= 0 ? v[nets.b] : 0
  const ve = nets.e >= 0 ? v[nets.e] : 0
  const vc = nets.c >= 0 ? v[nets.c] : 0
  const vbe = vb - ve
  const vce = vc - ve
  const beta = element.beta ?? 100
  const vbeOn = element.vbeOn ?? 0.7
  const vceSat = element.vceSat ?? 0.2
  if (region === NPN_OFF) return { vbe, vce, ib: 0, ic: 0, beta }
  const ib = (vbe - vbeOn) / NPN_RBE
  const ic = region === NPN_SAT ? (vce - vceSat) / NPN_RCE : beta * ib
  return { vbe, vce, ib, ic, beta }
}

/** Current through a diode element in its current region (anode → cathode). */
export function diodeCurrent(element, region, v, nets) {
  if (region !== DIODE_ON) return 0
  const va = nets.anode >= 0 ? v[nets.anode] : 0
  const vk = nets.cathode >= 0 ? v[nets.cathode] : 0
  return (va - vk - element.vf) / Math.max(element.rOn, 1e-3)
}

/**
 * Largest piecewise-linear violation of one element, in volts (current violations are scaled by the branch
 * resistance so every magnitude is comparable). Returns null when the element is in a consistent region.
 * @returns {{ target: number, magnitude: number }|null}
 */
export function elementViolation(element, region, v, nets) {
  if (element.kind === 'diode') {
    const va = nets.anode >= 0 ? v[nets.anode] : 0
    const vk = nets.cathode >= 0 ? v[nets.cathode] : 0
    const vak = va - vk
    if (region === DIODE_OFF) return vak > element.vf ? { target: DIODE_ON, magnitude: vak - element.vf } : null
    const current = diodeCurrent(element, region, v, nets)
    return current < 0 ? { target: DIODE_OFF, magnitude: -current * Math.max(element.rOn, 1e-3) } : null
  }
  if (element.kind === 'npn') {
    const op = npnOperating(element, region, v, nets)
    const vbeOn = element.vbeOn ?? 0.7
    const vceSat = element.vceSat ?? 0.2
    if (region === NPN_OFF) return op.vbe > vbeOn ? { target: NPN_ACTIVE, magnitude: op.vbe - vbeOn } : null
    if (op.ib <= 0) return { target: NPN_OFF, magnitude: Math.max(vbeOn - op.vbe, 1e-9) }
    if (region === NPN_ACTIVE) return op.vce < vceSat ? { target: NPN_SAT, magnitude: vceSat - op.vce } : null
    if (op.ic < 0) return { target: NPN_ACTIVE, magnitude: -op.ic * NPN_RCE }
    if (op.ic > op.beta * op.ib) return { target: NPN_ACTIVE, magnitude: (op.ic - op.beta * op.ib) * NPN_RCE }
    return null
  }
  return null
}

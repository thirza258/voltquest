/**
 * DC operating point and failure analysis — CONTRACTS §5.2/§5.3/§5.4.
 *
 * One `evaluateCircuit` call runs, in order:
 *   1. a probe solve (level-shifter pass 1) that resolves module supply voltages, relay coil states and which
 *      shifter channel sides are externally driven LOW;
 *   2. the operating point — a single solve, or the 2^k PWM combinations (k ≤ 3) averaged by duty cycle, or a
 *      per-pin two-solve blend for k > 3;
 *   3. the worst case (every PWM pin HIGH), which drives every overcurrent warning and blow event;
 *   4. a stress solve forcing every logic output above `gpioMaxV` HIGH, for the overvoltage check.
 *
 * Each solve is a Katzenelson-style piecewise-linear loop: solve the linear system, find the region violations,
 * flip only the single largest one, and stop on a repeated state vector (reporting the least-violating
 * solution with `converged:false` and a `solver_unstable` warning).
 */
import { branchCurrent, solveBranches } from './mna.js'
import {
  NPN_OFF,
  SHIFTER_LOW_RATIO,
  SHIFTER_MIN_RAIL_V,
  buildBranches,
  createContext,
  elementViolation,
  isPwlKind,
  npnOperating,
  potResistances,
  resolveHighV,
} from './models.js'

/** Katzenelson iteration cap (§5.2). */
const MAX_PWL_ITERATIONS = 64
/** Above this many simultaneously-PWM pins we stop enumerating combinations (§5.2). */
const MAX_ENUMERATED_PWM = 3
/** Relative slack so a current that lands exactly on a rating still blows (the gmin leak shaves ~1e-9 mA). */
const BLOW_EPSILON = 1e-6
/** Minimum LED current (mA) that counts as "lit". */
const MIN_LIT_MA = 0.1
/** Minimum per-segment current (mA) that lights a seven-segment segment. */
const MIN_SEGMENT_MA = 1
/** Warnings that survive `powered:false` (§5.3). */
const UNPOWERED_WARNINGS = new Set(['no_ground', 'unpowered_module'])

/** Previous PWL state vector per CompiledCircuit, so the next evaluation warm-starts from it. */
const warmStates = new WeakMap()

/** Voltage of a net id in a solved vector (0 for the reference / unknown nets). */
function netV(ctx, voltages, netId) {
  if (netId == null) return 0
  const index = ctx.netIndex.get(netId)
  return index === undefined ? 0 : voltages[index]
}

function formatMa(amps) {
  const ma = amps * 1000
  return Math.abs(ma) >= 100 ? ma.toFixed(0) : ma.toFixed(1)
}

function formatVolts(v) {
  return v.toFixed(2)
}

/**
 * One piecewise-linear solve.
 * @returns {{ voltages: Float64Array, branches: object[], state: Uint8Array, converged: boolean, ok: boolean, violation: number }}
 */
function solvePWL(ctx, config, baseState) {
  const state = Uint8Array.from(baseState)
  const visited = new Set()
  let best = null
  for (let iteration = 0; iteration < MAX_PWL_ITERATIONS; iteration++) {
    const key = state.join('')
    if (visited.has(key)) break
    visited.add(key)

    const branches = buildBranches(ctx, state, config)
    const { voltages, ok } = solveBranches(branches, ctx.netCount, ctx.refIndex)
    let worst = null
    let total = 0
    for (let ei = 0; ei < ctx.elements.length; ei++) {
      const element = ctx.elements[ei]
      if (!isPwlKind(element.kind) || ctx.damaged.has(element.componentId)) continue
      const violation = elementViolation(element, state[ei], voltages, ctx.elementNets[ei])
      if (!violation) continue
      total += violation.magnitude
      if (!worst || violation.magnitude > worst.magnitude) worst = { element: ei, ...violation }
    }
    const result = { voltages, branches, state: Uint8Array.from(state), converged: !worst, ok, violation: total }
    if (!worst) return result
    if (!best || total < best.violation) best = result
    state[worst.element] = worst.target
  }
  return best ? { ...best, converged: false } : { voltages: new Float64Array(ctx.netCount), branches: [], state, converged: false, ok: false, violation: 0 }
}

/** Per-solve currents: element through-currents, per-pin source currents and the total supply current. */
function extract(ctx, solve) {
  const currents = new Float64Array(ctx.elements.length)
  const pinCurrents = {}
  let supply = 0
  for (const branch of solve.branches) {
    const current = branchCurrent(branch, solve.voltages)
    if (branch.primary && branch.element !== undefined) currents[branch.element] += current
    if (branch.source && branch.pinName) {
      const sourcing = -current
      pinCurrents[branch.pinName] = (pinCurrents[branch.pinName] ?? 0) + sourcing
      if (sourcing > 0) supply += sourcing
    }
  }
  for (let ei = 0; ei < ctx.elements.length; ei++) {
    const element = ctx.elements[ei]
    if (element.kind !== 'npn' || ctx.damaged.has(element.componentId)) continue
    currents[ei] = npnOperating(element, solve.state[ei], solve.voltages, ctx.elementNets[ei]).ic
  }
  return { currents, pinCurrents, supply }
}

/** PWM pins of the current state: duty 0/1 collapses to a plain output, the rest are switched. */
function pwmPinsOf(ctx) {
  const switching = []
  const fixed = {}
  for (const [pinName, state] of Object.entries(ctx.mcuPins ?? {})) {
    if (state?.mode !== 'pwm' || ctx.burntPins.has(pinName)) continue
    // A pin state left over from another board has no driver, so it must not count towards the 2^k budget.
    if (!ctx.compiled.mcu?.pinNet[pinName]) continue
    const duty = Math.min(1, Math.max(0, Number(state.duty ?? 0)))
    if (duty <= 0) fixed[pinName] = 'low'
    else if (duty >= 1) fixed[pinName] = 'high'
    else switching.push({ pinName, duty })
  }
  switching.sort((a, b) => (a.pinName < b.pinName ? -1 : 1))
  return { switching, fixed }
}

/** Probe pass: module supplies, relay coils and level-shifter channel directions (§5.2 items 4–6). */
function probeDynamics(ctx, baseState, basePwm) {
  const probe = solvePWL(ctx, { probe: true, pwm: basePwm }, baseState)
  const v = probe.voltages
  const moduleVcc = {}
  const modulePowered = {}
  const relayOn = {}
  const shifter = {}

  for (const info of Object.values(ctx.componentIndex)) {
    if (info.vccNet == null) continue
    const supplyV = netV(ctx, v, info.vccNet) - netV(ctx, v, info.gndNet)
    moduleVcc[info.id] = supplyV
    if (info.minV != null) modulePowered[info.id] = ctx.powered && supplyV >= info.minV
  }

  for (let ei = 0; ei < ctx.elements.length; ei++) {
    const element = ctx.elements[ei]
    const nets = ctx.elementNets[ei]
    if (element.kind === 'switch' && element.relayInNet) {
      const info = ctx.componentIndex[element.componentId]
      const coilV = netV(ctx, v, element.relayInNet) - netV(ctx, v, info?.gndNet)
      const supplyV = moduleVcc[element.componentId] ?? 0
      relayOn[element.componentId] =
        ctx.powered && modulePowered[element.componentId] !== false && coilV > (element.relayThreshold ?? 0.6) * supplyV
    } else if (element.kind === 'level_shifter') {
      const hv = nets.hv >= 0 ? v[nets.hv] : 0
      const lv = nets.lv >= 0 ? v[nets.lv] : 0
      const gndH = nets.gnd_h >= 0 ? v[nets.gnd_h] : 0
      const gndL = nets.gnd_l >= 0 ? v[nets.gnd_l] : 0
      const railH = hv - gndH
      const railL = lv - gndL
      const powered = ctx.powered && railH >= SHIFTER_MIN_RAIL_V && railL >= SHIFTER_MIN_RAIL_V
      const drive = (element.channelNets ?? []).map((channel) => {
        if (!powered) return null
        const sideH = netV(ctx, v, channel.hv) - gndH
        const sideL = netV(ctx, v, channel.lv) - gndL
        if (sideH < SHIFTER_LOW_RATIO * railH) return 'lv'
        if (sideL < SHIFTER_LOW_RATIO * railL) return 'hv'
        return null
      })
      shifter[element.componentId] = { powered, railH, railL, drive }
    }
  }
  return { probe, moduleVcc, modulePowered, relayOn, shifter }
}

/**
 * Marks every net with a galvanic path to the reference node; the rest are floating (§5.2).
 *
 * The stamped branches cover resistors, closed switches, conducting diodes, pull-ups and every driver. Diodes
 * that happen to be off are added as edges too — an LED in series with a pin is a real (if weak) connection,
 * while an open switch or a capacitor genuinely leaves the pin hanging, which is the case the warning is for.
 */
function reachableNets(ctx, branches) {
  const reachable = new Uint8Array(ctx.netCount)
  if (ctx.refIndex < 0) return reachable
  const adjacency = new Map()
  const link = (a, b) => {
    if (a < 0 || b < 0 || a === b) return
    if (!adjacency.has(a)) adjacency.set(a, [])
    if (!adjacency.has(b)) adjacency.set(b, [])
    adjacency.get(a).push(b)
    adjacency.get(b).push(a)
  }
  for (const branch of branches) {
    link(branch.a, branch.b)
    if (branch.kind === 'vccs') link(branch.a, branch.cp)
  }
  for (let ei = 0; ei < ctx.elements.length; ei++) {
    const element = ctx.elements[ei]
    if (element.kind !== 'diode' || ctx.damaged.has(element.componentId)) continue
    const nets = ctx.elementNets[ei]
    link(nets.anode, nets.cathode)
  }
  const queue = [ctx.refIndex]
  reachable[ctx.refIndex] = 1
  while (queue.length) {
    const node = queue.pop()
    for (const next of adjacency.get(node) ?? []) {
      if (reachable[next]) continue
      reachable[next] = 1
      queue.push(next)
    }
  }
  return reachable
}

/** Weighted mean of several solves (PWM duty averaging). */
function averageSamples(ctx, samples) {
  const voltages = new Float64Array(ctx.netCount)
  const currents = new Float64Array(ctx.elements.length)
  const pinCurrents = {}
  let supply = 0
  let totalWeight = 0
  for (const { weight, solve, values } of samples) {
    totalWeight += weight
    for (let i = 0; i < voltages.length; i++) voltages[i] += weight * solve.voltages[i]
    for (let i = 0; i < currents.length; i++) currents[i] += weight * values.currents[i]
    for (const [pin, current] of Object.entries(values.pinCurrents)) pinCurrents[pin] = (pinCurrents[pin] ?? 0) + weight * current
    supply += weight * values.supply
  }
  if (totalWeight > 0 && Math.abs(totalWeight - 1) > 1e-12) {
    for (let i = 0; i < voltages.length; i++) voltages[i] /= totalWeight
    for (let i = 0; i < currents.length; i++) currents[i] /= totalWeight
    for (const pin of Object.keys(pinCurrents)) pinCurrents[pin] /= totalWeight
    supply /= totalWeight
  }
  return { voltages, currents, pinCurrents, supply }
}

/**
 * k > 3 fallback: two solves per PWM pin with the other PWM pins at their average voltage. Every quantity is
 * averaged over the pin that influences it most, so each element still sees its own driver switching.
 */
function blendPairs(ctx, pairs) {
  const voltages = new Float64Array(ctx.netCount)
  const currents = new Float64Array(ctx.elements.length)
  const pinCurrents = {}
  const pick = (read) => {
    let best = null
    let bestSpan = -1
    for (const pair of pairs) {
      const high = read(pair.high)
      const low = read(pair.low)
      const span = Math.abs(high - low)
      if (span > bestSpan) {
        bestSpan = span
        best = pair.duty * high + (1 - pair.duty) * low
      }
    }
    return best ?? 0
  }
  for (let i = 0; i < voltages.length; i++) voltages[i] = pick((sample) => sample.solve.voltages[i])
  for (let i = 0; i < currents.length; i++) currents[i] = pick((sample) => sample.values.currents[i])
  const pins = new Set()
  for (const pair of pairs) for (const sample of [pair.high, pair.low]) for (const pin of Object.keys(sample.values.pinCurrents)) pins.add(pin)
  for (const pin of pins) pinCurrents[pin] = pick((sample) => sample.values.pinCurrents[pin] ?? 0)
  return { voltages, currents, pinCurrents, supply: pick((sample) => sample.values.supply) }
}

/**
 * DC operating point of a compiled circuit (internal; `evaluateCircuit` and the peripheral binding both use it).
 * @param {object} compiled CompiledCircuit
 * @param {object} dynamicState §5.3
 * @param {{ forceLogicOut?: object }} [options]
 */
export function operatingPoint(compiled, dynamicState = {}, options = {}) {
  const ctx = createContext(compiled, dynamicState)
  const baseState = new Uint8Array(ctx.elements.length)
  const { switching, fixed } = pwmPinsOf(ctx)
  const basePwm = { ...fixed }
  for (const { pinName } of switching) basePwm[pinName] = 'avg'
  const dynamics = probeDynamics(ctx, baseState, basePwm)
  const config = {
    pwm: basePwm,
    forceLogicOut: options.forceLogicOut ?? null,
    moduleVcc: dynamics.moduleVcc,
    modulePowered: dynamics.modulePowered,
    relayOn: dynamics.relayOn,
    shifter: dynamics.shifter,
  }
  const solve = solvePWL(ctx, config, baseState)
  return { ctx, solve, dynamics, config, voltage: (netId) => netV(ctx, solve.voltages, netId) }
}

/**
 * Evaluate a compiled circuit for the given dynamic state (§5.4).
 * @param {object} compiled CompiledCircuit from `compileCircuit`
 * @param {object} dynamicState `{ powered, mcuPins, controls, damaged, burntPins, moduleOutputs }`
 * @returns {object} Evaluation
 */
export function evaluateCircuit(compiled, dynamicState = {}) {
  const empty = {
    ok: true,
    converged: true,
    nodeVoltages: {},
    mcuPinVoltages: {},
    supplyCurrentA: 0,
    componentStates: {},
    pinCurrents: {},
    warnings: [],
    events: [],
  }
  if (!compiled || !Array.isArray(compiled.nets)) return empty

  const ctx = createContext(compiled, dynamicState)
  const warm = warmStates.get(compiled)
  const baseState = warm && warm.length === ctx.elements.length ? Uint8Array.from(warm) : new Uint8Array(ctx.elements.length)
  const { switching, fixed } = pwmPinsOf(ctx)
  const basePwm = { ...fixed }
  for (const { pinName } of switching) basePwm[pinName] = 'avg'

  const dynamics = probeDynamics(ctx, baseState, basePwm)
  // The probe already walked the piecewise-linear regions once, so every solve below starts from its result:
  // deterministic (the probe always runs first with the same inputs) and far fewer flips on a cold document.
  const solveState = dynamics.probe.state
  const baseConfig = {
    moduleVcc: dynamics.moduleVcc,
    modulePowered: dynamics.modulePowered,
    relayOn: dynamics.relayOn,
    shifter: dynamics.shifter,
  }

  // --- operating point + worst case ---------------------------------------------------------------------------
  let averaged = null
  let worstSolve = null
  let converged = true
  let solverOk = true
  const record = (solve) => {
    converged = converged && solve.converged
    solverOk = solverOk && solve.ok
    return { solve, values: extract(ctx, solve) }
  }

  if (switching.length === 0) {
    const sample = record(solvePWL(ctx, { ...baseConfig, pwm: basePwm }, solveState))
    averaged = {
      voltages: sample.solve.voltages,
      currents: sample.values.currents,
      pinCurrents: sample.values.pinCurrents,
      supply: sample.values.supply,
    }
    worstSolve = sample
  } else if (switching.length <= MAX_ENUMERATED_PWM) {
    const samples = []
    const combinations = 1 << switching.length
    let allHigh = null
    for (let mask = 0; mask < combinations; mask++) {
      const pwm = { ...basePwm }
      let weight = 1
      switching.forEach((pin, bit) => {
        const high = (mask >> bit) & 1
        pwm[pin.pinName] = high ? 'high' : 'low'
        weight *= high ? pin.duty : 1 - pin.duty
      })
      if (weight <= 0 && mask !== combinations - 1) continue
      const sample = record(solvePWL(ctx, { ...baseConfig, pwm }, solveState))
      samples.push({ weight, ...sample })
      if (mask === combinations - 1) allHigh = sample
    }
    averaged = averageSamples(ctx, samples)
    worstSolve = allHigh ?? samples[samples.length - 1]
  } else {
    const pairs = switching.map((pin) => ({
      duty: pin.duty,
      high: record(solvePWL(ctx, { ...baseConfig, pwm: { ...basePwm, [pin.pinName]: 'high' } }, solveState)),
      low: record(solvePWL(ctx, { ...baseConfig, pwm: { ...basePwm, [pin.pinName]: 'low' } }, solveState)),
    }))
    averaged = blendPairs(ctx, pairs)
    const allHighPwm = { ...basePwm }
    for (const pin of switching) allHighPwm[pin.pinName] = 'high'
    worstSolve = record(solvePWL(ctx, { ...baseConfig, pwm: allHighPwm }, solveState))
  }
  warmStates.set(compiled, Uint8Array.from(worstSolve.solve.state))

  // --- stress solve (overvoltage) -----------------------------------------------------------------------------
  const gpioMaxV = ctx.board?.gpioMaxV ?? Infinity
  const forceLogicOut = {}
  let stressNeeded = false
  for (const element of ctx.elements) {
    if (element.kind !== 'logic_out' || ctx.damaged.has(element.componentId)) continue
    const highV = resolveHighV(element, ctx, { moduleVcc: dynamics.moduleVcc })
    if (highV <= gpioMaxV) continue
    stressNeeded = true
    const outPin = element.pinIds?.out ?? element.pins.out
    forceLogicOut[element.componentId] = { ...(forceLogicOut[element.componentId] ?? {}), [outPin]: 1 }
  }
  const allHighPwm = { ...basePwm }
  for (const pin of switching) allHighPwm[pin.pinName] = 'high'
  const stress = stressNeeded && ctx.powered ? solvePWL(ctx, { ...baseConfig, pwm: allHighPwm, forceLogicOut }, solveState) : null

  return assemble(ctx, {
    dynamics,
    averaged,
    worst: worstSolve,
    stress,
    converged,
    solverOk,
  })
}

/** Turn the solved operating point into the Evaluation shape (§5.4). */
function assemble(ctx, { dynamics, averaged, worst, stress, converged, solverOk }) {
  const compiled = ctx.compiled
  const warnings = []
  const events = []
  const componentStates = {}
  const nodeVoltages = {}
  const mcuPinVoltages = {}
  const pinCurrents = {}

  const addWarning = (warning) => {
    warnings.push({ severity: 'warning', ...warning })
    for (const id of warning.componentIds ?? []) componentStates[id]?.warnings.push(warning.code)
  }

  compiled.nets.forEach((net, index) => {
    nodeVoltages[net.id] = round(averaged.voltages[index])
  })
  const worstCurrents = worst.values.currents
  const reachable = reachableNets(ctx, worst.solve.branches)
  const reachesSource = createSourceProbe(ctx)

  // --- per-component state ------------------------------------------------------------------------------------
  for (const info of Object.values(ctx.componentIndex)) {
    componentStates[info.id] = {
      voltage: 0,
      current: 0,
      power: 0,
      brightness: 0,
      state: ctx.damaged.has(info.id) ? 'blown' : 'ok',
      warnings: [],
    }
  }
  const blown = new Set()

  for (let ei = 0; ei < ctx.elements.length; ei++) {
    const element = ctx.elements[ei]
    const info = ctx.componentIndex[element.componentId]
    const state = componentStates[element.componentId]
    if (!state) continue
    const nets = ctx.elementNets[ei]
    const damaged = ctx.damaged.has(element.componentId)
    const va = (role) => (nets[role] >= 0 ? averaged.voltages[nets[role]] : 0)
    const current = damaged ? 0 : averaged.currents[ei]
    const worstCurrent = damaged ? 0 : worstCurrents[ei]

    switch (element.kind) {
      case 'resistor': {
        const drop = va('a') - va('b')
        setTwoTerminal(state, drop, current)
        checkOvercurrent(element, info, worstCurrent, state, events, blown, addWarning)
        break
      }
      case 'diode': {
        const drop = va('anode') - va('cathode')
        const ma = Math.abs(current) * 1000
        if (Math.abs(drop) >= Math.abs(state.voltage)) state.voltage = round(drop)
        state.current = round(state.current + current, 9)
        state.power = round(Math.abs(drop * current), 9)
        const blows = checkOvercurrent(element, info, worstCurrent, state, events, blown, addWarning)
        if (element.led) {
          const lit = !damaged && !blows && ma >= MIN_LIT_MA
          const brightness = lit ? Math.min(1, Math.sqrt(ma / (element.ratedMa || 20))) : 0
          if (element.channel) {
            state.channels = { r: 0, g: 0, b: 0, ...(state.channels ?? {}) }
            state.channels[element.channel] = round(brightness, 3)
          }
          if (element.segment) {
            state.segments = state.segments ?? {}
            state.segments[element.segment] = !damaged && ma >= MIN_SEGMENT_MA
          }
          state.brightness = round(Math.max(state.brightness, brightness), 3)
          checkLedWiring(reachesSource, element, ei, nets, info, drop, worstCurrent, state, addWarning)
        }
        break
      }
      case 'switch': {
        // Relay contacts take their state from the coil below; a pushbutton reports its own control.
        if (!damaged && element.closedWhen?.control) state.state = isSwitchClosed(ctx, element, dynamics) ? 'on' : 'off'
        setTwoTerminal(state, va('a') - va('b'), current)
        break
      }
      case 'pot': {
        const { w } = potResistances(element, ctx)
        state.voltage = round(va('end1') - va('end2'))
        state.current = round(current, 9)
        state.power = round(Math.abs(state.voltage * current), 9)
        state.wiper = round(w, 4)
        state.wiperVoltage = round(va('wiper'))
        break
      }
      case 'capacitor': {
        setTwoTerminal(state, va('a') - va('b'), 0)
        break
      }
      case 'npn': {
        const op = npnOperating(element, worst.solve.state[ei], averaged.voltages, nets)
        state.state = damaged ? 'blown' : worst.solve.state[ei] === NPN_OFF ? 'off' : 'on'
        state.voltage = round(op.vce)
        state.current = round(damaged ? 0 : op.ic, 9)
        state.power = round(Math.abs(op.vce * op.ic), 9)
        state.baseCurrent = round(damaged ? 0 : op.ib, 9)
        checkOvercurrent(element, info, worstCurrent, state, events, blown, addWarning)
        break
      }
      case 'module_power': {
        const supplyV = va('vcc') - va('gnd')
        state.powered = Boolean(dynamics.modulePowered[element.componentId])
        state.voltage = round(supplyV)
        state.state = state.powered ? 'on' : 'off'
        if (!state.powered && !damaged) {
          addWarning({
            code: 'unpowered_module',
            message: `${info?.name ?? element.componentId} is not powered — VCC sees ${formatVolts(supplyV)} V but needs at least ${element.minV} V.`,
            hint: `Wire ${info?.name ?? 'the module'}'s VCC to 5V (or 3V3) and its GND to the ground rail.`,
            componentIds: [element.componentId],
            severity: 'warning',
          })
        }
        break
      }
      case 'level_shifter': {
        const shifter = dynamics.shifter[element.componentId]
        state.powered = Boolean(shifter?.powered)
        state.state = state.powered ? 'on' : 'off'
        state.voltage = round(shifter?.railH ?? 0)
        if (!state.powered && !damaged) {
          addWarning({
            code: 'unpowered_module',
            message: 'The level shifter has no reference voltages — HV needs 5 V and LV needs 3.3 V.',
            hint: 'Wire HV to 5V, LV to 3V3 and both GND pins to the ground rail.',
            componentIds: [element.componentId],
            severity: 'warning',
          })
        }
        break
      }
      case 'logic_out': {
        state.current = round(state.current + current, 9)
        break
      }
      default:
        break
    }
  }

  // --- relays, MCU --------------------------------------------------------------------------------------------
  for (const [componentId, on] of Object.entries(dynamics.relayOn)) {
    const state = componentStates[componentId]
    if (state) state.state = ctx.damaged.has(componentId) ? 'blown' : on ? 'on' : 'off'
  }
  const mcu = compiled.mcu
  if (mcu) {
    const mcuState = componentStates[mcu.componentId]
    if (mcuState) {
      mcuState.powered = ctx.powered
      mcuState.state = ctx.damaged.has(mcu.componentId) ? 'blown' : ctx.powered ? 'on' : 'off'
      mcuState.current = round(averaged.supply, 6)
    }
    for (const pin of mcu.board.pins) {
      const netId = mcu.pinNet[pin.name]
      mcuPinVoltages[pin.name] = netId ? round(netV(ctx, averaged.voltages, netId)) : 0
    }
    for (const [pinName, current] of Object.entries(averaged.pinCurrents)) pinCurrents[pinName] = round(current, 9)
  }

  // --- warnings -----------------------------------------------------------------------------------------------
  if (!converged || !solverOk) {
    warnings.push({
      code: 'solver_unstable',
      message: 'The circuit did not settle on a stable operating point.',
      hint: 'Look for parts wired in a loop with no resistor — a diode or transistor with nothing limiting its current.',
      severity: 'warning',
    })
  }
  structuralWarnings(ctx, addWarning)
  if (ctx.powered) {
    electricalWarnings(ctx, { averaged, worst, stress, reachable }, addWarning, events)
  }
  for (const warning of compiled.bindingWarnings ?? []) addWarning({ ...warning })

  const filtered = ctx.powered ? warnings : warnings.filter((w) => UNPOWERED_WARNINGS.has(w.code))
  if (!ctx.powered) {
    for (const state of Object.values(componentStates)) {
      state.warnings = state.warnings.filter((code) => UNPOWERED_WARNINGS.has(code))
    }
  }

  return {
    ok: solverOk && converged,
    converged,
    nodeVoltages,
    mcuPinVoltages,
    supplyCurrentA: round(ctx.powered ? averaged.supply : 0, 9),
    componentStates,
    pinCurrents,
    warnings: filtered,
    events: ctx.powered ? events : [],
  }
}

function setTwoTerminal(state, drop, current) {
  state.voltage = round(drop)
  state.current = round(current, 9)
  state.power = round(Math.abs(drop * current), 9)
}

function isSwitchClosed(ctx, element, dynamics) {
  const when = element.closedWhen ?? {}
  if (when.control) return Boolean(ctx.control(element.componentId, when.control))
  if (when.relayOn !== undefined) return Boolean(dynamics.relayOn[element.componentId]) === Boolean(when.relayOn)
  return false
}

/** Blow + `overcurrent_component` for any element that carries more than its `maxMa`. */
function checkOvercurrent(element, info, current, state, events, blown, addWarning) {
  const maxMa = element.maxMa
  if (!maxMa) return false
  const ma = Math.abs(current) * 1000
  if (ma < maxMa * (1 - BLOW_EPSILON)) return false
  if (blown.has(element.componentId)) return true
  blown.add(element.componentId)
  state.state = 'blown'
  state.brightness = 0
  events.push({ type: 'blow', componentId: element.componentId, reason: 'overcurrent', currentMa: round(ma, 1) })
  addWarning({
    code: 'overcurrent_component',
    message: `${info?.name ?? element.componentId} is carrying ${formatMa(current)} mA — more than the ${maxMa} mA it can take.`,
    hint: 'Add a series resistor (220 Ω for an LED on 5 V) or drive the load through a transistor.',
    componentIds: [element.componentId],
    severity: 'error',
  })
  return true
}

/**
 * `led_no_resistor` / `reverse_led` — both are wiring mistakes rather than operating-point results.
 * An LED has no current limit when BOTH of its nets reach a driven node without crossing a resistor.
 */
function checkLedWiring(reachesSource, element, ei, nets, info, drop, worstCurrent, state, addWarning) {
  const ma = Math.abs(worstCurrent) * 1000
  if (drop < -0.5 && ma < MIN_LIT_MA) {
    if (!state.warnings.includes('reverse_led')) {
      addWarning({
        code: 'reverse_led',
        message: `${info?.name ?? 'The LED'} is wired backwards — its cathode sits ${formatVolts(-drop)} V above its anode.`,
        hint: 'Flip the LED: the long leg (anode) goes towards the positive side, the flat side towards GND.',
        componentIds: [element.componentId],
        severity: 'warning',
      })
    }
    return
  }
  if (ma <= 0.5) return
  if (reachesSource(nets.anode, ei) && reachesSource(nets.cathode, ei)) {
    if (state.warnings.includes('led_no_resistor')) return
    addWarning({
      code: 'led_no_resistor',
      message: `${info?.name ?? 'The LED'} has no series resistor — it pulls ${formatMa(worstCurrent)} mA.`,
      hint: 'Put a 220 Ω resistor in series with the LED (I = (Vsrc − Vf) / R).',
      componentIds: [element.componentId],
      severity: ma >= (element.maxMa ?? Infinity) ? 'error' : 'warning',
    })
  }
}

/**
 * Resistor-free reachability graph, built once per evaluation: which nets can reach a driven node (a supply
 * pin, an active GPIO driver, a module output or ground) without passing through a resistor or a pot.
 */
function createSourceProbe(ctx) {
  const edges = new Map()
  const driven = new Set()
  const link = (a, b, element) => {
    if (a < 0 || b < 0) return
    if (!edges.has(a)) edges.set(a, [])
    if (!edges.has(b)) edges.set(b, [])
    edges.get(a).push({ to: b, element })
    edges.get(b).push({ to: a, element })
  }
  if (ctx.refIndex >= 0) driven.add(ctx.refIndex)
  for (let ei = 0; ei < ctx.elements.length; ei++) {
    const element = ctx.elements[ei]
    if (ctx.damaged.has(element.componentId)) continue
    const nets = ctx.elementNets[ei]
    if (element.kind === 'diode') link(nets.anode, nets.cathode, ei)
    else if (element.kind === 'switch') link(nets.a, nets.b, ei)
    else if (element.kind === 'logic_out' && nets.out >= 0) driven.add(nets.out)
  }
  const mcu = ctx.compiled.mcu
  if (mcu) {
    for (const pin of mcu.board.pins) {
      const netId = mcu.pinNet[pin.name]
      const index = netId === undefined ? undefined : ctx.netIndex.get(netId)
      if (index === undefined) continue
      const mode = ctx.mcuPins?.[pin.name]?.mode ?? 'input'
      if (pin.kind === 'power' || pin.kind === 'ground' || mode === 'output' || mode === 'pwm' || mode === 'dac') driven.add(index)
    }
  }
  return (startNet, skipElement) => {
    if (startNet < 0) return false
    const seen = new Set([startNet])
    const queue = [startNet]
    while (queue.length) {
      const node = queue.pop()
      if (driven.has(node)) return true
      for (const edge of edges.get(node) ?? []) {
        if (edge.element === skipElement || seen.has(edge.to)) continue
        seen.add(edge.to)
        queue.push(edge.to)
      }
    }
    return false
  }
}

/** Warnings that do not depend on the operating point (they survive `powered:false`). */
function structuralWarnings(ctx, addWarning) {
  const compiled = ctx.compiled
  if (compiled.mcu) {
    const groundNet = compiled.nets.find((net) => net.id === compiled.groundNet)
    const others = Object.values(ctx.componentIndex).filter((info) => info.id !== compiled.mcu.componentId)
    if (others.length && (!groundNet || !groundNet.external)) {
      addWarning({
        code: 'no_ground',
        message: 'Nothing is connected to GND — current has no way back to the board.',
        hint: "Run a wire from the board's GND pin to the − rail your parts share.",
        severity: 'error',
      })
    }
  }
  if (Object.values(ctx.componentIndex).some((info) => info.type === 'capacitor')) {
    addWarning({
      code: 'dc_only',
      message: 'This simulator solves DC only, so capacitors act as open circuits.',
      hint: 'Use them for smoothing on real hardware; here they do not change any reading.',
      severity: 'info',
    })
  }
}

/** Warnings and events that come from the solved operating point. */
function electricalWarnings(ctx, { averaged, worst, stress, reachable }, addWarning, events) {
  const compiled = ctx.compiled
  const mcu = compiled.mcu
  const board = ctx.board

  // Shorts and supply overload.
  let shortEmitted = false
  const emitShort = () => {
    if (shortEmitted) return
    shortEmitted = true
    events.push({ type: 'short' })
  }
  const shorted = (compiled.issues ?? []).some((issue) => issue.code === 'vcc_gnd_short')
  const powerNets = new Map()
  if (mcu) {
    for (const pin of mcu.board.pins) {
      if (pin.kind !== 'power' || pin.volts == null) continue
      const netId = mcu.pinNet[pin.name]
      if (!netId) continue
      const existing = powerNets.get(netId)
      if (existing != null && existing !== pin.volts) {
        addWarning({
          code: 'short_circuit',
          message: `Two supply pins with different voltages (${existing} V and ${pin.volts} V) are wired together.`,
          hint: 'Remove the wire that joins the two power rails.',
          pinNames: [pin.name],
          severity: 'error',
        })
      }
      powerNets.set(netId, pin.volts)
    }
  }
  if (shorted) {
    addWarning({
      code: 'short_circuit',
      message: 'A power pin is wired straight to GND — that is a short circuit.',
      hint: 'Remove the wire between the power rail and the ground rail before powering up.',
      severity: 'error',
    })
    emitShort()
  }
  const supplyMa = averaged.supply * 1000
  const supplyMax = board?.usbSupplyMaxMa ?? Infinity
  if (supplyMa > supplyMax) {
    addWarning({
      code: 'power_overload',
      message: `The circuit is drawing ${formatMa(averaged.supply)} mA — USB can supply about ${supplyMax} mA.`,
      hint: 'Drive motors and large LED arrays from their own supply, sharing only GND with the board.',
      severity: 'error',
    })
    emitShort()
  }

  if (!mcu || !board) return

  // Pin currents, floating inputs and GPIO overvoltage.
  const maxPinMa = board.pinMaxSourceMa ?? 40
  const worstPinCurrents = worst.values.pinCurrents
  for (const pin of board.pins) {
    const netId = mcu.pinNet[pin.name]
    if (!netId) continue
    const netIndex = ctx.netIndex.get(netId)
    const mode = ctx.mcuPins?.[pin.name]?.mode ?? 'input'
    const current = worstPinCurrents[pin.name] ?? 0
    const ma = Math.abs(current) * 1000
    if (ma > maxPinMa && !ctx.burntPins.has(pin.name) && (pin.kind === 'digital' || pin.kind === 'analog')) {
      addWarning({
        code: 'overcurrent_pin',
        message: `Pin ${pin.name} is ${current > 0 ? 'sourcing' : 'sinking'} ${formatMa(current)} mA (max ${maxPinMa} mA).`,
        hint: `Add a 220 Ω resistor in series so pin ${pin.name} stays under ${maxPinMa} mA.`,
        pinNames: [pin.name],
        severity: 'error',
      })
    }
    if (pin.kind !== 'digital' && pin.kind !== 'analog') continue
    if (mode === 'input' && netIndex !== undefined && !reachable[netIndex] && compiled.nets[netIndex]?.external) {
      addWarning({
        code: 'floating_input',
        message: `Pin ${pin.name} is an input with nothing driving it — it will read random values.`,
        hint: `Add a 10 kΩ pull-up or pull-down, or use pinMode(${pin.name}, INPUT_PULLUP).`,
        pinNames: [pin.name],
        severity: 'warning',
      })
    }
    const gpioMaxV = board.gpioMaxV ?? Infinity
    const opV = netIndex === undefined ? 0 : averaged.voltages[netIndex]
    const worstV = netIndex === undefined ? 0 : worst.solve.voltages[netIndex]
    const stressV = stress && netIndex !== undefined ? stress.voltages[netIndex] : 0
    const peak = Math.max(opV, worstV, stressV)
    if (peak > gpioMaxV) {
      addWarning({
        code: 'overvoltage_gpio',
        message: `Pin ${pin.name} sees ${formatVolts(peak)} V — this board tolerates at most ${gpioMaxV} V on a GPIO.`,
        hint: 'Drop the signal with a level shifter or a 1 kΩ / 2.2 kΩ divider before it reaches the pin.',
        pinNames: [pin.name],
        severity: 'error',
      })
      if (!ctx.burntPins.has(pin.name)) events.push({ type: 'burnt_pin', pinName: pin.name, volts: round(peak) })
    }
  }
}

/** Round to a sane number of decimals so snapshots and equality checks are stable. */
function round(value, decimals = 6) {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * `compileCircuit` — CircuitDoc → CompiledCircuit (CONTRACTS §5.1, §7.3).
 *
 * Nets come from `nets.js`; this module resolves every component's registry model into netlist elements,
 * indexes the components for the solver and the UI, and binds peripherals to MCU pins. Peripheral binding is
 * the one part of compilation that needs electricity: a module OUTPUT (HC-SR04 echo, PIR out, DHT data) is only
 * bound to a pin when forcing it HIGH actually pulls that pin's net above 0.6·vcc and forcing it LOW pulls it
 * below 0.3·vcc — so a too-weak divider stays unbound and says why.
 */
import * as defaultBoards from '../boards/index.js'
import * as defaultRegistry from '../components/registry.js'
import { GND_NET, buildNets } from './nets.js'
import { netsWithinHops } from './path.js'
import { operatingPoint } from './evaluate.js'

/** Module roles that receive a signal from the MCU (bound by connectivity alone). */
const INPUT_ROLES = new Set(['signal', 'din', 'trig', 'in', 'sda', 'scl'])
/** Module roles that drive the MCU (bound only when the levels are electrically readable). */
const OUTPUT_ROLES = new Set(['echo', 'out', 'data'])
/** Roles that describe the module's supply rather than a signal. */
const POWER_ROLES = new Set(['vcc', 'gnd'])
/** Hop budget of the binding search (§7.3): 0 = same net, 2 = through a divider or a level shifter. */
const BINDING_MAX_HOPS = 2
const HIGH_RATIO = 0.6
const LOW_RATIO = 0.3

/**
 * Compile a circuit document.
 * @param {object} doc CircuitDoc (§4.1)
 * @param {object} [registry] `engine/components/registry.js` namespace (injectable for tests)
 * @param {object} [boards] `engine/boards/index.js` namespace
 * @returns {object} CompiledCircuit (§5.1)
 */
export function compileCircuit(doc, registry = defaultRegistry, boards = defaultBoards) {
  const { nets, netById, terminalToNet, mcu, pinTerminals, issues } = buildNets(doc, registry, boards)
  const groundNet = netById.has(GND_NET) ? GND_NET : null

  const componentIndex = {}
  const componentNets = {}
  const elements = []

  for (const component of doc?.components ?? []) {
    const def = registry.getDef(component?.type)
    if (!def) continue
    const terminals = pinTerminals[component.id] ?? {}
    const pinNets = {}
    for (const [pinId, terminal] of Object.entries(terminals)) pinNets[pinId] = terminalToNet[terminal] ?? null
    componentNets[component.id] = pinNets

    const raw = registry.modelElements(component)
    const power = raw.find((element) => element.kind === 'module_power')
    componentIndex[component.id] = {
      id: component.id,
      type: component.type,
      name: def.name,
      category: def.category,
      mount: def.mount,
      props: { ...component.props },
      controls: registry.defaultControls(component.type),
      peripheral: def.peripheral ?? null,
      vccNet: power ? (pinNets[power.pins.vcc] ?? null) : null,
      gndNet: power ? (pinNets[power.pins.gnd] ?? null) : null,
      minV: power ? power.minV : null,
    }

    for (const element of raw) {
      const pins = {}
      for (const [role, pinId] of Object.entries(element.pins ?? {})) pins[role] = pinNets[pinId] ?? null
      const compiledElement = {
        ...element,
        componentId: component.id,
        componentType: component.type,
        pinIds: { ...(element.pins ?? {}) },
        pins,
      }
      if (element.kind === 'logic_out') compiledElement.gndNet = componentIndex[component.id].gndNet
      if (element.kind === 'switch' && element.relayIn) compiledElement.relayInNet = pinNets[element.relayIn] ?? null
      if (element.kind === 'level_shifter') {
        compiledElement.channelNets = (element.channels ?? []).map(([hvPin, lvPin]) => ({
          hv: pinNets[hvPin] ?? null,
          lv: pinNets[lvPin] ?? null,
          hvPin,
          lvPin,
        }))
      }
      elements.push(compiledElement)
    }
  }

  const compiled = {
    nets,
    terminalToNet,
    mcu,
    elements,
    peripheralMap: [],
    issues,
    // Extras beyond §5.1, used by the solver, the tooltips and package F (documented in the package report).
    groundNet,
    componentIndex,
    componentNets,
    bindingWarnings: [],
  }

  const binding = bindPeripherals(compiled)
  compiled.peripheralMap = binding.peripheralMap
  compiled.bindingWarnings = binding.warnings
  return compiled
}

/** Compile-time dynamic state: powered, every pin an input, controls at their registry defaults. */
function compileState(forceLogicOut) {
  return {
    state: { powered: true, mcuPins: {}, controls: {}, damaged: {}, burntPins: {}, moduleOutputs: {} },
    options: forceLogicOut ? { forceLogicOut } : {},
  }
}

/** MCU pins that a net reaches, nearest first (§7.3 binding rule). */
function candidatePins(compiled, roleNet) {
  const mcu = compiled.mcu
  if (!mcu || !roleNet) return []
  const hops = netsWithinHops(compiled, roleNet, BINDING_MAX_HOPS, ['level_shifter'])
  const candidates = []
  mcu.board.pins.forEach((pin, order) => {
    if (pin.kind !== 'digital' && pin.kind !== 'analog') return
    const netId = mcu.pinNet[pin.name]
    if (!netId || !hops.has(netId)) return
    candidates.push({ pin, hops: hops.get(netId), order, netId })
  })
  candidates.sort((a, b) => a.hops - b.hops || a.order - b.order)
  return candidates
}

/** Build `peripheralMap` (§7.3) plus any binding warnings the evaluation should re-emit. */
function bindPeripherals(compiled) {
  const peripheralMap = []
  const warnings = []
  const mcu = compiled.mcu
  const vcc = mcu?.board?.vcc ?? 5
  const i2c = mcu?.board?.i2c ?? null
  let operating = null
  const voltageOf = (netId) => {
    if (!operating) {
      const { state, options } = compileState(null)
      operating = operatingPoint(compiled, state, options)
    }
    return operating.voltage(netId)
  }

  for (const info of Object.values(compiled.componentIndex)) {
    const peripheral = info.peripheral
    if (!peripheral) continue
    const pinNets = compiled.componentNets[info.id] ?? {}
    const pins = {}
    let gndPin = null
    const outputRoles = []

    for (const [pinId, role] of Object.entries(peripheral.roles ?? {})) {
      if (POWER_ROLES.has(role)) {
        if (role === 'gnd') gndPin = pinId
        continue
      }
      const roleNet = pinNets[pinId] ?? null
      if (OUTPUT_ROLES.has(role)) {
        outputRoles.push({ pinId, role, roleNet })
        pins[role] = null
        continue
      }
      let bound = null
      for (const candidate of candidatePins(compiled, roleNet)) {
        if (INPUT_ROLES.has(role) && i2c && (role === 'sda' || role === 'scl')) {
          if (candidate.pin.name !== i2c[role]) continue
        }
        bound = candidate.pin.name
        break
      }
      pins[role] = bound
    }

    // Module outputs are confirmed electrically: force HIGH, then LOW, and check the pin's net actually swings.
    for (const { pinId, role, roleNet } of outputRoles) {
      const candidates = candidatePins(compiled, roleNet)
      if (!candidates.length) continue
      const high = solveForced(compiled, info.id, pinId, 1)
      const low = solveForced(compiled, info.id, pinId, 0)
      let bound = null
      let bestHigh = 0
      for (const candidate of candidates) {
        const vHigh = high.voltage(candidate.netId)
        const vLow = low.voltage(candidate.netId)
        bestHigh = Math.max(bestHigh, vHigh)
        if (vHigh >= HIGH_RATIO * vcc && vLow <= LOW_RATIO * vcc) {
          bound = candidate.pin.name
          break
        }
      }
      pins[role] = bound
      if (!bound) {
        warnings.push({
          code: 'divider_too_weak',
          message: `${info.name} ${role.toUpperCase()} only reaches ${bestHigh.toFixed(2)} V at the pin — the board needs at least ${(HIGH_RATIO * vcc).toFixed(2)} V to read a HIGH.`,
          hint: 'Use a 1 kΩ / 2.2 kΩ divider (about 3.4 V) or a level shifter between the module output and the pin.',
          componentIds: [info.id],
          severity: 'warning',
        })
      }
    }

    let powered = true
    if (info.minV != null) powered = voltageOf(info.vccNet) - voltageOf(info.gndNet) >= info.minV
    else if (gndPin) powered = (pinNets[gndPin] ?? null) === compiled.groundNet && compiled.groundNet != null

    const entry = {
      componentId: info.id,
      type: info.type,
      protocol: peripheral.protocol,
      pins,
      powered,
      props: { ...info.props },
    }
    const addressProp = peripheral.i2cAddressProp
    const address = addressProp && info.props[addressProp] != null ? Number(info.props[addressProp]) : peripheral.i2cAddress
    if (address != null) entry.i2cAddress = address
    peripheralMap.push(entry)
  }
  return { peripheralMap, warnings }
}

/** Operating point with one module output forced to a level (the §7.3 confirmation solves). */
function solveForced(compiled, componentId, pinId, level) {
  const { state, options } = compileState({ [componentId]: { [pinId]: level } })
  return operatingPoint(compiled, state, options)
}

import { getBoard } from '../../engine/boards/index.js'
import { getDef, resolvePins } from '../../engine/components/registry.js'

const pick = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]))

/** Explicit allowlist: never includes account data, saved projects or reference solutions. */
export function buildAssistantContext({ mode, title, doc, code = '', selectedIds = [], state, lesson, objectives, completedSteps = [] }) {
  const truncated = []
  const take = (name, items = [], max) => {
    if (items.length > max) truncated.push(name)
    return items.slice(0, max)
  }
  const clip = (name, value = '', max) => {
    if (value.length > max) truncated.push(name)
    return value.slice(0, max)
  }
  const board = getBoard(doc?.mcu)
  const selected = new Set(selectedIds)
  const components = take('components', [...(doc?.components ?? [])].sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id))), 80).map(component => {
    const def = getDef(component.type)
    const resolved = resolvePins(component, doc)
    return {
      ...pick(component, ['id', 'type', 'props', 'anchor', 'position', 'rotation']),
      name: def?.name, pins: Object.fromEntries(Object.entries(resolved.pins).map(([pin, location]) => [pin, location.hole ?? location.terminal])),
      validPlacement: resolved.valid,
    }
  })
  const wires = take('wires', doc?.wires, 200).map(wire => pick(wire, ['id', 'from', 'to', 'color']))
  const context = {
    mode, title: String(title ?? lesson?.title ?? doc?.meta?.name ?? 'Untitled project').slice(0, 200),
    board: { ...pick(board, ['id', 'name', 'family', 'vcc', 'gpioMaxV', 'adcBits', 'libraries', 'notes']), language: board?.family === 'raspberrypi' ? 'python-gpio-subset' : 'arduino-cpp-subset' },
    code: clip('code', code, 24000),
    circuit: { version: doc?.version, mcu: doc?.mcu, boardMode: doc?.boardMode, breadboards: doc?.breadboards, components, wires, totalComponents: doc?.components?.length ?? 0, totalWires: doc?.wires?.length ?? 0 },
    selection: take('selection', [...components, ...(doc?.wires ?? []).map(w => pick(w, ['id', 'from', 'to', 'color']))].filter(item => selected.has(item.id)), 20),
    simulation: {
      ...pick(state, ['status', 'powered', 'millis']),
      diagnostics: take('diagnostics', state?.diagnostics, 12), runtimeError: state?.runtimeError ?? null,
      warnings: take('warnings', state?.warnings, 12),
      serial: clip('serial', (state?.serial ?? []).slice(-30).map(entry => entry.text).join(''), 4000),
      components: Object.fromEntries(components.map(c => [c.id, pick(state?.evaluation?.componentStates?.[c.id], ['voltage', 'current', 'power', 'brightness', 'state'])])),
      controls: Object.fromEntries(components.filter(c => state?.controls?.[c.id]).map(c => [c.id, state.controls[c.id]])),
      damaged: state?.damaged ?? {}, burntPins: state?.burntPins ?? {},
      mcuPins: state?.mcuPins ?? {}, mcuPinVoltages: state?.evaluation?.mcuPinVoltages ?? {},
      nets: take('nets', state?.compiled?.nets, 80).map(net => ({ id: net.id, terminals: net.terminals, voltage: state?.evaluation?.nodeVoltages?.[net.id] })),
      wifi: pick(state?.wifi, ['status', 'ip']), mqtt: pick(state?.mqtt, ['status', 'connected']),
    },
    lesson: lesson ? {
      ...pick(lesson, ['id', 'title', 'summary', 'challenge', 'concepts', 'steps', 'hardwareConcepts', 'programConcepts', 'learn']),
      objectives: lesson.objectives?.map(o => ({ ...pick(o, ['id', 'title', 'text', 'description']), passed: objectives?.objectives?.find(r => r.id === o.id)?.passed ?? false })),
      completedSteps,
    } : null,
    truncated,
  }
  if (doc?.kind === 'drone') {
    context.circuit.kind = 'drone'
    const config = doc.droneConfig
    context.circuit.droneConfig = { ...pick(config, ['schemaVersion', 'name', 'payloadG', 'mixer']),
      airframe: pick(config.airframe, ['class', 'wheelbaseMm', 'frameMassG', 'maxPropIn']),
      motors: pick(config.motors, ['count', 'kv', 'stator', 'massG', 'maxCurrentA', 'phaseResistanceMohm', 'noLoadCurrentA']),
      props: pick(config.props, ['diameterIn', 'pitchIn', 'blades', 'massG']),
      esc: pick(config.esc, ['kind', 'continuousA', 'burstA', 'protocol', 'becVolts', 'becAmps']),
      battery: pick(config.battery, ['cells', 'chemistry', 'capacityMah', 'cRating', 'massG', 'internalResistanceMohm']),
      fc: pick(config.fc, ['board', 'carrier', 'imu', 'baro']), extras: config.extras.map(e => pick(e, ['id', 'massG'])),
    }
    context.circuit.flight = pick(doc.flight, ['seed', 'bench', 'wind'])
    context.circuit.mounts = take('mounts', doc.mounts, 32).map(m => pick(m, ['componentId', 'mount']))
    context.circuit.links = take('links', doc.links, 100).map(l => pick(l, ['id', 'from', 'to', 'kind', 'awg', 'lengthM']))
    context.circuit.course = take('course', doc.course, 24).map(g => pick(g, ['x', 'y', 'z', 'radius']))
    context.simulation.flight = pick(state?.flight, ['position', 'velocity', 'attitude', 'rates', 'armed', 'mode', 'rpm', 'pulses', 'electrical', 'gatesPassed', 'crashed', 'saturated'])
    context.selection = take('selection', [...components, ...context.circuit.links].filter(item => selected.has(item.id)), 20)
  }
  // Leave room under the API's 96 KiB limit, including UTF-8 expansion and JSON whitespace.
  const bytes = () => new TextEncoder().encode(JSON.stringify(context)).length
  for (const [owner, key] of [[context.simulation, 'nets'], [context.simulation, 'components'], [context, 'lesson'], [context.circuit, 'wires'], [context.circuit, 'components']]) {
    if (bytes() <= 80000) break
    owner[key] = Array.isArray(owner[key]) ? [] : null
    truncated.push(key)
  }
  if (bytes() > 80000) {
    context.code = context.code.slice(0, 6000)
    context.simulation = pick(context.simulation, ['status', 'powered', 'millis'])
    context.selection = context.selection.map(c => pick(c, ['id', 'type', 'name', 'pins']))
    truncated.push('code', 'simulation', 'selection')
  }
  return context
}

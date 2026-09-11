/**
 * Quest selectors — the three ways a rule names something in the circuit (QUEST_SCHEMA.md).
 *
 *   { mcuPin: 'D13' }                                    a microcontroller pin ('GND' = the ground net)
 *   { componentType: 'led', pin: 'anode', props, index }  a component, optionally one of its pins
 *   { terminal: 'bb1:e12' }                               a literal terminal
 *
 * Every helper returns `null` rather than throwing, so a malformed level degrades to a failed rule
 * with a readable message instead of taking the workspace down.
 */

/** Human description of a selector, used in rule `detail` strings. */
export function describeSelector(sel) {
  if (!sel || typeof sel !== 'object') return 'nothing'
  if (sel.mcuPin) return `pin ${sel.mcuPin}`
  if (sel.terminal) return `terminal ${sel.terminal}`
  if (sel.componentType) {
    const props = sel.props ? ` (${Object.entries(sel.props).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''
    return sel.pin ? `the ${sel.componentType}${props} ${sel.pin} pin` : `a ${sel.componentType}${props}`
  }
  return 'nothing'
}

/** True when a component matches a selector's type and prop constraints. */
export function componentMatches(component, sel) {
  if (!component || component.type !== sel.componentType) return false
  for (const [key, value] of Object.entries(sel.props ?? {})) {
    if (component.props?.[key] !== value) return false
  }
  return true
}

/** All components in the document matching a selector, in document order. */
export function matchingComponents(doc, sel) {
  const all = (doc?.components ?? []).filter((c) => componentMatches(c, sel))
  return typeof sel.index === 'number' ? all.slice(sel.index, sel.index + 1) : all
}

/**
 * Terminal reference(s) a selector points at.
 * A component selector without a `pin` yields every pin of every matching component.
 */
export function resolveTerminals(sel, ctx) {
  if (!sel || typeof sel !== 'object') return []
  const { compiled, doc } = ctx

  if (sel.terminal) return [sel.terminal]

  if (sel.mcuPin) {
    const mcuId = compiled?.mcu?.componentId
    if (!mcuId) return []
    return [`${mcuId}:${sel.mcuPin}`]
  }

  if (sel.componentType) {
    const components = matchingComponents(doc, sel)
    const out = []
    for (const component of components) {
      if (sel.pin) {
        out.push(`${component.id}:${sel.pin}`)
      } else {
        const pins = ctx.registry?.getDef?.(component.type)?.footprint?.pins ?? []
        for (const pin of pins) out.push(`${component.id}:${pin.id}`)
      }
    }
    return out
  }

  return []
}

/**
 * Net id(s) a selector resolves to. `{ mcuPin: 'GND' }` resolves through the MCU's pinNet map, which
 * merges every ground pin into one net, so quest content never has to know about GND2/GND3.
 */
export function resolveNets(sel, ctx) {
  const { compiled } = ctx
  if (!compiled) return []

  if (sel?.mcuPin && compiled.mcu?.pinNet) {
    const net = compiled.mcu.pinNet[sel.mcuPin]
    if (net) return [net]
  }

  const nets = new Set()
  for (const terminal of resolveTerminals(sel, ctx)) {
    const net = compiled.terminalToNet?.[terminal]
    if (net) nets.add(net)
  }
  return [...nets]
}

/** First terminal a selector resolves to, or null. */
export function firstTerminal(sel, ctx) {
  return resolveTerminals(sel, ctx)[0] ?? null
}

/** Voltage at a selector's net, or null when it cannot be resolved. */
export function voltageAt(sel, ctx) {
  const [net] = resolveNets(sel, ctx)
  if (!net) return null
  const v = ctx.sim?.evaluation?.nodeVoltages?.[net]
  return typeof v === 'number' ? v : null
}

/** Read a dotted path such as 'data.pixels.length' off an object. */
export function readPath(object, path) {
  if (!path) return object
  let current = object
  for (const key of String(path).split('.')) {
    if (current == null) return undefined
    current = current[key]
  }
  return current
}

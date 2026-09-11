/**
 * Connectivity queries over a CompiledCircuit — CONTRACTS §5.5.
 *
 * `findPath` walks the two-terminal parts of the netlist (resistor, LED/diode, switch, capacitor, LDR, buzzer,
 * DC motor, pot taps), which is what quest rules mean by "connect the LED to D13 through a 220 Ω resistor".
 * `describeNet` and `terminalsOfComponent` back the canvas tooltips and the inspector.
 */

/** Default maximum number of components a path may cross. */
const DEFAULT_MAX_HOPS = 6
/** Safety valve so a pathological document cannot spin the BFS forever. */
const MAX_EXPANSIONS = 20000

/**
 * Two-terminal edges of the netlist. Level-shifter channels are only traversable when the caller opts in
 * (`include: ['level_shifter']`), which is what the peripheral binding search does (§7.3).
 * @returns {Array<{ componentId: string, netA: string, netB: string }>}
 */
function edgesOf(compiled, include) {
  const edges = []
  const push = (componentId, netA, netB) => {
    if (!netA || !netB || netA === netB) return
    edges.push({ componentId, netA, netB })
  }
  for (const element of compiled.elements ?? []) {
    const pins = element.pins ?? {}
    switch (element.kind) {
      case 'resistor':
      case 'switch':
      case 'capacitor':
        push(element.componentId, pins.a, pins.b)
        break
      case 'diode':
        push(element.componentId, pins.anode, pins.cathode)
        break
      case 'pot':
        push(element.componentId, pins.end1, pins.wiper)
        push(element.componentId, pins.wiper, pins.end2)
        push(element.componentId, pins.end1, pins.end2)
        break
      case 'level_shifter':
        if (!include?.includes('level_shifter')) break
        for (const channel of element.channelNets ?? []) push(element.componentId, channel.hv, channel.lv)
        break
      default:
        break
    }
  }
  return edges
}

/** Adjacency list netId → [{ to, componentId }]. */
function adjacencyOf(compiled, include) {
  const adjacency = new Map()
  const add = (from, to, componentId) => {
    if (!adjacency.has(from)) adjacency.set(from, [])
    adjacency.get(from).push({ to, componentId })
  }
  for (const edge of edgesOf(compiled, include)) {
    add(edge.netA, edge.netB, edge.componentId)
    add(edge.netB, edge.netA, edge.componentId)
  }
  return adjacency
}

function sameValue(a, b) {
  if (a === b) return true
  const na = Number(a)
  const nb = Number(b)
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb
}

/** `{ type | componentType, props? }` matcher for one component on a path. */
function matchesSpec(component, spec) {
  if (!spec) return true
  const type = spec.type ?? spec.componentType
  if (type && component.type !== type) return false
  for (const [key, value] of Object.entries(spec.props ?? {})) {
    if (!sameValue(component.props?.[key], value)) return false
  }
  return true
}

/** The path's component sequence must contain `through` in order (or equal it when `exact`). */
function matchesThrough(components, through, exact) {
  if (!through?.length) return exact ? components.length === 0 : true
  if (exact) {
    if (components.length !== through.length) return false
    return through.every((spec, i) => matchesSpec(components[i], spec))
  }
  let index = 0
  for (const component of components) {
    if (index < through.length && matchesSpec(component, through[index])) index++
  }
  return index === through.length
}

function componentRef(compiled, componentId) {
  const info = compiled.componentIndex?.[componentId]
  return { id: componentId, type: info?.type ?? null, props: { ...(info?.props ?? {}) } }
}

/**
 * Shortest component path between two terminals whose component sequence matches `through`.
 *
 * @param {object} compiled CompiledCircuit
 * @param {string} fromTerminal TerminalRef
 * @param {string} toTerminal TerminalRef
 * @param {{ through?: Array<object>, exact?: boolean, maxHops?: number, include?: string[] }} [opts]
 * @returns {{ nets: string[], components: Array<{id,type,props}> }|null}
 */
export function findPath(compiled, fromTerminal, toTerminal, opts = {}) {
  if (!compiled?.terminalToNet) return null
  const { through = [], exact = false, maxHops = DEFAULT_MAX_HOPS, include } = opts
  const fromNet = compiled.terminalToNet[fromTerminal]
  const toNet = compiled.terminalToNet[toTerminal]
  if (!fromNet || !toNet) return null

  if (fromNet === toNet && matchesThrough([], through, exact)) return { nets: [fromNet], components: [] }

  const adjacency = adjacencyOf(compiled, include)
  const queue = [{ net: fromNet, nets: [fromNet], components: [], visited: new Set([fromNet]) }]
  let expansions = 0
  while (queue.length) {
    const path = queue.shift()
    if (path.components.length >= maxHops) continue
    for (const edge of adjacency.get(path.net) ?? []) {
      if (path.visited.has(edge.to)) continue
      if (++expansions > MAX_EXPANSIONS) return null
      const components = [...path.components, componentRef(compiled, edge.componentId)]
      const nets = [...path.nets, edge.to]
      if (edge.to === toNet && matchesThrough(components, through, exact)) return { nets, components }
      const visited = new Set(path.visited)
      visited.add(edge.to)
      queue.push({ net: edge.to, nets, components, visited })
    }
  }
  return null
}

/**
 * Every net reachable from `startNet` within `maxHops` component edges, mapped to its hop count.
 * Used by the peripheral binding search (§7.3, the `findPath(rolePin, mcuPin, { maxHops: 2 })` rule); the
 * ground net is an endpoint but never a transit node, so a pull-down resistor cannot bridge two signals.
 * @returns {Map<string, number>}
 */
export function netsWithinHops(compiled, startNet, maxHops, include) {
  const hops = new Map()
  if (!startNet) return hops
  hops.set(startNet, 0)
  const adjacency = adjacencyOf(compiled, include)
  let frontier = [startNet]
  for (let depth = 1; depth <= maxHops; depth++) {
    const next = []
    for (const net of frontier) {
      if (depth > 1 && net === compiled.groundNet) continue
      for (const edge of adjacency.get(net) ?? []) {
        if (hops.has(edge.to)) continue
        hops.set(edge.to, depth)
        next.push(edge.to)
      }
    }
    frontier = next
    if (!frontier.length) break
  }
  return hops
}

/**
 * Net summary for tooltips: label, the terminals on it and which component pins they belong to.
 * @returns {{ id: string, label: string|null, terminals: string[], componentPins: Array<{componentId,pinId}> }|null}
 */
export function describeNet(compiled, netId) {
  const net = compiled?.nets?.find((candidate) => candidate.id === netId)
  if (!net) return null
  return {
    id: net.id,
    label: net.label ?? null,
    terminals: [...net.terminals],
    componentPins: net.componentPins.map((pin) => ({ ...pin })),
  }
}

/**
 * Net of every pin of a component.
 * @returns {{ [pinId: string]: string }}
 */
export function terminalsOfComponent(compiled, componentId) {
  return { ...(compiled?.componentNets?.[componentId] ?? {}) }
}

/**
 * Net extraction — CONTRACTS §5.1.
 *
 * Union-find over every referenced terminal:
 *  - breadboard holes join their strip (`a12..e12` = `row12:upper`, rails are continuous along the board);
 *  - a board-mounted component pin IS its hole ref, and `${componentId}:${pinId}` is aliased onto the same net;
 *  - wires join their two endpoints;
 *  - model `bonds` join permanently-wired pins (pushbutton a1-a2 / b1-b2, seven-segment com-com2);
 *  - every MCU `kind:'ground'` pin ends up in one net with the fixed id `n_gnd` (the MNA reference);
 *  - internally tied header pins (Uno SCL↔A5, SDA↔A4) share a net.
 *
 * Pure: no DOM, no solver. `registry`/`boards` are module namespaces so tests can inject fakes.
 */
import { findBreadboard, holesInStrip, parseTerminal, stripOf } from '../components/geometry.js'

/** Fixed id of the ground net (the MNA reference). */
export const GND_NET = 'n_gnd'

/** Internal union-find nodes for breadboard strips; never exposed as TerminalRefs. */
const STRIP_PREFIX = '@strip:'
/** Label priority when several power pins share a net. */
const POWER_LABEL_ORDER = ['GND', '5V', '3V3', 'VIN']

/** Minimal union-find over string keys, insertion-ordered so net ids are deterministic. */
function createUnionFind() {
  const parent = new Map()
  const add = (key) => {
    if (!parent.has(key)) parent.set(key, key)
    return key
  }
  const find = (key) => {
    add(key)
    let root = key
    while (parent.get(root) !== root) root = parent.get(root)
    let walk = key
    while (parent.get(walk) !== walk) {
      const next = parent.get(walk)
      parent.set(walk, root)
      walk = next
    }
    return root
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
    return ra
  }
  return { add, find, union, keys: () => parent.keys() }
}

/** `bb1:e12` → `@strip:bb1:row12:upper` when the owner is one of the document's breadboards. */
function stripNodeFor(doc, terminalRef) {
  const ref = parseTerminal(terminalRef)
  if (!ref) return null
  const bb = findBreadboard(doc, ref.owner)
  if (!bb) return null
  const strip = stripOf(bb.type, ref.pin)
  return strip ? `${STRIP_PREFIX}${ref.owner}:${strip}` : null
}

/**
 * Compile the document's terminals into nets.
 *
 * @param {object} doc CircuitDoc (§4.1)
 * @param {object} registry `engine/components/registry.js` namespace
 * @param {object} boards `engine/boards/index.js` namespace
 * @returns {{
 *   nets: Array<{ id: string, terminals: string[], label: string|null, componentPins: Array<{componentId:string,pinId:string}>, external: boolean }>,
 *   netById: Map<string, object>,
 *   terminalToNet: Record<string, string>,
 *   stripNets: Record<string, string>,
 *   mcu: null | { componentId: string, board: object, pinNet: Record<string, string> },
 *   pinTerminals: Record<string, Record<string, string>>,
 *   issues: Array<object>
 * }}
 */
export function buildNets(doc, registry, boards) {
  const components = doc?.components ?? []
  const uf = createUnionFind()
  const issues = []
  /** terminal → owning component id (board-mounted pins own their hole ref). */
  const terminalOwner = new Map()
  /** componentId → { [pinId]: terminal } */
  const pinTerminals = {}
  const componentPinsOf = []

  const joinStrip = (terminal) => {
    const node = stripNodeFor(doc, terminal)
    if (node) uf.union(node, terminal)
  }

  // --- component pins -----------------------------------------------------------------------------------------
  let mcuComponent = null
  let mcuBoard = null
  for (const component of components) {
    const def = registry.getDef(component?.type)
    if (!def) continue
    const resolved = registry.resolvePins(component, doc)
    const pins = {}
    const invalidPins = []
    for (const pinDef of def.footprint.pins) {
      const resolvedPin = resolved.pins[pinDef.id]
      if (!resolvedPin) continue
      const terminal = resolvedPin.terminal
      const alias = `${component.id}:${pinDef.id}`
      uf.add(terminal)
      joinStrip(terminal)
      if (alias !== terminal) uf.union(terminal, alias)
      if (!terminalOwner.has(terminal)) terminalOwner.set(terminal, component.id)
      terminalOwner.set(alias, component.id)
      pins[pinDef.id] = terminal
      componentPinsOf.push({ componentId: component.id, pinId: pinDef.id, terminal })
      if (component.anchor && !resolvedPin.hole) invalidPins.push(pinDef.id)
    }
    pinTerminals[component.id] = pins
    if (invalidPins.length) {
      issues.push({
        code: 'unplaced_pin',
        message: `${def.name} has ${invalidPins.length} pin${invalidPins.length > 1 ? 's' : ''} off the breadboard (${invalidPins.join(', ')}).`,
        componentIds: [component.id],
        terminals: invalidPins.map((pinId) => `${component.id}:${pinId}`),
        severity: 'error',
      })
    }
    // Permanently joined pins declared by the model (`bonds`).
    for (const element of def.model ?? []) {
      for (const bond of element.bonds ?? []) {
        for (let i = 1; i < bond.length; i++) {
          const a = pins[bond[0]]
          const b = pins[bond[i]]
          if (a && b) uf.union(a, b)
        }
      }
    }
    if (def.category === 'mcu' && !mcuComponent) {
      mcuComponent = component
      mcuBoard = boards.getBoard(def.board ?? component.type) ?? null
    }
  }

  // --- wires --------------------------------------------------------------------------------------------------
  for (const w of doc?.wires ?? []) {
    if (!w?.from || !w?.to) continue
    for (const terminal of [w.from, w.to]) {
      uf.add(terminal)
      joinStrip(terminal)
    }
    uf.union(w.from, w.to)
  }

  // --- MCU grounds and internally tied pins -------------------------------------------------------------------
  let groundRoot = null
  if (mcuComponent && mcuBoard) {
    const pins = pinTerminals[mcuComponent.id] ?? {}
    for (const pin of mcuBoard.pins) {
      const terminal = pins[pin.name]
      if (!terminal) continue
      if (pin.kind === 'ground') groundRoot = groundRoot === null ? uf.find(terminal) : uf.union(groundRoot, terminal)
      if (pin.tiedTo && pins[pin.tiedTo]) uf.union(terminal, pins[pin.tiedTo])
    }
    if (groundRoot !== null) groundRoot = uf.find(groundRoot)
  } else {
    issues.push({ code: 'no_mcu', message: 'No microcontroller on the canvas — add a board to power the circuit.', severity: 'error' })
  }

  // --- net ids and members ------------------------------------------------------------------------------------
  const rootToId = new Map()
  if (groundRoot !== null) rootToId.set(groundRoot, GND_NET)
  const nets = []
  const netById = new Map()
  const terminalToNet = {}
  const stripNets = {}
  let counter = 0

  const netFor = (root) => {
    let id = rootToId.get(root)
    if (!id) {
      id = `n${++counter}`
      rootToId.set(root, id)
    }
    let net = netById.get(id)
    if (!net) {
      net = { id, terminals: [], label: null, componentPins: [], external: false }
      netById.set(id, net)
      nets.push(net)
    }
    return net
  }
  if (groundRoot !== null) netFor(groundRoot)

  for (const key of uf.keys()) {
    const net = netFor(uf.find(key))
    if (key.startsWith(STRIP_PREFIX)) {
      stripNets[key.slice(STRIP_PREFIX.length)] = net.id
      continue
    }
    net.terminals.push(key)
    terminalToNet[key] = net.id
    if (terminalOwner.get(key) !== mcuComponent?.id) net.external = true
  }
  // Every hole of a live strip resolves to that strip's net, so tooltips and quest selectors can name any hole
  // of it (`net.terminals` still lists only the holes something is actually plugged into).
  for (const [stripKey, netId] of Object.entries(stripNets)) {
    const separator = stripKey.indexOf(':')
    const boardId = stripKey.slice(0, separator)
    const bb = findBreadboard(doc, boardId)
    if (!bb) continue
    for (const hole of holesInStrip(bb.type, stripKey.slice(separator + 1))) {
      const ref = `${boardId}:${hole.name}`
      if (terminalToNet[ref] === undefined) terminalToNet[ref] = netId
    }
  }

  for (const entry of componentPinsOf) {
    const netId = terminalToNet[entry.terminal]
    const net = netId ? netById.get(netId) : null
    if (net) net.componentPins.push({ componentId: entry.componentId, pinId: entry.pinId })
  }

  // --- MCU pin map, labels ------------------------------------------------------------------------------------
  let mcu = null
  if (mcuComponent && mcuBoard) {
    const pins = pinTerminals[mcuComponent.id] ?? {}
    const pinNet = {}
    for (const pin of mcuBoard.pins) {
      const terminal = pins[pin.name]
      const netId = terminal ? terminalToNet[terminal] : null
      if (netId) pinNet[pin.name] = netId
    }
    mcu = { componentId: mcuComponent.id, board: mcuBoard, pinNet }
    labelNets(nets, netById, mcuBoard, pinNet)

    for (const pin of mcuBoard.pins) {
      if (pin.kind !== 'power' || pin.volts == null) continue
      if (pinNet[pin.name] === GND_NET) {
        issues.push({
          code: 'vcc_gnd_short',
          message: `${pin.name} is wired straight to GND — that is a short circuit.`,
          componentIds: [mcuComponent.id],
          terminals: [pins[pin.name]].filter(Boolean),
          severity: 'error',
        })
      }
    }
  }

  // --- floating components ------------------------------------------------------------------------------------
  for (const component of components) {
    if (!component || component.id === mcuComponent?.id) continue
    const def = registry.getDef(component.type)
    if (!def) continue
    const pins = pinTerminals[component.id] ?? {}
    let connected = false
    for (const terminal of Object.values(pins)) {
      const net = netById.get(terminalToNet[terminal])
      if (net?.componentPins.some((p) => p.componentId !== component.id)) {
        connected = true
        break
      }
    }
    if (!connected) {
      issues.push({
        code: 'floating_component',
        message: `${def.name} is not connected to anything — add wires to hook it into the circuit.`,
        componentIds: [component.id],
        terminals: Object.values(pins),
        severity: 'warning',
      })
    }
  }

  return { nets, netById, terminalToNet, stripNets, mcu, pinTerminals, issues }
}

/** Net labels: power labels win over MCU pin names; tied header pins (Uno SCL) never name a net. */
function labelNets(nets, netById, board, pinNet) {
  const byNet = new Map()
  for (const pin of board.pins) {
    const netId = pinNet[pin.name]
    if (!netId) continue
    if (!byNet.has(netId)) byNet.set(netId, [])
    byNet.get(netId).push(pin)
  }
  for (const [netId, pins] of byNet) {
    const net = netById.get(netId)
    if (!net) continue
    if (netId === GND_NET) {
      net.label = 'GND'
      continue
    }
    const power = pins.filter((p) => p.kind === 'power' || p.kind === 'ground')
    if (power.length) {
      power.sort((a, b) => labelRank(a.name) - labelRank(b.name))
      net.label = power[0].kind === 'ground' ? 'GND' : power[0].name
      continue
    }
    net.label = (pins.find((p) => !p.tiedTo) ?? pins[0]).name
  }
  for (const net of nets) if (net.label === undefined) net.label = null
}

function labelRank(name) {
  const idx = POWER_LABEL_ORDER.indexOf(name)
  return idx === -1 ? POWER_LABEL_ORDER.length : idx
}

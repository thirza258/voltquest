/** Ideal Boolean circuits. No host execution or physical timing is implied. */
export const GATES = Object.freeze({ BUF: 1, NOT: 1, AND: 2, OR: 2, XOR: 2, NAND: 2, NOR: 2, XNOR: 2, MUX: 3, DFF: 3 })
export const MAX_CIRCUIT_SOURCE = 16384
const identifier = /^[A-Za-z][A-Za-z0-9_]{0,31}$/
const bit = value => value === 0 || value === 1

export function gate(type, args) {
  const [a, b, s] = args
  switch (type) {
    case 'BUF': return a
    case 'NOT': return 1 - a
    case 'AND': return a & b
    case 'OR': return a | b
    case 'XOR': return a ^ b
    case 'NAND': return 1 - (a & b)
    case 'NOR': return 1 - (a | b)
    case 'XNOR': return 1 - (a ^ b)
    case 'MUX': return s ? b : a
    default: throw new Error(`Unknown combinational gate: ${type}.`)
  }
}

export function parseCircuit(source) {
  if (typeof source !== 'string' || source.length > MAX_CIRCUIT_SOURCE) throw new Error('Keep circuit source within 16384 characters.')
  const inputs = [], nodes = [], outputs = [], names = new Set(), outputNames = new Set()
  function claim(name, line) {
    if (!identifier.test(name) || names.has(name)) throw new Error(`Line ${line}: invalid or duplicate signal ${name}.`)
    names.add(name)
  }
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1, text = raw.split(/[;#]/)[0].trim()
    if (!text) return
    const parts = text.split(/\s+/)
    if (parts[0] === 'INPUT') {
      if (parts.length < 2) throw new Error(`Line ${line}: INPUT needs signal names.`)
      parts.slice(1).forEach(name => { claim(name, line); inputs.push(name) })
    } else if (parts[0] === 'OUTPUT') {
      if (parts.length < 2) throw new Error(`Line ${line}: OUTPUT needs name=signal pairs.`)
      parts.slice(1).forEach(pair => {
        const match = pair.match(/^([A-Za-z][A-Za-z0-9_]{0,31})=([A-Za-z][A-Za-z0-9_]{0,31}|[01])$/)
        if (!match || outputNames.has(match[1])) throw new Error(`Line ${line}: invalid or duplicate output ${pair}.`)
        outputNames.add(match[1]); outputs.push({ name: match[1], signal: match[2] })
      })
    } else {
      const match = text.match(/^([A-Za-z][A-Za-z0-9_]{0,31})\s*=\s*([A-Z]+)\s+(.+)$/)
      if (!match || !Object.hasOwn(GATES, match[2])) throw new Error(`Line ${line}: use name = GATE inputs.`)
      const [, id, type, rest] = match, args = rest.trim().split(/\s+/)
      if (args.length !== GATES[type]) throw new Error(`Line ${line}: ${type} needs ${GATES[type]} inputs.`)
      claim(id, line); nodes.push({ id, type, args, line })
    }
  })
  if (inputs.length > 16 || nodes.length > 256 || outputs.length > 16 || !outputs.length) throw new Error('Use at most 16 inputs, 256 gates and 1–16 outputs.')
  for (const ref of [...nodes.flatMap(node => node.args), ...outputs.map(output => output.signal)]) {
    if (ref !== '0' && ref !== '1' && !names.has(ref)) throw new Error(`Unknown signal ${ref}.`)
  }
  const circuit = { inputs, nodes, outputs }
  evaluateCircuit(circuit) // Reject cycles, including disconnected combinational cycles.
  return circuit
}

export function evaluateCircuit(circuit, inputs = {}, memory = {}) {
  const values = new Map([['0', 0], ['1', 1]]), depths = new Map([['0', 0], ['1', 0]])
  const nodes = new Map(circuit.nodes.map(node => [node.id, node])), visiting = new Set()
  for (const id of circuit.inputs) {
    const value = Object.hasOwn(inputs, id) ? inputs[id] : 0
    if (!bit(value)) throw new Error(`Input ${id} must be 0 or 1.`)
    values.set(id, value); depths.set(id, 0)
  }
  for (const node of circuit.nodes.filter(node => node.type === 'DFF')) {
    const value = Object.hasOwn(memory, node.id) ? memory[node.id] : 0
    if (!bit(value)) throw new Error(`Register ${node.id} must be 0 or 1.`)
    values.set(node.id, value); depths.set(node.id, 0)
  }
  function resolve(id) {
    if (values.has(id)) return values.get(id)
    if (visiting.has(id)) throw new Error(`Combinational feedback at ${id}. Use DFF for clocked storage.`)
    const node = nodes.get(id)
    if (!node) throw new Error(`Unknown signal ${id}.`)
    visiting.add(id)
    const args = node.args.map(resolve), value = gate(node.type, args)
    visiting.delete(id); values.set(id, value)
    depths.set(id, 1 + Math.max(...node.args.map(arg => depths.get(arg))))
    return value
  }
  circuit.nodes.forEach(node => resolve(node.id))
  return {
    signals: Object.fromEntries(values), depths: Object.fromEntries(depths),
    outputs: Object.fromEntries(circuit.outputs.map(output => [output.name, resolve(output.signal)])),
    depth: Math.max(0, ...depths.values()),
  }
}

/** Sample every DFF's OLD-state inputs before updating any Q. Reset is synchronous and wins. */
export function clockCircuit(circuit, inputs = {}, memory = {}) {
  const before = evaluateCircuit(circuit, inputs, memory)
  const next = Object.fromEntries(circuit.nodes.filter(node => node.type === 'DFF').map(node => {
    const [data, enable, reset] = node.args.map(id => before.signals[id])
    return [node.id, reset ? 0 : enable ? data : before.signals[node.id]]
  }))
  return { memory: next, ...evaluateCircuit(circuit, inputs, next) }
}

export function truthTable(circuit) {
  if (circuit.nodes.some(node => node.type === 'DFF')) throw new Error('Storage needs a sequence of clock edges, not a combinational truth table.')
  if (circuit.inputs.length > 6) throw new Error('Truth tables are limited to six inputs (64 rows). Test larger buses with chosen input patterns.')
  return Array.from({ length: 2 ** circuit.inputs.length }, (_, row) => {
    const inputs = Object.fromEntries(circuit.inputs.map((id, index) => [id, (row >> (circuit.inputs.length - index - 1)) & 1]))
    return { inputs, outputs: evaluateCircuit(circuit, inputs).outputs }
  })
}

/** Active-high NOR latch, settled behavior only. Invalid release stays unknown until set/reset. */
export function settleLatch(previous, set, reset) {
  if (![0, 1, null].includes(previous) || !bit(set) || !bit(reset)) throw new Error('Latch controls must be bits.')
  if (set && reset) return { q: null, nq: null, invalid: true, physicalOutputs: [0, 0] }
  const q = set ? 1 : reset ? 0 : previous
  return { q, nq: q === null ? null : 1 - q, invalid: q === null, physicalOutputs: q === null ? null : [q, 1 - q] }
}

export const bits = (value, width = 4) => value.toString(2).padStart(width, '0')
export function add4(a, b, carry = 0) {
  let result = 0
  for (let i = 0; i < 4; i++) {
    const x = (a >> i) & 1, y = (b >> i) & 1, p = gate('XOR', [x, y])
    result |= gate('XOR', [p, carry]) << i
    carry = gate('OR', [gate('AND', [x, y]), gate('AND', [p, carry])])
  }
  return { value: result, carry }
}

/**
 * Modified Nodal Analysis solver — CONTRACTS §5.2.
 *
 * Every element is reduced to one of three linear branches (no extra current unknowns, so the matrix is just
 * the node-conductance matrix):
 *
 *   { kind:'g',    a, b, g, volts }        current a→b = g·(Va − Vb − volts)   (resistor, or a Thevenin source)
 *   { kind:'i',    a, b, i }               current a→b = i                     (independent current source)
 *   { kind:'vccs', a, b, cp, cn, gm }      current a→b = gm·(Vcp − Vcn)        (transistor collector current)
 *
 * Node indices are net indices; `refIndex` is the reference net (ground, held at 0 V) and `-1` means "not
 * connected". Every non-reference node gets `GMIN` to ground, so an undriven node solves to 0 V instead of
 * making the matrix singular.
 *
 * The reference node is eliminated before assembly, which means a branch to ground does NOT join two nodes:
 * the matrix splits into independent blocks (one per galvanically connected sub-circuit). We solve each block
 * on its own with dense LU + partial pivoting, which keeps a 50-component document far below the 2 ms budget
 * even though the solver itself is dense.
 */

/** Leakage conductance from every node to ground (S). */
export const GMIN = 1e-12
/** No element may contribute more than 1e3 S (resistance floor of 1 mΩ). */
export const MAX_CONDUCTANCE = 1e3

/**
 * Conductance of a resistance in ohms, floored at 1 mΩ (`MAX_CONDUCTANCE`) and safe for 0/NaN input.
 * @param {number} ohms
 */
export function conductance(ohms) {
  const r = Number(ohms)
  if (!Number.isFinite(r) || r <= 1 / MAX_CONDUCTANCE) return MAX_CONDUCTANCE
  return 1 / r
}

/** Conductance branch (Thevenin source when `volts !== 0`). */
export function gBranch(a, b, g, volts = 0, extra = null) {
  const branch = { kind: 'g', a, b, g, volts }
  return extra ? Object.assign(branch, extra) : branch
}

/** Independent current source pushing `i` amps from node `a` to node `b`. */
export function iBranch(a, b, i, extra = null) {
  const branch = { kind: 'i', a, b, i }
  return extra ? Object.assign(branch, extra) : branch
}

/** Voltage-controlled current source: `gm·(Vcp − Vcn)` amps from `a` to `b`. */
export function vccsBranch(a, b, cp, cn, gm, extra = null) {
  const branch = { kind: 'vccs', a, b, cp, cn, gm }
  return extra ? Object.assign(branch, extra) : branch
}

/**
 * Current flowing through a branch from its `a` node to its `b` node, given a solved voltage vector.
 * @param {object} branch
 * @param {Float64Array} v node voltages indexed by net
 */
export function branchCurrent(branch, v) {
  const va = branch.a >= 0 ? v[branch.a] : 0
  const vb = branch.b >= 0 ? v[branch.b] : 0
  switch (branch.kind) {
    case 'g':
      return branch.g * (va - vb - branch.volts)
    case 'i':
      return branch.i
    case 'vccs': {
      const vp = branch.cp >= 0 ? v[branch.cp] : 0
      const vn = branch.cn >= 0 ? v[branch.cn] : 0
      return branch.gm * (vp - vn)
    }
    default:
      return 0
  }
}

/** In-place LU factorisation with partial pivoting; returns false when the block is singular. */
function luFactor(a, n, pivot) {
  for (let i = 0; i < n; i++) pivot[i] = i
  for (let col = 0; col < n; col++) {
    let best = col
    let bestAbs = Math.abs(a[col * n + col])
    for (let row = col + 1; row < n; row++) {
      const abs = Math.abs(a[row * n + col])
      if (abs > bestAbs) {
        best = row
        bestAbs = abs
      }
    }
    if (bestAbs < 1e-300) return false
    if (best !== col) {
      for (let k = 0; k < n; k++) {
        const tmp = a[col * n + k]
        a[col * n + k] = a[best * n + k]
        a[best * n + k] = tmp
      }
      const p = pivot[col]
      pivot[col] = pivot[best]
      pivot[best] = p
    }
    const diag = a[col * n + col]
    for (let row = col + 1; row < n; row++) {
      const factor = a[row * n + col] / diag
      if (factor === 0) continue
      a[row * n + col] = factor
      for (let k = col + 1; k < n; k++) a[row * n + k] -= factor * a[col * n + k]
    }
  }
  return true
}

/** Forward/back substitution for a factorised block. */
function luSolve(a, n, pivot, rhs, out) {
  for (let i = 0; i < n; i++) {
    let sum = rhs[pivot[i]]
    for (let k = 0; k < i; k++) sum -= a[i * n + k] * out[k]
    out[i] = sum
  }
  for (let i = n - 1; i >= 0; i--) {
    let sum = out[i]
    for (let k = i + 1; k < n; k++) sum -= a[i * n + k] * out[k]
    out[i] = sum / a[i * n + i]
  }
}

function findRoot(parent, i) {
  let root = i
  while (parent[root] !== root) root = parent[root]
  while (parent[i] !== root) {
    const next = parent[i]
    parent[i] = root
    i = next
  }
  return root
}

/**
 * Solve the branch network for node voltages.
 * @param {object[]} branches
 * @param {number} netCount total number of nets
 * @param {number} refIndex index of the reference net (held at 0 V); -1 when the circuit has no ground
 * @returns {{ voltages: Float64Array, ok: boolean }}
 */
export function solveBranches(branches, netCount, refIndex) {
  const voltages = new Float64Array(netCount)
  if (netCount === 0) return { voltages, ok: true }
  const parent = new Int32Array(netCount)
  for (let i = 0; i < netCount; i++) parent[i] = i

  const nodesOf = (branch) => {
    const nodes = [branch.a, branch.b]
    if (branch.kind === 'vccs') nodes.push(branch.cp, branch.cn)
    return nodes
  }
  for (const branch of branches) {
    let first = -1
    for (const node of nodesOf(branch)) {
      if (node < 0 || node === refIndex) continue
      if (first === -1) first = node
      else {
        const ra = findRoot(parent, first)
        const rb = findRoot(parent, node)
        if (ra !== rb) parent[rb] = ra
      }
    }
  }

  /** root → { nodes: number[], branches: object[] } */
  const blocks = new Map()
  const localIndex = new Int32Array(netCount).fill(-1)
  for (let net = 0; net < netCount; net++) {
    if (net === refIndex) continue
    const root = findRoot(parent, net)
    let block = blocks.get(root)
    if (!block) {
      block = { nodes: [], branches: [] }
      blocks.set(root, block)
    }
    localIndex[net] = block.nodes.length
    block.nodes.push(net)
  }
  for (const branch of branches) {
    let anchor = -1
    for (const node of nodesOf(branch)) {
      if (node >= 0 && node !== refIndex) {
        anchor = node
        break
      }
    }
    if (anchor === -1) continue
    blocks.get(findRoot(parent, anchor)).branches.push(branch)
  }

  let ok = true
  for (const block of blocks.values()) {
    const n = block.nodes.length
    const matrix = new Float64Array(n * n)
    const rhs = new Float64Array(n)
    for (let i = 0; i < n; i++) matrix[i * n + i] = GMIN
    for (const branch of block.branches) {
      const a = branch.a >= 0 && branch.a !== refIndex ? localIndex[branch.a] : -1
      const b = branch.b >= 0 && branch.b !== refIndex ? localIndex[branch.b] : -1
      if (branch.kind === 'g') {
        const g = branch.g
        if (a >= 0) {
          matrix[a * n + a] += g
          rhs[a] += g * branch.volts
        }
        if (b >= 0) {
          matrix[b * n + b] += g
          rhs[b] -= g * branch.volts
        }
        if (a >= 0 && b >= 0) {
          matrix[a * n + b] -= g
          matrix[b * n + a] -= g
        }
      } else if (branch.kind === 'i') {
        if (a >= 0) rhs[a] -= branch.i
        if (b >= 0) rhs[b] += branch.i
      } else if (branch.kind === 'vccs') {
        const cp = branch.cp >= 0 && branch.cp !== refIndex ? localIndex[branch.cp] : -1
        const cn = branch.cn >= 0 && branch.cn !== refIndex ? localIndex[branch.cn] : -1
        const gm = branch.gm
        if (a >= 0 && cp >= 0) matrix[a * n + cp] += gm
        if (a >= 0 && cn >= 0) matrix[a * n + cn] -= gm
        if (b >= 0 && cp >= 0) matrix[b * n + cp] -= gm
        if (b >= 0 && cn >= 0) matrix[b * n + cn] += gm
      }
    }

    if (n === 1) {
      const diag = matrix[0]
      voltages[block.nodes[0]] = Math.abs(diag) < 1e-300 ? 0 : rhs[0] / diag
      continue
    }
    const pivot = new Int32Array(n)
    const out = new Float64Array(n)
    if (!luFactor(matrix, n, pivot)) {
      ok = false
      continue
    }
    luSolve(matrix, n, pivot, rhs, out)
    for (let i = 0; i < n; i++) {
      const value = out[i]
      if (Number.isFinite(value)) voltages[block.nodes[i]] = value
      else ok = false
    }
  }
  return { voltages, ok }
}

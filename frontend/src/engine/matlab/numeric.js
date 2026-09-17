export const LIMITS = Object.freeze({ cells: 16384, allocations: 2000000, operations: 2000000, variables: 128, output: 200, plots: 8 })
export const isMatrix = value => value?.kind === 'matrix'
export const scalar = value => {
  if (!isMatrix(value) || value.data.length !== 1) throw new Error('This operation requires one real scalar.')
  return value.data[0]
}
export const vector = value => {
  if (!isMatrix(value) || (value.rows > 1 && value.cols > 1)) throw new Error('This function requires a row or column vector.')
  return value.data
}

/** Column-major matrices with explicit allocation and arithmetic budgets. */
export function createNumeric(budget) {
  function mat(rows, cols, source = () => 0, logical = false) {
    const count = rows * cols
    if (![rows, cols].every(n => Number.isInteger(n) && n >= 0 && n <= LIMITS.cells) || count > LIMITS.cells) throw new Error('Arrays must fit within 16,384 elements.')
    budget.allocate(count); budget.tick(count)
    const data = Array.from({ length: count }, (_, i) => typeof source === 'function' ? source(i % rows, Math.floor(i / rows), i) : source[i])
    if (data.some(n => !Number.isFinite(n))) throw new Error('This sandbox supports finite real numbers only. Check division by zero, overflow and function domains.')
    return { kind: 'matrix', rows, cols, data, ...(logical ? { logical: true } : {}) }
  }
  const num = n => mat(1, 1, [n])
  const at = (a, r, c) => a.data[c * a.rows + r]
  function numeric(a) { if (!isMatrix(a)) throw new Error('Expected a real numeric array.'); return a }
  function map(a, fn, logical = false) { numeric(a); return mat(a.rows, a.cols, (r, c) => fn(at(a, r, c)), logical) }
  function pair(a, b, fn, logical = false) {
    numeric(a); numeric(b)
    // Deliberately restricted: same-size arrays or scalar expansion, no implicit singleton expansion.
    if (a.data.length !== 1 && b.data.length !== 1 && (a.rows !== b.rows || a.cols !== b.cols)) throw new Error('Use equal array sizes or a scalar. General implicit expansion is desktop-only.')
    const shape = a.data.length === 1 ? b : a
    return mat(shape.rows, shape.cols, (r, c) => fn(a.data.length === 1 ? a.data[0] : at(a, r, c), b.data.length === 1 ? b.data[0] : at(b, r, c)), logical)
  }
  function transpose(a) { numeric(a); return mat(a.cols, a.rows, (r, c) => at(a, c, r), a.logical) }
  function multiply(a, b) {
    numeric(a); numeric(b)
    if (a.data.length === 1 || b.data.length === 1) return pair(a, b, (x, y) => x * y)
    if (a.cols !== b.rows) throw new Error('Matrix multiplication needs matching inner dimensions. Use .* for element-wise products.')
    budget.tick(a.rows * a.cols * b.cols)
    return mat(a.rows, b.cols, (r, c) => { let total = 0; for (let k = 0; k < a.cols; k++) total += at(a, r, k) * at(b, k, c); return total })
  }
  function solve(a, b) {
    numeric(a); numeric(b)
    if (a.rows !== b.rows || a.rows < a.cols || a.cols < 1 || Math.max(a.rows, b.cols) > 128) throw new Error('A\\b needs a full-rank square or tall A, matching rows in b, and dimensions at most 128.')
    if (a.rows > a.cols) {
      // Twice-reorthogonalized modified Gram-Schmidt for small, full-rank least-squares teaching cases.
      const m = a.rows, n = a.cols, q = mat(m, n), r = mat(n, n)
      budget.tick(2 * m * n * n)
      const scale = Math.max(...a.data.map(Math.abs))
      for (let j = 0; j < n; j++) {
        const v = a.data.slice(j * m, (j + 1) * m)
        for (let pass = 0; pass < 2; pass++) for (let k = 0; k < j; k++) {
          let projection = 0
          for (let row = 0; row < m; row++) projection += at(q, row, k) * v[row]
          r.data[j * n + k] += projection
          for (let row = 0; row < m; row++) v[row] -= projection * at(q, row, k)
        }
        const length = Math.hypot(...v)
        if (length <= scale * 1e-12) throw new Error('The matrix is singular or too ill-conditioned for this teaching solver.')
        r.data[j * n + j] = length
        for (let row = 0; row < m; row++) q.data[j * m + row] = v[row] / length
      }
      return solve(r, multiply(transpose(q), b))
    }
    const n = a.rows, width = n + b.cols, aug = []
    budget.allocate(n * width); budget.tick(n * n * width)
    for (let row = 0; row < n; row++) aug.push([...Array.from({ length: n }, (_, c) => at(a, row, c)), ...Array.from({ length: b.cols }, (_, c) => at(b, row, c))])
    const scale = Math.max(...a.data.map(Math.abs))
    for (let k = 0; k < n; k++) {
      let pivot = k
      for (let r = k + 1; r < n; r++) if (Math.abs(aug[r][k]) > Math.abs(aug[pivot][k])) pivot = r
      if (Math.abs(aug[pivot][k]) <= scale * 1e-12) throw new Error('The matrix is singular or too ill-conditioned for this teaching solver.')
      ;[aug[k], aug[pivot]] = [aug[pivot], aug[k]]
      for (let r = k + 1; r < n; r++) { const f = aug[r][k] / aug[k][k]; for (let c = k; c < width; c++) aug[r][c] -= f * aug[k][c] }
    }
    const x = mat(n, b.cols)
    for (let c = 0; c < b.cols; c++) for (let r = n - 1; r >= 0; r--) {
      let value = aug[r][n + c]
      for (let k = r + 1; k < n; k++) value -= aug[r][k] * at(x, k, c)
      x.data[c * n + r] = value / aug[r][r]
    }
    return mat(x.rows, x.cols, x.data)
  }
  function range(start, step, end) {
    if (!Number.isFinite(step) || step === 0) throw new Error('A range needs a nonzero finite step.')
    const n = Math.max(0, Math.floor((end - start) / step + 1e-10) + 1)
    return mat(1, n, (_r, _c, i) => start + i * step)
  }
  function indices(value, size) {
    if (value === ':') return Array.from({ length: size }, (_, i) => i)
    numeric(value)
    if (value.logical) {
      if (value.data.length !== size) throw new Error('A logical index must match the indexed dimension in this sandbox.')
      return value.data.flatMap((n, i) => n ? [i] : [])
    }
    if (value.data.some(i => !Number.isInteger(i) || i < 1 || i > size)) throw new Error(`Array indices must be integers from 1 to ${size}. Preallocate before indexed assignment.`)
    return value.data.map(i => i - 1)
  }
  function selection(a, args) {
    numeric(a)
    if (args.length === 1) {
      const idx = indices(args[0], a.data.length)
      const originalVector = a.rows === 1 || a.cols === 1
      const indexVector = isMatrix(args[0]) && (args[0].rows === 1 || args[0].cols === 1)
      let rows = idx.length, cols = 1
      if (originalVector && indexVector) { rows = a.rows === 1 ? 1 : idx.length; cols = a.rows === 1 ? idx.length : 1 }
      else if (isMatrix(args[0]) && !args[0].logical) { rows = args[0].rows; cols = args[0].cols }
      return { idx, rows, cols }
    }
    if (args.length !== 2) throw new Error('Use one or two indices for a numeric array.')
    const rr = indices(args[0], a.rows), cc = indices(args[1], a.cols)
    if (rr.length * cc.length > LIMITS.cells) throw new Error('The indexed result exceeds 16,384 elements.')
    return { idx: cc.flatMap(c => rr.map(r => c * a.rows + r)), rows: rr.length, cols: cc.length }
  }
  function reduce(a, fn, dimension) {
    numeric(a)
    const dim = dimension === undefined ? (a.rows === 1 ? 2 : 1) : scalar(dimension)
    if (![1, 2].includes(dim)) throw new Error('The reduction dimension must be 1 or 2.')
    if (a.rows === 0 && a.cols === 0 && dimension === undefined) return num(fn([]))
    return dim === 1 ? mat(1, a.cols, (_r, c) => fn(a.data.slice(c * a.rows, (c + 1) * a.rows)))
      : mat(a.rows, 1, r => fn(Array.from({ length: a.cols }, (_, c) => at(a, r, c))))
  }
  return { mat, num, at, numeric, map, pair, transpose, multiply, solve, range, selection, reduce }
}

import { scalar, vector, LIMITS } from './numeric.js'

/** Exact supported signatures. Optional toolbox functions belong to the learning reference only. */
export const SIGNATURES = {
  abs: 'abs(A)', sqrt: 'sqrt(A)', exp: 'exp(A)', log: 'log(A)', log10: 'log10(A)', log2: 'log2(A)',
  sin: 'sin(A)', cos: 'cos(A)', tan: 'tan(A)', asin: 'asin(A)', acos: 'acos(A)', atan: 'atan(A)',
  sind: 'sind(A)', cosd: 'cosd(A)', tand: 'tand(A)', floor: 'floor(A)', ceil: 'ceil(A)', round: 'round(A)', fix: 'fix(A)', sign: 'sign(A)',
  mod: 'mod(A,B)', rem: 'rem(A,B)', atan2: 'atan2(Y,X)', hypot: 'hypot(A,B)',
  zeros: 'zeros(n) or zeros(m,n)', ones: 'ones(n) or ones(m,n)', eye: 'eye(n)',
  linspace: 'linspace(a,b,n)', logspace: 'logspace(a,b,n)', reshape: 'reshape(A,m,n)', transpose: 'transpose(A)', diag: 'diag(v) or diag(A)',
  size: 'size(A) or size(A,dim)', numel: 'numel(A)', length: 'length(A)',
  sum: 'sum(A) or sum(A,dim)', prod: 'prod(A) or prod(A,dim)', mean: 'mean(A) or mean(A,dim)',
  median: 'median(A) or median(A,dim)', std: 'std(A) or std(A,0|1)', var: 'var(A) or var(A,0|1)',
  min: 'min(A) or min(A,B)', max: 'max(A) or max(A,B)', sort: 'sort(v)', cumsum: 'cumsum(v)',
  diff: 'diff(v)', gradient: 'gradient(v) or gradient(v,h)', trapz: 'trapz(y) or trapz(x,y)',
  dot: 'dot(a,b)', cross: 'cross(a,b)', norm: 'norm(v) or norm(A,"fro")', det: 'det(A)', inv: 'inv(A)',
  polyfit: 'polyfit(x,y,degree)', polyval: 'polyval(p,x)', interp1: 'interp1(x,y,xq)', conv: 'conv(a,b)',
  any: 'any(A) or any(A,dim)', all: 'all(A) or all(A,dim)', find: 'find(A)', logical: 'logical(A)', double: 'double(A)',
  rand: 'rand() or rand(n) or rand(m,n)', randn: 'randn() or randn(n) or randn(m,n)', rng: 'rng(seed)',
  disp: 'disp(value)', assert: 'assert(condition) or assert(condition,"message")',
  plot: 'plot(y) or plot(x,y)', title: 'title("text")', xlabel: 'xlabel("text")', ylabel: 'ylabel("text")', hold: 'hold("on"|"off")',
  fzero: 'fzero(@(x) expression,[a,b])',
}

export function createFunctions(n, context) {
  const { mat, num, numeric, map, pair, at, transpose, solve, reduce } = n
  const functions = Object.create(null)
  const define = (name, min, max, fn) => { functions[name] = args => {
    if (args.length < min || args.length > max) throw new Error(`Supported syntax: ${SIGNATURES[name]}.`)
    return fn(...args)
  } }
  const round = x => Math.sign(x) * Math.floor(Math.abs(x) + 0.5)
  const unary = { abs: Math.abs, sqrt: Math.sqrt, exp: Math.exp, log: Math.log, log10: Math.log10, log2: Math.log2,
    sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sind: x => Math.sin(x * Math.PI / 180), cosd: x => Math.cos(x * Math.PI / 180), tand: x => Math.tan(x * Math.PI / 180),
    floor: Math.floor, ceil: Math.ceil, round, fix: Math.trunc, sign: Math.sign }
  for (const [name, fn] of Object.entries(unary)) define(name, 1, 1, a => map(a, fn))
  for (const [name, fn] of Object.entries({ mod: (a, b) => b === 0 ? a : a - b * Math.floor(a / b), rem: (a, b) => a % b, atan2: Math.atan2, hypot: Math.hypot })) define(name, 2, 2, (a, b) => pair(a, b, fn))
  for (const name of ['zeros', 'ones', 'rand', 'randn']) define(name, name.startsWith('rand') ? 0 : 1, 2, (r, c) => {
    const rows = r === undefined ? 1 : scalar(r), cols = c === undefined ? rows : scalar(c)
    return mat(rows, cols, () => name === 'zeros' ? 0 : name === 'ones' ? 1 : name === 'rand' ? context.random()
      : Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, context.random()))) * Math.cos(2 * Math.PI * context.random()))
  })
  define('eye', 1, 1, a => mat(scalar(a), scalar(a), (r, c) => Number(r === c)))
  for (const name of ['linspace', 'logspace']) define(name, 3, 3, (a, b, count) => {
    const start = scalar(a), end = scalar(b), length = scalar(count)
    return mat(1, length, (_r, _c, i) => { const x = length === 1 ? end : start + (end - start) * i / (length - 1); return name === 'logspace' ? 10 ** x : x })
  })
  define('reshape', 3, 3, (a, r, c) => {
    numeric(a); if (scalar(r) * scalar(c) !== a.data.length) throw new Error('reshape must preserve the number of elements.')
    return mat(scalar(r), scalar(c), a.data, a.logical)
  })
  define('transpose', 1, 1, transpose)
  define('diag', 1, 1, a => {
    numeric(a)
    if (a.rows === 1 || a.cols === 1) return mat(a.data.length, a.data.length, (r, c) => r === c ? a.data[r] : 0)
    return mat(Math.min(a.rows, a.cols), 1, r => at(a, r, r))
  })
  define('size', 1, 2, (a, dimension) => {
    numeric(a); if (dimension === undefined) return mat(1, 2, [a.rows, a.cols])
    const d = scalar(dimension); if (!Number.isInteger(d) || d < 1) throw new Error('size dimension must be a positive integer.')
    return num(d === 1 ? a.rows : d === 2 ? a.cols : 1)
  })
  define('numel', 1, 1, a => num(numeric(a).data.length))
  define('length', 1, 1, a => num(Math.max(numeric(a).rows, a.cols)))
  const sum = values => values.reduce((s, x) => s + x, 0)
  const average = values => sum(values) / values.length
  const middle = values => { const sorted = [...values].sort((a, b) => a - b); const k = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[k] : (sorted[k - 1] + sorted[k]) / 2 }
  for (const [name, fn] of Object.entries({ sum, prod: a => a.reduce((p, x) => p * x, 1), mean: average, median: middle, any: a => Number(a.some(Boolean)), all: a => Number(a.every(Boolean)) })) define(name, 1, 2, (a, dim) => {
    const result = reduce(a, fn, dim); return ['any', 'all'].includes(name) ? { ...result, logical: true } : result
  })
  for (const name of ['std', 'var']) define(name, 1, 2, (a, normalization) => {
    const flag = normalization === undefined ? 0 : scalar(normalization)
    if (![0, 1].includes(flag)) throw new Error('Use 0 for sample normalization or 1 for population normalization.')
    return reduce(a, values => { const mean = average(values); const variance = sum(values.map(x => (x - mean) ** 2)) / Math.max(1, values.length - (1 - flag)); return name === 'std' ? Math.sqrt(variance) : variance })
  })
  for (const name of ['min', 'max']) define(name, 1, 2, (a, b) => b === undefined ? numeric(a).data.length === 0 ? mat(a.rows, a.cols) : reduce(a, values => Math[name](...values)) : pair(a, b, Math[name]))
  define('sort', 1, 1, a => mat(a.rows, a.cols, [...vector(a)].sort((x, y) => x - y)))
  define('cumsum', 1, 1, a => { let total = 0; return mat(a.rows, a.cols, vector(a).map(x => (total += x))) })
  define('diff', 1, 1, a => { const values = vector(a).slice(1).map((x, i) => x - a.data[i]); return mat(a.rows === 1 ? 1 : values.length, a.rows === 1 ? values.length : 1, values) })
  define('gradient', 1, 2, (a, h) => {
    const v = vector(a), step = h === undefined ? 1 : scalar(h)
    if (step === 0 || v.length < 2) throw new Error('gradient needs at least two samples and nonzero spacing.')
    return mat(a.rows, a.cols, v.map((_, i) => i === 0 ? (v[1] - v[0]) / step : i === v.length - 1 ? (v[i] - v[i - 1]) / step : (v[i + 1] - v[i - 1]) / (2 * step)))
  })
  define('trapz', 1, 2, (a, b) => {
    const y = vector(b ?? a), x = b === undefined ? y.map((_, i) => i) : vector(a)
    if (y.length !== x.length) throw new Error('trapz needs matching x and y vector lengths.')
    let area = 0; for (let i = 1; i < y.length; i++) area += (x[i] - x[i - 1]) * (y[i] + y[i - 1]) / 2
    return num(area)
  })
  define('dot', 2, 2, (a, b) => { const av = vector(a), bv = vector(b); if (av.length !== bv.length) throw new Error('dot requires matching vector lengths.'); return num(sum(av.map((x, i) => x * bv[i]))) })
  define('cross', 2, 2, (a, b) => { const x = vector(a), y = vector(b); if (x.length !== 3 || y.length !== 3) throw new Error('cross requires three-element vectors.'); return mat(a.rows, a.cols, [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]]) })
  define('norm', 1, 2, (a, kind) => {
    numeric(a)
    if (kind !== undefined && kind !== 'fro') throw new Error('Supported norms are norm(v) and norm(A,"fro").')
    if (kind === undefined) vector(a)
    return num(Math.hypot(...a.data))
  })
  define('inv', 1, 1, a => { numeric(a); if (a.rows !== a.cols) throw new Error('inv requires a square matrix.'); return solve(a, mat(a.rows, a.rows, (r, c) => Number(r === c))) })
  define('det', 1, 1, a => {
    numeric(a); if (a.rows !== a.cols || a.rows > 64) throw new Error('det requires a square matrix up to 64 by 64.')
    const m = mat(a.rows, a.cols, a.data); let determinant = 1
    context.budget.tick(a.rows ** 3)
    for (let k = 0; k < a.rows; k++) {
      let pivot = k
      for (let r = k + 1; r < a.rows; r++) if (Math.abs(at(m, r, k)) > Math.abs(at(m, pivot, k))) pivot = r
      if (at(m, pivot, k) === 0) return num(0)
      if (pivot !== k) { determinant = -determinant; for (let c = 0; c < a.cols; c++) { const p = c * a.rows; [m.data[p + k], m.data[p + pivot]] = [m.data[p + pivot], m.data[p + k]] } }
      const diagonal = at(m, k, k); determinant *= diagonal
      for (let r = k + 1; r < a.rows; r++) { const f = at(m, r, k) / diagonal; for (let c = k + 1; c < a.cols; c++) m.data[c * a.rows + r] -= f * at(m, k, c) }
    }
    return num(determinant)
  })
  define('polyfit', 3, 3, (x, y, degree) => {
    const xv = vector(x), yv = vector(y), d = scalar(degree)
    if (!Number.isInteger(d) || d < 0 || d > 6 || xv.length !== yv.length || xv.length <= d) throw new Error('polyfit needs matching vectors, more samples than degree, and degree 0–6.')
    const design = mat(xv.length, d + 1, (r, c) => xv[r] ** (d - c))
    const result = solve(design, mat(yv.length, 1, yv)); return transpose(result)
  })
  define('polyval', 2, 2, (p, x) => { const coefficients = vector(p); return map(x, value => coefficients.reduce((acc, c) => acc * value + c, 0)) })
  define('interp1', 3, 3, (x, y, xq) => {
    const xv = vector(x), yv = vector(y)
    if (xv.length < 2 || xv.length !== yv.length || xv.some((n, i) => i > 0 && n <= xv[i - 1])) throw new Error('interp1 needs matching vectors and strictly increasing x values.')
    context.budget.tick(xv.length * numeric(xq).data.length)
    return map(xq, value => {
      if (value < xv[0] || value > xv.at(-1)) throw new Error('This linear interp1 subset requires query points inside the sample interval.')
      let i = 1; while (i < xv.length - 1 && xv[i] < value) i++
      return yv[i - 1] + (yv[i] - yv[i - 1]) * (value - xv[i - 1]) / (xv[i] - xv[i - 1])
    })
  })
  define('conv', 2, 2, (a, b) => {
    const x = vector(a), y = vector(b)
    if (!x.length || !y.length) return mat(1, 0)
    context.budget.tick(x.length * y.length)
    const values = mat(1, x.length + y.length - 1)
    for (let i = 0; i < x.length; i++) for (let j = 0; j < y.length; j++) values.data[i + j] += x[i] * y[j]
    // MATLAB R2026a full-convolution orientation: column only when both inputs are columns.
    const row = !(a.cols === 1 && b.cols === 1)
    return mat(row ? 1 : values.cols, row ? values.cols : 1, values.data)
  })
  define('find', 1, 1, a => { numeric(a); const values = a.data.flatMap((x, i) => x ? [i + 1] : []); return mat(a.rows === 1 ? 1 : values.length, a.rows === 1 ? values.length : 1, values) })
  define('logical', 1, 1, a => map(a, x => Number(Boolean(x)), true))
  define('double', 1, 1, a => map(a, x => x))
  define('rng', 1, 1, a => { const seed = scalar(a); if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error('rng seed must be an integer from 0 to 4294967295.'); context.seed(seed); return null })
  define('disp', 1, 1, value => { context.print(value); return null })
  define('assert', 1, 2, (condition, message) => { if (message !== undefined && typeof message !== 'string') throw new Error('assert message must be text.'); if (!context.truth(condition)) throw new Error(message ?? 'Assertion failed.'); return null })
  define('plot', 1, 2, (a, b) => {
    const y = vector(b ?? a), x = b === undefined ? y.map((_, i) => i + 1) : vector(a)
    if (!x.length || x.length !== y.length || x.length > 4096) throw new Error('plot needs matching nonempty vectors with at most 4096 points.')
    if (!context.holding) context.plots.length = 0
    if (context.plots.length >= LIMITS.plots) throw new Error('Keep plots within eight series.')
    context.plots.push({ x: [...x], y: [...y] }); return null
  })
  for (const name of ['title', 'xlabel', 'ylabel']) define(name, 1, 1, value => { if (typeof value !== 'string' || value.length > 200) throw new Error('Plot labels must be text up to 200 characters.'); context.labels[name] = value; return null })
  define('hold', 1, 1, value => { if (!['on', 'off'].includes(value)) throw new Error('Use hold("on") or hold("off").'); context.holding = value === 'on'; return null })
  define('fzero', 2, 2, (fn, bracket) => {
    const bounds = vector(bracket)
    if (fn?.kind !== 'function' || bounds.length !== 2 || bounds[0] >= bounds[1]) throw new Error('fzero needs an anonymous function and an increasing two-element bracket.')
    let [a, b] = bounds, fa = scalar(context.call(fn, [num(a)])), fb = scalar(context.call(fn, [num(b)]))
    if (fa === 0) return num(a)
    if (fb === 0) return num(b)
    if (Math.sign(fa) === Math.sign(fb)) throw new Error('fzero requires opposite signs at the bracket endpoints.')
    for (let i = 0; i < 80; i++) {
      const mid = a + (b - a) / 2, fm = scalar(context.call(fn, [num(mid)]))
      if (fm === 0 || b - a <= 1e-10 * Math.max(1, Math.abs(mid))) return num(mid)
      if (Math.sign(fm) === Math.sign(fa)) { a = mid; fa = fm } else b = mid
    }
    throw new Error('fzero did not converge in 80 bisections.')
  })
  return functions
}

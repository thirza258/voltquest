/** Deterministic HPC experiments. All counts/costs are teaching models, never CPU timings. */
const integer = (label, min, max, value, step = 1) => ({ label, type: 'number', min, max, step, default: value })
const choice = (label, options, value) => ({ label, type: 'select', options, default: value })
export const LABS = {
  correctness: { title: 'Floating-point correctness', fields: {
    n: integer('Small values to sum', 1, 4096, 1000),
    precision: choice('Accumulator precision', ['float32', 'float64'], 'float32'),
    order: choice('Summation order', ['forward', 'small-first'], 'forward'),
  } },
  benchmark: { title: 'Benchmark evidence', fields: {
    baseline: { label: 'Baseline samples (milliseconds)', type: 'text', default: '50, 10, 11, 9, 10' },
    candidate: { label: 'Candidate samples (milliseconds)', type: 'text', default: '30, 6, 7, 5, 6' },
    warmup: integer('Warm-up samples to discard', 0, 10, 1),
  } },
  locality: { title: 'Cache access explorer', fields: {
    n: integer('Matrix width', 4, 64, 32),
    order: choice('Traversal', ['row', 'column'], 'row'),
    lineBytes: choice('Modeled cache line (bytes)', ['32', '64', '128'], '64'),
    cacheLines: integer('Modeled cache capacity (lines)', 1, 128, 16),
  } },
  blocking: { title: 'Matrix multiplication and tiling', fields: {
    n: integer('Matrix width', 2, 40, 24),
    block: integer('Tile width', 1, 32, 8),
    cacheLines: integer('Modeled cache capacity (64-byte lines)', 1, 256, 32),
  } },
  simd: { title: 'Vector lanes and tails', fields: {
    n: integer('Vector length', 1, 4096, 19),
    lanes: choice('Modeled vector lanes', ['2', '4', '8', '16'], '4'),
    tail: choice('Remainder handling', ['scalar-tail', 'skip-tail'], 'scalar-tail'),
  } },
  reduction: { title: 'Reduction and race interleavings', fields: {
    workers: integer('Workers', 2, 8, 4),
    updates: integer('Increments per worker', 1, 128, 10),
    method: choice('Update strategy', ['unsafe-shared', 'atomic', 'private-reduction'], 'unsafe-shared'),
  } },
  scheduling: { title: 'Load balancing', fields: {
    tasks: integer('Tasks', 4, 128, 24),
    workers: integer('Workers', 1, 16, 4),
    chunk: integer('Chunk size', 1, 32, 1),
    schedule: choice('Schedule', ['static-block', 'static-cyclic', 'dynamic'], 'static-block'),
    distribution: choice('Task cost distribution', ['uniform', 'heavy-tail'], 'heavy-tail'),
    overhead: integer('Dispatch cost (model units)', 0, 20, 1),
  } },
  scaling: { title: 'Scaling and Roofline', fields: {
    workers: integer('Workers', 1, 256, 8),
    serialPercent: integer('Serial work (%)', 0, 100, 10),
    overheadPercent: integer('Parallel overhead (% of baseline)', 0, 100, 0),
    intensity: { ...integer('Arithmetic intensity (FLOP/byte)', 0.01, 128, 0.25), step: 0.01 },
    bandwidth: integer('Assumed memory bandwidth (GB/s)', 1, 2000, 50),
    peak: integer('Assumed compute ceiling (GFLOP/s)', 1, 20000, 200),
  } },
  mpi: { title: 'Distributed partitions and collectives', fields: {
    n: integer('Global elements', 1, 256, 17),
    ranks: integer('Ranks', 1, 16, 4),
    partition: choice('Partition policy', ['balanced', 'drop-remainder'], 'balanced'),
    latency: integer('Message latency (model units)', 0, 100, 5),
  } },
  stencil: { title: 'Stencil capstone', fields: {
    n: integer('Interior cells', 2, 128, 17),
    ranks: integer('Partitions', 1, 16, 4),
    steps: integer('Time steps', 1, 100, 10),
    exchange: choice('Halo exchange', ['each-step', 'stale-halo'], 'each-step'),
  } },
}

export function defaultParameters(lab) {
  if (!Object.hasOwn(LABS, lab)) throw new Error('Unknown HPC experiment.')
  return Object.fromEntries(Object.entries(LABS[lab].fields).map(([key, field]) => [key, field.default]))
}

export function validateParameters(lab, value) {
  if (!Object.hasOwn(LABS, lab) || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid HPC experiment settings.')
  const fields = LABS[lab].fields
  if (Object.keys(value).some(key => !Object.hasOwn(fields, key))) throw new Error('Unknown experiment parameter.')
  const result = {}
  for (const [key, field] of Object.entries(fields)) {
    const v = value[key]
    if (field.type === 'number' && (typeof v !== 'number' || !Number.isFinite(v) || v < field.min || v > field.max || (field.step === 1 && !Number.isInteger(v)))) throw new Error(`${field.label}: use a value from ${field.min} to ${field.max}.`)
    if (field.type === 'select' && !field.options.includes(v)) throw new Error(`${field.label}: choose a listed option.`)
    if (field.type === 'text' && (typeof v !== 'string' || v.length > 2000)) throw new Error(`${field.label}: enter at most 2000 characters.`)
    result[key] = v
  }
  return result
}

/** Fully associative LRU cache; aligned arrays, write allocate, no prefetch/coherence/timing. */
export function createCache(lineBytes = 64, capacity = 16) {
  const resident = new Map()
  const stats = { accesses: 0, misses: 0, hits: 0 }
  return { stats, access(address) {
    const line = Math.floor(address / lineBytes)
    stats.accesses++
    if (resident.has(line)) { stats.hits++; resident.delete(line) }
    else { stats.misses++; if (resident.size >= capacity) resident.delete(resident.keys().next().value) }
    resident.set(line, true)
  } }
}

export function partitions(n, ranks) {
  const count = Math.floor(n / ranks), extra = n % ranks
  return Array.from({ length: ranks }, (_, rank) => ({ rank, start: rank * count + Math.min(rank, extra), count: count + (rank < extra ? 1 : 0) }))
}

const metric = (label, value, unit = '') => ({ label, value, unit })
const check = (label, passed, detail) => ({ label, passed, detail })
const sum = values => values.reduce((a, b) => a + b, 0)
function cacheMetrics(stats) {
  return [metric('Accesses', stats.accesses), metric('Cache misses', stats.misses), metric('Hit rate', 100 * stats.hits / stats.accesses, '%')]
}

export function analyzeSamples(text, warmup = 0) {
  const tokens = text.trim().split(/[\s,;]+/)
  if (!text.trim() || tokens.length > 100 || tokens.some(token => !/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(token))) throw new Error('Enter 2–100 positive timing samples separated by commas or spaces.')
  const all = tokens.map(Number)
  if (all.some(v => !Number.isFinite(v) || v <= 0 || v > 1e9) || all.length - warmup < 2) throw new Error('Keep at least two positive timing samples after warm-up.')
  const values = all.slice(warmup).sort((a, b) => a - b), n = values.length
  return { values, count: n, median: n % 2 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2, mean: sum(values) / n, min: values[0], max: values[n - 1] }
}

function correctness(p) {
  const round = p.precision === 'float32' ? Math.fround : v => v
  const data = p.order === 'forward' ? [1e8, ...Array(p.n).fill(1), -1e8] : [...Array(p.n).fill(1), 1e8, -1e8]
  const result = data.reduce((total, v) => round(total + round(v)), 0)
  return { metrics: [metric('Computed sum', result), metric('Exact integer reference', p.n), metric('Absolute error', Math.abs(result - p.n))], checks: [check('Matches reference', result === p.n, 'The reference is the number of ones; the large positive and negative values cancel exactly in real arithmetic.')], rows: data.slice(0, 12).map((v, i) => [i, v]), columns: ['Input index (first 12)', 'Value'], note: 'IEEE-style rounded arithmetic is evaluated in the browser. Small-first can improve this example but does not guarantee exact results for every size.' }
}
function benchmark(p) {
  const a = analyzeSamples(p.baseline, p.warmup), b = analyzeSamples(p.candidate, p.warmup)
  return { metrics: [metric('Baseline median', a.median, 'ms'), metric('Candidate median', b.median, 'ms'), metric('Median speedup', a.median / b.median, '×')], columns: ['Series', 'Samples kept', 'Minimum (ms)', 'Mean (ms)', 'Maximum (ms)'], rows: [['Baseline', a.count, a.min, a.mean, a.max], ['Candidate', b.count, b.min, b.mean, b.max]], checks: [check('Enough samples', true, 'At least two samples remain in each series. Timing data alone cannot establish output correctness or statistical significance.')], note: 'These are supplied timing samples. Defaults are an illustrative dataset. Paste native measurements from the same workload and timing scope; the browser has not measured C/C++ execution.' }
}
function locality(p) {
  const cache = createCache(Number(p.lineBytes), p.cacheLines), rows = []
  let total = 0
  for (let outer = 0; outer < p.n; outer++) for (let inner = 0; inner < p.n; inner++) {
    const index = p.order === 'row' ? outer * p.n + inner : inner * p.n + outer
    const before = cache.stats.misses
    cache.access(index * 8); total += index + 1
    if (rows.length < 24) rows.push([index, index * 8, cache.stats.misses > before ? 'Miss' : 'Hit'])
  }
  return { metrics: [...cacheMetrics(cache.stats), metric('Checksum', total)], columns: ['Element (first 24)', 'Byte address', 'Cache outcome'], rows, checks: [check('Every element visited', total === p.n * p.n * (p.n * p.n + 1) / 2, 'Row and column traversal must compute the same sum.')], note: 'Cold, fully associative LRU cache with write allocation, aligned double arrays, no prefetching or other traffic. Counts describe this model, not your processor.' }
}

export function multiply(n, block, capacity = 32) {
  const a = Float64Array.from({ length: n * n }, (_, i) => i % 7 - 3)
  const b = Float64Array.from({ length: n * n }, (_, i) => i % 5 - 2)
  const out = new Float64Array(n * n), cache = createCache(64, capacity)
  const offset = Math.ceil(n * n * 8 / 64) * 64
  const op = (i, j, k) => {
    const ai = i * n + k, bi = k * n + j, ci = i * n + j
    cache.access(ai * 8); cache.access(offset + bi * 8); cache.access(2 * offset + ci * 8)
    out[ci] += a[ai] * b[bi]; cache.access(2 * offset + ci * 8)
  }
  if (!block) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) op(i, j, k)
  else for (let ii = 0; ii < n; ii += block) for (let kk = 0; kk < n; kk += block) for (let jj = 0; jj < n; jj += block)
    for (let i = ii; i < Math.min(ii + block, n); i++) for (let k = kk; k < Math.min(kk + block, n); k++) for (let j = jj; j < Math.min(jj + block, n); j++) op(i, j, k)
  return { out, ...cache.stats }
}
function blocking(p) {
  const a = multiply(p.n, 0, p.cacheLines), b = multiply(p.n, p.block, p.cacheLines)
  const error = Math.max(...a.out.map((v, i) => Math.abs(v - b.out[i])))
  return { metrics: [metric('Scalar FLOPs', 2 * p.n ** 3), metric('Baseline misses', a.misses), metric('Tiled misses', b.misses), metric('Maximum error', error)], columns: ['Algorithm', 'Accesses', 'Misses', 'Checksum'], rows: [['i-j-k', a.accesses, a.misses, sum(a.out)], ['Tiled i-k-j', b.accesses, b.misses, sum(b.out)]], checks: [check('Every matrix entry matches', error === 0, 'Both algorithms use the same small integer inputs and check every output, including partial edge tiles.')], note: 'The cache trace counts three loads and one store per multiply-add. Register reuse, compiler vectorization and hardware timing are outside this LRU model.' }
}
function simd(p) {
  const width = Number(p.lanes), full = Math.floor(p.n / width), remainder = p.n % width
  const output = new Float64Array(p.n), reference = Float64Array.from({ length: p.n }, (_, i) => 2 * (i + 1) + 3)
  for (let pack = 0; pack < full; pack++) for (let lane = 0; lane < width; lane++) { const i = pack * width + lane; output[i] = 2 * (i + 1) + 3 }
  if (p.tail === 'scalar-tail') for (let i = full * width; i < p.n; i++) output[i] = 2 * (i + 1) + 3
  const missed = [...output].filter((v, i) => v !== reference[i]).length
  return { metrics: [metric('Full vector groups', full), metric('Remainder elements', remainder), metric('Incorrect outputs', missed)], columns: ['Index (last 16)', 'Reference', 'Candidate'], rows: [...output].map((v, i) => [i, reference[i], v]).slice(-16), checks: [check('All outputs match', missed === 0, 'A length divisible by the vector width cannot expose a missing tail. Also test one less and one more.')], note: 'Groups and lanes are evaluated as an algorithm trace. This does not claim the browser emitted SIMD instructions or measure a CPU speedup.' }
}
function reduction(p) {
  const expected = p.workers * p.updates, unsafe = p.method === 'unsafe-shared'
  const result = unsafe ? p.updates : expected
  const rows = []
  if (unsafe) {
    for (let w = 0; w < p.workers; w++) rows.push([w, 'Read shared value', 0])
    for (let w = 0; w < p.workers; w++) rows.push([w, 'Write local value + 1', 1])
  } else for (let w = 0; w < p.workers; w++) rows.push([w, p.method === 'atomic' ? 'Serialized atomic increments' : 'Private partial sum', p.updates])
  return { metrics: [metric('Expected increments', expected), metric('Observed model result', result), metric('Lost updates', expected - result)], columns: ['Worker', 'First round / partial result', 'Value'], rows, checks: [check('Reduction matches reference', result === expected, 'The unsafe trace is one lost-update interleaving. A native C/C++ data race is undefined behavior, not a promise of this numerical result.')], note: 'Worker interleavings are modeled deterministically. Atomics and private reductions give the correct count here; this trace does not benchmark synchronization.' }
}
export function scheduleTasks(p) {
  const costs = Array.from({ length: p.tasks }, (_, i) => p.distribution === 'uniform' ? 4 : i < Math.floor(p.tasks * 0.75) ? 1 : 16)
  const loads = Array(p.workers).fill(0), owners = Array(p.workers).fill(null).map(() => []), chunks = []
  if (p.schedule === 'static-block') partitions(p.tasks, p.workers).forEach(part => { if (part.count) chunks.push({ start: part.start, count: part.count, worker: part.rank }) })
  else for (let start = 0; start < p.tasks; start += p.chunk) chunks.push({ start, count: Math.min(p.chunk, p.tasks - start), worker: chunks.length % p.workers })
  for (const chunk of chunks) {
    const worker = p.schedule === 'dynamic' ? loads.indexOf(Math.min(...loads)) : chunk.worker
    for (let i = chunk.start; i < chunk.start + chunk.count; i++) { owners[worker].push(i); loads[worker] += costs[i] }
    loads[worker] += p.overhead
  }
  return { loads, owners, costs, dispatches: chunks.length, work: sum(costs), makespan: Math.max(...loads) }
}
function scheduling(p) {
  const s = scheduleTasks(p)
  return { metrics: [metric('Useful work', s.work, 'units'), metric('Completion time', s.makespan, 'model units'), metric('Dispatches', s.dispatches), metric('Useful utilization', 100 * s.work / (p.workers * s.makespan), '%')], columns: ['Worker', 'Task count', 'Completion (model units)', 'Assigned tasks'], rows: s.loads.map((load, i) => [i, s.owners[i].length, load, s.owners[i].join(', ')]), bars: s.loads.map((value, i) => ({ label: `Worker ${i}`, value })), checks: [check('Every task assigned once', new Set(s.owners.flat()).size === p.tasks && s.owners.flat().length === p.tasks, 'Useful work is constant across schedules; dispatch cost and load imbalance change completion time.')], note: 'Dispatch cost is charged to the receiving worker. A central queue, OS scheduling, cache contention and native OpenMP runtime behavior are not simulated.' }
}
function scaling(p) {
  const serial = p.serialPercent / 100, speedup = 1 / (serial + (1 - serial) / p.workers + p.overheadPercent / 100)
  const roof = Math.min(p.peak, p.bandwidth * p.intensity)
  return { metrics: [metric('Predicted speedup', speedup, '×'), metric('Parallel efficiency', 100 * speedup / p.workers, '%'), metric('Roofline ceiling', roof, 'GFLOP/s'), metric('Ridge intensity', p.peak / p.bandwidth, 'FLOP/byte')], columns: ['Workers', 'Amdahl speedup (same overhead)'], rows: [1, 2, 4, 8, 16, 32, 64, 128, 256].map(workers => [workers, 1 / (serial + (1 - serial) / workers + p.overheadPercent / 100)]), checks: [check('Ceiling respects both resources', roof <= p.peak && roof <= p.bandwidth * p.intensity, 'The bound uses your assumed bandwidth, compute ceiling and bytes at one memory level. It is not achieved throughput.')], note: 'Amdahl assumes fixed total useful work. The Roofline ceiling is a separate resource bound; multiplying the two models does not predict real application performance.' }
}
function mpi(p) {
  const parts = p.partition === 'balanced' ? partitions(p.n, p.ranks) : Array.from({ length: p.ranks }, (_, rank) => ({ rank, start: rank * Math.floor(p.n / p.ranks), count: Math.floor(p.n / p.ranks) }))
  const rows = parts.map(part => [part.rank, part.start, part.count, sum(Array.from({ length: part.count }, (_, i) => part.start + i + 1))])
  const total = sum(rows.map(row => row[3])), expected = p.n * (p.n + 1) / 2
  return { metrics: [metric('Reduced sum', total), metric('Reference sum', expected), metric('Elements covered', sum(parts.map(part => part.count))), metric('Illustrative tree latency', Math.ceil(Math.log2(p.ranks)) * p.latency, 'model units')], columns: ['Rank', 'Displacement (elements)', 'Count', 'Local sum'], rows, checks: [check('Global result matches', total === expected, 'Counts must cover every element once. Ranks may own zero elements when there are more ranks than data.')], note: 'Partitions and a sum are computed locally. The latency is an illustrative binary-tree cost, not an MPI transport benchmark or a specified collective algorithm.' }
}

export function runStencil(n, ranks, steps, exchange = 'each-step') {
  let reference = new Float64Array(n + 2), candidate = new Float64Array(n + 2)
  reference[0] = candidate[0] = 100
  const parts = partitions(n, ranks).filter(part => part.count)
  const halos = parts.map(part => [candidate[part.start], candidate[part.start + part.count + 1]])
  for (let step = 0; step < steps; step++) {
    const next = reference.slice(), nextCandidate = candidate.slice()
    for (let i = 1; i <= n; i++) next[i] = (reference[i - 1] + reference[i] + reference[i + 1]) / 3
    parts.forEach((part, rank) => {
      const start = part.start + 1, end = part.start + part.count
      if (exchange === 'each-step') halos[rank] = [candidate[start - 1], candidate[end + 1]]
      for (let i = start; i <= end; i++) nextCandidate[i] = ((i === start ? halos[rank][0] : candidate[i - 1]) + candidate[i] + (i === end ? halos[rank][1] : candidate[i + 1])) / 3
    })
    reference = next; candidate = nextCandidate
  }
  return { reference, candidate, maxError: Math.max(...reference.map((v, i) => Math.abs(v - candidate[i]))), parts }
}
function stencil(p) {
  const result = runStencil(p.n, p.ranks, p.steps, p.exchange)
  return { metrics: [metric('Maximum absolute error', result.maxError), metric('Updated cells', p.n * p.steps), metric('Active partitions', result.parts.length), metric('Internal halo values per step', 2 * (result.parts.length - 1))], columns: ['Cell', 'Serial reference', 'Partitioned result'], rows: [...result.reference].map((value, i) => [i, value, result.candidate[i]]), bars: [...result.candidate].map((value, i) => ({ label: `Cell ${i}`, value })), checks: [check('Every cell matches within 1e-12', result.maxError <= 1e-12, 'Compare all cells after all steps. A one-step test alone may not reveal stale halos; try ten steps on an uneven partition.')], note: 'A one-dimensional three-point Jacobi stencil with fixed boundary values 100 and 0. Each step reads the previous array. Distributed partitions and halo copies are local teaching operations.' }
}

const experiments = { correctness, benchmark, locality, blocking, simd, reduction, scheduling, scaling, mpi, stencil }
export function runExperiment(lab, parameters) {
  const validated = validateParameters(lab, parameters)
  return { lab, parameters: validated, ...experiments[lab](validated) }
}

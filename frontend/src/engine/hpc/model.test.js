import { describe, expect, it } from 'vitest'
import { LABS, defaultParameters, validateParameters, createCache, analyzeSamples, partitions, multiply, scheduleTasks, runStencil, runExperiment } from './model.js'

const run = (lab, patch = {}) => runExperiment(lab, { ...defaultParameters(lab), ...patch })
const value = (result, label) => result.metrics.find(metric => metric.label === label).value

describe('HPC numerical experiments', () => {
  it('exposes cancellation and rounding instead of inventing a speed measurement', () => {
    expect(value(run('correctness'), 'Computed sum')).toBe(0)
    expect(run('correctness').checks[0].passed).toBe(false)
    expect(run('correctness', { precision: 'float64' }).checks[0].passed).toBe(true)
    expect(run('correctness', { order: 'small-first', n: 1000 }).checks[0].passed).toBe(true)
    expect(run('correctness', { order: 'small-first', n: 1001 }).checks[0].passed).toBe(false)
  })
  it('analyzes actual supplied samples with median, spread and explicit warm-up', () => {
    expect(analyzeSamples('50, 9, 10, 10, 11', 1)).toEqual({ values: [9, 10, 10, 11], count: 4, median: 10, mean: 10, min: 9, max: 11 })
    expect(analyzeSamples('1e1; 20\n30').median).toBe(20)
    expect(value(run('benchmark'), 'Median speedup')).toBeCloseTo(10 / 6)
    for (const text of ['', '1', '0,2', '-1,2', 'NaN,1,2', 'Infinity,1', '1,,2', '1,,bad', '1e500,2', ',1,2']) {
      // Repeated separators are allowed, but empty/malformed samples are not.
      if (text === '1,,2') continue
      expect(() => analyzeSamples(text)).toThrow()
    }
    expect(() => analyzeSamples('1,2,3', 2)).toThrow(/two/)
  })
  it('models LRU replacement and explains row/column locality with the same checksum', () => {
    const cache = createCache(64, 2)
    ;[0, 64, 8, 128, 64].forEach(address => cache.access(address))
    expect(cache.stats).toEqual({ accesses: 5, hits: 1, misses: 4 })
    const row = run('locality'), column = run('locality', { order: 'column' })
    expect(value(row, 'Accesses')).toBe(1024)
    expect(value(row, 'Cache misses')).toBe(128)
    expect(value(column, 'Cache misses')).toBe(1024)
    expect(value(row, 'Checksum')).toBe(value(column, 'Checksum'))
    expect(value(run('locality', { order: 'column', cacheLines: 128 }), 'Cache misses')).toBe(128)
  })
  it.each([[1, 1], [17, 8], [33, 7], [7, 32], [24, 1]])('checks every tiled matrix entry for N=%i and tile=%i', (n, tile) => {
    const candidate = multiply(n, tile).out
    // Independent direct scalar definition, not the same tiled implementation.
    const expected = Array.from({ length: n * n }, (_, index) => {
      const i = Math.floor(index / n), j = index % n
      let total = 0
      for (let k = 0; k < n; k++) total += ((i * n + k) % 7 - 3) * ((k * n + j) % 5 - 2)
      return total
    })
    expect([...candidate]).toEqual(expected)
  })
  it('exposes missed SIMD tails at boundaries and never misses outputs with cleanup', () => {
    for (const n of [1, 3, 4, 5, 15, 16, 17, 19]) {
      expect(run('simd', { n }).checks[0].passed).toBe(true)
      expect(value(run('simd', { n, tail: 'skip-tail' }), 'Incorrect outputs')).toBe(n % 4)
    }
  })
  it('distinguishes the forced lost-update trace from both safe strategies', () => {
    expect(value(run('reduction'), 'Observed model result')).toBe(10)
    for (const method of ['atomic', 'private-reduction']) expect(value(run('reduction', { method }), 'Observed model result')).toBe(40)
    expect(run('reduction').checks[0].detail).toContain('undefined behavior')
  })
  it('assigns every task once and changes load balance without changing useful work', () => {
    const results = ['static-block', 'static-cyclic', 'dynamic'].map(schedule => scheduleTasks({ ...defaultParameters('scheduling'), schedule }))
    for (const result of results) {
      expect(result.owners.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, i) => i))
      expect(result.work).toBe(114)
      expect(result.loads.reduce((a, b) => a + b)).toBe(result.work + result.dispatches)
    }
    expect(results[2].makespan).toBeLessThan(results[0].makespan)
    const expensive = scheduleTasks({ ...defaultParameters('scheduling'), distribution: 'uniform', schedule: 'dynamic', overhead: 20 })
    const staticResult = scheduleTasks({ ...defaultParameters('scheduling'), distribution: 'uniform', schedule: 'static-block', overhead: 20 })
    expect(expensive.makespan).toBeGreaterThan(staticResult.makespan)
  })
  it('computes Amdahl and Roofline independently at resource boundaries', () => {
    expect(value(run('scaling'), 'Predicted speedup')).toBeCloseTo(1 / 0.2125)
    expect(value(run('scaling'), 'Roofline ceiling')).toBe(12.5)
    expect(value(run('scaling', { intensity: 100 }), 'Roofline ceiling')).toBe(200)
    expect(value(run('scaling', { serialPercent: 100 }), 'Predicted speedup')).toBe(1)
    expect(value(run('scaling', { serialPercent: 0, workers: 16 }), 'Predicted speedup')).toBe(16)
    expect(value(run('scaling', { workers: 1, overheadPercent: 100 }), 'Predicted speedup')).toBe(0.5)
  })
  it('covers uneven and zero-count MPI partitions without dropping a tail', () => {
    expect(partitions(17, 4)).toEqual([{ rank: 0, start: 0, count: 5 }, { rank: 1, start: 5, count: 4 }, { rank: 2, start: 9, count: 4 }, { rank: 3, start: 13, count: 4 }])
    for (const n of [1, 3, 17, 256]) for (const ranks of [1, 2, 4, 16]) {
      expect(partitions(n, ranks).flatMap(part => Array.from({ length: part.count }, (_, i) => part.start + i))).toEqual(Array.from({ length: n }, (_, i) => i))
      expect(run('mpi', { n, ranks }).checks[0].passed).toBe(true)
    }
    expect(value(run('mpi', { partition: 'drop-remainder' }), 'Reduced sum')).toBe(136)
  })
  it('compares all stencil cells over time, preserves boundaries and exposes stale halos', () => {
    for (const n of [2, 17, 19]) for (const ranks of [1, 4, 16]) for (const steps of [1, 10, 25]) {
      const result = runStencil(n, ranks, steps)
      expect(result.maxError).toBe(0)
      expect(result.candidate[0]).toBe(100)
      expect(result.candidate[n + 1]).toBe(0)
      expect([...result.candidate].every(value => value >= 0 && value <= 100)).toBe(true)
    }
    expect(runStencil(17, 4, 1).candidate[1]).toBeCloseTo(100 / 3)
    expect(runStencil(17, 4, 1, 'stale-halo').maxError).toBe(0)
    expect(runStencil(17, 4, 10, 'stale-halo').maxError).toBeGreaterThan(0.01)
  })
})

describe('bounded experiment inputs', () => {
  it.each(Object.keys(LABS))('validates %s before allocating or looping', lab => {
    const parameters = defaultParameters(lab)
    expect(validateParameters(lab, parameters)).toEqual(parameters)
    const result = runExperiment(lab, parameters)
    expect(result.metrics.every(metric => Number.isFinite(metric.value))).toBe(true)
    expect(() => runExperiment(lab, { ...parameters, extra: 1 })).toThrow()
    for (const [key, field] of Object.entries(LABS[lab].fields)) {
      if (field.type === 'number') for (const bad of [NaN, Infinity, field.min - 1, field.max + 1, '4', null]) expect(() => runExperiment(lab, { ...parameters, [key]: bad })).toThrow()
      if (field.type === 'select') expect(() => runExperiment(lab, { ...parameters, [key]: '__proto__' })).toThrow()
    }
  })
  it('rejects unknown experiment identities and malformed inputs', () => {
    for (const id of ['__proto__', 'constructor', 'missing']) expect(() => runExperiment(id, {})).toThrow()
    expect(() => validateParameters('locality', [])).toThrow()
  })
})

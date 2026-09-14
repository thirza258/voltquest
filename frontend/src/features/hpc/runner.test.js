import { afterEach, expect, it, vi } from 'vitest'
import { startExperiment } from './runner.js'
import { defaultParameters } from '../../engine/hpc/model.js'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
it('runs the same numerical experiment when a Worker is unavailable', async () => {
  vi.stubGlobal('Worker', undefined)
  const result = await startExperiment('mpi', defaultParameters('mpi')).promise
  expect(result.checks[0].passed).toBe(true)
  expect(result.metrics[0].value).toBe(153)
})
it('cancels a queued fallback before it runs', async () => {
  vi.stubGlobal('Worker', undefined)
  const run = startExperiment('mpi', defaultParameters('mpi'))
  const assertion = expect(run.promise).rejects.toThrow('cancelled')
  run.cancel(); await assertion
})
it('releases a worker after failure or deadline and never leaves a pending promise', async () => {
  vi.useFakeTimers()
  const workers = []
  class MockWorker {
    constructor() { this.terminate = vi.fn(); workers.push(this) }
    postMessage() {}
  }
  vi.stubGlobal('Worker', MockWorker)
  const run = startExperiment('mpi', defaultParameters('mpi'))
  const timeout = expect(run.promise).rejects.toThrow('time limit')
  await vi.advanceTimersByTimeAsync(5000); await timeout
  expect(workers[0].terminate).toHaveBeenCalledTimes(1)
  const fail = startExperiment('mpi', defaultParameters('mpi'))
  const failure = expect(fail.promise).rejects.toThrow('could not run')
  workers[1].onerror(); await failure
  expect(workers[1].terminate).toHaveBeenCalledTimes(1)
})

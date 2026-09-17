import { afterEach, expect, it, vi } from 'vitest'
import { startMatlab } from './runner.js'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
function mockWorker() {
  const workers = []
  vi.stubGlobal('Worker', class { constructor() { workers.push(this); this.terminate = vi.fn(); this.postMessage = vi.fn() } })
  return workers
}
it('executes the real numeric engine when Worker is unavailable', async () => {
  vi.stubGlobal('Worker', undefined)
  const result = await startMatlab('disp(2+3)').promise
  expect(result.output).toEqual(['5'])
})
it('passes the exact source and releases a successful worker', async () => {
  const workers = mockWorker(), task = startMatlab('disp(9)')
  expect(workers[0].postMessage).toHaveBeenCalledWith({ source: 'disp(9)' })
  workers[0].onmessage({ data: { result: { output: ['9'] } } })
  expect(await task.promise).toEqual({ output: ['9'] })
  expect(workers[0].terminate).toHaveBeenCalledOnce()
  workers[0].onmessage({ data: { error: 'late' } })
  expect(workers[0].terminate).toHaveBeenCalledOnce()
})
it('terminates on cancellation, deadline, worker errors and construction errors', async () => {
  vi.useFakeTimers()
  const workers = mockWorker(), cancelled = startMatlab('while true\nend')
  const rejected = expect(cancelled.promise).rejects.toThrow(/stopped/)
  cancelled.cancel(); await rejected
  expect(workers[0].terminate).toHaveBeenCalledOnce()
  const timed = startMatlab('disp(1)'), deadline = expect(timed.promise).rejects.toThrow(/five seconds/)
  await vi.advanceTimersByTimeAsync(5000); await deadline
  expect(workers[1].terminate).toHaveBeenCalledOnce()
  const failed = startMatlab('disp(1)'), failure = expect(failed.promise).rejects.toThrow(/could not start/)
  workers[2].onerror(); await failure
  expect(workers[2].terminate).toHaveBeenCalledOnce()
  vi.stubGlobal('Worker', class { constructor() { throw new Error('blocked Worker') } })
  await expect(startMatlab('disp(1)').promise).rejects.toThrow('blocked Worker')
})

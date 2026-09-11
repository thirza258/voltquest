import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createScheduler, SLICE_INTERVAL_MS } from './scheduler.js'

/**
 * A fake VM: every statement costs `costUs`, and the script is a list of
 * `{ statements, sleepUs }` steps the driver walks through.
 */
function makeDriver(script, costUs = 1) {
  let virtual = 0
  let index = 0
  const calls = { steps: [], ticks: [], slices: 0, halted: false, error: null }
  return {
    calls,
    step(max) {
      calls.steps.push(max)
      const item = script[index]
      if (!item) { return { status: 'halted' } }
      index += 1
      const n = Math.min(max, item.statements ?? max)
      virtual += n * costUs
      if (item.statements != null && n < item.statements) {
        script[--index] = { ...item, statements: item.statements - n }
        return { status: 'running' }
      }
      if (item.sleepUs) return { status: 'sleeping', wakeAtUs: virtual + item.sleepUs }
      if (item.error) return { status: 'error', error: item.error }
      return { status: 'running' }
    },
    now: () => virtual,
    advanceTo(us) { if (us > virtual) virtual = us },
    afterSlice() { calls.slices += 1 },
    onTick(ms) { calls.ticks.push(ms) },
    onHalt() { calls.halted = true },
    onError(e) { calls.error = e },
  }
}

describe('scheduler — deterministic mode', () => {
  it('advance(ms) runs exactly the requested virtual time', () => {
    const driver = makeDriver([{ statements: 1e9 }])
    const s = createScheduler({ driver, realtime: false, statementCostUs: 1 })
    s.start()
    s.advance(10)
    expect(driver.now()).toBe(10000)
    s.advance(5)
    expect(driver.now()).toBe(15000)
  })

  it('honours sleeps without overshooting the budget', () => {
    const driver = makeDriver([{ statements: 10, sleepUs: 500000 }, { statements: 10, sleepUs: 500000 }])
    const s = createScheduler({ driver, realtime: false })
    s.start()
    s.advance(100)
    expect(driver.now()).toBe(100000) // still asleep, time moved to the budget
    expect(s.wakeAtUs).toBe(500010)
    s.advance(500)
    expect(driver.now()).toBe(600000)
  })

  it('is reproducible across runs', () => {
    const run = () => {
      const driver = makeDriver([{ statements: 40, sleepUs: 1000 }, { statements: 40, sleepUs: 1000 }, { statements: 1e6 }])
      const s = createScheduler({ driver, realtime: false })
      s.start()
      for (let i = 0; i < 5; i++) s.advance(1)
      return { t: driver.now(), slices: driver.calls.slices }
    }
    expect(run()).toEqual(run())
  })

  it('emits a tick every 100 ms of virtual time', () => {
    const driver = makeDriver([{ statements: 1e9 }])
    const s = createScheduler({ driver, realtime: false })
    s.start()
    s.advance(250)
    expect(driver.calls.ticks).toEqual([100, 200])
  })

  it('reports halt and error through the driver', () => {
    const halting = makeDriver([])
    const s1 = createScheduler({ driver: halting, realtime: false })
    s1.start()
    s1.advance(1)
    expect(halting.calls.halted).toBe(true)
    expect(s1.running).toBe(false)

    const failing = makeDriver([{ statements: 2, error: { message: 'boom', line: 7 } }])
    const s2 = createScheduler({ driver: failing, realtime: false })
    s2.start()
    s2.advance(1)
    expect(failing.calls.error).toEqual({ message: 'boom', line: 7 })
  })

  it('never lets one slice exceed the remaining virtual time', () => {
    const driver = makeDriver([{ statements: 1e9 }], 1)
    const s = createScheduler({ driver, realtime: false, sliceStatements: 20000 })
    s.start()
    s.advance(2) // 2 ms at 1 µs/statement = 2000 statements
    expect(driver.calls.steps[0]).toBe(2000)
    expect(driver.now()).toBe(2000)
  })

  it('refuses advance() in realtime mode', () => {
    const s = createScheduler({ driver: makeDriver([]), realtime: true })
    expect(() => s.advance(1)).toThrow(/realtime/)
  })
})

describe('scheduler — realtime mode', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('pumps a slice roughly every 4 ms and keeps virtual time behind wall time', () => {
    const driver = makeDriver([{ statements: 1e9 }])
    const s = createScheduler({ driver, realtime: true, now: () => Date.now(), statementCostUs: 1 })
    s.start()
    vi.advanceTimersByTime(20)
    expect(driver.now()).toBeLessThanOrEqual(20000)
    expect(driver.now()).toBeGreaterThan(0)
    expect(driver.calls.steps.length).toBeGreaterThanOrEqual(4)
    s.stop()
  })

  it('schedules the next slice for the remaining sleep time', () => {
    const driver = makeDriver([{ statements: 10, sleepUs: 50000 }, { statements: 10 }])
    const s = createScheduler({ driver, realtime: true })
    s.start()
    vi.advanceTimersByTime(SLICE_INTERVAL_MS)
    expect(s.wakeAtUs).toBe(50010)
    const before = driver.calls.steps.length
    vi.advanceTimersByTime(10)
    expect(driver.calls.steps.length).toBe(before) // still sleeping
    vi.advanceTimersByTime(60)
    expect(driver.calls.steps.length).toBeGreaterThan(before)
    s.stop()
  })

  it('stop() clears the timer', () => {
    const driver = makeDriver([{ statements: 1e9 }])
    const s = createScheduler({ driver, realtime: true })
    s.start()
    vi.advanceTimersByTime(10)
    const count = driver.calls.steps.length
    s.stop()
    vi.advanceTimersByTime(100)
    expect(driver.calls.steps.length).toBe(count)
    expect(vi.getTimerCount()).toBe(0)
  })
})

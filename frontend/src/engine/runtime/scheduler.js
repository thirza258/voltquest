/**
 * Slice scheduler — drives the interpreter VM in small chunks (CONTRACTS §7).
 *
 * Two modes share one stepping loop:
 *  - **realtime**: a `setTimeout` pump runs a slice roughly every 4 ms and never lets virtual time run ahead of
 *    wall time. When the sketch sleeps (`delay()`), the next timer is scheduled for the remaining wall time.
 *  - **deterministic** (`realtime: false`): `advance(ms)` runs the same loop synchronously against a virtual
 *    budget. No timers, no wall clock — the headless quest tests depend on this being reproducible.
 *
 * The scheduler knows nothing about Arduino; it talks to a `driver` supplied by the runtime.
 */

/** Statements a single slice may run before the scheduler regains control. */
export const SLICE_STATEMENTS = 20000
/** Wall milliseconds between realtime slices. */
export const SLICE_INTERVAL_MS = 4
/** Virtual microseconds between `tick` messages. */
export const TICK_INTERVAL_US = 100000

/**
 * @typedef Driver
 * @property {(maxStatements: number) => { status: string, wakeAtUs?: number, error?: object }} step
 * @property {() => number} now             virtual µs
 * @property {(us: number) => void} advanceTo
 * @property {() => void} [beforeSlice]     run pending ISRs / poll timers just before a slice
 * @property {() => void} [afterSlice]      flush batched messages (pins, reads, serial)
 * @property {(millis: number) => void} [onTick]
 * @property {(error: object) => void} [onError]
 * @property {() => void} [onHalt]
 */

/**
 * Creates the scheduler.
 * @param {object} options
 * @param {Driver} options.driver
 * @param {boolean} [options.realtime]
 * @param {() => number} [options.now]  wall clock in ms (injected in tests)
 * @param {number} [options.statementCostUs] virtual µs per statement (board dependent)
 * @param {(fn: Function, ms: number) => any} [options.setTimer]
 * @param {(handle: any) => void} [options.clearTimer]
 */
export function createScheduler({
  driver,
  realtime = true,
  now = () => Date.now(),
  statementCostUs = 1,
  sliceStatements = SLICE_STATEMENTS,
  sliceIntervalMs = SLICE_INTERVAL_MS,
  tickIntervalUs = TICK_INTERVAL_US,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (h) => clearTimeout(h),
} = {}) {
  if (!driver || typeof driver.step !== 'function') throw new Error('createScheduler: driver.step is required')
  const costUs = Number(statementCostUs) > 0 ? Number(statementCostUs) : 1

  let running = false
  let timer = null
  /** Virtual µs the VM is sleeping until, or null when it is runnable. */
  let wakeAtUs = null
  let nextTickUs = tickIntervalUs
  let wallStartMs = 0
  let wallOffsetUs = 0
  let speed = 1
  /** Virtual µs the deterministic driver has been granted so far. */
  let budgetUs = 0
  let generation = 0

  function clearPending() {
    if (timer != null) { clearTimer(timer); timer = null }
  }

  function emitTicks() {
    const t = driver.now()
    while (t >= nextTickUs) {
      driver.onTick?.(Math.floor(nextTickUs / 1000))
      nextTickUs += tickIntervalUs
    }
  }

  /** Budget for the next slice: never more than the statements that fit in the remaining virtual time. */
  function sliceBudget(targetUs) {
    const remaining = targetUs - driver.now()
    if (remaining <= 0) return 0
    return Math.max(1, Math.min(sliceStatements, Math.ceil(remaining / costUs)))
  }

  /**
   * Runs slices until virtual time reaches `targetUs`, the sketch halts/errors, or it falls asleep past the target.
   * @returns {boolean} true while the sketch is still alive
   */
  function runUntil(targetUs) {
    let guard = 0
    const activeGeneration = generation
    while (running && driver.now() < targetUs) {
      driver.beforeSlice?.()
      if (!running) { driver.afterSlice?.(); return false }
      if (wakeAtUs != null) {
        const nextUs = Math.min(wakeAtUs, targetUs, nextTickUs, driver.nextEventUs?.() ?? Infinity)
        driver.advanceTo(nextUs)
        driver.beforeSlice?.()
        driver.afterSlice?.()
        emitTicks()
        if (generation !== activeGeneration) return running
        if (driver.now() < wakeAtUs) continue
        wakeAtUs = null
      }
      const budget = sliceBudget(Math.min(targetUs, nextTickUs, driver.nextEventUs?.() ?? Infinity))
      if (budget === 0) break
      const r = driver.step(budget)
      driver.afterSlice?.()
      if (generation !== activeGeneration) return running
      emitTicks()
      if (r.status === 'sleeping') {
        wakeAtUs = r.wakeAtUs ?? driver.now()
      } else if (r.status === 'halted') {
        running = false
        driver.onHalt?.()
        return false
      } else if (r.status === 'error') {
        running = false
        driver.onError?.(r.error ?? { message: 'runtime error', line: 0 })
        return false
      }
      // A slice that made no progress at all (cost rounding) must not spin forever.
      if (++guard > 100000) break
    }
    if (running && wakeAtUs != null && driver.now() < targetUs) driver.advanceTo(targetUs)
    emitTicks()
    return running
  }

  /** Wall-derived virtual target: virtual time may lag behind wall time but never lead it. */
  function wallTargetUs() {
    return Math.max(0, wallOffsetUs + Math.round((now() - wallStartMs) * 1000 * speed))
  }

  function schedule() {
    if (!running || !realtime) return
    let delayMs = sliceIntervalMs
    if (wakeAtUs != null) {
      const remainingUs = Math.min(wakeAtUs, nextTickUs, driver.nextEventUs?.() ?? Infinity) - driver.now()
      delayMs = Math.max(0, Math.round(remainingUs / 1000))
    }
    timer = setTimer(pump, delayMs)
  }

  function pump() {
    timer = null
    if (!running) return
    runUntil(wallTargetUs())
    schedule()
  }

  return {
    /** Starts the pump (realtime) or arms the virtual budget (deterministic). */
    start() {
      if (running) return
      generation += 1
      running = true
      wakeAtUs = null
      nextTickUs = tickIntervalUs
      if (realtime) wallStartMs = now()
      wallOffsetUs = driver.now()
      budgetUs = driver.now()
      if (realtime) schedule()
    },

    /** Stops stepping and clears every timer. */
    stop() {
      running = false
      clearPending()
    },
    setSpeed(value) {
      if (![.25, .5, 1].includes(value)) return
      if (realtime && running) { wallOffsetUs = wallTargetUs(); wallStartMs = now() }
      speed = value
    },

    /** Forgets sleep and tick bookkeeping; call after the VM has been rebuilt. */
    reset() {
      generation += 1
      running = false
      clearPending()
      wakeAtUs = null
      nextTickUs = tickIntervalUs
      budgetUs = 0
    },

    /**
     * Deterministic mode only: runs `ms` of virtual time synchronously.
     * @param {number} ms
     */
    advance(ms) {
      if (realtime) throw new Error('advance(ms) is only available when realtime is false')
      if (!running || !(ms > 0)) return
      budgetUs += Math.round(ms * 1000)
      runUntil(budgetUs)
    },

    /** Runs one slice immediately (used by realtime `start()` so the first statements execute right away). */
    pumpOnce() {
      if (!running) return
      runUntil(realtime ? wallTargetUs() : budgetUs)
    },

    get running() { return running },
    /** Virtual µs the VM sleeps until, or null when runnable. */
    get wakeAtUs() { return wakeAtUs },
  }
}

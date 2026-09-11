import { describe, it, expect, vi, afterEach } from 'vitest'
import { getBoard } from '../boards/index.js'
import { createRuntime } from './index.js'
import { sketch } from './testHarness.js'

afterEach(() => vi.useRealTimers())

describe('runtime lifecycle and diagnostics', () => {
  it.each(['uno', 'nano', 'esp32', 'esp32s3'])('runs setup once and loop repeatedly on %s', (board) => {
    const run = sketch('void setup() { Serial.println("setup"); } void loop() { Serial.println("loop"); delay(10); }', { board })
    run.advance(25)
    expect(run.text()).toBe('setup\nloop\nloop\nloop\n')
    expect(run.runtime.getSnapshot()).toMatchObject({ millis: 25, running: true })
    expect(run.messages.every((message) => Number.isInteger(message.t))).toBe(true)
  })

  it('stops execution and restarts with fresh globals, pins, and serial state', () => {
    const run = sketch('int count = 0; void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); Serial.println(++count); delay(10); }')
    run.advance(15)
    expect(run.text()).toBe('1\n2\n')
    run.runtime.stop()
    const count = run.messages.length
    run.advance(100)
    expect(run.messages).toHaveLength(count)
    run.runtime.reset()
    expect(run.runtime.getPinStates()).toEqual({})
    expect(run.runtime.getSnapshot()).toMatchObject({ running: false, millis: 0 })
    run.runtime.start()
    run.advance(5)
    expect(run.text()).toBe('1\n2\n1\n')
  })

  it('invalidates previously compiled firmware when replacement compilation fails', () => {
    const run = sketch('void setup() {} void loop() { Serial.println("old"); delay(10); }')
    expect(run.runtime.load('void setup() {}').ok).toBe(false)
    run.runtime.start()
    run.runtime.advance(10)
    expect(run.text()).toBe('')
    expect(run.runtime.getSnapshot().running).toBe(false)
  })

  it.each([
    ['uno', 'Servo motor; void setup() {} void loop() {}', /did you forget #include <Servo.h>/],
    ['uno', '#include <WiFi.h>\nvoid setup() { WiFi.begin("VoltNet"); } void loop() {}', /not available on Arduino Uno/],
    ['uno', 'void setup() { touchRead(4); } void loop() {}', /touchRead.*not available/],
    ['esp32', '#include <Missing.h>\nvoid setup() {} void loop() {}', /Missing.h is not available/],
    ['uno', 'void setup() { missingFunction(); } void loop() {}', /missingFunction.*not declared/],
  ])('reports board and include diagnostics (%s)', (board, source, message) => {
    const runtime = createRuntime({ board: getBoard(board), realtime: false })
    const result = runtime.load(source)
    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => message.test(error.message))).toBe(true)
    expect(result.errors.every((error) => error.line > 0)).toBe(true)
  })

  it('reports runtime errors with their source line and stops advancing', () => {
    const run = sketch('void setup() {\n int zero = 0;\n Serial.println(10 / zero);\n}\nvoid loop() {}')
    run.runtime.advance(1)
    expect(run.runtime.getSnapshot()).toMatchObject({ running: false, status: 'error', error: { line: 3 } })
    expect(run.ofType('status').at(-1).error.message).toMatch(/zero/)
  })

  it('executes through the worker message protocol and returns detached pin snapshots', () => {
    const runtime = createRuntime({ board: getBoard('uno'), realtime: false })
    runtime.handle({ type: 'load', source: 'void setup() { pinMode(13, OUTPUT); digitalWrite(13, HIGH); } void loop() { delay(100); }' })
    runtime.handle({ type: 'start' })
    runtime.advance(1)
    const states = runtime.getPinStates()
    states.D13.level = 0
    expect(runtime.getPinStates().D13.level).toBe(1)
    runtime.handle({ type: 'reset' })
    expect(runtime.getPinStates()).toEqual({})
  })

  it('defers realtime execution until the initial env arrives and clears timers on stop', () => {
    vi.useFakeTimers()
    const run = sketch('void setup() { Serial.println(analogRead(A0)); } void loop() { delay(100); }', { realtime: true, now: () => Date.now() })
    expect(run.text()).toBe('')
    run.runtime.handle({ type: 'env', analog: { A0: 5 } })
    vi.advanceTimersByTime(10)
    expect(run.text()).toBe('1023\n')
    run.runtime.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses no timers or wall clock in deterministic mode', () => {
    vi.useFakeTimers()
    const now = vi.fn(() => { throw new Error('wall clock used') })
    const run = sketch('void setup() {} void loop() { delay(1000); }', { now })
    run.advance(2000)
    expect(vi.getTimerCount()).toBe(0)
    expect(now).not.toHaveBeenCalled()
  })
})

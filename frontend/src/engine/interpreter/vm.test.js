/**
 * VM scheduling contract (CONTRACTS §6): virtual time, preemption, budgets, sleeps, `call()` and performance.
 */
import { describe, it, expect } from 'vitest'
import { compile, createVM, formatValue } from './index.js'

/** Compiles a sketch and builds a VM with a small mock host; returns `{ vm, log, pins }`. */
function build(source, options = {}) {
  const { intBits = 16, statementCostUs = 1 } = options
  const compiled = compile(source, { intBits })
  if (!compiled.ok) throw new Error(`compile failed: ${JSON.stringify(compiled.errors)}`)
  const log = []
  const pins = []
  const errors = []
  const vm = createVM(compiled.program, {
    intBits,
    statementCostUs,
    natives: {
      'Serial.print': (args, ctx) => log.push(formatValue(args[0], ctx.argTypes[0], args[1], intBits)),
      'Serial.println': (args, ctx) => log.push(`${formatValue(args[0], ctx.argTypes[0], args[1], intBits)}\n`),
      delay: function* (args, ctx) { yield ctx.sleep(args[0] * 1000) },
      micros: { fn: (_args, ctx) => ctx.now(), returns: 'unsigned long' },
      millis: { fn: (_args, ctx) => Math.floor(ctx.now() / 1000), returns: 'unsigned long' },
      pinMode: () => {},
      digitalWrite: (args, ctx) => pins.push({ pin: args[0], level: args[1], t: ctx.now() }),
      register: (args) => { vm.pending = args[0] },
      ...(options.natives ?? {}),
    },
    globals: { HIGH: 1, LOW: 0, OUTPUT: 1, LED_BUILTIN: 13, ...(options.globals ?? {}) },
    classes: options.classes ?? {},
    onError: (err) => errors.push(err),
  })
  vm.start()
  return { vm, log, pins, errors, program: compiled.program }
}

/** Runs slices, honouring sleeps, until `until(status)` or `maxSlices` is reached. */
function drive({ vm }, { slices = 50, budget = 5000 } = {}) {
  let status = { status: 'running' }
  for (let i = 0; i < slices; i++) {
    status = vm.step(budget)
    if (status.status === 'sleeping') vm.advanceTo(status.wakeAtUs)
    else if (status.status !== 'running') return status
  }
  return status
}

describe('preemption and budgets', () => {
  it('returns running from an infinite loop instead of hanging', () => {
    const h = build('void setup(){}\nvoid loop(){ while (true) { } }')
    for (let i = 0; i < 5; i++) expect(h.vm.step(500)).toEqual({ status: 'running' })
    expect(h.vm.halted).toBe(false)
  })

  it('never exceeds the statement budget, for any budget size', () => {
    const h = build('void setup(){}\nvoid loop(){ int a = 0; a++; a++; a++; }')
    for (const budget of [1, 2, 3, 63, 64, 65, 100, 1000]) {
      const before = h.vm.statementCount
      const status = h.vm.step(budget)
      expect(status.status).toBe('running')
      expect(h.vm.statementCount - before).toBe(budget)
    }
  })

  it('does nothing for a zero budget', () => {
    const h = build('void setup(){}\nvoid loop(){ int a = 0; }')
    expect(h.vm.step(0)).toEqual({ status: 'running' })
    expect(h.vm.statementCount).toBe(0)
  })

  it('reports halted once and stays halted', () => {
    const h = build('void setup(){ stop(); }\nvoid loop(){}', { natives: { stop: (_a, ctx) => ctx.halt() } })
    expect(h.vm.step(500)).toEqual({ status: 'halted' })
    expect(h.vm.step(500)).toEqual({ status: 'halted' })
    expect(h.vm.halted).toBe(true)
  })
})

describe('virtual time', () => {
  it('derives now() from the statement counter and stays an integer on 0.25 µs boards', () => {
    const h = build('void setup(){}\nvoid loop(){ int a = 0; a++; }', { intBits: 32, statementCostUs: 0.25 })
    for (let i = 0; i < 20; i++) {
      h.vm.step(1)
      expect(Number.isInteger(h.vm.now())).toBe(true)
    }
    expect(h.vm.now()).toBe(Math.floor(h.vm.statementCount * 0.25))
  })

  it('reports micros() as an integer on an ESP32 statement cost', () => {
    const h = build('void setup(){ for (int i = 0; i < 50; i++) { Serial.println(micros()); } }\nvoid loop(){}',
      { intBits: 32, statementCostUs: 0.25 })
    drive(h, { slices: 5, budget: 5000 })
    const values = h.log.map((s) => Number(s.trim()))
    expect(values.length).toBe(50)
    for (const v of values) expect(Number.isInteger(v)).toBe(true)
    expect(values[49]).toBeGreaterThan(values[0])
  })

  it('suspends on a native sleep and resumes after advanceTo', () => {
    const h = build('void setup(){}\nvoid loop(){ delay(5); }')
    const first = h.vm.step(1000)
    expect(first.status).toBe('sleeping')
    expect(first.wakeAtUs).toBe(h.vm.now() + 5000)
    h.vm.advanceTo(first.wakeAtUs)
    expect(h.vm.now()).toBe(first.wakeAtUs)
  })

  it('stays asleep when stepped again before time has caught up', () => {
    const h = build('void setup(){}\nvoid loop(){ delay(10); }')
    const first = h.vm.step(1000)
    expect(first.status).toBe('sleeping')
    const parked = h.vm.statementCount
    for (let i = 0; i < 3; i++) {
      expect(h.vm.step(1000)).toEqual({ status: 'sleeping', wakeAtUs: first.wakeAtUs })
      expect(h.vm.statementCount).toBe(parked)
    }
    h.vm.advanceTo(first.wakeAtUs - 1)
    expect(h.vm.step(1000).status).toBe('sleeping')
    h.vm.advanceTo(first.wakeAtUs)
    // Waking resumes the sketch, but loop() immediately re-enters delay(10), so the slice ends on
    // another sleep. What proves the wake happened is that statements ran and the next wake is later.
    const resumed = h.vm.step(200)
    expect(resumed.status).toBe('sleeping')
    expect(resumed.wakeAtUs).toBeGreaterThan(first.wakeAtUs)
    expect(h.vm.statementCount).toBeGreaterThan(parked)
  })

  it('still runs ISRs through call() while the sketch is sleeping', () => {
    const src = 'int hits = 0;\nvoid isr(){ hits++; }\nvoid setup(){ register(isr); }\nvoid loop(){ delay(10); }'
    const h = build(src)
    let status = h.vm.step(1000)
    while (status.status === 'running') status = h.vm.step(1000)
    expect(status.status).toBe('sleeping')
    expect(h.vm.call(h.vm.pending, [])).toEqual({ status: 'ok', value: undefined })
    expect(h.vm.getGlobal('hits')).toBe(1)
    expect(h.vm.step(1000).status).toBe('sleeping')
  })

  it('blinks on the right virtual schedule', () => {
    const src = 'void setup(){ pinMode(13, OUTPUT); }\nvoid loop(){ digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }'
    const h = build(src)
    drive(h, { slices: 40, budget: 5000 })
    expect(h.pins.length).toBeGreaterThanOrEqual(4)
    expect(h.pins.slice(0, 4).map((p) => p.level)).toEqual([1, 0, 1, 0])
    // Each level lasts 500 ms of virtual time (plus the handful of statements between the calls).
    for (let i = 1; i < 4; i++) {
      const dt = h.pins[i].t - h.pins[i - 1].t
      expect(dt).toBeGreaterThanOrEqual(500000)
      expect(dt).toBeLessThan(500100)
    }
  })

  it('advanceTo never moves time backwards', () => {
    const h = build('void setup(){}\nvoid loop(){ int a = 0; }')
    h.vm.step(100)
    const t = h.vm.now()
    h.vm.advanceTo(t - 1000)
    expect(h.vm.now()).toBe(t)
  })
})

describe('call()', () => {
  const src = [
    'int total = 0;',
    'void isr(){ total += 7; }',
    'void slowIsr(){ delay(2); total = 99; }',
    'int twice(int x){ return x * 2; }',
    'void setup(){ register(isr); }',
    'void loop(){}',
  ].join('\n')

  it('runs a callable to completion and returns its value', () => {
    const h = build(src)
    h.vm.step(500)
    expect(h.vm.call(h.vm.pending, [])).toEqual({ status: 'ok', value: undefined })
    expect(h.vm.getGlobal('total')).toBe(7)
    h.vm.call(h.vm.pending, [])
    expect(h.vm.getGlobal('total')).toBe(14)
  })

  it('runs nested sleeps inline instead of suspending', () => {
    const h = build(src.replace('register(isr)', 'register(slowIsr)'))
    h.vm.step(500)
    const before = h.vm.now()
    expect(h.vm.call(h.vm.pending, []).status).toBe('ok')
    expect(h.vm.getGlobal('total')).toBe(99)
    expect(h.vm.now()).toBeGreaterThanOrEqual(before + 2000)
  })

  it('keeps the sketch runnable afterwards', () => {
    const h = build(src)
    h.vm.step(500)
    h.vm.call(h.vm.pending, [])
    expect(h.vm.step(500).status).toBe('running')
    expect(h.vm.halted).toBe(false)
  })

  it('reports errors instead of throwing', () => {
    const h = build('int boom(){ int z = 0; return 1 / z; }\nvoid setup(){ register(boom); }\nvoid loop(){}')
    h.vm.step(500)
    const r = h.vm.call(h.vm.pending, [])
    expect(r.status).toBe('error')
    expect(r.error.message).toBe('division by zero')
    expect(h.errors).toHaveLength(1)
  })

  it('passes arguments through', () => {
    const h = build(src.replace('register(isr)', 'register(twice)'))
    h.vm.step(500)
    expect(h.vm.call(h.vm.pending, [21])).toEqual({ status: 'ok', value: 42 })
  })
})

describe('globals and errors', () => {
  it('reads and writes globals, wrapping on write', () => {
    const h = build('int counter = 3;\nvoid setup(){}\nvoid loop(){}')
    h.vm.step(500)
    expect(h.vm.getGlobal('counter')).toBe(3)
    expect(h.vm.setGlobal('counter', 40000)).toBe(true)
    expect(h.vm.getGlobal('counter')).toBe(-25536)
    expect(h.vm.setGlobal('nope', 1)).toBe(false)
    expect(h.vm.getGlobal('nope')).toBeUndefined()
  })

  it('carries the source line on a runtime error and calls onError', () => {
    const h = build('void setup(){\n  int a[2];\n  a[9] = 1;\n}\nvoid loop(){}')
    const status = h.vm.step(1000)
    expect(status).toMatchObject({ status: 'error', error: { line: 3 } })
    expect(h.errors[0].line).toBe(3)
    expect(h.vm.lastLine).toBe(3)
    expect(h.vm.halted).toBe(true)
  })

  it('stops runaway recursion at the depth limit', () => {
    const h = build('int f(int n){\n  return f(n + 1);\n}\nvoid setup(){ f(0); }\nvoid loop(){}')
    const status = h.vm.step(200000)
    expect(status.status).toBe('error')
    expect(status.error.message).toMatch(/call depth exceeded 512/)
    expect(status.error.line).toBe(2)
  })

  it('errors when a sketch calls something the host does not provide', () => {
    const h = build('void setup(){ ledcWrite(0, 128); }\nvoid loop(){}')
    expect(h.vm.step(500)).toMatchObject({ status: 'error', error: { message: "'ledcWrite' was not declared in this scope" } })
  })
})

describe('native context', () => {
  it('exposes argTypes, line, intBits, now, sleep, invoke and a bound formatter', () => {
    const seen = []
    const h = build(`void setup(){\n  probe('A', 2.5, "s");\n}\nvoid loop(){}`, {
      intBits: 16,
      natives: {
        probe: (args, ctx) => {
          seen.push({
            argTypes: ctx.argTypes,
            line: ctx.line,
            intBits: ctx.intBits,
            char: ctx.format(args[0], 'char'),
            hex: ctx.format(-1, 'int', 16),
            now: ctx.now(),
            sleepShape: ctx.sleep(50),
            hasInvoke: typeof ctx.invoke === 'function',
            isVm: ctx.vm === h.vm,
          })
        },
      },
    })
    h.vm.step(500)
    expect(seen[0]).toMatchObject({
      argTypes: ['char', 'double', 'String'],
      line: 2,
      intBits: 16,
      char: 'A',
      hex: 'FFFF',
      hasInvoke: true,
      isVm: true,
    })
    expect(seen[0].sleepShape).toEqual({ type: 'sleep', untilUs: seen[0].now + 50 })
  })
})

describe('program reuse', () => {
  it('runs the same compiled program in two independent VMs', () => {
    const compiled = compile('int n = 0;\nvoid setup(){ n = 5; }\nvoid loop(){ n++; }', { intBits: 16 })
    const make = () => createVM(compiled.program, { intBits: 16, statementCostUs: 1 })
    const a = make()
    const b = make()
    a.start()
    b.start()
    a.step(200)
    expect(b.getGlobal('n')).toBeUndefined()
    b.start()
    b.step(20)
    expect(a.getGlobal('n')).toBeGreaterThan(b.getGlobal('n'))
  })
})

describe('performance', () => {
  it('runs at least 2 million statements per second', () => {
    const h = build('void setup(){}\nvoid loop(){ long s = 0; for (long i = 0; i < 100000; i++) { s += i; } }', { intBits: 32 })
    h.vm.step(200000)                      // warm up the JIT before measuring
    const start = h.vm.statementCount
    const t0 = process.hrtime.bigint()
    for (let i = 0; i < 8; i++) h.vm.step(500000)
    const seconds = Number(process.hrtime.bigint() - t0) / 1e9
    const rate = (h.vm.statementCount - start) / seconds
    expect(h.vm.statementCount - start).toBe(4000000)
    expect(rate).toBeGreaterThan(2e6)
  })
})

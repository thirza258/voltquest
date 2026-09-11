import { describe, it, expect } from 'vitest'
import { sketch } from './testHarness.js'

describe('Arduino API on the assembled runtime', () => {
  it('batches every distinct edge in execution order with its original timestamp', () => {
    const run = sketch('void setup() { pinMode(LED_BUILTIN, OUTPUT); digitalWrite(13, HIGH); digitalWrite(13, HIGH); delayMicroseconds(10); digitalWrite(13, LOW); } void loop() { delay(1000); }')
    run.advance(1)
    const edges = run.ofType('pins').flatMap((message) => message.changes)
    expect(edges.map((edge) => [edge.pin, edge.mode, edge.level])).toEqual([
      ['D13', 'output', undefined], ['D13', 'output', 1], ['D13', 'output', 0],
    ])
    expect(edges[2].t - edges[1].t).toBeGreaterThanOrEqual(10)
    expect(edges.every((edge) => Number.isInteger(edge.t))).toBe(true)
  })

  it('scales and clamps analog input, records every read, and respects digital input', () => {
    const run = sketch('void setup() { Serial.println(analogRead(A0)); Serial.println(analogRead(A1)); Serial.println(analogRead(2)); Serial.println(digitalRead(2)); } void loop() { delay(1000); }', {
      env: { analog: { A0: 2.5, A1: 8 }, digital: { D2: 1 } },
    })
    run.advance(1)
    expect(run.text()).toBe('512\n1023\n0\n1\n')
    expect(run.ofType('read').flatMap((message) => message.reads).map(({ pin, value }) => [pin, value])).toEqual([['A0', 512], ['A1', 1023], ['D2', 0]])
    expect(run.ofType('log').map((message) => message.code)).toContain('not_adc_pin')
  })

  it('drives PWM, degrades non-PWM output, and warns on AVR pull-downs', () => {
    const run = sketch('void setup() { analogWrite(9, 128); analogWrite(13, 200); pinMode(2, INPUT_PULLDOWN); } void loop() { delay(1000); }')
    run.advance(1)
    expect(run.runtime.getPinStates()).toMatchObject({ D9: { mode: 'pwm', duty: 128 / 255, freq: 490 }, D13: { mode: 'output', level: 1 } })
    expect(run.ofType('log').map((message) => message.code)).toEqual(['no_pwm_pin', 'no_pulldown'])
  })

  it('ends timed tones while the sketch is sleeping', () => {
    const run = sketch('void setup() { tone(9, 440, 25); delay(1000); } void loop() {}')
    run.advance(50)
    const tones = run.ofType('tone')
    expect(tones.map((message) => message.freq)).toEqual([440, 0])
    expect(tones[1].t - tones[0].t).toBe(25000)
  })

  it('runs interrupt callbacks at a safe point even during delay', () => {
    const run = sketch('volatile int hits = 0; void pressed() { hits++; Serial.println(hits); } void setup() { attachInterrupt(digitalPinToInterrupt(2), pressed, RISING); } void loop() { delay(1000); }')
    run.advance(1)
    run.runtime.handle({ type: 'env', digital: { D2: 1 } })
    expect(run.text()).toBe('')
    run.advance(1)
    expect(run.text()).toBe('1\n')
    run.runtime.handle({ type: 'env', digital: { D2: 1 } })
    run.advance(1)
    expect(run.text()).toBe('1\n')
  })

  it('defers interrupts until re-enabled and discards detached callbacks', () => {
    const run = sketch('void pressed() { Serial.println("edge"); } void setup() { attachInterrupt(2, pressed, CHANGE); noInterrupts(); delay(10); interrupts(); delay(10); detachInterrupt(2); } void loop() { delay(1000); }')
    run.advance(1)
    run.runtime.handle({ type: 'env', digital: { D2: 1 } })
    run.advance(5)
    expect(run.text()).toBe('')
    run.advance(10)
    expect(run.text()).toBe('edge\n')
    run.advance(10)
    run.runtime.handle({ type: 'env', digital: { D2: 0 } })
    run.advance(1)
    expect(run.text()).toBe('edge\n')
  })

  it('measures a bound ultrasonic sensor and times out on an unbound pin', () => {
    const run = sketch('void setup() { Serial.println(pulseIn(2, HIGH)); Serial.println(pulseIn(3, HIGH, 500)); } void loop() { delay(1000); }', {
      env: { peripheralMap: [{ componentId: 'sensor', protocol: 'ultrasonic', pins: { echo: 'D2' }, powered: true }], peripherals: { sensor: { distanceCm: 100 } } },
    })
    run.advance(10)
    expect(run.text()).toBe('5830\n0\n')
  })

  it('replays seeded random sequences after reset', () => {
    const run = sketch('void setup() { randomSeed(42); for (int index = 0; index < 5; index++) Serial.println(random(10, 20)); } void loop() { delay(1000); }')
    run.advance(1)
    const first = run.text()
    expect(first.trim().split('\n').map(Number).every((value) => value >= 10 && value < 20)).toBe(true)
    run.runtime.start()
    run.advance(1)
    expect(run.text()).toBe(first + first)
  })
})

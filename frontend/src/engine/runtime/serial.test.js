import { describe, it, expect } from 'vitest'
import { sketch } from './testHarness.js'

describe('Serial and native formatting', () => {
  it.each([
    ['uno', '-25536\n16960\n3.00A'], ['esp32', '40000\n1000000\n3.00A'],
  ])('preserves C expression types and integer widths on %s', (board, expected) => {
    const run = sketch('void setup() { int value = 40; Serial.println(value * 1000); long big = 1000 * 1000; Serial.println(big); float decimal = 3.0; Serial.print(decimal); char letter = 65; Serial.print(letter); } void loop() { delay(1000); }', { board })
    run.advance(1)
    expect(run.text()).toBe(expected)
  })

  it('honors UART FIFO backpressure and baud rate', () => {
    const countAt = (baud) => {
      const run = sketch(`void setup() { Serial.begin(${baud}); } void loop() { Serial.write('x'); }`)
      run.advance(100)
      expect(run.ofType('serialBegin')[0].baud).toBe(baud)
      return run.text().length
    }
    expect(countAt(9600)).toBeGreaterThanOrEqual(159)
    expect(countAt(9600)).toBeLessThanOrEqual(162)
    expect(countAt(115200)).toBeGreaterThan(1100)
    expect(countAt(115200)).toBeLessThan(1220)
  })

  it('coalesces small prints per slice and flush waits until the UART drains', () => {
    const run = sketch('void setup() { Serial.begin(9600); Serial.print("ab"); Serial.print("cd"); Serial.flush(); Serial.println(micros()); } void loop() { delay(1000); }')
    run.advance(1)
    expect(run.text()).toBe('abcd')
    expect(run.ofType('serial')).toHaveLength(1)
    run.advance(5)
    expect(Number(run.text().slice(4).trim())).toBeGreaterThanOrEqual(4167)
  })

  it('accepts serial input during a blocking read and consumes delimiters', () => {
    const run = sketch('void setup() { Serial.setTimeout(50); Serial.println(Serial.readStringUntil(10)); Serial.println(Serial.parseInt()); Serial.println(Serial.peek()); Serial.println(Serial.read()); } void loop() { delay(1000); }')
    run.advance(5)
    expect(run.text()).toBe('')
    run.runtime.handle({ type: 'serialInput', text: 'hello\n42!' })
    run.advance(5)
    expect(run.text()).toBe('hello\n42\n33\n33\n')
  })

  it('returns remaining input on timeout and clears RX on reset', () => {
    const run = sketch('void setup() { Serial.setTimeout(5); Serial.println(Serial.readStringUntil(\'!\')); } void loop() { delay(1000); }')
    run.runtime.handle({ type: 'serialInput', text: 'partial' })
    run.advance(10)
    expect(run.text()).toBe('partial\n')
    run.runtime.handle({ type: 'serialInput', text: 'discard!' })
    run.runtime.reset()
    run.runtime.start()
    run.advance(10)
    expect(run.text()).toBe('partial\n\n')
  })

  it('writes bounded, null-terminated buffers with snprintf, dtostrf and itoa', () => {
    const run = sketch('void setup() { char buffer[6]; Serial.println(snprintf(buffer, sizeof(buffer), "%s", "abcdefghi")); Serial.println(buffer); char decimal[12]; dtostrf(3.14, 6, 2, decimal); Serial.println(decimal); itoa(255, decimal, 16); Serial.println(decimal); } void loop() { delay(1000); }')
    run.advance(1)
    expect(run.text()).toBe('9\nabcde\n  3.14\nff\n')
  })

  it('provides printf on ESP32', () => {
    const run = sketch('void setup() { Serial.printf("%04d %.1f %s", 7, 2.5, "ok"); } void loop() { delay(1000); }', { board: 'esp32' })
    run.advance(1)
    expect(run.text()).toBe('0007 2.5 ok')
  })
})

import { describe, it, expect } from 'vitest'
import * as boards from '../boards/index.js'
import { createPinResolver, normalizeBoard } from './pins.js'

describe('board pin resolution', () => {
  it.each([
    ['uno', 14, 'A0', 'LED_BUILTIN', 'D13'], ['nano', 21, 'A7', 'LED_BUILTIN', 'D13'],
    ['esp32', 4, 'GPIO4', 'T0', 'GPIO4'], ['esp32s3', 8, 'GPIO8', 'T14', 'GPIO14'],
  ])('resolves numbers and aliases to canonical names on %s', (boardId, number, pin, alias, target) => {
    const resolver = createPinResolver(normalizeBoard(boardId, boards), boards)
    expect(resolver.byNumber(number).name).toBe(pin)
    expect(resolver.byName(alias).name).toBe(target)
    expect(resolver.byNumber(resolver.aliasGlobals()[alias]).name).toBe(target)
    expect(resolver.resolve(-1)).toBeNull()
    expect(resolver.resolve(NaN)).toBeNull()
  })

  it('distinguishes ESP32 ADC units and input-only pins', () => {
    const resolver = createPinResolver(normalizeBoard('esp32', boards), boards)
    expect(resolver.byNumber(4).adcUnit).toBe(2)
    expect(resolver.byNumber(34).adcUnit).toBe(1)
    expect(resolver.byNumber(34).caps.has('input_only')).toBe(true)
    expect(resolver.byNumber(34).caps.has('pwm')).toBe(false)
    expect(resolver.i2cPins()).toEqual({ sda: 'GPIO21', scl: 'GPIO22' })
  })

  it('keeps Nano A6 and A7 analog-only', () => {
    const resolver = createPinResolver(normalizeBoard('nano', boards), boards)
    expect(resolver.byNumber(20).caps.has('digital')).toBe(false)
    expect(resolver.byNumber(21).caps.has('adc')).toBe(true)
  })
})

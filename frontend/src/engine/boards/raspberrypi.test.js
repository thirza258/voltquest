import { describe, it, expect } from 'vitest'
import { getBoard, resolvePinNumber, resolvePinName } from './index.js'
import { makeDoc, wire } from '../components/seeds.js'
import { compileCircuit, evaluateCircuit } from '../circuit/index.js'

describe('Raspberry Pi header and electrical model', () => {
  it.each(['raspberrypi4', 'raspberrypi5'])('%s has the physical 40-pin header without an ADC', (id) => {
    const board = getBoard(id)
    expect(board.pins).toHaveLength(40)
    expect(new Set(board.pins.map((pin) => pin.name)).size).toBe(40)
    expect(board.pins[10].name).toBe('GPIO17')
    expect(board.pins[12].name).toBe('GPIO27')
    expect(board.pins[0]).toMatchObject({ name: '3V3', volts: 3.3, kind: 'power' })
    expect(resolvePinName(board, 'PIN11').name).toBe('GPIO17')
    expect(resolvePinNumber(board, 17).name).toBe('GPIO17')
    expect(board.pins.some((pin) => pin.caps.includes('adc'))).toBe(false)
    expect(board.ledBuiltin).toBeNull()
  })

  it('detects a 5 V GPIO overvoltage and merges all ground pins', () => {
    const doc = makeDoc({ mcu: 'raspberrypi4' })
    wire(doc, 'c_raspberrypi4:5V', 'c_raspberrypi4:GPIO17')
    const compiled = compileCircuit(doc)
    expect(compiled.mcu.pinNet.GND8).toBe('n_gnd')
    const evaluation = evaluateCircuit(compiled, { powered: true, mcuPins: {}, controls: {}, damaged: {}, burntPins: {}, moduleOutputs: {} })
    expect(evaluation.events).toContainEqual(expect.objectContaining({ type: 'burnt_pin', pinName: 'GPIO17' }))
  })
})

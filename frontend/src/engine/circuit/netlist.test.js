/**
 * Compilation: nets, netlist elements, structural issues, peripheral binding and path queries
 * (CONTRACTS §5.1, §5.5, §7.3).
 */
import { describe, it, expect } from 'vitest'
import { makeDoc, place, placeFree, wire } from '../components/seeds.js'
import { compileCircuit } from './netlist.js'
import { describeNet, findPath, terminalsOfComponent } from './path.js'
import { GND_NET } from './nets.js'

function bindingOf(compiled, componentId) {
  return compiled.peripheralMap.find((entry) => entry.componentId === componentId) ?? null
}

describe('nets', () => {
  it('joins a breadboard strip and keeps the two blocks of a row apart', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'resistor', 'bb1', 'a12', { ohms: 220 }, 0, 'c_r1')
    const compiled = compileCircuit(doc)

    const upper = compiled.terminalToNet['bb1:a12']
    expect(compiled.terminalToNet['bb1:e12']).toBe(upper)
    expect(compiled.terminalToNet['bb1:f12']).not.toBe(upper)
    expect(compiled.terminalToNet['bb1:c16']).toBe(compiled.terminalToNet['bb1:a16'])
  })

  it('keeps a rail continuous along the whole board', () => {
    const doc = makeDoc({ mcu: 'uno' })
    wire(doc, 'c_uno:5V', 'bb1:TP1')
    const compiled = compileCircuit(doc)

    expect(compiled.terminalToNet['bb1:TP25']).toBe(compiled.terminalToNet['bb1:TP1'])
    expect(compiled.terminalToNet['bb1:TN1']).not.toBe(compiled.terminalToNet['bb1:TP1'])
    expect(compiled.nets.find((net) => net.id === compiled.terminalToNet['bb1:TP1']).label).toBe('5V')
  })

  it('aliases board-mounted component pins onto their hole net', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'led', 'bb1', 'a3', { color: 'red' }, 0, 'c_led1')
    const compiled = compileCircuit(doc)

    expect(compiled.terminalToNet['c_led1:anode']).toBe(compiled.terminalToNet['bb1:a3'])
    expect(compiled.terminalToNet['c_led1:cathode']).toBe(compiled.terminalToNet['bb1:a4'])
    expect(terminalsOfComponent(compiled, 'c_led1')).toEqual({
      anode: compiled.terminalToNet['bb1:a3'],
      cathode: compiled.terminalToNet['bb1:a4'],
    })
  })

  it('merges every ground pin into n_gnd and labels power nets', () => {
    const doc = makeDoc({ mcu: 'uno' })
    const compiled = compileCircuit(doc)

    expect(compiled.mcu.pinNet.GND).toBe(GND_NET)
    expect(compiled.mcu.pinNet.GND2).toBe(GND_NET)
    expect(compiled.mcu.pinNet.GND3).toBe(GND_NET)
    expect(describeNet(compiled, GND_NET).label).toBe('GND')
    expect(compiled.nets.find((net) => net.id === compiled.mcu.pinNet['3V3']).label).toBe('3V3')
    expect(compiled.nets.find((net) => net.id === compiled.mcu.pinNet.D13).label).toBe('D13')
  })

  it('ties the Uno SCL/SDA header pins to A5/A4', () => {
    const compiled = compileCircuit(makeDoc({ mcu: 'uno' }))
    expect(compiled.mcu.pinNet.SCL).toBe(compiled.mcu.pinNet.A5)
    expect(compiled.mcu.pinNet.SDA).toBe(compiled.mcu.pinNet.A4)
    expect(compiled.nets.find((net) => net.id === compiled.mcu.pinNet.A5).label).toBe('A5')
  })

  it('bonds the two halves of a pushbutton and the two COM pins of a display', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'pushbutton', 'bb1', 'a1', {}, 0, 'c_btn')
    place(doc, 'seven_segment', 'bb1', 'e10', {}, 0, 'c_seg')
    const compiled = compileCircuit(doc)

    expect(compiled.terminalToNet['c_btn:a1']).toBe(compiled.terminalToNet['c_btn:a2'])
    expect(compiled.terminalToNet['c_btn:b1']).toBe(compiled.terminalToNet['c_btn:b2'])
    expect(compiled.terminalToNet['c_btn:a1']).not.toBe(compiled.terminalToNet['c_btn:b1'])
    expect(compiled.terminalToNet['c_seg:com']).toBe(compiled.terminalToNet['c_seg:com2'])
  })

  it('resolves model elements to net ids', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'resistor', 'bb1', 'a1', { ohms: 4700 }, 0, 'c_r1')
    const compiled = compileCircuit(doc)
    const element = compiled.elements.find((el) => el.componentId === 'c_r1')

    expect(element.kind).toBe('resistor')
    expect(element.ohms).toBe(4700)
    expect(element.pins).toEqual({ a: compiled.terminalToNet['bb1:a1'], b: compiled.terminalToNet['bb1:a5'] })
    expect(element.pinIds).toEqual({ a: 'p1', b: 'p2' })
  })
})

describe('issues', () => {
  it('reports a document with no MCU', () => {
    const doc = makeDoc({})
    place(doc, 'led', 'bb1', 'a1', { color: 'red' }, 0, 'c_led1')
    const compiled = compileCircuit(doc)

    expect(compiled.issues.map((i) => i.code)).toContain('no_mcu')
    expect(compiled.mcu).toBeNull()
  })

  it('reports pins that hang off the breadboard', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'resistor', 'bb1', 'a29', { ohms: 220 }, 0, 'c_r1')
    const issue = compileCircuit(doc).issues.find((i) => i.code === 'unplaced_pin')

    expect(issue.componentIds).toEqual(['c_r1'])
    expect(issue.severity).toBe('error')
  })

  it('reports a supply pin wired to ground', () => {
    const doc = makeDoc({ mcu: 'uno' })
    wire(doc, 'c_uno:5V', 'c_uno:GND')
    const compiled = compileCircuit(doc)

    expect(compiled.issues.map((i) => i.code)).toContain('vcc_gnd_short')
    expect(compiled.mcu.pinNet['5V']).toBe(GND_NET)
  })

  it('reports a component that is wired to nothing', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'led', 'bb1', 'a20', { color: 'red' }, 0, 'c_led1')
    place(doc, 'resistor', 'bb1', 'a1', { ohms: 220 }, 0, 'c_r1')
    wire(doc, 'c_uno:5V', 'bb1:b1')
    const issues = compileCircuit(doc).issues.filter((i) => i.code === 'floating_component')

    expect(issues.map((i) => i.componentIds[0])).toEqual(['c_led1'])
  })
})

describe('peripheral binding', () => {
  /** Servo on D9, LCD on the I2C pins, PIR on D2, ultrasonic on D6/D7. */
  function sensorDoc() {
    const doc = makeDoc({ mcu: 'uno' })
    wire(doc, 'c_uno:5V', 'bb1:TP1')
    wire(doc, 'c_uno:GND', 'bb1:TN1')

    place(doc, 'servo', 'bb1', 'a1', {}, 0, 'c_servo')
    wire(doc, 'bb1:b1', 'c_uno:D9')
    wire(doc, 'bb1:b2', 'bb1:TP2')
    wire(doc, 'bb1:b3', 'bb1:TN2')

    place(doc, 'lcd16x2_i2c', 'bb1', 'a5', { addr: 0x3f }, 0, 'c_lcd')
    wire(doc, 'bb1:b5', 'bb1:TN3')
    wire(doc, 'bb1:b6', 'bb1:TP3')
    wire(doc, 'bb1:b7', 'c_uno:A4')
    wire(doc, 'bb1:b8', 'c_uno:A5')

    place(doc, 'pir', 'bb1', 'a10', {}, 0, 'c_pir')
    wire(doc, 'bb1:b10', 'bb1:TP4')
    wire(doc, 'bb1:b11', 'c_uno:D2')
    wire(doc, 'bb1:b12', 'bb1:TN4')

    place(doc, 'ultrasonic_hcsr04', 'bb1', 'a15', {}, 0, 'c_hc')
    wire(doc, 'bb1:b15', 'bb1:TP5')
    wire(doc, 'bb1:b16', 'c_uno:D6')
    wire(doc, 'bb1:b17', 'c_uno:D7')
    wire(doc, 'bb1:b18', 'bb1:TN5')
    return doc
  }

  it('binds input roles by connectivity and output roles electrically', () => {
    const compiled = compileCircuit(sensorDoc())

    expect(bindingOf(compiled, 'c_servo')).toMatchObject({ protocol: 'servo', pins: { signal: 'D9' }, powered: true })
    expect(bindingOf(compiled, 'c_lcd')).toMatchObject({ protocol: 'lcd_i2c', pins: { sda: 'A4', scl: 'A5' }, i2cAddress: 0x3f })
    expect(bindingOf(compiled, 'c_pir')).toMatchObject({ protocol: 'pir', pins: { signal: 'D2' }, powered: true })
    expect(bindingOf(compiled, 'c_hc')).toMatchObject({ protocol: 'ultrasonic', pins: { trig: 'D6', echo: 'D7' } })
    expect(bindingOf(compiled, 'c_hc').props).toEqual({})
  })

  it('leaves I2C pins unbound when the module is on the wrong pins', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'lcd16x2_i2c', 'bb1', 'a5', {}, 0, 'c_lcd')
    wire(doc, 'bb1:b5', 'c_uno:GND')
    wire(doc, 'bb1:b6', 'c_uno:5V')
    wire(doc, 'bb1:b7', 'c_uno:D2')
    wire(doc, 'bb1:b8', 'c_uno:D3')
    const binding = bindingOf(compileCircuit(doc), 'c_lcd')

    expect(binding.pins).toEqual({ sda: null, scl: null })
    expect(binding.powered).toBe(true)
  })

  it('reports an unpowered module and an unbound signal', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'servo', 'bb1', 'a1', {}, 0, 'c_servo')
    const binding = bindingOf(compileCircuit(doc), 'c_servo')

    expect(binding.powered).toBe(false)
    expect(binding.pins.signal).toBeNull()
  })

  it('binds a module output that reaches the pin through a divider', () => {
    const doc = makeDoc({ mcu: 'esp32', boardMode: 'dual', mcuId: 'c_esp32' })
    place(doc, 'ultrasonic_hcsr04', 'bb1', 'a1', {}, 0, 'c_hc')
    place(doc, 'resistor', 'bb1', 'a6', { ohms: 1000 }, 0, 'c_r1')
    place(doc, 'resistor', 'bb1', 'a11', { ohms: 2200 }, 0, 'c_r2')
    wire(doc, 'c_esp32:VIN', 'bb1:b1')
    wire(doc, 'bb1:b4', 'c_esp32:GND')
    wire(doc, 'bb1:b2', 'c_esp32:GPIO5') // trig
    wire(doc, 'bb1:b3', 'bb1:b6')
    wire(doc, 'bb1:b10', 'bb1:b11')
    wire(doc, 'bb1:b15', 'c_esp32:GND')
    wire(doc, 'bb1:c11', 'c_esp32:GPIO4')
    const compiled = compileCircuit(doc)

    expect(bindingOf(compiled, 'c_hc').pins).toEqual({ trig: 'GPIO5', echo: 'GPIO4' })
    expect(compiled.bindingWarnings).toEqual([])
  })

  it('produces no binding for parts that are not peripherals', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'dc_motor', 'bb1', 'a1', {}, 0, 'c_m1')
    place(doc, 'relay_5v', 'bb1', 'a5', {}, 0, 'c_relay')
    place(doc, 'seven_segment', 'bb1', 'e15', {}, 0, 'c_seg')
    place(doc, 'level_shifter', 'bb1', 'e20', {}, 0, 'c_ls')
    expect(compileCircuit(doc).peripheralMap).toEqual([])
  })
})

describe('findPath', () => {
  /** 5V → 220 Ω → LED → GND. */
  function ledDoc() {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'resistor', 'bb1', 'a1', { ohms: 220 }, 0, 'c_r1')
    place(doc, 'led', 'bb1', 'a6', { color: 'red' }, 0, 'c_led1')
    wire(doc, 'c_uno:D13', 'bb1:b1')
    wire(doc, 'bb1:b5', 'bb1:b6')
    wire(doc, 'bb1:b7', 'c_uno:GND')
    return compileCircuit(doc)
  }

  it('finds a path through a resistor of a given value', () => {
    const compiled = ledDoc()
    const path = findPath(compiled, 'c_uno:D13', 'c_led1:anode', { through: [{ componentType: 'resistor', props: { ohms: 220 } }] })

    expect(path.components.map((c) => c.id)).toEqual(['c_r1'])
    expect(path.nets[0]).toBe(compiled.mcu.pinNet.D13)
    expect(path.nets.at(-1)).toBe(compiled.terminalToNet['c_led1:anode'])
  })

  it('accepts both `type` and `componentType` in a through spec and rejects wrong values', () => {
    const compiled = ledDoc()
    expect(findPath(compiled, 'c_uno:D13', 'c_led1:anode', { through: [{ type: 'resistor' }] })).not.toBeNull()
    expect(findPath(compiled, 'c_uno:D13', 'c_led1:anode', { through: [{ type: 'resistor', props: { ohms: 1000 } }] })).toBeNull()
    expect(findPath(compiled, 'c_uno:D13', 'c_led1:anode', { through: [{ type: 'capacitor' }] })).toBeNull()
  })

  it('walks the whole series chain and honours exact and maxHops', () => {
    const compiled = ledDoc()
    const full = findPath(compiled, 'c_uno:D13', 'c_uno:GND', { through: [{ type: 'resistor' }, { type: 'led' }] })
    expect(full.components.map((c) => c.type)).toEqual(['resistor', 'led'])

    expect(findPath(compiled, 'c_uno:D13', 'c_uno:GND', { through: [{ type: 'led' }], exact: true })).toBeNull()
    expect(findPath(compiled, 'c_uno:D13', 'c_uno:GND', { maxHops: 1 })).toBeNull()
  })

  it('treats two terminals on the same net as a zero-hop path', () => {
    const compiled = ledDoc()
    const path = findPath(compiled, 'c_r1:p2', 'c_led1:anode')

    expect(path.components).toEqual([])
    expect(path.nets).toHaveLength(1)
  })

  it('returns null for unknown terminals and disconnected parts', () => {
    const compiled = ledDoc()
    expect(findPath(compiled, 'c_uno:D13', 'c_nope:anode')).toBeNull()
    expect(findPath(compiled, 'c_uno:D12', 'c_led1:anode')).toBeNull()
  })

  it('crosses a pot between its ends and its wiper', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'potentiometer', 'bb1', 'a1', { ohms: 10000 }, 0, 'c_pot')
    wire(doc, 'c_uno:5V', 'bb1:b1')
    wire(doc, 'bb1:b2', 'c_uno:A0')
    wire(doc, 'bb1:b3', 'c_uno:GND')
    const compiled = compileCircuit(doc)

    expect(findPath(compiled, 'c_uno:A0', 'c_uno:5V', { through: [{ type: 'potentiometer' }] })).not.toBeNull()
    expect(findPath(compiled, 'c_uno:5V', 'c_uno:GND', { through: [{ type: 'potentiometer' }], exact: true })).not.toBeNull()
  })
})

describe('describeNet', () => {
  it('lists the terminals and component pins of a net', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'led', 'bb1', 'a3', { color: 'red' }, 0, 'c_led1')
    wire(doc, 'c_uno:D13', 'bb1:b3')
    const compiled = compileCircuit(doc)
    const net = describeNet(compiled, compiled.mcu.pinNet.D13)

    expect(net.label).toBe('D13')
    expect(net.terminals).toEqual(expect.arrayContaining(['c_uno:D13', 'bb1:a3', 'c_led1:anode']))
    expect(net.componentPins).toEqual(
      expect.arrayContaining([
        { componentId: 'c_uno', pinId: 'D13' },
        { componentId: 'c_led1', pinId: 'anode' },
      ]),
    )
    expect(describeNet(compiled, 'n_nope')).toBeNull()
  })

  it('handles a free-mounted part with no breadboard at all', () => {
    const doc = makeDoc({ mcu: 'uno' })
    placeFree(doc, 'uno', 400, 400, {}, 0, 'c_second')
    const compiled = compileCircuit(doc)

    expect(compiled.mcu.componentId).toBe('c_uno')
    expect(compiled.terminalToNet['c_second:D13']).toBeTruthy()
  })
})

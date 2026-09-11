/**
 * Electrical reference values of the circuit engine (CONTRACTS §5.2/§5.4).
 *
 * Every number asserted here is a contract reference value — quest content and the learn cards are authored
 * against them, so a change in the solver has to show up as a failure here first.
 */
import { describe, it, expect } from 'vitest'
import { makeDoc, place, wire } from '../components/seeds.js'
import { compileCircuit } from './netlist.js'
import { evaluateCircuit } from './evaluate.js'

/** Dynamic state with every field filled in (§5.3). */
function dynamic(patch = {}) {
  return { powered: true, mcuPins: {}, controls: {}, damaged: {}, burntPins: {}, moduleOutputs: {}, ...patch }
}

/** Compile + evaluate in one step. */
function run(doc, patch) {
  const compiled = compileCircuit(doc)
  return { compiled, evaluation: evaluateCircuit(compiled, dynamic(patch)) }
}

/** Current through a component in mA. */
function ma(evaluation, componentId) {
  return (evaluation.componentStates[componentId]?.current ?? 0) * 1000
}

function codes(evaluation) {
  return evaluation.warnings.map((w) => w.code)
}

/**
 * `source` → [resistor?] → LED → GND on a half breadboard.
 * Rows: resistor a1..a5, LED anode a6 / cathode a7 (or LED anode a1 when there is no resistor).
 */
function ledRig({ mcu = 'uno', source = 'c_uno:5V', ohms = 220, color = 'red', ground = true } = {}) {
  const doc = makeDoc({ mcu })
  const ids = {}
  if (ohms) {
    ids.resistor = place(doc, 'resistor', 'bb1', 'a1', { ohms }, 0, 'c_r1')
    ids.led = place(doc, 'led', 'bb1', 'a6', { color }, 0, 'c_led1')
    wire(doc, source, 'bb1:b1')
    wire(doc, 'bb1:b5', 'bb1:b6')
  } else {
    ids.led = place(doc, 'led', 'bb1', 'a1', { color }, 0, 'c_led1')
    wire(doc, source, 'bb1:b1')
  }
  if (ground) wire(doc, ohms ? 'bb1:b7' : 'bb1:b2', `c_${mcu}:GND`)
  return { doc, ids }
}

describe('LED reference currents', () => {
  it('5V → 220 Ω → red LED → GND draws ~13.9 mA and warns about nothing', () => {
    const { doc } = ledRig()
    const { evaluation } = run(doc)

    expect(ma(evaluation, 'c_led1')).toBeCloseTo(13.9, 1)
    expect(evaluation.componentStates.c_led1.brightness).toBeCloseTo(0.83, 2)
    expect(evaluation.componentStates.c_led1.state).toBe('ok')
    expect(evaluation.warnings).toEqual([])
    expect(evaluation.events).toEqual([])
    expect(evaluation.converged).toBe(true)
    expect(evaluation.ok).toBe(true)
  })

  it('5V → red LED straight to GND pulls ~317 mA and blows', () => {
    const { doc } = ledRig({ ohms: 0 })
    const { evaluation } = run(doc)

    expect(ma(evaluation, 'c_led1')).toBeCloseTo(316.8, 0)
    expect(codes(evaluation)).toEqual(expect.arrayContaining(['led_no_resistor', 'overcurrent_component']))
    expect(evaluation.events).toEqual([{ type: 'blow', componentId: 'c_led1', reason: 'overcurrent', currentMa: expect.any(Number) }])
    expect(evaluation.componentStates.c_led1.state).toBe('blown')
    expect(evaluation.componentStates.c_led1.brightness).toBe(0)
  })

  it('D13 HIGH → 220 Ω → LED → GND draws ~12.5 mA through the 25 Ω pin resistance', () => {
    const { doc } = ledRig({ source: 'c_uno:D13' })
    const { evaluation } = run(doc, { mcuPins: { D13: { mode: 'output', level: 1 } } })

    expect(ma(evaluation, 'c_led1')).toBeCloseTo(12.5, 1)
    expect(evaluation.pinCurrents.D13 * 1000).toBeCloseTo(12.5, 1)
    expect(codes(evaluation)).not.toContain('overcurrent_pin')
  })

  it('D13 HIGH → LED with no resistor draws ~91 mA and overloads the pin', () => {
    const { doc } = ledRig({ source: 'c_uno:D13', ohms: 0 })
    const { evaluation } = run(doc, { mcuPins: { D13: { mode: 'output', level: 1 } } })

    expect(ma(evaluation, 'c_led1')).toBeCloseTo(91.4, 0)
    expect(codes(evaluation)).toEqual(expect.arrayContaining(['overcurrent_pin', 'led_no_resistor']))
    expect(evaluation.events.some((e) => e.type === 'blow' && e.componentId === 'c_led1')).toBe(true)
    const pinWarning = evaluation.warnings.find((w) => w.code === 'overcurrent_pin')
    expect(pinWarning.message).toContain('D13')
    expect(pinWarning.hint).toMatch(/resistor/i)
  })

  it('a red LED straight on an ESP32 GPIO draws exactly 30 mA and blows', () => {
    const doc = makeDoc({ mcu: 'esp32', boardMode: 'dual', mcuId: 'c_esp32' })
    place(doc, 'led', 'bb1', 'a1', { color: 'red' }, 0, 'c_led1')
    wire(doc, 'c_esp32:GPIO4', 'bb1:b1')
    wire(doc, 'bb1:b2', 'c_esp32:GND')
    const { evaluation } = run(doc, { mcuPins: { GPIO4: { mode: 'output', level: 1 } } })

    expect(ma(evaluation, 'c_led1')).toBeCloseTo(30.0, 2)
    expect(evaluation.events.some((e) => e.type === 'blow' && e.componentId === 'c_led1')).toBe(true)
  })

  it('a blue LED on an ESP32 GPIO through 220 Ω stays lit at ~2.1 mA', () => {
    const doc = makeDoc({ mcu: 'esp32', boardMode: 'dual', mcuId: 'c_esp32' })
    place(doc, 'resistor', 'bb1', 'a1', { ohms: 220 }, 0, 'c_r1')
    place(doc, 'led', 'bb1', 'a6', { color: 'blue' }, 0, 'c_led1')
    wire(doc, 'c_esp32:GPIO4', 'bb1:b1')
    wire(doc, 'bb1:b5', 'bb1:b6')
    wire(doc, 'bb1:b7', 'c_esp32:GND')
    const { evaluation } = run(doc, { mcuPins: { GPIO4: { mode: 'output', level: 1 } } })

    expect(ma(evaluation, 'c_led1')).toBeCloseTo(2.14, 2)
    expect(evaluation.componentStates.c_led1.brightness).toBeGreaterThan(0.2)
    expect(evaluation.events).toEqual([])
  })

  it('reports a backwards LED', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'resistor', 'bb1', 'a1', { ohms: 220 }, 0, 'c_r1')
    place(doc, 'led', 'bb1', 'a6', { color: 'red' }, 0, 'c_led1')
    wire(doc, 'c_uno:5V', 'bb1:b7') // cathode side on 5 V
    wire(doc, 'bb1:b5', 'bb1:b6')
    wire(doc, 'bb1:b1', 'c_uno:GND')
    const { evaluation } = run(doc)

    expect(codes(evaluation)).toContain('reverse_led')
    expect(ma(evaluation, 'c_led1')).toBeCloseTo(0, 3)
  })
})

describe('dividers, level shifting and GPIO limits', () => {
  it('5V → 1 kΩ → node → 2.2 kΩ → GND sits at 3.44 V', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'resistor', 'bb1', 'a1', { ohms: 1000 }, 0, 'c_r1')
    place(doc, 'resistor', 'bb1', 'a5', { ohms: 2200 }, 0, 'c_r2')
    wire(doc, 'c_uno:5V', 'bb1:b1')
    wire(doc, 'bb1:b9', 'c_uno:GND')
    const { compiled, evaluation } = run(doc)

    expect(evaluation.nodeVoltages[compiled.terminalToNet['bb1:c5']]).toBeCloseTo(3.44, 2)
  })

  it('an HC-SR04 echo through the same divider reaches 3.38 V and is safe for an ESP32 GPIO', () => {
    const doc = makeDoc({ mcu: 'esp32', boardMode: 'dual', mcuId: 'c_esp32' })
    place(doc, 'ultrasonic_hcsr04', 'bb1', 'a1', {}, 0, 'c_hc')
    place(doc, 'resistor', 'bb1', 'a6', { ohms: 1000 }, 0, 'c_r1')
    place(doc, 'resistor', 'bb1', 'a11', { ohms: 2200 }, 0, 'c_r2')
    wire(doc, 'c_esp32:VIN', 'bb1:b1') // module VCC = 5 V
    wire(doc, 'bb1:b4', 'c_esp32:GND')
    wire(doc, 'bb1:b3', 'bb1:b6') // echo → 1 kΩ
    wire(doc, 'bb1:b10', 'bb1:b11') // node
    wire(doc, 'bb1:b15', 'c_esp32:GND')
    wire(doc, 'bb1:c11', 'c_esp32:GPIO4')
    const { compiled, evaluation } = run(doc, { moduleOutputs: { c_hc: { echo: 1 } } })

    expect(evaluation.nodeVoltages[compiled.terminalToNet['bb1:c11']]).toBeCloseTo(3.38, 2)
    expect(evaluation.mcuPinVoltages.GPIO4).toBeCloseTo(3.38, 2)
    expect(codes(evaluation)).not.toContain('overvoltage_gpio')
    expect(evaluation.events).toEqual([])
    expect(compiled.peripheralMap.find((b) => b.componentId === 'c_hc').pins.echo).toBe('GPIO4')
  })

  it('a 10 kΩ / 1 kΩ divider is too weak: the echo stays unbound and warns', () => {
    const doc = makeDoc({ mcu: 'esp32', boardMode: 'dual', mcuId: 'c_esp32' })
    place(doc, 'ultrasonic_hcsr04', 'bb1', 'a1', {}, 0, 'c_hc')
    place(doc, 'resistor', 'bb1', 'a6', { ohms: 10000 }, 0, 'c_r1')
    place(doc, 'resistor', 'bb1', 'a11', { ohms: 1000 }, 0, 'c_r2')
    wire(doc, 'c_esp32:VIN', 'bb1:b1')
    wire(doc, 'bb1:b4', 'c_esp32:GND')
    wire(doc, 'bb1:b3', 'bb1:b6')
    wire(doc, 'bb1:b10', 'bb1:b11')
    wire(doc, 'bb1:b15', 'c_esp32:GND')
    wire(doc, 'bb1:c11', 'c_esp32:GPIO4')
    const { compiled, evaluation } = run(doc, { moduleOutputs: { c_hc: { echo: 1 } } })

    expect(evaluation.nodeVoltages[compiled.terminalToNet['bb1:c11']]).toBeCloseTo(0.45, 2)
    expect(compiled.peripheralMap.find((b) => b.componentId === 'c_hc').pins.echo).toBeNull()
    expect(codes(evaluation)).toContain('divider_too_weak')
  })

  it('an ESP32 GPIO wired straight to VIN burns the pin', () => {
    const doc = makeDoc({ mcu: 'esp32', boardMode: 'dual', mcuId: 'c_esp32' })
    wire(doc, 'c_esp32:GPIO4', 'c_esp32:VIN')
    const { evaluation } = run(doc)

    expect(codes(evaluation)).toContain('overvoltage_gpio')
    expect(evaluation.events).toContainEqual({ type: 'burnt_pin', pinName: 'GPIO4', volts: 5 })
    expect(evaluation.warnings.find((w) => w.code === 'overvoltage_gpio').hint).toMatch(/level shifter|divider/i)
  })

  it('a 5 V HIGH on HV1 appears as 3.3 V on LV1, and an unpowered shifter leaves its channels open', () => {
    const build = (powered) => {
      const doc = makeDoc({ mcu: 'esp32', boardMode: 'dual', mcuId: 'c_esp32' })
      place(doc, 'level_shifter', 'bb1', 'e17', {}, 0, 'c_ls')
      if (powered) {
        wire(doc, 'c_esp32:VIN', 'bb1:d17') // HV rail = 5 V
        wire(doc, 'c_esp32:3V3', 'bb1:g17') // LV rail = 3.3 V
        wire(doc, 'bb1:d22', 'c_esp32:GND')
        wire(doc, 'bb1:g22', 'c_esp32:GND')
      }
      wire(doc, 'c_esp32:VIN', 'bb1:d18') // HV1 driven HIGH
      return doc
    }
    const powered = run(build(true))
    const lv1 = powered.compiled.terminalToNet['bb1:g18']
    expect(powered.evaluation.nodeVoltages[lv1]).toBeCloseTo(3.3, 2)
    expect(powered.evaluation.componentStates.c_ls.powered).toBe(true)

    const dead = run(build(false))
    expect(dead.evaluation.nodeVoltages[dead.compiled.terminalToNet['bb1:g18']]).toBeCloseTo(0, 3)
    expect(codes(dead.evaluation)).toContain('unpowered_module')
    expect(dead.evaluation.componentStates.c_ls.powered).toBe(false)
  })

  it('a level shifter passes an externally driven LOW to the other side', () => {
    const doc = makeDoc({ mcu: 'esp32', boardMode: 'dual', mcuId: 'c_esp32' })
    place(doc, 'level_shifter', 'bb1', 'e17', {}, 0, 'c_ls')
    wire(doc, 'c_esp32:VIN', 'bb1:d17')
    wire(doc, 'c_esp32:3V3', 'bb1:g17')
    wire(doc, 'bb1:d22', 'c_esp32:GND')
    wire(doc, 'bb1:g22', 'c_esp32:GND')
    wire(doc, 'bb1:d18', 'c_esp32:GND') // HV1 pulled LOW
    const { compiled, evaluation } = run(doc)

    expect(evaluation.nodeVoltages[compiled.terminalToNet['bb1:g18']]).toBeLessThan(0.3 * 3.3)
  })
})

describe('inputs, switches and knobs', () => {
  it('a 10 kΩ pot across 5V/GND puts the wiper at 25 % of the supply', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'potentiometer', 'bb1', 'a1', { ohms: 10000 }, 0, 'c_pot')
    wire(doc, 'c_uno:5V', 'bb1:b1')
    wire(doc, 'bb1:b3', 'c_uno:GND')
    const compiled = compileCircuit(doc)
    const wiperNet = compiled.terminalToNet['bb1:b2']

    const middle = evaluateCircuit(compiled, dynamic({ controls: { c_pot: { value: 0.25 } } }))
    expect(middle.nodeVoltages[wiperNet]).toBeCloseTo(1.25, 2)

    for (const value of [0, 1]) {
      const edge = evaluateCircuit(compiled, dynamic({ controls: { c_pot: { value } } }))
      expect(Number.isFinite(edge.nodeVoltages[wiperNet])).toBe(true)
      expect(edge.nodeVoltages[wiperNet]).toBeCloseTo(value * 5, 1)
    }
  })

  it('a pushbutton switches an LED on and off', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'pushbutton', 'bb1', 'a1', {}, 0, 'c_btn')
    place(doc, 'resistor', 'bb1', 'a5', { ohms: 220 }, 0, 'c_r1')
    place(doc, 'led', 'bb1', 'a10', { color: 'red' }, 0, 'c_led1')
    wire(doc, 'c_uno:5V', 'bb1:c1')
    wire(doc, 'bb1:c3', 'bb1:b5')
    wire(doc, 'bb1:b9', 'bb1:b10')
    wire(doc, 'bb1:b11', 'c_uno:GND')
    const compiled = compileCircuit(doc)

    const open = evaluateCircuit(compiled, dynamic({ controls: { c_btn: { pressed: false } } }))
    expect(open.componentStates.c_led1.brightness).toBe(0)
    expect(open.componentStates.c_btn.state).toBe('off')

    const pressed = evaluateCircuit(compiled, dynamic({ controls: { c_btn: { pressed: true } } }))
    expect(ma(pressed, 'c_led1')).toBeCloseTo(13.9, 1)
    expect(pressed.componentStates.c_btn.state).toBe('on')
  })

  it('INPUT_PULLUP reads 5 V with the button open and 0 V pressed', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'pushbutton', 'bb1', 'a1', {}, 0, 'c_btn')
    wire(doc, 'c_uno:D2', 'bb1:c1')
    wire(doc, 'bb1:c3', 'c_uno:GND')
    const compiled = compileCircuit(doc)
    const pins = { D2: { mode: 'input_pullup' } }

    const open = evaluateCircuit(compiled, dynamic({ mcuPins: pins, controls: { c_btn: { pressed: false } } }))
    expect(open.mcuPinVoltages.D2).toBeCloseTo(5, 2)
    const pressed = evaluateCircuit(compiled, dynamic({ mcuPins: pins, controls: { c_btn: { pressed: true } } }))
    expect(pressed.mcuPinVoltages.D2).toBeCloseTo(0, 3)
    expect(codes(pressed)).not.toContain('floating_input')
  })

  it('flags an input pin that nothing drives', () => {
    const doc = makeDoc({ mcu: 'uno' })
    wire(doc, 'c_uno:D2', 'bb1:a20')
    wire(doc, 'c_uno:GND', 'bb1:TN1')
    const { evaluation } = run(doc, { mcuPins: { D2: { mode: 'input' } } })

    const floating = evaluation.warnings.find((w) => w.code === 'floating_input')
    expect(floating).toBeTruthy()
    expect(floating.pinNames).toEqual(['D2'])
  })

  it('an LDR changes resistance with its light-level control', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'ldr', 'bb1', 'a1', {}, 0, 'c_ldr')
    place(doc, 'resistor', 'bb1', 'a3', { ohms: 10000 }, 0, 'c_r1')
    wire(doc, 'c_uno:5V', 'bb1:b1')
    wire(doc, 'bb1:b7', 'c_uno:GND')
    const compiled = compileCircuit(doc)
    const node = compiled.terminalToNet['bb1:c3']

    const dark = evaluateCircuit(compiled, dynamic({ controls: { c_ldr: { lightLevel: 0 } } }))
    const bright = evaluateCircuit(compiled, dynamic({ controls: { c_ldr: { lightLevel: 100 } } }))
    expect(dark.nodeVoltages[node]).toBeCloseTo(5 * (10000 / 210000), 2)
    expect(bright.nodeVoltages[node]).toBeCloseTo(5 * (10000 / 11000), 2)
  })
})

describe('transistors, PWM and relays', () => {
  it('an NPN saturates and runs a DC motor from a HIGH pin', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'transistor_npn', 'bb1', 'a1', {}, 0, 'c_q1')
    place(doc, 'resistor', 'bb1', 'a5', { ohms: 1000 }, 0, 'c_rb')
    place(doc, 'dc_motor', 'bb1', 'a11', {}, 0, 'c_m1')
    wire(doc, 'c_uno:D9', 'bb1:b5')
    wire(doc, 'bb1:b9', 'bb1:b2') // base resistor → base
    wire(doc, 'c_uno:5V', 'bb1:b11')
    wire(doc, 'bb1:b13', 'bb1:b3') // motor → collector
    wire(doc, 'bb1:b1', 'c_uno:GND') // emitter → GND
    const compiled = compileCircuit(doc)

    const on = evaluateCircuit(compiled, dynamic({ mcuPins: { D9: { mode: 'output', level: 1 } } }))
    // Saturated: Ic = (5 − 0.2) / (20 Ω motor + 1 Ω Vce(sat) slope + 0.1 Ω supply) = 227.5 mA.
    expect(ma(on, 'c_m1')).toBeGreaterThan(215)
    expect(ma(on, 'c_m1')).toBeLessThan(245)
    expect(on.componentStates.c_q1.state).toBe('on')
    expect(on.componentStates.c_q1.baseCurrent * 1000).toBeCloseTo(4.15, 1)

    const off = evaluateCircuit(compiled, dynamic({ mcuPins: { D9: { mode: 'output', level: 0 } } }))
    expect(off.componentStates.c_q1.state).toBe('off')
    expect(ma(off, 'c_m1')).toBeCloseTo(0, 2)
  })

  it('PWM averages over the duty cycle instead of averaging the pin voltage', () => {
    const { doc } = ledRig({ source: 'c_uno:D9' })
    const compiled = compileCircuit(doc)
    const half = evaluateCircuit(compiled, dynamic({ mcuPins: { D9: { mode: 'pwm', duty: 0.5 } } }))

    expect(ma(half, 'c_led1')).toBeCloseTo(6.27, 1) // not the 2.75 mA of a 2.5 V DC source
    expect(half.mcuPinVoltages.D9).toBeCloseTo(2.34, 1) // time average of 4.69 V HIGH and 0 V LOW
    expect(half.componentStates.c_led1.brightness).toBeCloseTo(Math.sqrt(6.27 / 20), 2)

    const quarter = evaluateCircuit(compiled, dynamic({ mcuPins: { D9: { mode: 'pwm', duty: 0.25 } } }))
    expect(ma(quarter, 'c_led1')).toBeCloseTo(3.14, 1)
  })

  it('PWM warnings use the worst case, not the average', () => {
    const { doc } = ledRig({ source: 'c_uno:D9', ohms: 0 })
    const { evaluation } = run(doc, { mcuPins: { D9: { mode: 'pwm', duty: 0.3 } } })

    expect(ma(evaluation, 'c_led1')).toBeCloseTo(27.4, 0) // average is below the 40 mA pin limit
    expect(codes(evaluation)).toContain('overcurrent_pin') // worst case (91 mA) is not
    expect(evaluation.events.some((e) => e.type === 'blow')).toBe(true)
  })

  it('a relay switches its contacts with the coil input', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'relay_5v', 'bb1', 'a1', {}, 0, 'c_relay')
    place(doc, 'resistor', 'bb1', 'a10', { ohms: 1000 }, 0, 'c_load')
    wire(doc, 'c_uno:5V', 'bb1:b1')
    wire(doc, 'bb1:b2', 'c_uno:GND')
    wire(doc, 'c_uno:D7', 'bb1:b3')
    wire(doc, 'c_uno:5V', 'bb1:b4') // COM on 5 V
    wire(doc, 'bb1:b5', 'bb1:b10') // NO → load
    wire(doc, 'bb1:b14', 'c_uno:GND')
    const compiled = compileCircuit(doc)

    const on = evaluateCircuit(compiled, dynamic({ mcuPins: { D7: { mode: 'output', level: 1 } } }))
    expect(on.componentStates.c_relay.state).toBe('on')
    expect(ma(on, 'c_load')).toBeCloseTo(5, 1)

    const off = evaluateCircuit(compiled, dynamic({ mcuPins: { D7: { mode: 'output', level: 0 } } }))
    expect(off.componentStates.c_relay.state).toBe('off')
    expect(ma(off, 'c_load')).toBeCloseTo(0, 3)
  })
})

describe('multi-element parts', () => {
  it('lights only the driven segments of a seven-segment display', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'seven_segment', 'bb1', 'e10', {}, 0, 'c_seg')
    place(doc, 'resistor', 'bb1', 'a1', { ohms: 220 }, 0, 'c_r1')
    place(doc, 'resistor', 'bb1', 'a6', { ohms: 220 }, 0, 'c_r2')
    wire(doc, 'c_uno:D2', 'bb1:b1')
    wire(doc, 'bb1:b5', 'bb1:d13') // → seg_a
    wire(doc, 'c_uno:D3', 'bb1:b6')
    wire(doc, 'bb1:b10', 'bb1:d14') // → seg_b
    wire(doc, 'bb1:d12', 'c_uno:GND') // common cathode
    const { evaluation } = run(doc, { mcuPins: { D2: { mode: 'output', level: 1 }, D3: { mode: 'output', level: 1 } } })

    const segments = evaluation.componentStates.c_seg.segments
    expect(segments.seg_a).toBe(true)
    expect(segments.seg_b).toBe(true)
    expect(segments.seg_c).toBe(false)
    expect(segments.seg_dp).toBe(false)
    expect(ma(evaluation, 'c_seg')).toBeCloseTo(25, 0)
  })

  it('reports RGB LED channels independently', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'rgb_led', 'bb1', 'a1', {}, 0, 'c_rgb')
    place(doc, 'resistor', 'bb1', 'a6', { ohms: 220 }, 0, 'c_r1')
    place(doc, 'resistor', 'bb1', 'a11', { ohms: 220 }, 0, 'c_r2')
    wire(doc, 'c_uno:D2', 'bb1:b6')
    wire(doc, 'bb1:b10', 'bb1:b1') // → red anode
    wire(doc, 'c_uno:D3', 'bb1:b11')
    wire(doc, 'bb1:b15', 'bb1:b3') // → green anode
    wire(doc, 'bb1:b2', 'c_uno:GND') // common cathode
    const { evaluation } = run(doc, { mcuPins: { D2: { mode: 'output', level: 1 }, D3: { mode: 'output', level: 1 } } })

    const channels = evaluation.componentStates.c_rgb.channels
    expect(channels.r).toBeGreaterThan(0.5)
    expect(channels.g).toBeGreaterThan(0.5)
    expect(channels.b).toBe(0)
  })
})

describe('power, damage and stability', () => {
  it('powered:false leaves every net at 0 V with no damage', () => {
    const { doc } = ledRig()
    const { evaluation } = run(doc, { powered: false })

    expect(Object.values(evaluation.nodeVoltages).every((v) => v === 0)).toBe(true)
    expect(evaluation.events).toEqual([])
    expect(evaluation.supplyCurrentA).toBe(0)
    expect(evaluation.componentStates.c_led1.brightness).toBe(0)
    expect(evaluation.warnings.every((w) => ['no_ground', 'unpowered_module'].includes(w.code))).toBe(true)
  })

  it('a damaged component is an open circuit and stops re-reporting damage', () => {
    const { doc } = ledRig({ ohms: 0 })
    const compiled = compileCircuit(doc)
    const first = evaluateCircuit(compiled, dynamic())
    expect(first.events.some((e) => e.type === 'blow')).toBe(true)

    const after = evaluateCircuit(compiled, dynamic({ damaged: { c_led1: true } }))
    expect(after.events).toEqual([])
    expect(ma(after, 'c_led1')).toBe(0)
    expect(after.componentStates.c_led1.state).toBe('blown')
    expect(after.supplyCurrentA).toBeLessThan(1e-6)
  })

  it('a burnt pin stops driving', () => {
    const { doc } = ledRig({ source: 'c_uno:D13' })
    const { evaluation } = run(doc, { mcuPins: { D13: { mode: 'output', level: 1 } }, burntPins: { D13: true } })

    expect(ma(evaluation, 'c_led1')).toBeCloseTo(0, 3)
    expect(evaluation.mcuPinVoltages.D13).toBeCloseTo(0, 3)
  })

  it('is idempotent: the same dynamic state evaluates to the same result twice', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'transistor_npn', 'bb1', 'a1', {}, 0, 'c_q1')
    place(doc, 'resistor', 'bb1', 'a5', { ohms: 1000 }, 0, 'c_rb')
    place(doc, 'resistor', 'bb1', 'a11', { ohms: 220 }, 0, 'c_rc')
    place(doc, 'led', 'bb1', 'a16', { color: 'red' }, 0, 'c_led1')
    wire(doc, 'c_uno:D9', 'bb1:b5')
    wire(doc, 'bb1:b9', 'bb1:b2')
    wire(doc, 'c_uno:5V', 'bb1:b11')
    wire(doc, 'bb1:b15', 'bb1:b16')
    wire(doc, 'bb1:b17', 'bb1:b3')
    wire(doc, 'bb1:b1', 'c_uno:GND')
    const compiled = compileCircuit(doc)
    const state = dynamic({ mcuPins: { D9: { mode: 'pwm', duty: 0.4 } } })

    const first = evaluateCircuit(compiled, state)
    const second = evaluateCircuit(compiled, state)
    expect(second).toEqual(first)
    expect(first.converged).toBe(true)
  })

  it('an evaluation of a 50-component document stays under 2 ms', () => {
    const { doc } = perfDoc()
    const compiled = compileCircuit(doc)
    expect(doc.components.length).toBe(50)
    const state = dynamic({
      mcuPins: { D9: { mode: 'pwm', duty: 0.5 }, D10: { mode: 'pwm', duty: 0.25 }, D11: { mode: 'pwm', duty: 0.75 } },
    })

    for (let i = 0; i < 20; i++) evaluateCircuit(compiled, state)
    const samples = []
    for (let i = 0; i < 50; i++) {
      const started = performance.now()
      evaluateCircuit(compiled, state)
      samples.push(performance.now() - started)
    }
    samples.sort((a, b) => a - b)
    const median = samples[Math.floor(samples.length / 2)]
    expect(median).toBeLessThan(2)
  })
})

/** 50 components: 16 resistor + 2-LED branches across two breadboards, plus a capacitor. */
function perfDoc() {
  const doc = makeDoc({ mcu: 'uno', boardMode: 'dual' })
  const pwmPins = ['D9', 'D10', 'D11']
  let index = 0
  for (const board of ['bb1', 'bb2']) {
    wire(doc, 'c_uno:5V', `${board}:TP1`)
    wire(doc, 'c_uno:GND', `${board}:TN1`)
    for (const [pinColumn, wireColumn] of [['a', 'b'], ['f', 'g']]) {
      for (let branch = 0; branch < 4; branch++) {
        const row = 1 + branch * 7
        place(doc, 'resistor', board, `${pinColumn}${row}`, { ohms: 220 }, 0, `c_r${index}`)
        place(doc, 'led', board, `${pinColumn}${row + 4}`, { color: 'red' }, 0, `c_led${index}a`)
        place(doc, 'led', board, `${pinColumn}${row + 5}`, { color: 'red' }, 0, `c_led${index}b`)
        const source = index < pwmPins.length ? `c_uno:${pwmPins[index]}` : `${board}:TP1`
        wire(doc, source, `${board}:${wireColumn}${row}`)
        wire(doc, `${board}:${wireColumn}${row + 6}`, `${board}:TN1`)
        index++
      }
    }
  }
  place(doc, 'capacitor', 'bb1', 'a29', { uF: 100 }, 0, 'c_cap')
  wire(doc, 'bb1:b29', 'bb1:TP1')
  wire(doc, 'bb1:b30', 'bb1:TN1')
  return { doc }
}

describe('supply warnings and edge cases', () => {
  it('warns when nothing is connected to GND', () => {
    const { doc } = ledRig({ ground: false })
    const { evaluation } = run(doc)

    const warning = evaluation.warnings.find((w) => w.code === 'no_ground')
    expect(warning.severity).toBe('error')
    expect(warning.hint).toMatch(/GND/)
    expect(ma(evaluation, 'c_led1')).toBeCloseTo(0, 3)
  })

  it('reports a 5V-to-GND short as an error and an event', () => {
    const doc = makeDoc({ mcu: 'uno' })
    wire(doc, 'c_uno:5V', 'c_uno:GND')
    const { evaluation } = run(doc)

    expect(codes(evaluation)).toContain('short_circuit')
    expect(evaluation.events).toContainEqual({ type: 'short' })
  })

  it('reports a USB power overload', () => {
    const doc = makeDoc({ mcu: 'uno' })
    for (let i = 0; i < 3; i++) {
      const row = 1 + i * 4
      place(doc, 'dc_motor', 'bb1', `a${row}`, {}, 0, `c_m${i}`)
      wire(doc, 'c_uno:5V', `bb1:b${row}`)
      wire(doc, `bb1:b${row + 2}`, 'c_uno:GND')
    }
    const { evaluation } = run(doc)

    expect(evaluation.supplyCurrentA * 1000).toBeGreaterThan(500)
    const warning = evaluation.warnings.find((w) => w.code === 'power_overload')
    expect(warning.severity).toBe('error')
    expect(evaluation.events).toContainEqual({ type: 'short' })
  })

  it('reports an unpowered module and notes that capacitors are DC-only', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'servo', 'bb1', 'a1', {}, 0, 'c_servo')
    place(doc, 'capacitor', 'bb1', 'a5', { uF: 100 }, 0, 'c_cap')
    wire(doc, 'bb1:b1', 'c_uno:D9')
    wire(doc, 'bb1:b3', 'c_uno:GND')
    wire(doc, 'bb1:b5', 'c_uno:5V')
    wire(doc, 'bb1:b6', 'c_uno:GND')
    const { evaluation } = run(doc)

    expect(codes(evaluation)).toContain('unpowered_module')
    expect(evaluation.componentStates.c_servo.powered).toBe(false)
    const info = evaluation.warnings.find((w) => w.code === 'dc_only')
    expect(info.severity).toBe('info')
    expect(evaluation.componentStates.c_cap.current).toBe(0)
  })

  it('falls back to per-pin averaging above three PWM pins', () => {
    const doc = makeDoc({ mcu: 'uno' })
    const pins = ['D3', 'D5', 'D6', 'D9']
    const duties = [0.2, 0.4, 0.6, 0.8]
    pins.forEach((pin, i) => {
      const row = 1 + i * 6
      place(doc, 'resistor', 'bb1', `a${row}`, { ohms: 220 }, 0, `c_r${i}`)
      place(doc, 'led', 'bb1', `a${row + 4}`, { color: 'red' }, 0, `c_led${i}`)
      wire(doc, `c_uno:${pin}`, `bb1:b${row}`)
      wire(doc, `bb1:b${row + 5}`, 'c_uno:GND')
    })
    const mcuPins = Object.fromEntries(pins.map((pin, i) => [pin, { mode: 'pwm', duty: duties[i] }]))
    const { evaluation } = run(doc, { mcuPins })

    duties.forEach((duty, i) => {
      expect(ma(evaluation, `c_led${i}`)).toBeCloseTo(duty * 12.549, 1)
    })
    expect(evaluation.mcuPinVoltages.D9).toBeGreaterThan(evaluation.mcuPinVoltages.D3)
  })

  it('drives a DAC pin at its set voltage', () => {
    const doc = makeDoc({ mcu: 'esp32', boardMode: 'dual', mcuId: 'c_esp32' })
    place(doc, 'resistor', 'bb1', 'a1', { ohms: 10000 }, 0, 'c_r1')
    wire(doc, 'c_esp32:GPIO25', 'bb1:b1')
    wire(doc, 'bb1:b5', 'c_esp32:GND')
    const { evaluation } = run(doc, { mcuPins: { GPIO25: { mode: 'dac', value: 1.65 } } })

    expect(evaluation.mcuPinVoltages.GPIO25).toBeCloseTo(1.643, 2)
  })

  it('survives an empty or missing document', () => {
    expect(() => compileCircuit(null)).not.toThrow()
    const compiled = compileCircuit({ version: 1, boardMode: 'half', breadboards: [], components: [], wires: [] })
    expect(compiled.nets).toEqual([])
    expect(compiled.issues.map((i) => i.code)).toEqual(['no_mcu'])

    const evaluation = evaluateCircuit(compiled, dynamic())
    expect(evaluation).toMatchObject({ ok: true, nodeVoltages: {}, componentStates: {}, events: [] })
    expect(evaluateCircuit(null, dynamic()).ok).toBe(true)
    expect(evaluateCircuit(compiled).warnings).toEqual([])
  })
})

describe('floating detection', () => {
  it('does not call a pin floating when an LED chain ties it to GND', () => {
    const { doc } = ledRig({ source: 'c_uno:D13' })
    const idle = run(doc) // no firmware yet: D13 is still an input
    expect(codes(idle.evaluation)).not.toContain('floating_input')

    const driven = run(doc, { mcuPins: { D13: { mode: 'output', level: 1 } } })
    expect(codes(driven.evaluation)).not.toContain('floating_input')
  })

  it('still calls a pin floating behind an open switch', () => {
    const doc = makeDoc({ mcu: 'uno' })
    place(doc, 'pushbutton', 'bb1', 'a1', {}, 0, 'c_btn')
    wire(doc, 'c_uno:D2', 'bb1:c1')
    wire(doc, 'bb1:c3', 'c_uno:GND')
    const compiled = compileCircuit(doc)

    const open = evaluateCircuit(compiled, dynamic({ controls: { c_btn: { pressed: false } } }))
    expect(codes(open)).toContain('floating_input')
    const pressed = evaluateCircuit(compiled, dynamic({ controls: { c_btn: { pressed: true } } }))
    expect(codes(pressed)).not.toContain('floating_input')
  })
})

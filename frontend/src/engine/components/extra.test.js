import { describe, expect, it } from 'vitest'
import { compileCircuit, evaluateCircuit } from '../circuit/index.js'
import { createSimulation } from '../sim/index.js'
import { makeDoc, place, wire } from './seeds.js'
import { getDef, resolvePins } from './registry.js'
import { thermistorOhms, flexOhms, forceOhms } from './sensorCurves.js'
import { EXTRA_DEFS } from './defs/extra.js'
import { parseProjectFile, projectFile } from '../../features/sandbox/projectFile.js'
import { billOfMaterials } from '../../features/sandbox/bom.js'

describe('additional sandbox parts', () => {
  it.each(EXTRA_DEFS.map(def => def.type))('%s has valid pins, survives project import and has a priced BOM row', type => {
    const doc = makeDoc({ mcu: 'uno' })
    const id = place(doc, type, 'bb1', 'a10')
    const part = doc.components.find(part => part.id === id)
    expect(resolvePins(part, doc).valid).toBe(true)
    const restored = parseProjectFile(JSON.stringify(projectFile({ name: 'Extra parts', circuit: doc, code: 'void setup() {} void loop() {}' })))
    expect(restored.circuit).toEqual(doc)
    expect(billOfMaterials(doc).find(row => row.catalog_id === getDef(type).bom.catalogId).unit_price_usd).toBeGreaterThan(0)
    const bad = structuredClone(restored)
    bad.circuit.components.at(-1).anchor.hole = 'a63'
    expect(() => parseProjectFile(JSON.stringify(bad))).toThrow(/legs/)
  })

  it.each([['slide_switch', 'closed'], ['reed_switch', 'magnetNear'], ['tilt_switch', 'tilted']])('%s switches a real firmware digital input', async (type, field) => {
    const doc = makeDoc({ mcu: 'uno' })
    const id = place(doc, type, 'bb1', 'a10')
    wire(doc, 'c_uno:D2', `${id}:p1`); wire(doc, `${id}:p2`, 'c_uno:GND')
    const sim = createSimulation({ inline: true })
    try {
      sim.setDocument(doc)
      sim.setCode('void setup() { Serial.begin(9600); pinMode(2, INPUT_PULLUP); } void loop() { Serial.println(digitalRead(2)); delay(100); }')
      expect((await sim.run()).ok).toBe(true)
      sim.advance(120)
      expect(sim.getState().trace.serialText.trim().split(/\s+/).at(-1)).toBe('1')
      sim.setControl(id, { [field]: true }); sim.advance(120)
      expect(sim.getState().trace.serialText.trim().split(/\s+/).at(-1)).toBe('0')
      sim.setControl(id, { [field]: false }); sim.advance(120)
      expect(sim.getState().trace.serialText.trim().split(/\s+/).at(-1)).toBe('1')
    } finally { sim.dispose() }
  })

  it.each([
    ['thermistor_ntc', 'temperatureC', 25, 100, 2.5, 4.674],
    ['force_sensor', 'forcePercent', 0, 100, 0.0495, 4.545],
    ['flex_sensor', 'bendDegrees', 0, 90, 2.5, 1.25],
    ['variable_resistor', 'resistanceOhms', 10000, 100000, 2.5, 0.4545],
  ])('%s changes the actual ADC voltage through the resistor network', async (type, field, start, end, firstV, lastV) => {
    const doc = makeDoc({ mcu: 'uno' })
    const sensor = place(doc, type, 'bb1', 'a1')
    const resistor = place(doc, 'resistor', 'bb1', 'a10', { ohms: 10000 })
    wire(doc, 'c_uno:5V', `${sensor}:p1`); wire(doc, `${sensor}:p2`, `${resistor}:p1`)
    wire(doc, `${resistor}:p1`, 'c_uno:A0'); wire(doc, `${resistor}:p2`, 'c_uno:GND')
    const sim = createSimulation({ inline: true })
    try {
      sim.setDocument(doc)
      sim.setCode('void setup() {Serial.begin(9600);} void loop() {Serial.println(analogRead(A0)); delay(100);}')
      await sim.run(); sim.setControl(sensor, { [field]: start }); sim.advance(120)
      const first = Number(sim.getState().trace.serialText.trim().split(/\s+/).at(-1))
      expect(first).toBeCloseTo(Math.round(firstV / 5 * 1023), 0)
      sim.setControl(sensor, { [field]: end }); sim.advance(120)
      const last = Number(sim.getState().trace.serialText.trim().split(/\s+/).at(-1))
      expect(last).toBeCloseTo(Math.round(lastV / 5 * 1023), 0)
      expect(sim.getState().evaluation.events).toEqual([])
    } finally { sim.dispose() }
  })

  it('trimpot adjustment reaches both rails without disconnecting the divider', () => {
    const doc = makeDoc({ mcu: 'uno' })
    const id = place(doc, 'trimpot', 'bb1', 'a10')
    wire(doc, 'c_uno:5V', `${id}:end1`); wire(doc, 'c_uno:GND', `${id}:end2`); wire(doc, 'c_uno:A0', `${id}:wiper`)
    const compiled = compileCircuit(doc)
    for (const value of [0, 0.5, 1]) {
      const result = evaluateCircuit(compiled, { powered: true, controls: { [id]: { value } } })
      expect(result.mcuPinVoltages.A0).toBeCloseTo(value * 5, 2)
      expect(result.events).toEqual([])
    }
  })

  it('sensor curves match their documented reference points and bound extreme controls', () => {
    expect(thermistorOhms(25)).toBeCloseTo(10000, 6)
    expect(thermistorOhms(0)).toBeCloseTo(33620.6037, 2)
    expect(thermistorOhms(100)).toBeCloseTo(697.5198, 2)
    expect(flexOhms(0)).toBe(10000); expect(flexOhms(90)).toBe(30000)
    expect(forceOhms(0)).toBe(1000000); expect(forceOhms(100)).toBe(1000)
    expect(thermistorOhms(-300)).toBe(thermistorOhms(-20))
    expect(flexOhms(500)).toBe(30000); expect(forceOhms(-100)).toBe(1000000)
  })
})

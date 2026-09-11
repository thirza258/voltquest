/** Input parts: switches, knobs and sensors. */
import { ALL_BOARDS, ESP_BOARDS, enumProp, footprint, logicOut, modulePower, multiControl, pin, slider } from './shared.js'
import {
  bme280Learn,
  dht22Learn,
  ldrLearn,
  pirLearn,
  potentiometerLearn,
  pushbuttonLearn,
  touchPadLearn,
  ultrasonicLearn,
} from '../learn/input.js'

export const pushbutton = {
  type: 'pushbutton',
  name: 'Pushbutton',
  category: 'input',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  // a-group in row r, b-group in row r+2 — the two groups never share a strip at rotation 0.
  footprint: footprint([pin('a1', 0, 0, 'A'), pin('a2', 0, 1, 'A'), pin('b1', 2, 0, 'B'), pin('b2', 2, 1, 'B')], 3, 2),
  props: {},
  model: [{ kind: 'switch', pins: { a: 'a1', b: 'b1' }, closedWhen: { control: 'pressed' }, rOn: 0.1, bonds: [['a1', 'a2'], ['b1', 'b2']] }],
  control: { kind: 'momentary', field: 'pressed' },
  peripheral: null,
  learn: pushbuttonLearn,
  bom: { partName: 'Tactile pushbutton 6 mm', catalogId: 'pushbutton' },
}

export const potentiometer = {
  type: 'potentiometer',
  name: 'Potentiometer',
  category: 'input',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('end1', 0, 0, '1'), pin('wiper', 1, 0, 'W'), pin('end2', 2, 0, '2')], 3, 1),
  props: { ohms: enumProp('Resistance', [1000, 5000, 10000, 50000, 100000], 10000, { unit: 'Ω', format: 'ohms' }) },
  model: [{ kind: 'pot', pins: { end1: 'end1', wiper: 'wiper', end2: 'end2' }, ohms: '$props.ohms', wiper: { control: 'value' } }],
  control: { kind: 'knob', field: 'value', min: 0, max: 1, default: 0.5, label: 'Knob' },
  peripheral: null,
  learn: potentiometerLearn,
  bom: { partName: 'Potentiometer 10 kΩ', catalogId: 'potentiometer_10k' },
}

export const ldr = {
  type: 'ldr',
  name: 'Photoresistor (LDR)',
  category: 'input',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('p1', 0), pin('p2', 2)], 3, 1),
  props: {},
  model: [{ kind: 'resistor', pins: { a: 'p1', b: 'p2' }, ohms: { fromControl: 'lightLevel', curve: 'ldr' } }],
  control: slider('lightLevel', 'Light level', 0, 100, 60, { unit: '%' }),
  peripheral: null,
  learn: ldrLearn,
  bom: { partName: 'Photoresistor GL5528', catalogId: 'ldr' },
}

export const touch_pad = {
  type: 'touch_pad',
  name: 'Touch pad',
  category: 'input',
  mount: 'board',
  recommendedBoards: ESP_BOARDS,
  footprint: footprint([pin('pad', 0, 0, 'T')], 1, 2),
  props: {},
  model: [],
  control: { kind: 'toggle', field: 'touched', label: 'Touched' },
  peripheral: { protocol: 'touch', roles: { pad: 'signal' } },
  learn: touchPadLearn,
  bom: { partName: 'Copper touch pad', catalogId: 'touch_pad' },
}

export const pir = {
  type: 'pir',
  name: 'PIR motion sensor',
  category: 'input',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('vcc', 0, 0, 'VCC'), pin('out', 1, 0, 'OUT'), pin('gnd', 2, 0, 'GND')], 3, 1),
  props: {},
  model: [modulePower('vcc', 'gnd', 4.5), logicOut('out', 3.3)],
  control: { kind: 'toggle', field: 'motion', label: 'Motion' },
  peripheral: { protocol: 'pir', roles: { out: 'signal', vcc: 'vcc', gnd: 'gnd' } },
  learn: pirLearn,
  bom: { partName: 'PIR motion sensor HC-SR501', catalogId: 'pir' },
}

export const dht22 = {
  type: 'dht22',
  name: 'DHT22 temperature & humidity',
  category: 'input',
  mount: 'board',
  recommendedBoards: ESP_BOARDS,
  footprint: footprint([pin('vcc', 0, 0, 'VCC'), pin('data', 1, 0, 'DATA'), pin('gnd', 2, 0, 'GND')], 3, 1),
  props: {},
  model: [modulePower('vcc', 'gnd', 3.0), logicOut('data', 'vcc')],
  control: multiControl(
    slider('temperatureC', 'Temperature', -10, 50, 24.5, { step: 0.5, unit: '°C' }),
    slider('humidity', 'Humidity', 0, 100, 55, { unit: '%' }),
  ),
  peripheral: { protocol: 'dht', roles: { data: 'data', vcc: 'vcc', gnd: 'gnd' } },
  learn: dht22Learn,
  bom: { partName: 'DHT22 sensor module', catalogId: 'dht22' },
}

export const bme280 = {
  type: 'bme280',
  name: 'BME280 environment sensor',
  category: 'input',
  mount: 'board',
  recommendedBoards: ESP_BOARDS,
  footprint: footprint([pin('vin', 0, 0, 'VIN'), pin('gnd', 1, 0, 'GND'), pin('scl', 2, 0, 'SCL'), pin('sda', 3, 0, 'SDA')], 4, 1),
  props: { addr: enumProp('I2C address', [0x76, 0x77], 0x76, { format: 'hex' }) },
  model: [modulePower('vin', 'gnd', 3.0)],
  control: multiControl(
    slider('temperatureC', 'Temperature', -10, 50, 24.5, { step: 0.5, unit: '°C' }),
    slider('pressureHpa', 'Pressure', 950, 1050, 1013, { unit: 'hPa' }),
    slider('humidity', 'Humidity', 0, 100, 55, { unit: '%' }),
  ),
  peripheral: { protocol: 'bme280_i2c', roles: { sda: 'sda', scl: 'scl', vin: 'vcc', gnd: 'gnd' }, i2cAddress: 0x76, i2cAddressProp: 'addr' },
  learn: bme280Learn,
  bom: { partName: 'BME280 breakout (I2C)', catalogId: 'bme280' },
}

export const ultrasonic_hcsr04 = {
  type: 'ultrasonic_hcsr04',
  name: 'Ultrasonic sensor (HC-SR04)',
  category: 'input',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('vcc', 0, 0, 'VCC'), pin('trig', 1, 0, 'TRIG'), pin('echo', 2, 0, 'ECHO'), pin('gnd', 3, 0, 'GND')], 4, 1),
  props: {},
  model: [modulePower('vcc', 'gnd', 4.5), logicOut('echo', 'vcc')],
  control: slider('distanceCm', 'Distance', 2, 400, 50, { unit: 'cm' }),
  peripheral: { protocol: 'ultrasonic', roles: { trig: 'trig', echo: 'echo', vcc: 'vcc', gnd: 'gnd' } },
  learn: ultrasonicLearn,
  bom: { partName: 'Ultrasonic sensor HC-SR04', catalogId: 'hcsr04' },
}

export const INPUT_DEFS = [pushbutton, potentiometer, ldr, touch_pad, pir, dht22, bme280, ultrasonic_hcsr04]

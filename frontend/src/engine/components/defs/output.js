/** Output parts: LEDs, displays, actuators. */
import { ALL_BOARDS, AVR_BOARDS, ESP_BOARDS, LED_COLORS, enumProp, footprint, ledDiode, modulePower, numberProp, pin } from './shared.js'
import {
  buzzerLearn,
  dcMotorLearn,
  lcdLearn,
  ledLearn,
  neopixelLearn,
  oledLearn,
  relayLearn,
  rgbLedLearn,
  servoLearn,
  sevenSegmentLearn,
} from '../learn/output.js'

export const led = {
  type: 'led',
  name: 'LED',
  category: 'output',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('anode', 0, 0, '+'), pin('cathode', 1, 0, '−')], 2, 1),
  props: { color: enumProp('Color', LED_COLORS, 'red') },
  // vf/rOn are resolved per colour by `modelElements()` (LED_PARAMS).
  model: [{ kind: 'diode', pins: { anode: 'anode', cathode: 'cathode' }, led: true, vf: '$color', rOn: '$color', ratedMa: 20, maxMa: 30 }],
  control: null,
  peripheral: null,
  learn: ledLearn,
  bom: { partName: '5 mm LED', catalogId: 'led_red' },
}

export const rgb_led = {
  type: 'rgb_led',
  name: 'RGB LED',
  category: 'output',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('r', 0, 0, 'R'), pin('cathode', 1, 0, '−'), pin('g', 2, 0, 'G'), pin('b', 3, 0, 'B')], 4, 1),
  props: {},
  model: [
    ledDiode('r', 'cathode', 1.8, 10, { channel: 'r' }),
    ledDiode('g', 'cathode', 2.1, 10, { channel: 'g' }),
    ledDiode('b', 'cathode', 2.7, 20, { channel: 'b' }),
  ],
  control: null,
  peripheral: null,
  learn: rgbLedLearn,
  bom: { partName: 'RGB LED, common cathode', catalogId: 'rgb_led' },
}

export const buzzer = {
  type: 'buzzer',
  name: 'Piezo buzzer',
  category: 'output',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('pos', 0, 0, '+'), pin('neg', 2, 0, '−')], 3, 1),
  props: {},
  model: [{ kind: 'resistor', pins: { a: 'pos', b: 'neg' }, ohms: 1000 }],
  control: null,
  peripheral: { protocol: 'buzzer', roles: { pos: 'signal', neg: 'gnd' } },
  learn: buzzerLearn,
  bom: { partName: 'Piezo buzzer', catalogId: 'buzzer' },
}

export const servo = {
  type: 'servo',
  name: 'Micro servo (SG90)',
  category: 'output',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('signal', 0, 0, 'SIG'), pin('vcc', 1, 0, 'VCC'), pin('gnd', 2, 0, 'GND')], 3, 1),
  props: {},
  model: [modulePower('vcc', 'gnd', 4.5)],
  control: null,
  peripheral: { protocol: 'servo', roles: { signal: 'signal', vcc: 'vcc', gnd: 'gnd' } },
  learn: servoLearn,
  bom: { partName: 'Micro servo SG90', catalogId: 'servo_sg90' },
}

export const lcd16x2_i2c = {
  type: 'lcd16x2_i2c',
  name: 'LCD 16x2 (I2C)',
  category: 'output',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('gnd', 0, 0, 'GND'), pin('vcc', 1, 0, 'VCC'), pin('sda', 2, 0, 'SDA'), pin('scl', 3, 0, 'SCL')], 4, 1),
  props: { addr: enumProp('I2C address', [0x27, 0x3f], 0x27, { format: 'hex' }) },
  model: [modulePower('vcc', 'gnd', 4.5)],
  control: null,
  peripheral: { protocol: 'lcd_i2c', roles: { sda: 'sda', scl: 'scl', vcc: 'vcc', gnd: 'gnd' }, i2cAddress: 0x27, i2cAddressProp: 'addr' },
  learn: lcdLearn,
  bom: { partName: 'LCD 16x2 with I2C backpack', catalogId: 'lcd16x2_i2c' },
}

export const oled_ssd1306 = {
  type: 'oled_ssd1306',
  name: 'OLED 128x64 (SSD1306)',
  category: 'output',
  mount: 'board',
  recommendedBoards: ESP_BOARDS,
  footprint: footprint([pin('vcc', 0, 0, 'VCC'), pin('gnd', 1, 0, 'GND'), pin('scl', 2, 0, 'SCL'), pin('sda', 3, 0, 'SDA')], 4, 1),
  props: { addr: enumProp('I2C address', [0x3c, 0x3d], 0x3c, { format: 'hex' }) },
  model: [modulePower('vcc', 'gnd', 3.0)],
  control: null,
  peripheral: { protocol: 'oled_i2c', roles: { sda: 'sda', scl: 'scl', vcc: 'vcc', gnd: 'gnd' }, i2cAddress: 0x3c, i2cAddressProp: 'addr' },
  learn: oledLearn,
  bom: { partName: 'OLED 0.96" SSD1306 I2C', catalogId: 'oled_ssd1306' },
}

const SEGMENTS = ['seg_a', 'seg_b', 'seg_c', 'seg_d', 'seg_e', 'seg_f', 'seg_g', 'seg_dp']

export const seven_segment = {
  type: 'seven_segment',
  name: 'Seven-segment display',
  category: 'output',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint(
    [
      pin('seg_g', 0, 0, 'g'),
      pin('seg_f', 1, 0, 'f'),
      pin('com', 2, 0, 'COM'),
      pin('seg_a', 3, 0, 'a'),
      pin('seg_b', 4, 0, 'b'),
      pin('seg_e', 0, 3, 'e'),
      pin('seg_d', 1, 3, 'd'),
      pin('com2', 2, 3, 'COM'),
      pin('seg_c', 3, 3, 'c'),
      pin('seg_dp', 4, 3, 'dp'),
    ],
    5,
    4,
  ),
  props: {},
  // The two COM pins are one common cathode: `bonds` (on the first element) joins them.
  model: SEGMENTS.map((seg, i) => ledDiode(seg, 'com', 1.8, 10, i === 0 ? { segment: seg, bonds: [['com', 'com2']] } : { segment: seg })),
  control: null,
  peripheral: null,
  learn: sevenSegmentLearn,
  bom: { partName: 'Seven-segment display, common cathode', catalogId: 'seven_segment' },
}

export const neopixel_ring = {
  type: 'neopixel_ring',
  name: 'NeoPixel ring',
  category: 'output',
  mount: 'board',
  recommendedBoards: ESP_BOARDS,
  footprint: footprint([pin('din', 0, 0, 'DIN'), pin('vcc', 1, 0, 'VCC'), pin('gnd', 2, 0, 'GND')], 3, 1),
  props: { count: numberProp('Pixels', 12, { min: 1, max: 60, step: 1 }) },
  model: [modulePower('vcc', 'gnd', 4.5)],
  control: null,
  peripheral: { protocol: 'neopixel', roles: { din: 'din', vcc: 'vcc', gnd: 'gnd' } },
  learn: neopixelLearn,
  bom: { partName: 'NeoPixel ring, 12 × WS2812B', catalogId: 'neopixel_ring_12' },
}

export const dc_motor = {
  type: 'dc_motor',
  name: 'DC motor',
  category: 'output',
  mount: 'board',
  recommendedBoards: AVR_BOARDS,
  footprint: footprint([pin('p1', 0, 0, 'M1'), pin('p2', 2, 0, 'M2')], 3, 1),
  props: {},
  model: [{ kind: 'resistor', pins: { a: 'p1', b: 'p2' }, ohms: 20, maxMa: 1000 }],
  control: null,
  peripheral: null,
  learn: dcMotorLearn,
  bom: { partName: 'Hobby DC motor 3–6 V', catalogId: 'dc_motor' },
}

export const relay_5v = {
  type: 'relay_5v',
  name: 'Relay module 5 V',
  category: 'module',
  mount: 'board',
  recommendedBoards: AVR_BOARDS,
  footprint: footprint(
    [pin('vcc', 0, 0, 'VCC'), pin('gnd', 1, 0, 'GND'), pin('in', 2, 0, 'IN'), pin('com', 3, 0, 'COM'), pin('no', 4, 0, 'NO'), pin('nc', 5, 0, 'NC')],
    6,
    1,
  ),
  props: {},
  // relayOn = powered && V(in) − V(gnd) > relayThreshold · Vmodule (evaluated by the circuit engine).
  model: [
    modulePower('vcc', 'gnd', 4.5),
    { kind: 'switch', pins: { a: 'com', b: 'no' }, closedWhen: { relayOn: true }, rOn: 0.1, relayIn: 'in', relayThreshold: 0.6 },
    { kind: 'switch', pins: { a: 'com', b: 'nc' }, closedWhen: { relayOn: false }, rOn: 0.1, relayIn: 'in', relayThreshold: 0.6 },
  ],
  control: null,
  peripheral: null,
  learn: relayLearn,
  bom: { partName: 'Relay module 5 V, 1 channel', catalogId: 'relay_5v' },
}

export const OUTPUT_DEFS = [led, rgb_led, buzzer, servo, lcd16x2_i2c, oled_ssd1306, seven_segment, neopixel_ring, dc_motor, relay_5v]

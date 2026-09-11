import { groundPin, headerRow, makePin, otherPin, powerPin } from './pins.js'

const PWM = new Set([3, 5, 6, 9, 10, 11])
const INTERRUPT = new Set([2, 3])

/** Digital pin `D<n>` of the ATmega328P family (Uno, Nano). */
export function avrDigital(n, extraCaps = []) {
  const caps = ['digital']
  if (PWM.has(n)) caps.push('pwm')
  if (INTERRUPT.has(n)) caps.push('interrupt')
  if (n === 0 || n === 1) caps.push('serial')
  caps.push(...extraCaps)
  const aliases = n === 13 ? ['LED_BUILTIN'] : n === 0 ? ['RX'] : n === 1 ? ['TX'] : []
  return { name: `D${n}`, label: `D${n}`, kind: 'digital', number: n, aliases, caps }
}

/** Analog pin `A<n>` (numbers 14..21). A0–A5 are also digital; A6/A7 are ADC-only (Nano). */
export function avrAnalog(n, { digital = true, aliases = [], caps: extraCaps = [] } = {}) {
  const caps = digital ? ['digital', 'adc'] : ['adc']
  if (n === 4) caps.push('i2c_sda')
  if (n === 5) caps.push('i2c_scl')
  caps.push(...extraCaps)
  return { name: `A${n}`, label: `A${n}`, kind: 'analog', number: 14 + n, aliases, caps, adcChannel: n, adcUnit: 1 }
}

const AVR_LIBRARIES = [
  'Servo.h',
  'LiquidCrystal_I2C.h',
  'Wire.h',
  'Adafruit_NeoPixel.h',
  'DHT.h',
  'Adafruit_SSD1306.h',
  'Adafruit_GFX.h',
  'Adafruit_BME280.h',
  'Adafruit_Sensor.h',
]

/** Electrical characteristics shared by the 5 V AVR boards. */
export const AVR_COMMON = {
  family: 'avr',
  vcc: 5,
  gpioMaxV: 5.5,
  adcBits: 10,
  intBits: 16,
  statementCostUs: 1,
  pinOutputResistance: 25,
  pinMaxSourceMa: 40,
  pullupOhms: 35000,
  usbSupplyMaxMa: 500,
  ledBuiltin: 'D13',
  i2c: { sda: 'A4', scl: 'A5' },
  pwmDefault: { freqHz: 490, bits: 8 },
  libraries: AVR_LIBRARIES,
}

/** Arduino Uno R3 — free-mounted, top header (18 pins) and bottom header (13 pins). */
export const uno = {
  id: 'uno',
  name: 'Arduino Uno R3',
  componentType: 'uno',
  ...AVR_COMMON,
  pins: [
    ...headerRow('top', [
      // The header SCL/SDA pins are internally the same signals as A5/A4 (`tiedTo`).
      { name: 'SCL', kind: 'other', caps: ['i2c_scl'], tiedTo: 'A5' },
      { name: 'SDA', kind: 'other', caps: ['i2c_sda'], tiedTo: 'A4' },
      { name: 'AREF', kind: 'other' },
      (side, index) => groundPin('GND', side, index),
      ...[13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((n) => avrDigital(n)),
    ]),
    ...headerRow('bottom', [
      (side, index) => makePin({ name: 'IOREF', kind: 'other', side, index }),
      (side, index) => otherPin('RESET', side, index),
      (side, index) => powerPin('3V3', 3.3, side, index),
      (side, index) => powerPin('5V', 5, side, index),
      (side, index) => groundPin('GND2', side, index),
      (side, index) => groundPin('GND3', side, index),
      (side, index) => powerPin('VIN', 5, side, index),
      ...[0, 1, 2, 3, 4, 5].map((n) => avrAnalog(n)),
    ]),
  ],
  notes: [
    'The Uno runs at 5 V: a HIGH output pin sits near 5 V and its inputs read HIGH above roughly 3 V.',
    'Each I/O pin can safely source or sink about 40 mA — an LED without a resistor asks for far more and damages the pin.',
    'analogRead() returns 0–1023 (10 bits) for 0–5 V, so one step is about 4.9 mV.',
    'Only pins D3, D5, D6, D9, D10 and D11 (marked ~) support analogWrite() PWM at about 490 Hz.',
    'A0–A5 double as digital pins 14–19; A4/A5 are also the I2C SDA/SCL lines used by LCD and sensor modules.',
    'int is 16 bits here: values above 32,767 wrap around to negative numbers — use long for big counters.',
    'The board is powered over USB; the 5V pin can supply about 500 mA in total to your circuit.',
    'External interrupts are available on D2 and D3 (attachInterrupt).',
  ],
}

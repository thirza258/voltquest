import { groundPin, headerRow, otherPin, powerPin } from './pins.js'
import { AVR_COMMON, avrAnalog, avrDigital } from './uno.js'

/** Arduino Nano — board-mounted, two rows of 15 pins (row 2 six pitches below row 1). */
export const nano = {
  id: 'nano',
  name: 'Arduino Nano',
  componentType: 'nano',
  ...AVR_COMMON,
  pins: [
    ...headerRow('top', [
      avrDigital(13),
      (side, index) => powerPin('3V3', 3.3, side, index),
      (side, index) => otherPin('AREF', side, index),
      avrAnalog(0),
      avrAnalog(1),
      avrAnalog(2),
      avrAnalog(3),
      avrAnalog(4, { aliases: ['SDA'] }),
      avrAnalog(5, { aliases: ['SCL'] }),
      avrAnalog(6, { digital: false }),
      avrAnalog(7, { digital: false }),
      (side, index) => powerPin('5V', 5, side, index),
      (side, index) => otherPin('RESET', side, index, 'RST'),
      (side, index) => groundPin('GND', side, index),
      (side, index) => powerPin('VIN', 5, side, index),
    ]),
    ...headerRow('bottom', [
      ...[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map((n) => avrDigital(n)),
      (side, index) => groundPin('GND2', side, index),
      (side, index) => otherPin('RESET2', side, index, 'RST'),
      avrDigital(0),
      avrDigital(1),
    ]),
  ],
  notes: [
    'The Nano is an Uno shrunk onto a breadboard-friendly stick: same 5 V logic, same 16 MHz chip, same pin numbers.',
    'It straddles the breadboard gap — the two pin rows are 6 pitches apart, so the top row lands in column b and the bottom row in column f.',
    'Pins A6 and A7 are analog-input only: analogRead works, digitalWrite does not.',
    'Like the Uno, only D3, D5, D6, D9, D10 and D11 offer PWM with analogWrite().',
    'analogRead() returns 0–1023 (10 bits) for 0–5 V.',
    'Each pin is limited to about 40 mA; always put a resistor in series with an LED.',
    'A4 is SDA and A5 is SCL for I2C modules such as the 16x2 LCD backpack.',
  ],
}

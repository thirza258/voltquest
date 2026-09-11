import { groundPin, headerRow, otherPin, powerPin } from './pins.js'
import { ESP32_COMMON } from './esp32.js'

const INPUT_ONLY = new Set([46])
const SERIAL = { 43: 'TX', 44: 'RX' }

/** GPIO pin of the ESP32-S3 DevKitC-1. Silkscreen labels are the bare GPIO numbers. */
function gpio(n) {
  const caps = ['digital', 'interrupt']
  const aliases = []
  if (INPUT_ONLY.has(n)) caps.push('input_only')
  else caps.push('pwm')
  const isAdc = n >= 1 && n <= 20
  if (isAdc) {
    caps.push('adc')
    aliases.push(`A${n - 1}`)
  }
  const isTouch = n >= 1 && n <= 14
  if (isTouch) {
    caps.push('touch')
    aliases.push(`T${n}`)
  }
  if (n === 8) {
    caps.push('i2c_sda')
    aliases.push('SDA')
  }
  if (n === 9) {
    caps.push('i2c_scl')
    aliases.push('SCL')
  }
  if (SERIAL[n]) {
    caps.push('serial')
    aliases.push(SERIAL[n])
  }
  if (n === 48) aliases.push('LED_BUILTIN')
  return {
    name: `GPIO${n}`,
    label: SERIAL[n] ?? String(n),
    kind: isAdc ? 'analog' : 'digital',
    number: n,
    aliases,
    caps,
    adcChannel: isAdc ? (n <= 10 ? n - 1 : n - 11) : null,
    adcUnit: isAdc ? (n <= 10 ? 1 : 2) : null,
    touchChannel: isTouch ? n : null,
    dacChannel: null,
  }
}

/** ESP32-S3 DevKitC-1 — board-mounted, 44 pins in two rows of 22 (row 2 ten pitches below row 1). */
export const esp32s3 = {
  id: 'esp32s3',
  name: 'ESP32-S3 DevKitC-1',
  componentType: 'esp32s3',
  ...ESP32_COMMON,
  ledBuiltin: 'GPIO48',
  i2c: { sda: 'GPIO8', scl: 'GPIO9' },
  pins: [
    ...headerRow('top', [
      (side, index) => powerPin('3V3', 3.3, side, index),
      (side, index) => powerPin('3V3_2', 3.3, side, index, '3V3'),
      (side, index) => otherPin('RST', side, index),
      ...[4, 5, 6, 7, 15, 16, 17, 18, 8, 3, 46, 9, 10, 11, 12, 13, 14].map(gpio),
      (side, index) => powerPin('5V', 5, side, index),
      (side, index) => groundPin('GND', side, index),
    ]),
    ...headerRow('bottom', [
      (side, index) => groundPin('GND2', side, index),
      ...[43, 44, 1, 2, 42, 41, 40, 39, 38, 37, 36, 35, 0, 45, 48, 47, 21, 20, 19].map(gpio),
      (side, index) => groundPin('GND3', side, index),
      (side, index) => groundPin('GND4', side, index),
    ]),
  ],
  notes: [
    'The ESP32-S3 is a 3.3 V board like the classic ESP32: never feed a GPIO more than 3.6 V.',
    'The 5V pin passes the USB supply through for 5 V modules; the chip itself and its 3V3 pins run at 3.3 V.',
    'GPIO1–GPIO20 are 12-bit ADC inputs (0–4095). GPIO1–10 are ADC1 (WiFi-safe); GPIO11–20 are ADC2 and pause while WiFi is up.',
    'GPIO1–GPIO14 are touch pads T1–T14 — the S3 has more touch channels than any other board here.',
    'There is no DAC on the S3: use PWM (ledcWrite) and an RC filter when you need an analog-like output.',
    'The built-in RGB LED lives on GPIO48; the default I2C bus is SDA = GPIO8, SCL = GPIO9.',
    'GPIO43/44 are the UART0 TX/RX lines used by the serial monitor; GPIO19/20 are the native USB data pins.',
    'GPIO0, GPIO45 and GPIO46 are strapping pins read at boot — they still work as I/O but avoid pulling them the wrong way at power-up.',
  ],
}

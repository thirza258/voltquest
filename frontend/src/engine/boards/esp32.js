import { groundPin, headerRow, otherPin, powerPin } from './pins.js'
import { AVR_COMMON } from './uno.js'

/** Touch channels of the ESP32 (DevKit V1 header pins only; T1 = GPIO0 is not broken out). */
const TOUCH = { 4: 0, 2: 2, 15: 3, 13: 4, 12: 5, 14: 6, 27: 7, 33: 8, 32: 9 }
/** ADC1 channels (usable while WiFi is active). */
const ADC1 = { 36: 0, 39: 3, 32: 4, 33: 5, 34: 6, 35: 7 }
/** ADC2 channels (blocked while WiFi is active). */
const ADC2 = { 4: 0, 2: 2, 15: 3, 13: 4, 12: 5, 14: 6, 27: 7, 25: 8, 26: 9 }
const DAC = { 25: 1, 26: 2 }
const INPUT_ONLY = new Set([34, 35, 36, 39])
/** Arduino-core analog aliases (A0 = GPIO36 …). */
const ANALOG_ALIAS = { 36: 'A0', 39: 'A3', 32: 'A4', 33: 'A5', 34: 'A6', 35: 'A7', 4: 'A10', 2: 'A12', 15: 'A13', 13: 'A14', 12: 'A15', 14: 'A16', 27: 'A17', 25: 'A18', 26: 'A19' }

/** GPIO pin of the ESP32 DevKit V1 with its silkscreen label. */
function gpio(n, label) {
  const caps = ['digital', 'interrupt']
  const aliases = []
  if (label !== `GPIO${n}`) aliases.push(label)
  if (INPUT_ONLY.has(n)) caps.push('input_only')
  else caps.push('pwm')
  if (n in ADC1 || n in ADC2) caps.push('adc')
  if (n in TOUCH) {
    caps.push('touch')
    aliases.push(`T${TOUCH[n]}`)
  }
  if (n in DAC) {
    caps.push('dac')
    aliases.push(`DAC${DAC[n]}`)
  }
  if (n === 21) {
    caps.push('i2c_sda')
    aliases.push('SDA')
  }
  if (n === 22) {
    caps.push('i2c_scl')
    aliases.push('SCL')
  }
  if (n === 1 || n === 3) caps.push('serial')
  if (n === 1) aliases.push('TX')
  if (n === 3) aliases.push('RX')
  if (n === 2) aliases.push('LED_BUILTIN')
  if (ANALOG_ALIAS[n]) aliases.push(ANALOG_ALIAS[n])
  return {
    name: `GPIO${n}`,
    label,
    kind: n in ADC1 || n in ADC2 ? 'analog' : 'digital',
    number: n,
    aliases,
    caps,
    adcChannel: ADC1[n] ?? ADC2[n] ?? null,
    adcUnit: n in ADC1 ? 1 : n in ADC2 ? 2 : null,
    touchChannel: TOUCH[n] ?? null,
    dacChannel: DAC[n] ?? null,
  }
}

/** Electrical characteristics shared by the 3.3 V ESP32 family. */
export const ESP32_COMMON = {
  family: 'esp32',
  vcc: 3.3,
  gpioMaxV: 3.6,
  adcBits: 12,
  intBits: 32,
  statementCostUs: 0.25,
  pinOutputResistance: 40,
  pinMaxSourceMa: 40,
  pullupOhms: 45000,
  usbSupplyMaxMa: 500,
  pwmDefault: { freqHz: 1000, bits: 8 },
  libraries: [...AVR_COMMON.libraries, 'WiFi.h', 'WebServer.h', 'PubSubClient.h', 'ESP32Servo.h'],
}

/** ESP32 DevKit V1 — board-mounted, 30 pins in two rows of 15 (row 2 ten pitches below row 1). */
export const esp32 = {
  id: 'esp32',
  name: 'ESP32 DevKit V1',
  componentType: 'esp32',
  ...ESP32_COMMON,
  ledBuiltin: 'GPIO2',
  i2c: { sda: 'GPIO21', scl: 'GPIO22' },
  pins: [
    ...headerRow('top', [
      (side, index) => powerPin('3V3', 3.3, side, index),
      (side, index) => groundPin('GND', side, index),
      gpio(15, 'D15'),
      gpio(2, 'D2'),
      gpio(4, 'D4'),
      gpio(16, 'RX2'),
      gpio(17, 'TX2'),
      gpio(5, 'D5'),
      gpio(18, 'D18'),
      gpio(19, 'D19'),
      gpio(21, 'D21'),
      gpio(3, 'RX0'),
      gpio(1, 'TX0'),
      gpio(22, 'D22'),
      gpio(23, 'D23'),
    ]),
    ...headerRow('bottom', [
      (side, index) => powerPin('VIN', 5, side, index),
      (side, index) => groundPin('GND2', side, index),
      gpio(13, 'D13'),
      gpio(12, 'D12'),
      gpio(14, 'D14'),
      gpio(27, 'D27'),
      gpio(26, 'D26'),
      gpio(25, 'D25'),
      gpio(33, 'D33'),
      gpio(32, 'D32'),
      gpio(35, 'D35'),
      gpio(34, 'D34'),
      gpio(39, 'VN'),
      gpio(36, 'VP'),
      (side, index) => otherPin('EN', side, index),
    ]),
  ],
  notes: [
    'The ESP32 is a 3.3 V board. Its GPIO pins tolerate at most about 3.6 V — 5 V on a pin burns it. Use a voltage divider or a level shifter for 5 V sensors.',
    'VIN carries the 5 V from USB and can power 5 V modules; 3V3 is the regulated 3.3 V that the chip itself runs on.',
    'analogRead() returns 0–4095 (12 bits) for 0–3.3 V — remember to change 1023 to 4095 when porting Uno code.',
    'ADC2 pins (GPIO 2, 4, 12–15, 25–27) stop working while WiFi is connected; use ADC1 pins (GPIO 32–39) for sensors in IoT projects.',
    'GPIO 34, 35, 36 and 39 are input-only: they can read but never drive an LED.',
    'Nine header pins are capacitive touch inputs (T0 = GPIO4 … T9 = GPIO32): touchRead() drops from about 70 to about 15 when a finger touches the pad.',
    'Any output pin can do PWM through the LEDC peripheral (analogWrite or ledcWrite); GPIO25/26 are true 8-bit DACs.',
    'int is 32 bits and the chip runs at 240 MHz — millions of statements per second, so short delays matter more than loop overhead.',
  ],
}


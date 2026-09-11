import { makePin } from './pins.js'

const HEADER = [
  '3V3', '5V', 'GPIO2', '5V_2', 'GPIO3', 'GND', 'GPIO4', 'GPIO14', 'GND2', 'GPIO15',
  'GPIO17', 'GPIO18', 'GPIO27', 'GND3', 'GPIO22', 'GPIO23', '3V3_2', 'GPIO24', 'GPIO10', 'GND4',
  'GPIO9', 'GPIO25', 'GPIO11', 'GPIO8', 'GND5', 'GPIO7', 'GPIO0', 'GPIO1', 'GPIO5', 'GND6',
  'GPIO6', 'GPIO12', 'GPIO13', 'GND7', 'GPIO19', 'GPIO16', 'GPIO26', 'GPIO20', 'GND8', 'GPIO21',
]

function headerPin(name, index) {
  const number = name.startsWith('GPIO') ? Number(name.slice(4)) : null
  const caps = number === null ? [] : ['digital', 'pwm', 'interrupt']
  const aliases = [`PIN${index + 1}`]
  if (number === 2) { caps.push('i2c_sda'); aliases.push('SDA') }
  if (number === 3) { caps.push('i2c_scl'); aliases.push('SCL') }
  if (number === 14 || number === 15) caps.push('serial')
  return makePin({
    name, number, caps, aliases,
    label: `${index + 1} ${name.replace(/_2$/, '')}`,
    kind: number !== null ? 'digital' : name.startsWith('GND') ? 'ground' : 'power',
    volts: name.startsWith('3V3') ? 3.3 : name.startsWith('5V') ? 5 : null,
    tiedTo: name.endsWith('_2') ? name.slice(0, -2) : null,
    side: index % 2 ? 'bottom' : 'top', index: Math.floor(index / 2),
  })
}

function raspberryPi(id, name) {
  return {
    id, name, componentType: id, family: 'raspberrypi', language: 'python',
    vcc: 3.3, gpioMaxV: 3.6, adcBits: 0, intBits: 32, statementCostUs: 1,
    pinOutputResistance: 50, pinMaxSourceMa: 16, pullupOhms: 50000, usbSupplyMaxMa: 500,
    pwmDefault: { freqHz: 100, bits: 8 }, ledBuiltin: null,
    i2c: { sda: 'GPIO2', scl: 'GPIO3' }, libraries: [], pins: HEADER.map(headerPin),
    notes: [
      'The 40-pin header uses 3.3 V GPIO. Physical header numbers and BCM GPIO numbers differ.',
      'The simulator accepts a documented Python subset with gpiozero and RPi.GPIO-compatible calls.',
      'There is no built-in analog input. ADCs, Linux, networking, cameras and external Python packages are not simulated.',
      'GPIO resistance, current limits and virtual instruction timing are teaching-model approximations.',
    ],
  }
}

export const raspberrypi4 = raspberryPi('raspberrypi4', 'Raspberry Pi 4 Model B')
export const raspberrypi5 = raspberryPi('raspberrypi5', 'Raspberry Pi 5')

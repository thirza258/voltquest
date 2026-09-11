import { native, deviceByAddress } from './helpers.js'

export function createBme280Library(core) {
  function sample(sensor, field, fallback) {
    const binding = deviceByAddress(core, 'bme280_i2c', sensor.address)
    return binding ? Number(core.controlsOf(binding.componentId)[field] ?? fallback) : NaN
  }
  return { classes: { Adafruit_BME280: {
    construct: () => ({ __class: 'Adafruit_BME280', address: 0x76 }),
    methods: {
      begin: native('bool', function ([address = 0x76]) { this.address = address; return Boolean(deviceByAddress(core, 'bme280_i2c', address)) }),
      readTemperature: native('float', function () { return sample(this, 'temperatureC', 24.5) }),
      readHumidity: native('float', function () { return sample(this, 'humidity', 55) }),
      readPressure: native('float', function () { return sample(this, 'pressureHpa', 1013) * 100 }),
      readAltitude: native('float', function ([seaLevel = 1013.25]) { return 44330 * (1 - Math.pow(sample(this, 'pressureHpa', 1013) / seaLevel, 0.1903)) }),
    },
  } } }
}

import { native, noop, deviceByPin } from './helpers.js'

export function createDhtLibrary(core) {
  function sample(sensor, field, fallback) {
    const binding = deviceByPin(core, 'dht', 'data', sensor.pin)
    return binding ? Number(core.controlsOf(binding.componentId)[field] ?? fallback) : NaN
  }
  return {
    globals: { DHT11: 11, DHT22: 22 },
    classes: { DHT: {
      construct: ([pin]) => ({ __class: 'DHT', pin }),
      methods: {
        begin: noop,
        readTemperature: native('float', function ([fahrenheit]) { const temperature = sample(this, 'temperatureC', 24.5); return fahrenheit ? temperature * 1.8 + 32 : temperature }),
        readHumidity: native('float', function () { return sample(this, 'humidity', 55) }),
      },
    } },
  }
}

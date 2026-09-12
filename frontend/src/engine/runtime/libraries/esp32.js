import { mulberry32 } from '../arduino.js'
import { native, clamp, integer } from './helpers.js'

export function createEsp32Extras(core, adc) {
  const channels = new Map()
  const attached = new Map()
  const random = mulberry32(0x5eed1)
  function outputPin(pin, capability = 'pwm') {
    const info = core.pins.resolve(pin)
    if (!info || !info.caps.has(capability) || info.caps.has('input_only')) {
      core.log('warn', info?.caps.has('input_only') ? 'input_only_pin' : 'unknown_pin', `${capability} output is unavailable on pin ${pin}.`)
      return null
    }
    return info.name
  }
  function write(channel, value) {
    const config = channels.get(channel)
    if (!config) return
    const duty = clamp(value, 0, 2 ** config.bits - 1) / (2 ** config.bits - 1)
    for (const [pin, binding] of attached) {
      if (binding.channel === channel) {
        const esc = core.bindings.byPin('esc', 'signal', pin)
        if (esc) {
          const protocol = core.drone?.state ? core.env.escProtocol : 'pwm'
          const us = protocol === 'dshot600' ? (value < 48 ? 1000 : 1000 + (Math.min(2047, value) - 48) / 1999 * 1000) : duty / config.freq * 1e6 * (protocol === 'oneshot125' ? 8 : 1)
          core.peripheral(esc, 'esc', { us })
        } else core.setPwm(pin, duty, config.freq)
      }
    }
  }
  return {
    globals: { ADC_0db: 0, ADC_2_5db: 1, ADC_6db: 2, ADC_11db: 3, ESP: { __class: 'ESPClass' } },
    classes: { ESPClass: {
      construct: () => ({ __class: 'ESPClass' }),
      methods: {
        getFreeHeap: native('unsigned long', () => 262144),
        getChipModel: native('String', () => core.board.id === 'esp32s3' ? 'ESP32-S3' : 'ESP32'),
        restart: native('void', () => core.restart()),
      },
    } },
    natives: {
      touchRead: native('int', ([pin]) => {
        const info = core.pins.resolve(pin)
        if (!info?.caps.has('touch')) { core.log('warn', 'not_touch_pin', `Pin ${pin} has no touch sensor.`); return 0 }
        const value = core.env.touch[info.name] ?? 70
        core.queueRead('touch', info.name, value)
        return value
      }),
      ledcSetup: native('double', ([channel, freq, bits]) => { channels.set(channel, { freq: Math.max(1, Number(freq)), bits: clamp(bits, 1, 16) }); return freq }),
      ledcAttachPin: native('void', ([pin, channel]) => {
        const name = outputPin(pin)
        if (name) { if (!channels.has(channel)) channels.set(channel, { freq: 1000, bits: 8 }); attached.set(name, { channel, modern: false }) }
      }),
      ledcAttach: native('bool', ([pin, freq, bits]) => {
        const name = outputPin(pin)
        if (!name) return false
        channels.set(name, { freq: Math.max(1, Number(freq)), bits: clamp(bits, 1, 16) })
        attached.set(name, { channel: name, modern: true })
        return true
      }),
      ledcWrite: native('void', ([pinOrChannel, value]) => {
        const binding = attached.get(core.pins.resolve(pinOrChannel)?.name)
        write(binding?.modern ? binding.channel : pinOrChannel, value)
      }),
      ledcDetach: native('bool', ([pin]) => {
        const name = core.pins.resolve(pin)?.name
        if (!attached.delete(name)) return false
        core.setMode(name, 'input')
        return true
      }),
      dacWrite: native('void', ([pin, value]) => { const name = outputPin(pin, 'dac'); if (name) core.setDac(name, clamp(value, 0, 255) / 255 * core.board.vcc) }),
      hallRead: native('int', () => 0),
      analogSetAttenuation: native('void', ([attenuation]) => adc.setAttenuation(attenuation)),
      analogSetPinAttenuation: native('void', ([pin, attenuation]) => adc.setPinAttenuation(pin, attenuation)),
      analogReadMilliVolts: native('unsigned long', ([pin]) => adc.readMilliVolts(pin)),
      esp_random: native('unsigned long', () => integer(random() * 4294967296)),
    },
  }
}

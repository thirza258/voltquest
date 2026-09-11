import { MQTT_CONNECT_US } from '../network.js'
import { charArrayToString } from '../format.js'
import { native } from './helpers.js'

export function createMqttLibrary(core, network) {
  return { classes: { PubSubClient: {
    construct: () => ({ __class: 'PubSubClient', host: '', port: 1883, active: false, callback: null, clientId: '' }),
    methods: {
      setServer: native('PubSubClient', function ([host, port = 1883]) { this.host = charArrayToString(host); this.port = port; return this }),
      setCallback: native('PubSubClient', function ([callback]) { this.callback = callback; return this }),
      connect: native('bool', function* ([clientId], ctx) {
        this.clientId = charArrayToString(clientId)
        if (network.isConnected()) yield ctx.sleep(MQTT_CONNECT_US)
        this.active = network.isConnected()
        core.post({ type: 'mqtt', event: 'connect', host: this.host, clientId: this.clientId, ok: this.active })
        return this.active
      }),
      connected: native('bool', function () { return this.active && network.isConnected() }),
      state: native('int', function () { return this.active && network.isConnected() ? 0 : -1 }),
      disconnect: native('void', function () { this.active = false; core.post({ type: 'mqtt', event: 'disconnect' }) }),
      publish: native('bool', function ([topic, payload, length]) {
        if (!this.active || !network.isConnected()) return false
        const text = Array.isArray(payload) && typeof length === 'number'
          ? payload.slice(0, length).map((value) => String.fromCharCode(value & 255)).join('') : charArrayToString(payload)
        return network.publish(charArrayToString(topic), text)
      }),
      subscribe: native('bool', function ([topic]) { return this.active && network.isConnected() && network.subscribe(charArrayToString(topic)) }),
      unsubscribe: native('bool', ([topic]) => network.unsubscribe(charArrayToString(topic))),
      loop: native('bool', function* (args, ctx) {
        if (!this.active || !network.isConnected()) return false
        const message = network.takeInbound()
        if (message && this.callback) {
          const payload = Array.from(String(message.payload), (character) => character.charCodeAt(0) & 255)
          core.post({ type: 'mqtt', event: 'deliver', topic: message.topic, payload: message.payload })
          yield* ctx.invoke(this.callback, [message.topic, payload, payload.length])
        }
        return true
      }),
      setBufferSize: native('bool', () => true),
      setKeepAlive: native('PubSubClient', function () { return this }),
      setSocketTimeout: native('PubSubClient', function () { return this }),
    },
  } } }
}

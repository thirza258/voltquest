import { WL, WIFI_MODES, makeIpAddress } from '../network.js'
import { native, noop, integer } from './helpers.js'

export function createWifiLibrary(core, network) {
  const client = {
    construct: () => ({ __class: 'WiFiClient', connected: false, buffer: '' }),
    methods: {
      connect: native('int', function () { this.connected = network.isConnected(); return this.connected ? 1 : 0 }),
      connected: native('bool', function () { return this.connected && network.isConnected() }),
      stop: native('void', function () { this.connected = false }),
      print: native('size_t', function (args, ctx) { const text = core.format(args[0], ctx.argTypes[0], args[1]); this.buffer += text; return text.length }),
      println: native('size_t', function (args, ctx) { const text = `${args.length ? core.format(args[0], ctx.argTypes[0], args[1]) : ''}\n`; this.buffer += text; return text.length }),
      available: native('int', () => 0), read: native('int', () => -1), flush: noop,
    },
  }
  return {
    globals: { ...WL, ...WIFI_MODES, WiFi: { __class: 'WiFiClass' } },
    classes: {
      WiFiClient: client,
      IPAddress: {
        construct: (args) => makeIpAddress(args.length === 4 ? args.map((part) => integer(part) & 255).join('.') : args[0]),
        methods: { toString: native('String', function () { return this.__toString() }) },
      },
      WiFiClass: {
        construct: () => ({ __class: 'WiFiClass' }),
        methods: {
          begin: native('int', ([ssid, password]) => network.beginSta(ssid, password)),
          status: native('int', () => network.status()),
          isConnected: native('bool', () => network.isConnected()),
          disconnect: native('bool', () => { network.disconnect(); return true }),
          softAP: native('bool', ([ssid]) => network.softAP(ssid)),
          softAPdisconnect: native('bool', () => { network.disconnect(); return true }),
          localIP: native('IPAddress', () => makeIpAddress(network.localIp())),
          softAPIP: native('IPAddress', () => makeIpAddress(network.localIp())),
          SSID: native('String', () => network.wifi.ssid ?? ''),
          RSSI: native('int', () => network.wifi.rssi ?? 0),
          mode: native('bool', ([mode]) => { if (!mode) network.disconnect(); return true }),
          setHostname: native('bool', () => true),
        },
      },
    },
  }
}

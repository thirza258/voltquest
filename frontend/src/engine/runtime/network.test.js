import { describe, it, expect } from 'vitest'
import { createNetwork, WL } from './network.js'

function lab() {
  const messages = []
  let timeUs = 0
  const core = { now: () => timeUs, env: { wifiAllowed: true }, shared: {}, post: (message) => messages.push(message), log: () => {} }
  const network = createNetwork(core)
  return { core, network, messages, advance(us) { timeUs += us; network.pump() } }
}

describe('virtual network', () => {
  it.each(['VoltNet', 'VoltNet-Guest'])('connects to %s after 500 ms', (ssid) => {
    const run = lab()
    run.network.beginSta(ssid, 'anything')
    run.advance(499999)
    expect(run.network.isConnected()).toBe(false)
    run.advance(1)
    expect(run.network.status()).toBe(WL.WL_CONNECTED)
    expect(run.network.localIp()).toBe('192.168.4.1')
    expect(run.core.shared.wifiConnected).toBe(true)
  })

  it('fails an unknown SSID after three seconds and cancels stale associations', () => {
    const run = lab()
    run.network.beginSta('missing', '')
    run.advance(3000000)
    expect(run.network.status()).toBe(WL.WL_NO_SSID_AVAIL)
    run.network.beginSta('VoltNet', '')
    run.network.disconnect()
    run.advance(1000000)
    expect(run.network.wifi.status).toBe('idle')
  })

  it('cannot finish a previous association after WiFi is disabled', () => {
    const run = lab()
    run.network.beginSta('VoltNet', '')
    run.core.env.wifiAllowed = false
    run.network.beginSta('VoltNet', '')
    run.advance(1000000)
    expect(run.network.status()).toBe(WL.WL_NO_SHIELD)
    expect(run.network.isConnected()).toBe(false)
  })

  it('starts an AP immediately and resets all transient state', () => {
    const run = lab()
    run.network.softAP('Lab')
    expect(run.network.wifi.status).toBe('ap')
    run.network.queueHttpRequest({ id: 'one' })
    run.network.publish('lab/value', '42')
    run.network.subscribe('lab/#')
    run.network.reset()
    expect(run.network.takeHttpRequest()).toBeNull()
    expect(run.network.takeInbound()).toBeNull()
    expect(run.network.retainedValue('lab/value')).toBeUndefined()
    expect(run.network.isConnected()).toBe(false)
  })

  it('queues HTTP in order and delivers retained and matching inbound MQTT topics', () => {
    const run = lab()
    run.network.queueHttpRequest({ id: 1 })
    run.network.queueHttpRequest({ id: 2 })
    expect(run.network.takeHttpRequest()).toEqual({ id: 1 })
    expect(run.network.takeHttpRequest()).toEqual({ id: 2 })
    run.network.publish('lab/temp', '24')
    run.network.subscribe('lab/+')
    expect(run.network.takeInbound()).toEqual({ topic: 'lab/temp', payload: '24' })
    run.network.deliverInbound('outside/temp', '0')
    run.network.deliverInbound('lab/temp', '25')
    expect(run.network.takeInbound()).toEqual({ topic: 'lab/temp', payload: '25' })
    expect(run.network.takeInbound()).toBeNull()
    run.network.unsubscribe('lab/+')
    run.network.deliverInbound('lab/temp', '26')
    expect(run.network.takeInbound()).toBeNull()
  })
})

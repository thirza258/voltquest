/**
 * The virtual network the sketch lives on (CONTRACTS §7.4 "Semantics").
 *
 * One WiFi state machine, one MQTT broker and one queue of inbound HTTP requests, all driven by virtual time so
 * `advance(ms)` reproduces the same transitions every run. `libraries/wifi.js`, `libraries/webserver.js` and
 * `libraries/mqtt.js` are thin API wrappers over this module.
 */

/** SSIDs the virtual access point answers to (any password is accepted). */
export const KNOWN_SSIDS = ['VoltNet', 'VoltNet-Guest']
/** The IP the virtual router hands out (and the softAP address). */
export const VIRTUAL_IP = '192.168.4.1'
/** Signal strength reported by `WiFi.RSSI()`. */
export const VIRTUAL_RSSI = -55
/** Virtual µs a station association takes. */
export const STA_CONNECT_US = 500000
/** Virtual µs before an unknown SSID gives up with `WL_NO_SSID_AVAIL`. */
export const NO_SSID_TIMEOUT_US = 3000000
/** Virtual µs an MQTT connection handshake takes once WiFi is up. */
export const MQTT_CONNECT_US = 200000

/** `wl_status_t` values (Arduino WiFi library). */
export const WL = {
  WL_NO_SHIELD: 255,
  WL_IDLE_STATUS: 0,
  WL_NO_SSID_AVAIL: 1,
  WL_SCAN_COMPLETED: 2,
  WL_CONNECTED: 3,
  WL_CONNECT_FAILED: 4,
  WL_CONNECTION_LOST: 5,
  WL_DISCONNECTED: 6,
}

/** `wifi_mode_t` values. */
export const WIFI_MODES = { WIFI_OFF: 0, WIFI_STA: 1, WIFI_AP: 2, WIFI_AP_STA: 3, WIFI_MODE_NULL: 0, WIFI_MODE_STA: 1, WIFI_MODE_AP: 2, WIFI_MODE_APSTA: 3 }

/** An `IPAddress` value: prints as dotted quad and indexes like the real class. */
export function makeIpAddress(text) {
  const parts = String(text ?? '0.0.0.0').split('.').map((n) => Number(n) | 0)
  return {
    __class: 'IPAddress',
    __toString: () => parts.join('.'),
    toString: { returns: 'String', fn: () => parts.join('.') },
    0: parts[0], 1: parts[1], 2: parts[2], 3: parts[3],
  }
}

/** True when an MQTT topic filter (with `+` / `#` wildcards) matches a concrete topic. */
export function topicMatches(filter, topic) {
  if (filter === topic) return true
  const f = String(filter).split('/')
  const t = String(topic).split('/')
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true
    if (i >= t.length) return false
    if (f[i] !== '+' && f[i] !== t[i]) return false
  }
  return f.length === t.length
}

/**
 * Creates the virtual network.
 * @param {object} core runtime core
 */
export function createNetwork(core) {
  const wifi = { status: 'idle', ssid: null, ip: null, rssi: null, mode: null }
  /** Pending association: `{ atUs, status, code }`. */
  let pending = null
  let statusCode = WL.WL_IDLE_STATUS

  const httpQueue = []
  const broker = { retained: new Map(), subscriptions: [], inbox: [] }

  function publishState() {
    core.shared.wifiConnected = wifi.status === 'connected' || wifi.status === 'ap'
    core.post({ type: 'wifi', status: wifi.status, ssid: wifi.ssid, ip: wifi.ip, rssi: wifi.rssi, mode: wifi.mode })
  }

  function setState(patch) {
    Object.assign(wifi, patch)
    publishState()
  }

  /** Applies any association that has come due. Safe (and cheap) to call as often as you like. */
  function pump() {
    if (pending && core.now() >= pending.atUs) {
      const done = pending
      pending = null
      statusCode = done.code
      if (done.status === 'connected') setState({ status: 'connected', ip: VIRTUAL_IP, rssi: VIRTUAL_RSSI, mode: 'sta' })
      else setState({ status: 'failed', ip: null, rssi: null })
    }
  }

  const api = {
    wifi,
    pump,
    get nextEventUs() { return pending?.atUs ?? Infinity },

    /** Starts a station association. Unknown SSIDs fail with `WL_NO_SSID_AVAIL` after 3 virtual seconds. */
    beginSta(ssid, password) {
      const name = ssid == null ? '' : String(ssid)
      if (core.env.wifiAllowed === false) {
        pending = null
        core.log('warn', 'wifi_unavailable', `WiFi.begin("${name}"): this board has no WiFi radio.`)
        statusCode = WL.WL_NO_SHIELD
        setState({ status: 'failed', ssid: name, ip: null, mode: null })
        return statusCode
      }
      const known = KNOWN_SSIDS.includes(name)
      statusCode = WL.WL_DISCONNECTED
      setState({ status: 'connecting', ssid: name, ip: null, rssi: null, mode: 'sta' })
      pending = known
        ? { atUs: core.now() + STA_CONNECT_US, status: 'connected', code: WL.WL_CONNECTED }
        : { atUs: core.now() + NO_SSID_TIMEOUT_US, status: 'failed', code: WL.WL_NO_SSID_AVAIL }
      if (!known) {
        core.log('warn', 'wifi_no_ssid', `No access point named "${name}" is in range. The lab network is "VoltNet" (or "VoltNet-Guest"); password: anything.`)
      }
      void password
      return statusCode
    },

    /** Brings up the soft access point — immediate, as on real hardware. */
    softAP(ssid) {
      const name = ssid == null ? 'VoltQuest-AP' : String(ssid)
      pending = null
      statusCode = WL.WL_CONNECTED
      setState({ status: 'ap', ssid: name, ip: VIRTUAL_IP, rssi: VIRTUAL_RSSI, mode: 'ap' })
      return true
    },

    disconnect() {
      pending = null
      statusCode = WL.WL_DISCONNECTED
      setState({ status: 'idle', ssid: null, ip: null, rssi: null, mode: null })
    },

    /** `wl_status_t` for `WiFi.status()`. */
    status() {
      pump()
      return statusCode
    },

    isConnected() {
      pump()
      return wifi.status === 'connected' || wifi.status === 'ap'
    },

    localIp() { return wifi.ip ?? '0.0.0.0' },

    // --- HTTP ----------------------------------------------------------------------------------------------
    /** Queues a request from the main thread; `WebServer.handleClient()` pops it. */
    queueHttpRequest(request) { httpQueue.push(request) },
    takeHttpRequest() { return httpQueue.shift() ?? null },
    get pendingHttp() { return httpQueue.length },

    // --- MQTT ----------------------------------------------------------------------------------------------
    /** Retains the value and logs the publish (the sketch is the publisher). */
    publish(topic, payload) {
      broker.retained.set(topic, payload)
      core.post({ type: 'mqtt', event: 'publish', topic, payload })
      return true
    },
    subscribe(topic) {
      if (!broker.subscriptions.includes(topic)) broker.subscriptions.push(topic)
      core.post({ type: 'mqtt', event: 'subscribe', topic })
      for (const [retainedTopic, payload] of broker.retained) {
        if (topicMatches(topic, retainedTopic)) broker.inbox.push({ topic: retainedTopic, payload })
      }
      return true
    },
    unsubscribe(topic) {
      const i = broker.subscriptions.indexOf(topic)
      if (i >= 0) broker.subscriptions.splice(i, 1)
      return true
    },
    /** An external client published: retain it and deliver it to matching subscriptions. */
    deliverInbound(topic, payload) {
      broker.retained.set(topic, payload)
      if (broker.subscriptions.some((f) => topicMatches(f, topic))) broker.inbox.push({ topic, payload })
    },
    takeInbound() { return broker.inbox.shift() ?? null },
    retainedValue(topic) { return broker.retained.get(topic) },

    reset() {
      pending = null
      statusCode = WL.WL_IDLE_STATUS
      Object.assign(wifi, { status: 'idle', ssid: null, ip: null, rssi: null, mode: null })
      core.shared.wifiConnected = false
      httpQueue.length = 0
      broker.retained.clear()
      broker.subscriptions.length = 0
      broker.inbox.length = 0
    },

    /** Snapshot for `getSnapshot()`. */
    snapshot() {
      return { ...wifi, subscriptions: broker.subscriptions.slice(), pendingHttp: httpQueue.length }
    },
  }

  return api
}

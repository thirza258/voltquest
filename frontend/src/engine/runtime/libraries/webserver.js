import { native, noop, integer } from './helpers.js'
import { charArrayToString } from '../format.js'

export const HTTP_METHODS = { HTTP_ANY: 0, HTTP_GET: 1, HTTP_POST: 3 }

export function createWebServerLibrary(core, network) {
  function routes(server, event) {
    core.post({ type: 'http', event, port: server.port, routes: [...new Set(server.routes.map((route) => route.path))] })
  }
  function respond(server, status, contentType, body) {
    if (!server.request || server.sent) return
    server.sent = true
    core.post({ type: 'httpResponse', id: server.request.id, status, contentType, headers: { ...server.headers }, body: charArrayToString(body) })
  }
  return {
    globals: HTTP_METHODS,
    classes: { WebServer: {
      construct: ([port = 80]) => ({ __class: 'WebServer', port, routes: [], notFound: null, started: false, request: null, headers: {}, params: [], sent: false }),
      methods: {
        on: native('void', function ([path, method, handler]) {
          this.routes.push({ path, method: handler === undefined ? 0 : method, handler: handler === undefined ? method : handler })
          routes(this, 'route')
        }),
        onNotFound: native('void', function ([handler]) { this.notFound = handler }),
        begin: native('void', function () { this.started = true; routes(this, 'serverStarted') }),
        stop: native('void', function () { this.started = false }),
        handleClient: native('void', function* (args, ctx) {
          if (!this.started || !network.isConnected()) return
          const request = network.takeHttpRequest()
          if (!request) return
          const url = new URL(request.path, 'http://192.168.4.1')
          this.request = { ...request, path: url.pathname, method: String(request.method ?? 'GET').toUpperCase() }
          this.headers = {}
          this.sent = false
          this.params = [...url.searchParams.entries()]
          const contentType = Object.entries(request.headers ?? {}).find(([name]) => name.toLowerCase() === 'content-type')?.[1] ?? ''
          if (request.body != null) {
            if (contentType.includes('application/x-www-form-urlencoded')) this.params.push(...new URLSearchParams(request.body).entries())
            else this.params.push(['plain', charArrayToString(request.body)])
          }
          const method = HTTP_METHODS[`HTTP_${this.request.method}`] ?? -1
          const route = this.routes.find((entry) => entry.path === url.pathname && (entry.method === 0 || entry.method === method))
          const handler = route?.handler ?? this.notFound
          try {
            if (handler) yield* ctx.invoke(handler, [])
            if (!this.sent) respond(this, handler ? 500 : 404, 'text/plain', handler ? 'Handler did not send a response' : 'Not found')
          } finally {
            this.request = null
          }
        }),
        send: native('void', function ([status = 200, contentType = 'text/html', body = '']) { respond(this, integer(status), contentType, body) }),
        sendHeader: native('void', function ([name, value]) { this.headers[charArrayToString(name)] = charArrayToString(value) }),
        setContentLength: noop,
        arg: native('String', function ([name]) { return (typeof name === 'number' ? this.params[name]?.[1] : this.params.find(([key]) => key === name)?.[1]) ?? '' }),
        argName: native('String', function ([index]) { return this.params[index]?.[0] ?? '' }),
        args: native('int', function () { return this.params.length }),
        hasArg: native('bool', function ([name]) { return this.params.some(([key]) => key === name) }),
        uri: native('String', function () { return this.request?.path ?? '' }),
        method: native('int', function () { return HTTP_METHODS[`HTTP_${this.request?.method}`] ?? 0 }),
        client: native('WiFiClient', () => ({ __class: 'WiFiClient', connected: network.isConnected(), buffer: '' })),
      },
    } },
  }
}

import { requestDraft } from './project.js'

/**
 * A small, bounded curl parser for the security terminal. It turns a curl-style line into a request
 * draft for the existing request pipeline; it never runs a process or contacts a network. Only the
 * flags the VoltShop labs need are supported (-X, -H, -d/--data*, -b/--cookie, and a target path).
 */
const HOST = 'shop.vq.test'

/** Split a command line into tokens, honouring single/double quotes and backslash escapes. */
export function tokenizeCommand(line) {
  const tokens = []
  let token = '', quote = null, has = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quote) {
      if (ch === quote) quote = null
      else if (ch === '\\' && quote === '"' && i + 1 < line.length) { token += line[++i] }
      else token += ch
      continue
    }
    if (ch === "'" || ch === '"') { quote = ch; has = true; continue }
    if (ch === '\\' && i + 1 < line.length) { token += line[++i]; has = true; continue }
    if (/\s/.test(ch)) { if (has) { tokens.push(token); token = ''; has = false } continue }
    token += ch; has = true
  }
  if (quote) throw new Error('Close the quote before running the command.')
  if (has) tokens.push(token)
  return tokens
}

/** Path (with query) for a curl target, from a shop URL or a bare local path. */
function pathFromTarget(target) {
  const absolute = /^https?:\/\/([^/]+)(\/.*)?$/i.exec(target)
  if (absolute) {
    if (absolute[1] !== HOST) throw new Error(`Point the request at the local shop (${HOST}); the labs never contact other hosts.`)
    return absolute[2] ?? '/'
  }
  if (target.startsWith('/')) return target
  throw new Error('Give a target path beginning with / or a http(s)://shop.vq.test URL.')
}

/**
 * Parse a curl command into a request draft `{ method, path, headers, body }` with JSON-string
 * headers/body, ready for `parseRequestDraft`. Cookie/Origin flags fold into headers.
 */
export function parseCurl(command) {
  if (typeof command !== 'string' || command.length > 8000) throw new Error('Command is empty or too long.')
  const tokens = tokenizeCommand(command.trim())
  if (!tokens.length) throw new Error('Type a curl command, for example: curl /health')
  let i = tokens[0] === 'curl' ? 1 : 0
  let method = null, target = null, bodyText = null
  const headers = {}
  const addHeader = raw => {
    const at = raw.indexOf(':')
    if (at < 0) throw new Error(`Header "${raw}" must look like Name: value.`)
    headers[raw.slice(0, at).trim()] = raw.slice(at + 1).trim()
  }
  const valueFor = flag => { const value = tokens[++i]; if (value === undefined) throw new Error(`${flag} needs a value.`); return value }
  for (; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '-X' || token === '--request') method = valueFor(token).toUpperCase()
    else if (token === '-H' || token === '--header') addHeader(valueFor(token))
    else if (token === '-b' || token === '--cookie') headers.Cookie = valueFor(token)
    else if (['-d', '--data', '--data-raw', '--data-binary', '--json'].includes(token)) bodyText = valueFor(token)
    else if (token.startsWith('-')) throw new Error(`This terminal does not support ${token}. Supported: -X, -H, -d/--data, -b/--cookie.`)
    else if (target === null) target = token
    else throw new Error(`Unexpected argument "${token}".`)
  }
  if (target === null) throw new Error('Add a target path, for example /orders/1001.')
  let body = {}
  if (bodyText !== null) {
    try { body = JSON.parse(bodyText) } catch { throw new Error('The -d body must be a JSON object, for example -d \'{"email":"a@vq.test"}\'.') }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('The -d body must be a JSON object.')
  }
  return requestDraft({ method: method ?? (bodyText !== null ? 'POST' : 'GET'), path: pathFromTarget(target), headers, body })
}

/** Render a validated request (objects) as a copyable curl command for the shop host. */
export function formatCurl(request) {
  const quote = value => `'${String(value).replace(/'/g, "'\\''")}'`
  const parts = ['curl']
  if (request.method !== 'GET') parts.push('-X', request.method)
  for (const [name, value] of Object.entries(request.headers ?? {})) parts.push('-H', quote(`${name}: ${value}`))
  if (request.body && Object.keys(request.body).length) parts.push('-d', quote(JSON.stringify(request.body)))
  parts.push(quote(`https://${HOST}${request.path}`))
  return parts.join(' ')
}

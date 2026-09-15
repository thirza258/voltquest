/** Deterministic web teaching model. No network, filesystem, DOM or user-code execution. */
export const CONTROLS = {
  debug: 'Disable public debug data',
  ownership: 'Check order ownership',
  identity: 'Use the server session role',
  sql: 'Bind SQL parameters',
  html: 'Encode HTML text output',
  files: 'Constrain normalized file paths',
  csrf: 'Validate origin and CSRF token',
  outbound: 'Allow only the public news origin',
  fields: 'Allow only editable profile fields',
}
export const secureControls = () => Object.fromEntries(Object.keys(CONTROLS).map(key => [key, true]))
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
const forbidden = key => ['__proto__', 'prototype', 'constructor'].includes(key)
const hasControl = value => [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
export function validateControls(value) {
  if (!plain(value) || Object.keys(value).length !== Object.keys(CONTROLS).length || Object.keys(CONTROLS).some(key => typeof value[key] !== 'boolean')) throw new Error('Every defense must be true or false.')
  return Object.fromEntries(Object.keys(CONTROLS).map(key => [key, value[key]]))
}

export function validateRequest(value) {
  if (!plain(value) || !['GET', 'POST', 'PATCH'].includes(value.method)) throw new Error('Choose GET, POST or PATCH.')
  if (typeof value.path !== 'string' || value.path.length > 2048 || !/^\/(?!\/)/.test(value.path) || /[\s\\#]/.test(value.path) || hasControl(value.path)) throw new Error('Use a local path beginning with /, up to 2048 characters. Encode spaces in query values.')
  if (!plain(value.headers) || Object.keys(value.headers).length > 20) throw new Error('Headers must be a JSON object with at most 20 entries.')
  const headers = {}
  for (const [key, item] of Object.entries(value.headers)) {
    const name = key.toLowerCase()
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(name) || forbidden(name) || Object.hasOwn(headers, name) || typeof item !== 'string' || item.length > 2048 || hasControl(item)) throw new Error('Use unique header names and single-line string values.')
    headers[name] = item
  }
  if (!plain(value.body) || Object.keys(value.body).length > 20 || Object.entries(value.body).some(([key, item]) => forbidden(key) || key.length > 64 || !['string', 'boolean', 'number'].includes(typeof item) || (typeof item === 'string' && item.length > 4096) || (typeof item === 'number' && !Number.isFinite(item)))) throw new Error('Body must be a JSON object with up to 20 text, number or boolean fields.')
  if (JSON.stringify(value).length > 12000) throw new Error('Keep the request within 12000 characters.')
  return { method: value.method, path: value.path, headers, body: { ...value.body } }
}

export function createState() {
  return {
    users: {
      alice: { name: 'Alice', role: 'customer', email: 'alice@vq.test' },
      bob: { name: 'Bob', role: 'customer', email: 'bob@vq.test' },
      admin: { name: 'Administrator', role: 'admin', email: 'admin@vq.test' },
    },
    orders: [{ id: '1001', owner: 'alice', item: 'LED kit', address: 'Alice — demo address' }, { id: '1002', owner: 'bob', item: 'Robot kit', address: 'Bob — demo address' }],
  }
}
const PRODUCTS = [{ name: 'Lamp', public: 'yes', price: 15 }, { name: 'Cable', public: 'yes', price: 3 }, { name: 'Prototype', public: 'no', price: 99 }]
const FILES = { '/public/readme.txt': 'VoltShop public manual.', '/public/catalog.txt': 'Lamp and Cable are available.', '/private/notes.txt': 'DEMO_PRIVATE: unreleased prototype notes.' }
const SERVICES = { 'https://news.vq.test/article': { title: 'Welcome to VoltShop' }, 'http://inventory.internal/status': { internal: true, stock: 42, note: 'DEMO_INTERNAL: warehouse data' } }
export const encodeHtml = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

/** Small SQL WHERE grammar: literals/columns, =/<>, parentheses, AND/OR, -- comments.
 * Parsing precedes evaluation; no eval, regex payload matching, joins or database access. */
export function sqlPredicate(source) {
  if (source.length > 4096) throw new Error('SQL expression is too long.')
  const tokens = []
  let cursor = 0
  while (cursor < source.length) {
    if (/\s/.test(source[cursor])) { cursor++; continue }
    if (source.slice(cursor, cursor + 2) === '--') {
      const end = source.indexOf('\n', cursor)
      if (end < 0) break
      cursor = end + 1; continue
    }
    const rest = source.slice(cursor)
    const token = /^(?:'(?:[^']|'')*'|<>|=|\(|\)|\d+(?:\.\d+)?|[a-z_][a-z0-9_]*)/i.exec(rest)?.[0]
    if (!token) throw new Error('Unsupported SQL syntax. This lab supports equality, AND, OR, parentheses and -- comments.')
    tokens.push(token); cursor += token.length
    if (tokens.length > 128) throw new Error('SQL expression exceeds 128 tokens.')
  }
  let pos = 0
  function value() {
    const token = tokens[pos++]
    if (!token) throw new Error('SQL value is missing.')
    if (token.startsWith("'")) return () => token.slice(1, -1).replace(/''/g, "'")
    if (/^\d/.test(token) && Number.isFinite(Number(token))) return () => Number(token)
    if (['name', 'public', 'price'].includes(token.toLowerCase())) return row => row[token.toLowerCase()]
    throw new Error('Unknown column in the teaching SQL grammar.')
  }
  function atom(depth) {
    if (depth > 16) throw new Error('SQL parentheses are too deeply nested.')
    if (tokens[pos] === '(') {
      pos++; const expr = or(depth + 1)
      if (tokens[pos++] !== ')') throw new Error('SQL closing parenthesis is missing.')
      return expr
    }
    const left = value(), op = tokens[pos++], right = value()
    if (!['=', '<>'].includes(op)) throw new Error('Only = and <> comparisons are supported.')
    return row => op === '=' ? left(row) === right(row) : left(row) !== right(row)
  }
  function and(depth) {
    let result = atom(depth)
    while (tokens[pos]?.toUpperCase() === 'AND') { pos++; const left = result, right = atom(depth); result = row => left(row) && right(row) }
    return result
  }
  function or(depth) {
    let result = and(depth)
    while (tokens[pos]?.toUpperCase() === 'OR') { pos++; const left = result, right = and(depth); result = row => left(row) || right(row) }
    return result
  }
  const predicate = or(0)
  if (pos !== tokens.length) throw new Error('Unexpected trailing SQL tokens.')
  return predicate
}

export function normalizeFilePath(input) {
  const parts = []
  for (const item of ('/public/' + input).split('/')) {
    if (item === '..') parts.pop()
    else if (item !== '' && item !== '.') parts.push(item)
  }
  return '/' + parts.join('/')
}

export function executeRequest(input, defenses = secureControls(), initial = createState()) {
  const request = validateRequest(input), controls = validateControls(defenses)
  const state = structuredClone(initial), trace = [], findings = []
  const queryStart = request.path.indexOf('?')
  const path = queryStart < 0 ? request.path : request.path.slice(0, queryStart)
  const query = new URLSearchParams(queryStart < 0 ? '' : request.path.slice(queryStart + 1))
  const cookies = Object.fromEntries((request.headers.cookie ?? '').split(';').map(item => item.trim().split('=')))
  const sessions = { 'alice-session': 'alice', 'bob-session': 'bob', 'admin-session': 'admin' }
  const actor = Object.hasOwn(sessions, cookies.sid) ? sessions[cookies.sid] : null
  const user = actor ? state.users[actor] : null
  trace.push(`Session lookup: ${actor ?? 'anonymous'}.`)
  const result = (status, body, extra = {}) => ({ request, controls, status, headers: { 'content-type': 'application/json', ...extra }, body, trace, findings, state })
  const issue = (id, evidence) => findings.push({ id, evidence })
  const route = `${request.method} ${path}`
  if (route === 'GET /health') return result(200, { service: 'VoltShop', status: 'ok' })
  if (route === 'GET /debug') {
    trace.push(controls.debug ? 'Public diagnostic route disabled.' : 'Diagnostic object returned without authentication.')
    if (controls.debug) return result(404, { error: 'Not found' })
    issue('debug', 'Anonymous visitors can read the internal service name and demo configuration.')
    return result(200, { framework: 'Teaching server 1.0', internalService: 'http://inventory.internal/status', demoConfig: 'DEMO_ONLY_CONFIGURATION' })
  }
  if (request.method === 'GET' && /^\/orders\/[^/]+$/.test(path)) {
    if (!user) return result(401, { error: 'A lab session is required.' })
    const order = state.orders.find(item => item.id === path.split('/')[2])
    if (!order) return result(404, { error: 'Order not found' })
    trace.push(`Owner ${order.owner}; requester ${actor}; ownership check ${controls.ownership ? 'enabled' : 'missing'}.`)
    if (controls.ownership && order.owner !== actor && user.role !== 'admin') return result(403, { error: 'This order belongs to another customer.' })
    if (order.owner !== actor && user.role !== 'admin') issue('ownership', `Session ${actor} read order ${order.id} belonging to ${order.owner}.`)
    return result(200, { ...order })
  }
  if (route === 'GET /admin') {
    if (!user) return result(401, { error: 'A lab session is required.' })
    const role = controls.identity ? user.role : request.headers['x-role'] ?? user.role
    trace.push(`Role source: ${controls.identity ? 'server session' : 'client header or session'}; effective role: ${role}.`)
    if (role !== 'admin') return result(403, { error: 'Administrator role required.' })
    if (actor !== 'admin') issue(user.role === 'admin' ? 'fields' : 'identity', `Customer session ${actor} accessed the administrator dashboard.`)
    return result(200, { dashboard: 'DEMO_ADMIN: supplier purchase totals', total: 450 })
  }
  if (route === 'GET /products') {
    const name = query.get('name') ?? 'Lamp'
    const where = `name = '${name}' AND public = 'yes'`
    trace.push(controls.sql ? `SELECT name, price FROM products WHERE name = ? AND public = 'yes'; bound value ${JSON.stringify(name)}` : `SELECT name, price FROM products WHERE ${where}`)
    try {
      const selected = PRODUCTS.filter(controls.sql ? row => row.name === name && row.public === 'yes' : sqlPredicate(where))
      if (selected.some(row => row.public === 'no')) issue('sql', 'The changed WHERE expression returned the unpublished Prototype product.')
      return result(200, { products: selected.map(({ name, price }) => ({ name, price })) })
    } catch (error) { return result(400, { error: error.message }) }
  }
  if (route === 'GET /search') {
    const text = query.get('q') ?? ''
    const output = controls.html ? encodeHtml(text) : text
    trace.push(controls.html ? 'Query encoded for an HTML text node.' : 'Query concatenated into an HTML text node without encoding.')
    // Structural diagnostic only: this is NOT a browser HTML parser or script execution detector.
    if (!controls.html && /<[a-z!/]/i.test(text)) issue('html', 'Untrusted markup reached an HTML sink unchanged. This is an injection indicator, not proof of JavaScript execution.')
    return result(200, `<h2>Search results for ${output}</h2>`, { 'content-type': 'text/html; charset=utf-8' })
  }
  if (route === 'GET /files') {
    const name = query.get('name') ?? 'readme.txt'
    if (name.includes('\\') || name.includes('\0')) return result(400, { error: 'This POSIX path lab does not accept backslashes or null bytes.' })
    const resolved = normalizeFilePath(name)
    trace.push(`Decoded once, then normalized: ${resolved}.`)
    if (controls.files && !resolved.startsWith('/public/')) return result(403, { error: 'File is outside the public directory.' })
    if (!Object.hasOwn(FILES, resolved)) return result(404, { error: 'File not found in the in-memory fixture.' })
    if (!resolved.startsWith('/public/')) issue('files', `The request escaped /public/ and read ${resolved}.`)
    return result(200, { path: resolved, content: FILES[resolved] })
  }
  if (route === 'POST /account/email') {
    if (!user) return result(401, { error: 'A lab session is required.' })
    const originOk = request.headers.origin === 'https://shop.vq.test', tokenOk = request.body.csrf === `csrf-${actor}`
    trace.push(`Origin match: ${originOk}; session token match: ${tokenOk}.`)
    if (controls.csrf && (!originOk || !tokenOk)) return result(403, { error: 'Origin or CSRF token rejected.' })
    if (typeof request.body.email !== 'string' || !/^[a-z0-9.+_-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(request.body.email) || request.body.email.length > 120) return result(400, { error: 'Enter a valid demo email address.' })
    const previous = user.email
    user.email = request.body.email
    if (!originOk || !tokenOk) issue('csrf', `Email changed from ${previous} to ${user.email} without valid origin and session-token checks.`)
    return result(200, { email: user.email, previous })
  }
  if (route === 'GET /preview') {
    let url
    try { url = new URL(query.get('url') ?? 'https://news.vq.test/article') } catch { return result(400, { error: 'Enter an absolute URL as the encoded url parameter.' }) }
    trace.push(`Parsed outbound destination: ${url.origin}${url.pathname}. Only fixture lookup occurs.`)
    if (controls.outbound && (url.origin !== 'https://news.vq.test' || url.username || url.password)) return result(403, { error: 'Destination is outside the allowed public origin.' })
    if (url.username || url.password || url.hash || !Object.hasOwn(SERVICES, url.href)) return result(404, { error: 'No such fixture. No network request was sent.' })
    const content = SERVICES[url.href]
    if (content.internal) issue('outbound', 'The preview feature returned data from the internal inventory fixture.')
    return result(200, { destination: url.href, content: { ...content } })
  }
  if (route === 'PATCH /profile') {
    if (!user) return result(401, { error: 'A lab session is required.' })
    if (typeof request.body.name !== 'string' || !request.body.name.trim() || request.body.name.length > 80) return result(400, { error: 'Profile name must contain 1–80 characters.' })
    const unknown = Object.keys(request.body).filter(key => key !== 'name')
    trace.push(controls.fields ? 'Only name is editable; extra properties reject the entire update.' : 'Name and role are copied from client fields in the teaching model.')
    if (controls.fields && unknown.length) return result(400, { error: 'Only the name field may be updated.' })
    if (request.body.role != null && !['customer', 'admin'].includes(request.body.role)) return result(400, { error: 'Role must be customer or admin in this fixture.' })
    user.name = request.body.name
    if (!controls.fields && Object.hasOwn(request.body, 'role')) user.role = request.body.role
    if (actor !== 'admin' && user.role === 'admin') issue('fields', `Client profile data changed ${actor}'s server role to admin.`)
    return result(200, { ...user })
  }
  const known = ['/health', '/debug', '/admin', '/products', '/search', '/files', '/account/email', '/preview', '/profile'].includes(path) || /^\/orders\/[^/]+$/.test(path)
  return result(known ? 405 : 404, { error: known ? 'Method not allowed for this lab route.' : 'Route not found in VoltShop.' })
}

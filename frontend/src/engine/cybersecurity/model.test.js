import { describe, expect, it, vi } from 'vitest'
import { createState, encodeHtml, executeRequest, secureControls, sqlPredicate, validateControls, validateRequest } from './model.js'
import { LABS, defaultControls, labRequest, verifyLab } from './scenarios.js'

const cookie = actor => ({ cookie: `sid=${actor}-session` })
const query = (path, key, value) => `${path}?${key}=${encodeURIComponent(value)}`
const request = (method, path, headers = {}, body = {}, controls = secureControls(), state = createState()) => executeRequest(labRequest(method, path, headers, body), controls, state)

describe.each(Object.keys(LABS))('%s teaching scenario', id => {
  it('produces observable evidence from its probe, then contains it with defenses', () => {
    const lab = LABS[id], controls = defaultControls(id)
    const baseline = executeRequest(lab.baseline, controls)
    expect(baseline.status).toBe(200)
    expect(baseline.findings).toEqual([])
    const probe = executeRequest(lab.probe, controls)
    expect(probe.status).toBe(200)
    expect(probe.findings.map(item => item.id)).toContain(lab.control ?? 'ownership')
    const fixed = executeRequest(lab.probe, secureControls())
    expect(fixed.status).toBe(lab.fixedStatus)
    expect(fixed.findings).toEqual([])
  })
  it('fails its initially vulnerable regression matrix and passes after remediation', () => {
    const before = verifyLab(id, defaultControls(id)), after = verifyLab(id, secureControls())
    expect(before.passed).toBe(false)
    expect(after.passed).toBe(true)
    expect(after.checks.every(check => check.outcomeMatches)).toBe(true)
    expect(before.checks.filter(check => check.name === 'Normal request still works').every(check => check.passed)).toBe(true)
  })
})

it('enforces the full actor/object matrix and does not leak a record in error bodies', () => {
  for (const actor of ['alice', 'bob', 'admin', 'unknown']) for (const id of ['1001', '1002']) {
    const response = request('GET', `/orders/${id}`, cookie(actor))
    const permitted = actor === 'admin' || (actor === 'alice' && id === '1001') || (actor === 'bob' && id === '1002')
    expect(response.status).toBe(permitted ? 200 : actor === 'unknown' ? 401 : 403)
    if (!permitted) expect(JSON.stringify(response.body)).not.toMatch(/address|Robot kit|LED kit/)
  }
  expect(request('GET', '/orders/9999', cookie('alice')).status).toBe(404)
})

it('never authenticates prototype names, invalid sessions or a role without a session', () => {
  for (const sid of ['__proto__', 'constructor', 'toString', 'missing', '']) {
    expect(request('GET', '/admin', { Cookie: `sid=${sid}`, 'X-Role': 'admin' }, {}, defaultControls('auth')).status).toBe(401)
  }
  expect(request('GET', '/admin', { ...cookie('alice'), 'x-role': 'admin' }).status).toBe(403)
  expect(request('GET', '/admin', cookie('admin')).body.total).toBe(450)
})

it('evaluates different SQL predicates including false controls and operator precedence', () => {
  const controls = defaultControls('sql')
  const lookup = value => request('GET', query('/products', 'name', value), {}, {}, controls)
  expect(lookup("' OR (2=2 AND 'x'='x') --").body.products).toHaveLength(3)
  expect(lookup("' OR 2=3 --").body.products).toEqual([])
  expect(lookup("Lamp' OR name='Prototype").body.products).toEqual([{ name: 'Lamp', price: 15 }])
  expect(lookup("' OR public='no' --").body.products).toEqual([{ name: 'Prototype', price: 99 }])
  expect(lookup("Lamp' AND 1=0 --").body.products).toEqual([])
  const quoted = sqlPredicate("name='O''Reilly' AND price<>0")
  expect(quoted({ name: "O'Reilly", price: 5 })).toBe(true)
  expect(quoted({ name: 'Other', price: 5 })).toBe(false)
  expect(sqlPredicate('1=1 -- comment\n AND 2=3')({})).toBe(false)
})

it('binds apostrophes as literal values and rejects unsupported SQL without executing it', () => {
  expect(request('GET', query('/products', 'name', "O'Reilly")).body.products).toEqual([])
  for (const payload of ["'; DROP TABLE products; --", "' UNION SELECT name FROM users --", "' OR sleep(1000) --", "'"]) {
    const result = request('GET', query('/products', 'name', payload), {}, {}, defaultControls('sql'))
    expect(result.status).toBe(400)
    expect(result.findings).toEqual([])
  }
  expect(() => sqlPredicate('('.repeat(18) + '1=1' + ')'.repeat(18))).toThrow(/deeply nested/)
  expect(() => sqlPredicate(Array(100).fill('1=1').join(' OR '))).toThrow(/128 tokens/)
})

it('encodes every special text character without executing or dropping the user text', () => {
  const text = '<img src=x onerror="alert(1)"> & \' <script>test</script>'
  const vulnerable = request('GET', query('/search', 'q', text), {}, {}, defaultControls('xss'))
  const fixed = request('GET', query('/search', 'q', text))
  expect(vulnerable.body).toBe(`<h2>Search results for ${text}</h2>`)
  expect(vulnerable.headers['content-type']).toBe('text/html; charset=utf-8')
  expect(vulnerable.findings[0].evidence).toContain('not proof of JavaScript execution')
  expect(fixed.body).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;')
  expect(fixed.body).not.toContain('<script>')
  expect(fixed.body).toBe(`<h2>Search results for ${encodeHtml(text)}</h2>`)
})

it('normalizes before checking directory containment and decodes query values only once', () => {
  for (const name of ['../private/notes.txt', 'images/../../private/notes.txt', '../public-other/../private/notes.txt']) {
    const path = query('/files', 'name', name)
    expect(request('GET', path, {}, {}, defaultControls('path')).body.content).toContain('DEMO_PRIVATE')
    expect(request('GET', path).status).toBe(403)
  }
  expect(request('GET', '/files?name=%252e%252e%252fprivate%252fnotes.txt', {}, {}, defaultControls('path')).status).toBe(404)
  expect(request('GET', '/files?name=folder%2F..%2Fcatalog.txt').status).toBe(200)
  expect(request('GET', '/files?name=absent.txt').status).toBe(404)
  expect(request('GET', '/files?name=%00').status).toBe(400)
  expect(request('GET', '/files?name=..%5Cprivate%5Cnotes.txt').status).toBe(400)
})

it('checks CSRF origin and session binding before mutation, including wrong-token cases', () => {
  const state = createState()
  for (const origin of ['https://shop.vq.test', 'https://other.vq.test', 'https://shop.vq.test.other']) for (const csrf of ['', 'csrf-bob', 'csrf-alice']) {
    const result = request('POST', '/account/email', { ...cookie('alice'), origin }, { email: 'updated@vq.test', csrf }, secureControls(), state)
    const allowed = origin === 'https://shop.vq.test' && csrf === 'csrf-alice'
    expect(result.status).toBe(allowed ? 200 : 403)
    expect(result.state.users.alice.email).toBe(allowed ? 'updated@vq.test' : 'alice@vq.test')
    expect(state.users.alice.email).toBe('alice@vq.test')
  }
  expect(request('POST', '/account/email', {}, { email: 'updated@vq.test' }).status).toBe(401)
  expect(request('POST', '/account/email', { ...cookie('alice'), origin: 'https://shop.vq.test' }, { email: 'invalid', csrf: 'csrf-alice' }).status).toBe(400)
})

it('uses parsed origins, rejecting alternate schemes, ports, lookalikes and URL credentials', () => {
  for (const destination of ['http://inventory.internal/status', 'https://news.vq.test@inventory.internal/status', 'https://news.vq.test.attacker.test/article', 'https://news.vq.test:444/article', 'http://news.vq.test/article', 'file:///private/notes.txt', 'https://user:pass@news.vq.test/article']) {
    expect(request('GET', query('/preview', 'url', destination)).status).toBe(403)
  }
  expect(request('GET', query('/preview', 'url', 'https://news.vq.test:443/article')).body.content.title).toBe('Welcome to VoltShop')
  expect(request('GET', query('/preview', 'url', 'https://news.vq.test/unknown')).status).toBe(404)
  expect(request('GET', query('/preview', 'url', 'nonsense')).status).toBe(400)
  const network = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Unexpected network') })
  try {
    expect(request('GET', query('/preview', 'url', 'https://unlisted.test/'), {}, {}, defaultControls('ssrf')).status).toBe(404)
    expect(network).not.toHaveBeenCalled()
  } finally { network.mockRestore() }
})

it('models the profile-to-admin chain with actual state and blocks the entire forbidden write', () => {
  const initial = createState()
  const elevated = executeRequest(LABS.mass.probe, defaultControls('mass'), initial)
  expect(initial.users.alice.role).toBe('customer')
  expect(elevated.state.users.alice.role).toBe('admin')
  const dashboard = request('GET', '/admin', cookie('alice'), {}, defaultControls('mass'), elevated.state)
  expect(dashboard.status).toBe(200)
  expect(dashboard.findings.map(item => item.id)).toEqual(['fields'])
  const denied = executeRequest(LABS.mass.probe, secureControls(), initial)
  expect(denied.status).toBe(400)
  expect(denied.state).toEqual(initial)
  expect(request('GET', '/admin', cookie('alice'), {}, secureControls(), denied.state).status).toBe(403)
  expect(executeRequest(LABS.mass.baseline).state.users.alice).toEqual({ name: 'Alice Learner', role: 'customer', email: 'alice@vq.test' })
})

it('distinguishes unsupported routes and methods and rejects malformed/bounded inputs', () => {
  expect(request('POST', '/health').status).toBe(405)
  expect(request('GET', '/not-a-route').status).toBe(404)
  for (const path of ['https://example.test', '//example.test', '/with space', '/with\\slash', '/health#fragment', '/x' + 'a'.repeat(2048)]) expect(() => request('GET', path)).toThrow()
  for (const body of [null, [], { nested: {} }, { x: 'x'.repeat(4097) }, JSON.parse('{"__proto__":{"polluted":true}}')]) expect(() => request('PATCH', '/profile', cookie('alice'), body)).toThrow()
  expect(() => validateRequest({ ...LABS.http.baseline, headers: { Cookie: 'a', cookie: 'b' } })).toThrow(/unique header/)
  expect(() => validateRequest({ ...LABS.http.baseline, headers: { x: 'a\r\nb' } })).toThrow(/single-line/)
  expect(() => validateControls({ ...secureControls(), sql: 'false' })).toThrow()
  expect(() => validateControls({ ...secureControls(), extra: false })).toThrow()
  expect({}.polluted).toBeUndefined()
})

it('exposes three independent capstone root causes and verifies every modeled route', () => {
  const controls = defaultControls('capstone')
  expect(Object.keys(controls).filter(key => !controls[key])).toEqual(['debug', 'ownership', 'fields'])
  const first = executeRequest(LABS.mass.probe, controls)
  const chain = request('GET', '/admin', cookie('alice'), {}, controls, first.state)
  expect(chain.findings.map(item => item.id)).toEqual(['fields'])
  expect(verifyLab('capstone', controls).checks).toHaveLength(30)
  expect(new Set(verifyLab('capstone', controls).checks.filter(check => !check.passed).map(check => check.lab))).toEqual(new Set(['http', 'idor', 'mass']))
})

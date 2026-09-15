import { createState, executeRequest, secureControls } from './model.js'

export const labRequest = (method, path, headers = {}, body = {}) => ({ method, path, headers, body })
const alice = { cookie: 'sid=alice-session' }
const admin = { cookie: 'sid=admin-session' }
const q = encodeURIComponent
export const LABS = {
  http: { title: 'HTTP and information exposure', control: 'debug',
    baseline: labRequest('GET', '/health'), probe: labRequest('GET', '/debug'), fixedStatus: 404,
    vulnerable: 'GET /debug → return internalConfiguration', fixed: 'GET /debug → 404\nGET /health → { service, status }',
    hint: 'Compare /health with /debug as an anonymous visitor. What information helps someone map the application?' },
  idor: { title: 'Broken object authorization', control: 'ownership',
    baseline: labRequest('GET', '/orders/1001', alice), probe: labRequest('GET', '/orders/1002', alice), fixedStatus: 403,
    vulnerable: 'order = orders.find(request.id)\nreturn order', fixed: 'order = orders.find(request.id)\nrequire(order.owner == session.user || session.role == "admin")\nreturn order',
    hint: 'Alice owns order 1001. Keep her session and request order 1002, which belongs to Bob.' },
  auth: { title: 'Sessions and trusted identity', control: 'identity',
    baseline: labRequest('GET', '/admin', admin), probe: labRequest('GET', '/admin', { ...alice, 'x-role': 'admin' }), fixedStatus: 403,
    vulnerable: 'role = request.headers["x-role"] ?? session.role\nrequire(role == "admin")', fixed: 'session = sessions.lookup(cookie.sid)\nrequire(session.role == "admin")',
    hint: 'An administrator can open /admin. As Alice, add an x-role header with value admin. Does the server trust it?' },
  sql: { title: 'SQL injection', control: 'sql',
    baseline: labRequest('GET', '/products?name=Lamp'), probe: labRequest('GET', `/products?name=${q("' OR 1=1 -- ")}`), fixedStatus: 200,
    vulnerable: "SELECT name, price FROM products\nWHERE name = '<input>' AND public = 'yes'", fixed: "SELECT name, price FROM products\nWHERE name = ? AND public = 'yes'\nparameters = [request.name]", 
    hint: 'Use a quote to close the name string, OR 1=1 to make the predicate true, and -- to comment out the public filter. URL-encode the query value.' },
  xss: { title: 'HTML injection and XSS', control: 'html',
    baseline: labRequest('GET', '/search?q=Lamp'), probe: labRequest('GET', `/search?q=${q('<img src=x onerror="alert(1)">')}`), fixedStatus: 200,
    vulnerable: 'html = "<h2>Search results for " + query.q + "</h2>"', fixed: 'html = "<h2>Search results for " + encodeHtml(query.q) + "</h2>"',
    hint: 'Place <b>test</b> in q (URL-encoded), then inspect whether the angle brackets survive. The lab displays inert HTML source; it never executes handlers.' },
  path: { title: 'Path traversal', control: 'files',
    baseline: labRequest('GET', '/files?name=readme.txt'), probe: labRequest('GET', '/files?name=..%2Fprivate%2Fnotes.txt'), fixedStatus: 403,
    vulnerable: 'path = normalize("/public/" + decodedName)\nreturn fixtureFiles[path]', fixed: 'path = normalize("/public/" + decodedName)\nrequire(path.startsWith("/public/"))\nreturn fixtureFiles[path]',
    hint: 'The public manual lives under /public/. Try ../private/notes.txt and inspect the normalized path in the trace.' },
  csrf: { title: 'Cross-site request forgery', control: 'csrf',
    baseline: labRequest('POST', '/account/email', { ...alice, origin: 'https://shop.vq.test' }, { email: 'new@vq.test', csrf: 'csrf-alice' }),
    probe: labRequest('POST', '/account/email', { ...alice, origin: 'https://other.vq.test' }, { email: 'changed@vq.test' }), fixedStatus: 403,
    vulnerable: 'require(session)\naccount.email = body.email', fixed: 'require(session)\nrequire(origin == "https://shop.vq.test")\nrequire(body.csrf == session.csrfToken)\naccount.email = body.email',
    hint: 'Keep Alice’s demo session cookie, change Origin to https://other.vq.test and remove csrf from the body. Check whether her email changes.' },
  ssrf: { title: 'Server-side request forgery', control: 'outbound',
    baseline: labRequest('GET', `/preview?url=${q('https://news.vq.test/article')}`), probe: labRequest('GET', `/preview?url=${q('http://inventory.internal/status')}`), fixedStatus: 403,
    vulnerable: 'destination = parseURL(query.url)\nreturn fixtureServices[destination]', fixed: 'destination = parseURL(query.url)\nrequire(destination.origin == "https://news.vq.test")\nrequire(no URL credentials)\nreturn fixtureServices[destination]',
    hint: 'The preview normally reads a public article. Change the destination to the internal inventory fixture shown in the route map.' },
  mass: { title: 'Mass assignment', control: 'fields',
    baseline: labRequest('PATCH', '/profile', alice, { name: 'Alice Learner' }), probe: labRequest('PATCH', '/profile', alice, { name: 'Alice Learner', role: 'admin' }), fixedStatus: 400,
    vulnerable: 'profile.name = body.name\nif (body.role exists) profile.role = body.role', fixed: 'require(body contains only "name")\nprofile.name = validateName(body.name)',
    hint: 'Add role: admin to the normal profile JSON. After sending it, request /admin with the same Alice session to check the impact.' },
  capstone: { title: 'VoltShop investigation', control: null,
    baseline: labRequest('GET', '/health'), probe: labRequest('GET', '/orders/1002', alice), fixedStatus: 403,
    vulnerable: 'Investigate three independent boundaries:\npublic diagnostics, order ownership, profile fields.', fixed: 'Remove public diagnostics.\nEnforce ownership on each order read.\nAllow only the profile name field.',
    hint: 'Find three issues. Use /debug, compare both order ids as Alice, and add a role to PATCH /profile. Demonstrate /admin access after the profile change, then fix and retest.' },
}

export const ROUTES = [
  ['GET', '/health', 'Public service status'], ['GET', '/debug', 'Public diagnostics'],
  ['GET', '/orders/1001', 'Alice’s order (Bob owns 1002)'], ['GET', '/admin', 'Administrator dashboard'],
  ['GET', '/products?name=Lamp', 'Product search: Lamp, Cable, private Prototype'],
  ['GET', '/search?q=Lamp', 'Search term in HTML output'], ['GET', '/files?name=readme.txt', 'Public files; private fixture at ../private/notes.txt'],
  ['POST', '/account/email', 'Email update: email and csrf body fields'],
  ['GET', '/preview?url=https%3A%2F%2Fnews.vq.test%2Farticle', 'Article preview; internal fixture http://inventory.internal/status'],
  ['PATCH', '/profile', 'Profile name update'],
]

export function defaultControls(lab) {
  if (!Object.hasOwn(LABS, lab)) throw new Error('Unknown cybersecurity lab.')
  const controls = secureControls()
  for (const key of lab === 'capstone' ? ['debug', 'ownership', 'fields'] : [LABS[lab].control]) controls[key] = false
  return controls
}

function casesFor(lab) {
  const item = LABS[lab]
  const cases = [
    { name: 'Normal request still works', request: item.baseline, status: 200, baseline: true },
    { name: 'Vulnerability probe is contained', request: item.probe, status: item.fixedStatus },
  ]
  if (lab === 'idor') cases.push({ name: 'Bob cannot read Alice’s order', request: labRequest('GET', '/orders/1001', { cookie: 'sid=bob-session' }), status: 403 }, { name: 'Anonymous order access is denied', request: labRequest('GET', '/orders/1001'), status: 401 })
  if (lab === 'auth') cases.push({ name: 'Unknown session cannot claim admin', request: labRequest('GET', '/admin', { cookie: 'sid=unknown', 'x-role': 'admin' }), status: 401 })
  if (lab === 'sql') cases.push({ name: 'A second boolean expression is contained', request: labRequest('GET', `/products?name=${q("' OR 'a'='a' --")}`), status: 200 }, { name: 'Literal apostrophe is accepted as data', request: labRequest('GET', `/products?name=${q("O'Reilly")}`), status: 200 })
  if (lab === 'xss') cases.push({ name: 'Script markup is encoded too', request: labRequest('GET', `/search?q=${q('<script>alert(1)</script>')}`), status: 200 })
  if (lab === 'path') cases.push({ name: 'Traversal after a normal directory is contained', request: labRequest('GET', '/files?name=images%2F..%2F..%2Fprivate%2Fnotes.txt'), status: 403 })
  if (lab === 'csrf') cases.push({ name: 'A token from another session is rejected', request: labRequest('POST', '/account/email', { ...alice, origin: 'https://shop.vq.test' }, { email: 'new@vq.test', csrf: 'csrf-bob' }), status: 403 }, { name: 'Same origin without a token is rejected', request: labRequest('POST', '/account/email', { ...alice, origin: 'https://shop.vq.test' }, { email: 'new@vq.test' }), status: 403 }, { name: 'Wrong origin with the right token is rejected', request: labRequest('POST', '/account/email', { ...alice, origin: 'https://other.vq.test' }, { email: 'new@vq.test', csrf: 'csrf-alice' }), status: 403 })
  if (lab === 'ssrf') cases.push({ name: 'Public hostname as URL username is rejected', request: labRequest('GET', `/preview?url=${q('https://news.vq.test@inventory.internal/status')}`), status: 403 })
  if (lab === 'mass') cases.push({ name: 'Profile-to-admin chain is contained', sequence: [item.probe, labRequest('GET', '/admin', alice)], status: 403 })
  return cases
}

function normalOutcome(lab, response) {
  const { body, state } = response
  return {
    http: () => body.status === 'ok' && body.service === 'VoltShop',
    idor: () => body.id === '1001' && body.owner === 'alice',
    auth: () => body.total === 450 && body.dashboard.startsWith('DEMO_ADMIN'),
    sql: () => body.products?.length === 1 && body.products[0].name === 'Lamp' && body.products[0].price === 15,
    xss: () => body === '<h2>Search results for Lamp</h2>',
    path: () => body.path === '/public/readme.txt' && body.content === 'VoltShop public manual.',
    csrf: () => body.email === 'new@vq.test' && state.users.alice.email === 'new@vq.test',
    ssrf: () => body.content?.title === 'Welcome to VoltShop',
    mass: () => body.name === 'Alice Learner' && body.role === 'customer' && state.users.alice.name === 'Alice Learner',
  }[lab]()
}

/** Each case starts with clean fixtures. Sequence cases deliberately retain state between requests. */
export function verifyLab(lab, controls) {
  if (!Object.hasOwn(LABS, lab)) throw new Error('Unknown cybersecurity lab.')
  const selected = lab === 'capstone' ? Object.keys(LABS).filter(key => key !== 'capstone') : [lab]
  const checks = selected.flatMap(key => casesFor(key).map(test => {
    let state = createState()
    const responses = (test.sequence ?? [test.request]).map(request => {
      const response = executeRequest(request, controls, state); state = response.state; return response
    })
    const last = responses.at(-1)
    const outcomeMatches = test.baseline ? normalOutcome(key, last)
      : key === 'sql' ? last.body.products?.length === 0
        : key === 'xss' ? !/<(?:img|script)/i.test(last.body) && last.body.includes('&lt;')
          : key === 'csrf' ? last.state.users.alice.email === 'alice@vq.test'
            : key === 'mass' ? last.state.users.alice.role === 'customer' : true
    const passed = last.status === test.status && responses.every(response => response.findings.length === 0) && outcomeMatches
    return { lab: key, name: test.name, passed, outcomeMatches, expectedStatus: test.status, actualStatus: last.status, responses }
  }))
  return { passed: checks.every(check => check.passed), checks, controls: { ...controls } }
}

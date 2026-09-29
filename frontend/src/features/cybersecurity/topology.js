/**
 * The VoltShop network as a small topology for the Packet Tracer-style view, and the honest path a
 * single request took through it. Everything here is derived from the request and the model's own
 * response (route, trace, findings); nothing new is simulated and no packet leaves the browser.
 */
export const NODES = [
  { id: 'client', label: 'Browser', role: 'You (the client)', zone: 'client' },
  { id: 'server', label: 'VoltShop app', role: 'Request handler and defenses', zone: 'app' },
  { id: 'sessions', label: 'Accounts & sessions', role: 'Users, roles, orders, profile', zone: 'data' },
  { id: 'products', label: 'Products DB', role: 'SQL product catalog', zone: 'data' },
  { id: 'files', label: 'File store', role: 'Public and private files', zone: 'data' },
  { id: 'news', label: 'news.vq.test', role: 'Allowed public origin', zone: 'external' },
  { id: 'internal', label: 'inventory.internal', role: 'Internal-only service', zone: 'internal' },
]
const NODE_IDS = new Set(NODES.map(node => node.id))
/** Which backend each route reaches, and which node a finding implicates. */
const ROUTE_BACKEND = { '/products': 'products', '/files': 'files', '/orders': 'sessions', '/admin': 'sessions', '/account/email': 'sessions', '/profile': 'sessions' }
const FINDING_NODE = { sql: 'products', files: 'files', outbound: 'internal', ownership: 'sessions', identity: 'sessions', fields: 'sessions', csrf: 'sessions', debug: 'server', html: 'client' }

const pathOnly = path => { const q = path.indexOf('?'); return q < 0 ? path : path.slice(0, q) }
const routeKey = path => { const p = pathOnly(path); return p.startsWith('/orders/') ? '/orders' : p }

/** For /preview, the destination host the handler parsed, from its own trace line. */
function previewTarget(response) {
  const line = response.trace.find(entry => entry.startsWith('Parsed outbound destination'))
  if (line?.includes('inventory.internal')) return 'internal'
  if (line?.includes('news.vq.test')) return 'news'
  return null
}

/**
 * `{ hops, edges, reached, blocked, findingNodes }` for a response:
 * - `hops` is the ordered request path (client → server → backend), for animation;
 * - `edges` pair ids for drawing; `blocked` marks a backend the defenses stopped short of;
 * - `findingNodes` are nodes a security finding implicates.
 */
export function requestTopology(response) {
  const key = routeKey(response.request.path)
  const hops = ['client', 'server']
  let backend = ROUTE_BACKEND[key] ?? null
  let blocked = false
  if (key === '/preview') {
    backend = previewTarget(response)
    // A 403 from the outbound allow-list means the server refused before reaching the destination.
    if (response.status === 403) blocked = true
  }
  // A rejected request (auth, ownership, CSRF, blocked file) stops at the server before the data tier.
  if (backend && backend !== 'client' && response.status >= 400 && response.status !== 404) blocked = true
  if (backend && !blocked) hops.push(backend)
  const edges = []
  for (let i = 0; i < hops.length - 1; i++) edges.push([hops[i], hops[i + 1]])
  if (backend && blocked) edges.push(['server', backend])
  const findingNodes = [...new Set(response.findings.map(finding => FINDING_NODE[finding.id]).filter(id => NODE_IDS.has(id)))]
  return { hops, edges, reached: hops, backend, blocked, findingNodes }
}

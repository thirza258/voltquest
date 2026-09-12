// Fetch wrapper for the VoltQuest backend (docs/API.md). Bearer-token auth, JSON in/out, typed helpers.

const BASE = (import.meta.env?.VITE_API_URL ?? '/api').replace(/\/$/, '')
const DEFAULT_TIMEOUT_MS = 8000

let token = null
const unauthorizedListeners = new Set()

/** Error thrown for every failed request. `status` 0 = network/timeout; `detail` = backend `detail` or a message. */
export class ApiError extends Error {
  constructor(status, detail, body) {
    super(typeof detail === 'string' && detail ? detail : `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.body = body
  }
  /** True when the request never reached the server (offline, DNS, timeout). */
  get isNetwork() {
    return this.status === 0
  }
}

/** Set (or clear with null) the bearer token used for authenticated calls. */
export function setToken(next) {
  token = next || null
}

/** Current bearer token or null. */
export function getToken() {
  return token
}

/** Register a callback fired on any 401 response. Returns an unsubscribe function. */
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

function buildQuery(params) {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!entries.length) return ''
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`
}

async function parseError(res) {
  const text = await res.text().catch(() => '')
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  let detail = body && typeof body === 'object' && 'detail' in body ? body.detail : body
  if (Array.isArray(detail)) detail = detail.map((d) => d?.msg ?? JSON.stringify(d)).join('; ')
  else if (detail && typeof detail === 'object') detail = JSON.stringify(detail)
  return new ApiError(res.status, detail || res.statusText || `HTTP ${res.status}`, body)
}

/**
 * Perform a request. `responseType` 'json' (default) | 'text' | 'blob'.
 * Throws ApiError for HTTP errors (status ≥ 400) and for network failures/timeouts (status 0).
 */
export async function request(method, path, body, { query, responseType = 'json', timeoutMs = DEFAULT_TIMEOUT_MS, headers: extraHeaders, signal } = {}) {
  const headers = { Accept: 'application/json, text/plain, */*', ...extraHeaders }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const abort = () => controller?.abort()
  if (signal?.aborted) abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const res = await fetch(`${BASE}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller?.signal,
    })

    if (res.status === 401 && headers.Authorization && headers.Authorization === `Bearer ${token}` && path !== '/auth/login') unauthorizedListeners.forEach((fn) => fn())
    if (!res.ok) throw await parseError(res)
    if (res.status === 204) return null
    if (responseType === 'blob') return await res.blob()
    if (responseType === 'text') return await res.text()
    const text = await res.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return text }
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw new ApiError(0, err?.name === 'AbortError' ? (signal?.aborted ? 'Request cancelled' : 'Request timed out') : 'Network error', null)
  } finally {
    if (timer) clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }

}

const get = (path, opts) => request('GET', path, undefined, opts)
const post = (path, body, opts) => request('POST', path, body ?? {}, opts)
const put = (path, body, opts) => request('PUT', path, body ?? {}, opts)
const patch = (path, body, opts) => request('PATCH', path, body ?? {}, opts)
const del = (path, opts) => request('DELETE', path, undefined, opts)

export const api = {
  get,
  post,
  put,
  patch,
  del,
  /** GET /api/health */
  health: () => get('/health', { timeoutMs: 4000 }),
  boards: () => get('/boards'),
  assistant: {
    status: () => get('/assistant/status'),
    chat: (body, options = {}) => post('/assistant/chat', body, { ...options, timeoutMs: 55000 }),
    mcpAccess: () => get('/assistant/mcp/access'),
    mcpToken: () => post('/assistant/mcp/token'),
    revokeMcp: () => del('/assistant/mcp/access'),
    shareContext: (context) => put('/assistant/mcp/context', { question: 'Share context with my coding agent', context }),
  },
  tutorials: {
    list: (params = {}) => get('/tutorials', { query: params }),
    get: (id) => get(`/tutorials/${encodeURIComponent(id)}`),
  },
  players: {
    /** POST /api/players/guest → { token, player } */
    guest: () => post('/players/guest'),
    me: () => get('/players/me'),
    /** PATCH /api/players/me { display_name?, settings? } */
    update: (patchBody) => patch('/players/me', patchBody),
    claim: (username, password) => post('/players/claim', { username, password }),
  },
  auth: {
    /** POST /api/auth/login → { token, player } */
    login: (username, password) => post('/auth/login', { username, password }),
  },
  quests: {
    list: () => get('/quests'),
    get: (levelId) => get(`/quests/${encodeURIComponent(levelId)}`),
  },
  progress: {
    list: () => get('/progress'),
    complete: (levelId, payload) => post(`/progress/${encodeURIComponent(levelId)}/complete`, payload),
    attempt: (levelId, payload = {}) => post(`/progress/${encodeURIComponent(levelId)}/attempt`, payload),
  },
  projects: {
    list: () => get('/projects'),
    create: (body) => post('/projects', body),
    get: (id) => get(`/projects/${encodeURIComponent(id)}`),
    update: (id, body) => put(`/projects/${encodeURIComponent(id)}`, body),
    remove: (id) => del(`/projects/${encodeURIComponent(id)}`),
    publish: (id, publish = true) => post(`/projects/${encodeURIComponent(id)}/publish`, { publish }),
  },
  showcase: {
    /** GET /api/showcase?sort=&q=&board=&limit=&offset= */
    list: (params = {}) => get('/showcase', { query: params }),
    get: (slug) => get(`/showcase/${encodeURIComponent(slug)}`),
    fork: (slug) => post(`/showcase/${encodeURIComponent(slug)}/fork`),
  },
  exports: {
    /** POST /api/export/bom → CSV Blob */
    bom: (circuit) => post('/export/bom', { circuit }, { responseType: 'blob' }),
    /** POST /api/export/bom.json → { rows, total_usd } */
    bomJson: (circuit) => post('/export/bom.json', { circuit }),
  },
  /** GET /api/leaderboard?limit= */
  leaderboard: (limit = 20) => get('/leaderboard', { query: { limit } }),
}

export default api

export function mcpUrl(origin = window.location.origin) {
  return new URL(`${BASE}/mcp/`, origin).href
}

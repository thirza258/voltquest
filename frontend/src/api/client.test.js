import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, ApiError, setToken, getToken, onUnauthorized } from './client.js'

function jsonResponse(status, body, headers = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('api client', () => {
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setToken(null)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('performs GET against the base path and parses JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: 'ok' }))
    const res = await api.health()
    expect(res).toEqual({ status: 'ok' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/health')
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('sends JSON bodies and the bearer token', async () => {
    setToken('tok123')
    expect(getToken()).toBe('tok123')
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { attempts: 1, hint_tier_max: 2 }))
    const res = await api.progress.attempt('w1-l1', { hint_tier: 2 })
    expect(res.attempts).toBe(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/progress/w1-l1/attempt')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok123')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ hint_tier: 2 })
  })

  it('throws ApiError with status and detail on HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { detail: 'username taken' }))
    const err = await api.players.claim('bob', 'secret1').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(409)
    expect(err.detail).toBe('username taken')
    expect(err.message).toBe('username taken')
    expect(err.isNetwork).toBe(false)
  })

  it('flattens pydantic validation details', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(422, { detail: [{ loc: ['body', 'stars'], msg: 'stars must be 1..3' }] }))
    const err = await api.progress.complete('w1-l1', { stars: 5 }).catch((e) => e)
    expect(err.status).toBe(422)
    expect(err.detail).toContain('stars must be 1..3')
  })

  it('maps network failures to status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const err = await api.quests.list().catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(0)
    expect(err.isNetwork).toBe(true)
  })

  it('returns null for 204 and notifies unauthorized listeners on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await api.projects.remove('p1')).toBeNull()
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')

    const listener = vi.fn()
    const off = onUnauthorized(listener)
    setToken('expired-token')
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: 'Not authenticated' }))
    await expect(api.players.me()).rejects.toMatchObject({ status: 401 })
    expect(listener).toHaveBeenCalledTimes(1)
    off()
  })

  it('does not expire the current session for a rejected login', async () => {
    setToken('current-session')
    const listener = vi.fn()
    const off = onUnauthorized(listener)
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: 'Invalid credentials' }))
    await expect(api.auth.login('wrong', 'password')).rejects.toMatchObject({ status: 401 })
    expect(listener).not.toHaveBeenCalled()
    off()
  })

  it('serialises query params and returns blobs for exports', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: [], total: 0 }))
    await api.showcase.list({ sort: 'popular', q: '', limit: 24, offset: 0 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/showcase?sort=popular&limit=24&offset=0')

    fetchMock.mockResolvedValueOnce(new Response('Qty,Part\n1,LED', { status: 200, headers: { 'Content-Type': 'text/csv' } }))
    const blob = await api.exports.bom({ version: 1 })
    expect(blob).toBeInstanceOf(Blob)
    expect(await blob.text()).toContain('Qty,Part')
  })
})

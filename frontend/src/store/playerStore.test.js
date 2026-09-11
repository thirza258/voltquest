// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
/**
 * playerStore is the one store that must keep working when the API does not, so these tests drive it
 * through a fake fetch: guest creation, an offline completion that queues and later replays, local XP
 * maths, and token expiry for guests vs claimed accounts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installMemoryStorage } from '../test-utils/localStorage.js'

const STORAGE_KEY = 'vq.player'

/** Minimal fetch double: route handlers keyed by "METHOD /path". */
function mockFetch(routes) {
  return vi.fn(async (url, options = {}) => {
    const method = (options.method ?? 'GET').toUpperCase()
    const path = String(url).replace(/^.*\/api/, '')
    const handler = routes[`${method} ${path}`]
    if (!handler) return new Response(JSON.stringify({ detail: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    const result = await handler(options.body ? JSON.parse(options.body) : undefined)
    if (result instanceof Error) throw result
    const { status = 200, body = {} } = result ?? {}
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  })
}

const GUEST = { id: 'p1', display_name: 'Cadet-4f3a', username: null, xp: 0, settings: {} }

/** Fresh module registry per test so the store's module-level state does not leak. */
async function freshStore() {
  vi.resetModules()
  const mod = await import('./playerStore.js')
  return mod.usePlayerStore
}

describe('playerStore', () => {
  beforeEach(() => {
    installMemoryStorage()
    vi.useRealTimers()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a guest and persists the token', async () => {
    global.fetch = mockFetch({
      'POST /players/guest': () => ({ status: 201, body: { token: 'tok-1', player: GUEST } }),
      'GET /players/me': () => ({ body: GUEST }),
      'GET /progress': () => ({ body: { progress: {} } }),
    })
    const store = await freshStore()
    await store.getState().ensureGuest()

    expect(store.getState().token).toBe('tok-1')
    expect(store.getState().player.display_name).toBe('Cadet-4f3a')
    expect(store.getState().player.level).toBe(1)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).token).toBe('tok-1')
  })

  it('stays usable when guest creation fails and reports itself offline', async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const store = await freshStore()
    await store.getState().ensureGuest()

    expect(store.getState().token).toBeNull()
    expect(store.getState().online).toBe(false)
    expect(store.getState().ready).toBe(true) // the app is allowed to render
  })

  it('awards XP locally and queues the completion when the API is down', async () => {
    global.fetch = mockFetch({
      'POST /players/guest': () => ({ status: 201, body: { token: 'tok-1', player: GUEST } }),
      'GET /players/me': () => ({ body: GUEST }),
      'GET /progress': () => ({ body: { progress: {} } }),
      'POST /progress/w1-l2/complete': () => new TypeError('Failed to fetch'),
    })
    const store = await freshStore()
    await store.getState().ensureGuest()

    const outcome = store.getState().completeLevel('w1-l2', {
      level: { xp: 120 },
      stars: 2,
      objectives_passed: ['a', 'b'],
      code_lines: 12,
    })
    // 120 * 1.25 = 150, and that is enough to reach level 2 (threshold 100).
    expect(outcome.xpGained).toBe(150)
    expect(outcome.levelUp).toBe(true)
    expect(store.getState().player.xp).toBe(150)
    expect(store.getState().player.level).toBe(2)
    expect(store.getState().progress['w1-l2'].stars).toBe(2)

    await vi.waitFor(() => expect(store.getState().pendingOps).toHaveLength(1))
    expect(store.getState().pendingOps[0]).toMatchObject({ type: 'complete', levelId: 'w1-l2' })
    // The queue survives a reload.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).pendingOps).toHaveLength(1)
  })

  it('replays queued operations once the API answers again', async () => {
    let completeCalls = 0
    global.fetch = mockFetch({
      'POST /players/guest': () => ({ status: 201, body: { token: 'tok-1', player: GUEST } }),
      'GET /players/me': () => ({ body: { ...GUEST, xp: 150 } }),
      'GET /progress': () => ({ body: { progress: {} } }),
      'POST /progress/w1-l2/complete': () => {
        completeCalls += 1
        if (completeCalls === 1) return new TypeError('Failed to fetch')
        return { body: { progress: { 'w1-l2': { stars: 2, xp_earned: 150 } }, player: { ...GUEST, xp: 150 }, xp_gained: 150 } }
      },
    })
    const store = await freshStore()
    await store.getState().ensureGuest()
    store.getState().completeLevel('w1-l2', { level: { xp: 120 }, stars: 2 })
    await vi.waitFor(() => expect(store.getState().pendingOps).toHaveLength(1))

    await store.getState().flushPending()

    expect(completeCalls).toBe(2)
    expect(store.getState().pendingOps).toHaveLength(0)
    expect(store.getState().online).toBe(true)
  })

  it('does not lower stars when a level is replayed for fewer', async () => {
    global.fetch = mockFetch({
      'POST /players/guest': () => ({ status: 201, body: { token: 'tok-1', player: GUEST } }),
      'GET /players/me': () => ({ body: GUEST }),
      'GET /progress': () => ({ body: { progress: {} } }),
      'POST /progress/w1-l1/complete': () => ({ body: {} }),
    })
    const store = await freshStore()
    await store.getState().ensureGuest()

    const first = store.getState().completeLevel('w1-l1', { level: { xp: 100 }, stars: 3 })
    const second = store.getState().completeLevel('w1-l1', { level: { xp: 100 }, stars: 1 })

    expect(first.xpGained).toBe(150)
    expect(second.xpGained).toBe(0) // nothing new to earn
    expect(store.getState().progress['w1-l1'].stars).toBe(3)
  })

  it('upgrades an existing level and only awards the difference', async () => {
    global.fetch = mockFetch({
      'POST /players/guest': () => ({ status: 201, body: { token: 'tok-1', player: GUEST } }),
      'GET /players/me': () => ({ body: GUEST }),
      'GET /progress': () => ({ body: { progress: {} } }),
      'POST /progress/w1-l4/complete': () => ({ body: {} }),
    })
    const store = await freshStore()
    await store.getState().ensureGuest()

    store.getState().completeLevel('w1-l4', { level: { xp: 120 }, stars: 1 }) // 120
    const upgrade = store.getState().completeLevel('w1-l4', { level: { xp: 120 }, stars: 3 }) // 180 - 120

    expect(upgrade.xpGained).toBe(60)
    expect(store.getState().player.xp).toBe(180)
  })

  it('remembers which briefings have been seen', async () => {
    global.fetch = mockFetch({ 'POST /players/guest': () => ({ status: 201, body: { token: 't', player: GUEST } }), 'GET /players/me': () => ({ body: GUEST }), 'GET /progress': () => ({ body: { progress: {} } }) })
    const store = await freshStore()
    await store.getState().ensureGuest()

    expect(store.getState().hasSeen('level', 'w1-l1')).toBe(false)
    store.getState().markSeen('level', 'w1-l1')
    store.getState().markSeen('world', 'w1')
    expect(store.getState().hasSeen('level', 'w1-l1')).toBe(true)
    expect(store.getState().hasSeen('world', 'w1')).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).seenLevels).toEqual(['w1-l1'])
  })

  it('restores a persisted session on reload', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        token: 'tok-restored',
        player: { ...GUEST, xp: 350 },
        progress: { 'w1-l1': { stars: 3 } },
        settings: { audio: false, skin: 'mint', wirePalette: 'neon', monitorBaud: 115200 },
        seenLevels: ['w1-l1'],
        seenWorlds: [],
        pendingOps: [],
      }),
    )
    global.fetch = mockFetch({})
    const store = await freshStore()

    expect(store.getState().token).toBe('tok-restored')
    expect(store.getState().player.level).toBe(3) // 350 xp
    expect(store.getState().settings.monitorBaud).toBe(115200)
    expect(store.getState().progress['w1-l1'].stars).toBe(3)
  })

  it('keeps local progress that is ahead of the server on refresh', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, token: 't', player: GUEST, progress: { 'w1-l1': { stars: 3 } }, settings: {}, seenLevels: [], seenWorlds: [], pendingOps: [] }),
    )
    global.fetch = mockFetch({
      'GET /players/me': () => ({ body: GUEST }),
      'GET /progress': () => ({ body: { progress: { 'w1-l1': { stars: 1 }, 'w1-l2': { stars: 2 } } } }),
    })
    const store = await freshStore()
    await store.getState().refresh()

    expect(store.getState().progress['w1-l1'].stars).toBe(3) // local win preserved
    expect(store.getState().progress['w1-l2'].stars).toBe(2) // server-only level adopted
  })

  it('logs out by clearing the token and stored session', async () => {
    global.fetch = mockFetch({ 'POST /players/guest': () => ({ status: 201, body: { token: 't', player: GUEST } }), 'GET /players/me': () => ({ body: GUEST }), 'GET /progress': () => ({ body: { progress: {} } }) })
    const store = await freshStore()
    await store.getState().ensureGuest()
    store.getState().logout()

    expect(store.getState().token).toBeNull()
    expect(store.getState().player).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('maps server settings onto the camelCase store shape', async () => {
    global.fetch = mockFetch({
      'GET /players/me': () => ({ body: { ...GUEST, settings: { audio: false, skin: 'slate', wire_palette: 'neon', monitor_baud: 57600 } } }),
      'GET /progress': () => ({ body: { progress: {} } }),
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, token: 't', player: GUEST, progress: {}, settings: {}, seenLevels: [], seenWorlds: [], pendingOps: [] }))
    const store = await freshStore()
    await store.getState().refresh()

    expect(store.getState().settings).toMatchObject({ audio: false, skin: 'slate', wirePalette: 'neon', monitorBaud: 57600 })
  })

  it('claims a guest account and keeps its progress', async () => {
    global.fetch = mockFetch({
      'POST /players/guest': () => ({ status: 201, body: { token: 'tok-1', player: GUEST } }),
      'GET /players/me': () => ({ body: GUEST }),
      'GET /progress': () => ({ body: { progress: {} } }),
      'POST /progress/w1-l1/complete': () => ({ body: {} }),
      'POST /players/claim': (body) => ({ body: { ...GUEST, username: body.username, xp: 150 } }),
    })
    const store = await freshStore()
    await store.getState().ensureGuest()
    store.getState().completeLevel('w1-l1', { level: { xp: 120 }, stars: 2 })

    const res = await store.getState().claim('sparky', 'hunter2')

    expect(res.ok).toBe(true)
    expect(store.getState().player.username).toBe('sparky')
    expect(store.getState().progress['w1-l1'].stars).toBe(2)
  })

  it('surfaces a rejected claim without losing the session', async () => {
    global.fetch = mockFetch({
      'POST /players/guest': () => ({ status: 201, body: { token: 'tok-1', player: GUEST } }),
      'GET /players/me': () => ({ body: GUEST }),
      'GET /progress': () => ({ body: { progress: {} } }),
      'POST /players/claim': () => ({ status: 409, body: { detail: 'username taken' } }),
    })
    const store = await freshStore()
    await store.getState().ensureGuest()

    const res = await store.getState().claim('taken', 'hunter2')

    expect(res.ok).toBe(false)
    expect(res.error.status).toBe(409)
    expect(store.getState().token).toBe('tok-1')
    expect(store.getState().online).toBe(true) // a 4xx means the server answered
  })
})

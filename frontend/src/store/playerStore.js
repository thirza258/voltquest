/**
 * Player identity, progress, settings and cosmetics — CONTRACTS §11.2.
 *
 * Offline-first by design: a classroom laptop may lose the API mid-session, and `docker compose up`
 * serves the client before the API finishes booting. Every mutation is applied locally first, mirrored
 * to localStorage, and — if the network call fails — queued in `pendingOps` and replayed later. The UI
 * therefore never blocks on the server and never loses a completed level.
 */
import { create } from 'zustand'
import { api, ApiError, getToken, onUnauthorized, setToken } from '../api/client.js'
import { readJson, removeKey, writeJson } from '../lib/storage.js'
import { levelForXp, newlyUnlocked, xpForCompletion } from '../lib/xp.js'
import { COSMETICS, LEVELS } from '../content/index.js'

const STORAGE_KEY = 'vq.player'
const HEALTH_POLL_MS = 30_000
/** Guard against a runaway queue if the API stays down for a very long session. */
const MAX_PENDING_OPS = 200

export const DEFAULT_SETTINGS = Object.freeze({
  audio: true,
  skin: 'classic',
  wirePalette: 'standard',
  monitorBaud: 9600,
})

/** Shape persisted to localStorage. Kept small and versioned so it can migrate later. */
function persistedSlice(state) {
  return {
    v: 1,
    token: state.token,
    player: state.player,
    progress: state.progress,
    settings: state.settings,
    seenLevels: state.seenLevels,
    seenWorlds: state.seenWorlds,
    pendingOps: state.pendingOps.slice(-MAX_PENDING_OPS),
  }
}

function loadPersisted() {
  const saved = readJson(STORAGE_KEY, null)
  if (!saved || typeof saved !== 'object') return null
  return {
    token: typeof saved.token === 'string' ? saved.token : null,
    player: saved.player ?? null,
    progress: saved.progress && typeof saved.progress === 'object' ? saved.progress : {},
    settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
    seenLevels: Array.isArray(saved.seenLevels) ? saved.seenLevels : [],
    seenWorlds: Array.isArray(saved.seenWorlds) ? saved.seenWorlds : [],
    pendingOps: Array.isArray(saved.pendingOps) ? saved.pendingOps : [],
  }
}

/** Local view of a player's level/XP so the UI is correct before (or without) a server reply. */
function withDerived(player) {
  if (!player) return null
  const xp = Number(player.xp ?? 0)
  const { level, xpIntoLevel, xpForNext } = levelForXp(xp)
  return { ...player, xp, level, xp_into_level: xpIntoLevel, xp_for_next: xpForNext }
}

/** True when a player has no credentials attached, i.e. their token is disposable. */
function isGuest(player) {
  return !player?.username
}

const initial = loadPersisted()

export const usePlayerStore = create((set, get) => {
  let healthTimer = null
  let flushing = null
  let guestRequest = null
  let identityVersion = 0

  /** Persist the parts of state that must survive a reload. */
  const persist = () => writeJson(STORAGE_KEY, persistedSlice(get()))

  const setOnline = (online) => {
    if (get().online === online) return
    set({ online })
    if (online) {
      stopHealthPolling()
      if (!get().token && !get().authExpired) void get().ensureGuest()
      else void flushPending()
    } else {
      startHealthPolling()
    }
  }

  function startHealthPolling() {
    if (healthTimer || typeof setInterval !== 'function') return
    healthTimer = setInterval(() => {
      api.health().then(
        () => setOnline(true),
        () => {},
      )
    }, HEALTH_POLL_MS)
    // Node/test environments do not have unref on every timer implementation.
    healthTimer?.unref?.()
  }

  function stopHealthPolling() {
    if (!healthTimer) return
    clearInterval(healthTimer)
    healthTimer = null
  }

  /**
   * Run an API call, tracking connectivity. Network/5xx failures mark the store offline; the caller
   * decides whether to queue the operation for replay.
   */
  async function call(fn) {
    try {
      const result = await fn()
      setOnline(true)
      return { ok: true, result }
    } catch (error) {
      // A 4xx means the server answered, so we are online but the request was rejected.
      const answered = error instanceof ApiError && error.status >= 400 && error.status < 500
      setOnline(answered)
      return { ok: false, error }
    }
  }

  const queue = (op) => {
    set((s) => ({ pendingOps: [...s.pendingOps, { ...op, at: Date.now() }].slice(-MAX_PENDING_OPS) }))
    persist()
  }

  /** Replay queued operations in order, stopping at the first failure so ordering is preserved. */
  async function flushPending() {
    if (flushing) return flushing
    const { pendingOps, token } = get()
    if (!pendingOps.length || !token) return
    flushing = (async () => {
      while (get().pendingOps.length) {
        const op = get().pendingOps[0]
        const sent = await sendOp(op)
        if (!sent) break
        set(s => ({ pendingOps: s.pendingOps.filter(item => item !== op) }))
        persist()
      }
    })()
    try { await flushing } finally { flushing = null }
  }

  async function sendOp(op) {
    const version = identityVersion
    if (op.type === 'complete') {
      const { ok, result } = await call(() => api.progress.complete(op.levelId, op.payload))
      if (ok && version === identityVersion) applyServerCompletion(op.levelId, result)
      return ok && version === identityVersion
    }
    if (op.type === 'attempt') {
      const { ok } = await call(() => api.progress.attempt(op.levelId, op.payload))
      return ok
    }
    if (op.type === 'settings') {
      const { ok } = await call(() => api.players.update(op.payload))
      return ok
    }
    return true // unknown op: drop rather than block the queue forever
  }

  /** Merge an authoritative /complete response over the optimistic local state. */
  function applyServerCompletion(levelId, response) {
    if (!response) return
    set((s) => ({
      player: response.player ? withDerived({ ...response.player, xp: Math.max(response.player.xp ?? 0, s.player?.xp ?? 0) }) : s.player,
      progress: response.progress ? mergeProgress(response.progress.stars != null ? { ...s.progress, [levelId]: response.progress } : { ...s.progress, ...response.progress }, s.progress) : s.progress,
    }))
    persist()
  }

  // An expired or invalid token: guests silently get a fresh identity (their local progress is
  // replayed onto it); claimed accounts must log in again, so we surface that to the UI.
  onUnauthorized(() => {
    const { player } = get()
    if (isGuest(player)) {
      set({ token: null })
      setToken(null)
      void get().ensureGuest()
    } else {
      set({ token: null, authExpired: true })
      setToken(null)
      persist()
    }
  })

  if (initial?.token) setToken(initial.token)
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', () => setOnline(true))
    window.addEventListener('offline', () => setOnline(false))
  }

  return {
    player: withDerived(initial?.player ?? null),
    token: initial?.token ?? getToken() ?? null,
    progress: initial?.progress ?? {},
    settings: initial?.settings ?? { ...DEFAULT_SETTINGS },
    seenLevels: initial?.seenLevels ?? [],
    seenWorlds: initial?.seenWorlds ?? [],
    pendingOps: initial?.pendingOps ?? [],
    /** Optimistic connectivity flag: false after a network failure, true after any success. */
    online: true,
    /** Set when a claimed account's token expired and the user must log in again. */
    authExpired: false,
    ready: false,

    /**
     * Create a guest identity if there is none. Fire-and-forget at app start: the UI must not block
     * on it, because play works entirely offline.
     */
    async ensureGuest() {
      if (get().authExpired) return null
      if (get().token && get().player) {
        set({ ready: true })
        void get().refresh()
        return get().player
      }
      if (guestRequest) return guestRequest
      const version = identityVersion
      guestRequest = (async () => {
        const { ok, result } = await call(() => api.players.guest())
        if (version !== identityVersion) return null
        if (!ok) { set({ ready: true }); return null }
        setToken(result.token)
        set({ token: result.token, player: withDerived({ ...result.player, xp: Math.max(result.player.xp ?? 0, get().player?.xp ?? 0) }), authExpired: false, ready: true })
        // A new guest id must recover completed lessons as well as operations queued while offline.
        for (const [levelId, progress] of Object.entries(get().progress)) {
          const level = LEVELS[levelId]
          if (!level || !progress.stars || get().pendingOps.some(op => op.type === 'complete' && op.levelId === levelId)) continue
          queue({ type: 'complete', levelId, payload: { stars: progress.stars, objectives_passed: level.objectives.map(o => o.id), code_lines: progress.best_code_lines ?? 0, component_count: progress.solution?.circuit?.components?.length ?? 0, damage_count: 0, duration_ms: 0, ...(progress.solution ?? {}) } })
        }
        persist()
        await flushPending()
        return get().player
      })().finally(() => { guestRequest = null })
      return guestRequest
    },

    /** Pull the server's view of the player and progress, then replay anything queued. */
    async refresh() {
      if (!get().token) return
      const version = identityVersion
      const [me, progress] = await Promise.all([call(() => api.players.me()), call(() => api.progress.list())])
      if (version !== identityVersion) return
      if (me.ok) {
        set((s) => ({
          player: withDerived({ ...me.result, xp: Math.max(me.result.xp ?? 0, s.player?.xp ?? 0) }),
          settings: s.pendingOps.some(op => op.type === 'settings') ? s.settings : { ...s.settings, ...serverSettings(me.result?.settings) },
        }))
      }
      if (progress.ok) {
        // Local wins per level when it is ahead (offline completions not yet flushed).
        set((s) => ({ progress: mergeProgress(progress.result?.progress ?? {}, s.progress) }))
      }
      if (me.ok || progress.ok) persist()
      await flushPending()
      set({ ready: true })
    },

    async login(username, password) {
      const { ok, result, error } = await call(() => api.auth.login(username, password))
      if (!ok) return { ok: false, error }
      identityVersion++
      setToken(result.token)
      set({ token: result.token, player: withDerived(result.player), progress: {}, pendingOps: [], seenLevels: [], seenWorlds: [], settings: { ...DEFAULT_SETTINGS, ...serverSettings(result.player?.settings) }, authExpired: false })
      persist()
      await get().refresh()
      return { ok: true, player: get().player }
    },

    /** Attach credentials to the current guest so their progress becomes a real account. */
    async claim(username, password) {
      if (!get().token) await get().ensureGuest()
      const { ok, result, error } = await call(() => api.players.claim(username, password))
      if (!ok) return { ok: false, error }
      set({ player: withDerived(result) })
      persist()
      return { ok: true, player: get().player }
    },

    logout() {
      identityVersion++
      stopHealthPolling()
      setToken(null)
      removeKey(STORAGE_KEY)
      set({
        player: null,
        token: null,
        progress: {},
        pendingOps: [],
        seenLevels: [],
        seenWorlds: [],
        settings: { ...DEFAULT_SETTINGS },
        authExpired: false,
      })
    },

    /**
     * Record a level completion. Applies XP and stars locally straight away (so the success modal is
     * correct offline) and reconciles with the server's numbers when the call succeeds.
     * @returns {{ xpGained: number, levelUp: boolean, unlocked: { skins: object[], wirePalettes: object[] }, stars: number }}
     */
    completeLevel(levelId, payload = {}) {
      const level = payload.level ?? { xp: payload.levelXp ?? 0 }
      const stars = Math.max(1, Math.min(3, Number(payload.stars ?? 1)))
      const state = get()
      const previous = state.progress[levelId] ?? { stars: 0, attempts: 0 }
      const prevStars = Number(previous.stars ?? 0)
      const xpGained = xpForCompletion(level, stars, prevStars)

      const beforeLevel = state.player?.level ?? 1
      const xp = Number(state.player?.xp ?? 0) + xpGained
      const player = withDerived({ ...(state.player ?? { display_name: 'Cadet' }), xp })
      const unlocked = newlyUnlocked(COSMETICS, beforeLevel, player.level)

      set({
        player,
        progress: {
          ...state.progress,
          [levelId]: {
            ...previous,
            stars: Math.max(prevStars, stars),
            xp_earned: Number(previous.xp_earned ?? 0) + xpGained,
            best_code_lines:
              previous.best_code_lines == null
                ? payload.code_lines ?? null
                : Math.min(previous.best_code_lines, payload.code_lines ?? previous.best_code_lines),
            completed_at: new Date().toISOString(),
            ...(payload.code != null && payload.circuit ? { solution: { code: payload.code, circuit: payload.circuit } } : {}),
          },
        },
      })
      persist()

      const body = {
        stars,
        objectives_passed: payload.objectives_passed ?? [],
        code_lines: payload.code_lines ?? 0,
        component_count: payload.component_count ?? 0,
        damage_count: payload.damage_count ?? 0,
        duration_ms: payload.duration_ms ?? 0,
        ...(payload.code != null ? { code: payload.code } : {}),
        ...(payload.circuit ? { circuit: payload.circuit } : {}),
        ...(payload.solution ?? {}),
      }
      queue({ type: 'complete', levelId, payload: body })
      void flushPending()

      return { xpGained, levelUp: player.level > beforeLevel, unlocked, stars }
    },

    /** Count an attempt and the highest hint tier reached. Best-effort; queued when offline. */
    recordAttempt(levelId, hintTier = 0) {
      const state = get()
      const previous = state.progress[levelId] ?? {}
      set({
        progress: {
          ...state.progress,
          [levelId]: {
            ...previous,
            attempts: Number(previous.attempts ?? 0) + 1,
            hint_tier_max: Math.max(Number(previous.hint_tier_max ?? 0), hintTier),
          },
        },
      })
      persist()
      const body = { hint_tier: hintTier }
      queue({ type: 'attempt', levelId, payload: body })
      void flushPending()
    },

    /** Update local settings and mirror them to the server (queued when offline). */
    setSettings(patchBody) {
      const settings = { ...get().settings, ...patchBody }
      set({ settings })
      persist()
      const body = {
        settings: {
          audio: settings.audio,
          skin: settings.skin,
          wire_palette: settings.wirePalette,
          monitor_baud: settings.monitorBaud,
        },
      }
      queue({ type: 'settings', payload: body })
      void flushPending()
    },

    /** Remember that a level's briefing (or a world's intro) has been shown. */
    markSeen(kind, id) {
      const key = kind === 'world' ? 'seenWorlds' : 'seenLevels'
      if (get()[key].includes(id)) return
      set((s) => ({ [key]: [...s[key], id] }))
      persist()
    },

    hasSeen(kind, id) {
      return get()[kind === 'world' ? 'seenWorlds' : 'seenLevels'].includes(id)
    },

    /** Cosmetics the player's level has unlocked, for the profile page. */
    unlockedCosmetics() {
      const level = get().player?.level ?? 1
      const pick = (items = []) => items.filter((c) => (c.unlockLevel ?? 1) <= level)
      return { skins: pick(COSMETICS?.skins), wirePalettes: pick(COSMETICS?.wirePalettes) }
    },

    /** Exposed for the UI's "retry now" affordance and for tests. */
    async flushPending() { await flushing; return flushPending() },
  }
})

/** Map the API's snake_case settings onto the store's camelCase shape. */
function serverSettings(settings) {
  if (!settings) return {}
  const mapped = {}
  if ('audio' in settings) mapped.audio = !!settings.audio
  if ('skin' in settings) mapped.skin = settings.skin
  if ('wire_palette' in settings) mapped.wirePalette = settings.wire_palette
  if ('monitor_baud' in settings) mapped.monitorBaud = Number(settings.monitor_baud)
  return mapped
}

/** Per level, keep whichever record has more stars (local offline wins may be ahead of the server). */
function mergeProgress(server, local) {
  const merged = { ...server }
  for (const [levelId, localEntry] of Object.entries(local ?? {})) {
    const serverEntry = server[levelId]
    if (!serverEntry || Number(localEntry.stars ?? 0) > Number(serverEntry.stars ?? 0)) merged[levelId] = localEntry
  }
  return merged
}

export default usePlayerStore

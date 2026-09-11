/**
 * In-memory localStorage for tests.
 *
 * vitest's jsdom environment exposes `globalThis.localStorage` as a plain object with no Storage
 * methods, so anything that persists state cannot be asserted on without this. Call
 * `installMemoryStorage()` in a `beforeEach`; `lib/storage.js` guards every access in try/catch, so
 * production code still works when a browser denies storage entirely.
 */
export function createMemoryStorage() {
  let data = new Map()
  return {
    get length() {
      return data.size
    },
    key(index) {
      return [...data.keys()][index] ?? null
    },
    getItem(key) {
      return data.has(String(key)) ? data.get(String(key)) : null
    },
    setItem(key, value) {
      data.set(String(key), String(value))
    },
    removeItem(key) {
      data.delete(String(key))
    },
    clear() {
      data = new Map()
    },
  }
}

/** Replace globalThis.localStorage (and window.localStorage) with a fresh in-memory store. */
export function installMemoryStorage() {
  const storage = createMemoryStorage()
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true })
  }
  return storage
}

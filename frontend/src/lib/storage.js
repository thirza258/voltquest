// Safe localStorage helpers: never throw (private mode, quota, SSR/node) and always JSON.

function store() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** Read and parse a JSON value; returns `fallback` when missing or unreadable. */
export function readJson(key, fallback = null) {
  const s = store()
  if (!s) return fallback
  try {
    const raw = s.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** Serialise and write a JSON value. Returns true on success. */
export function writeJson(key, value) {
  const s = store()
  if (!s) return false
  try {
    s.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** Remove a key. */
export function removeKey(key) {
  const s = store()
  if (!s) return
  try {
    s.removeItem(key)
  } catch {
    /* ignore */
  }
}

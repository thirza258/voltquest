/**
 * Compact relative timestamps for discussion lists.
 *
 * The backend sends ISO-8601 UTC. SQLite hands SQLAlchemy those timestamps back without their
 * offset, so a value may arrive with no zone at all; treat a bare timestamp as UTC rather than
 * letting the browser read it as local time and report fresh posts as hours old.
 */
export function parseTimestamp(value) {
  if (!value) return null
  const text = typeof value === 'string' && !/(Z|[+-]\d{2}:?\d{2})$/.test(value) ? `${value}Z` : value
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

/** `just now`, `5m ago`, `3h ago`, `2d ago`, then an absolute date. `t` is the translator. */
export function timeAgo(value, t = (message) => message, now = Date.now()) {
  const date = parseTimestamp(value)
  if (!date) return ''
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000))
  if (seconds < 60) return t('just now')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return t('{count}m ago', { count: minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('{count}h ago', { count: hours })
  const days = Math.round(hours / 24)
  if (days < 30) return t('{count}d ago', { count: days })
  return date.toISOString().slice(0, 10)
}

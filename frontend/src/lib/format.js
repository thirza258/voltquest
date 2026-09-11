// Small pure formatting helpers for electrical values and UI text. SI in, human-readable out.

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

/** Format a voltage: 3.3 → '3.30 V'; 0.0004 → '0.4 mV'. */
export function formatVolts(v, digits = 2) {
  if (!isNum(v)) return '—'
  if (Math.abs(v) < 0.01 && v !== 0) return `${(v * 1000).toFixed(1)} mV`
  return `${v.toFixed(digits)} V`
}

/** Format a current in amps: 0.0125 → '12.5 mA'; 1.2 → '1.20 A'; 0.00004 → '40 µA'. */
export function formatAmps(a) {
  if (!isNum(a)) return '—'
  const abs = Math.abs(a)
  if (abs >= 1) return `${a.toFixed(2)} A`
  if (abs >= 0.001) return `${(a * 1000).toFixed(abs >= 0.1 ? 0 : 1)} mA`
  if (abs === 0) return '0 mA'
  return `${Math.round(a * 1e6)} µA`
}

/** Format a resistance: 220 → '220 Ω'; 4700 → '4.7 kΩ'; 1e6 → '1 MΩ'. */
export function formatOhms(ohms) {
  if (!isNum(ohms)) return '—'
  if (ohms >= 1e6) return `${trim(ohms / 1e6)} MΩ`
  if (ohms >= 1e3) return `${trim(ohms / 1e3)} kΩ`
  return `${trim(ohms)} Ω`
}

/** Format power in watts: 0.045 → '45 mW'; 2.5 → '2.50 W'. */
export function formatWatts(w) {
  if (!isNum(w)) return '—'
  const abs = Math.abs(w)
  if (abs >= 1) return `${w.toFixed(2)} W`
  if (abs >= 0.001) return `${(w * 1000).toFixed(abs >= 0.1 ? 0 : 1)} mW`
  if (abs === 0) return '0 mW'
  return `${Math.round(w * 1e6)} µW`
}

/** Milliseconds → '12.3 s' / '2m 05s'. */
export function formatDuration(ms) {
  if (!isNum(ms) || ms < 0) return '0.0 s'
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  const m = Math.floor(s / 60)
  const rest = Math.floor(s % 60)
  return `${m}m ${String(rest).padStart(2, '0')}s`
}

/** Relative time for an ISO timestamp: 'just now', '2 min ago', '3 h ago', 'yesterday', '5 days ago'. */
export function timeAgo(iso, now = Date.now()) {
  const t = typeof iso === 'number' ? iso : Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const diff = Math.max(0, now - t)
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

/** Integer with thousands separators: 12500 → '12,500'. */
export function formatInt(n) {
  if (!isNum(n)) return '—'
  return Math.round(n).toLocaleString('en-US')
}

/** Percent from a 0..1 ratio: 0.789 → '79 %'. */
export function formatPercent(ratio) {
  if (!isNum(ratio)) return '—'
  return `${Math.round(ratio * 100)} %`
}

/** Capitalise the first letter: 'red' → 'Red'. */
export function capitalize(s) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function trim(n) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}

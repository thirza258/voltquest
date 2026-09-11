// Firmware trace — a bounded record of what the sketch did (CONTRACTS §8, `Trace`).
// Pure data structure: no DOM, no timers. Fed by the SimulationController with every runtime message,
// queried by the quest validator (pin edges, periods, patterns, ADC/touch samples, serial text).

const MAX_EVENTS = 20000 // ring capacity for pinEvents / analogReads / touchReads
const DROP_CHUNK = 2000 // oldest entries dropped at once when a ring is full (amortised shift)
const MAX_SERIAL_CHARS = 64 * 1024
const PERIOD_INTERVALS = 8 // periodOf() averages the last ≤ 8 rising-edge intervals

function pushCapped(ring, item) {
  if (ring.length >= MAX_EVENTS) ring.splice(0, DROP_CHUNK)
  ring.push(item)
}

/**
 * Creates an empty trace.
 * @returns {{ pinEvents: Array, analogReads: Array, touchReads: Array, serialText: string, nowUs(): number,
 *   record(msg: object): void, edgesOf(pin: string, sinceUs?: number): number, periodOf(pin: string): number|null,
 *   distinctDuties(pin: string): number[], segmentsOf(pin: string): Array<{level: 0|1, fromUs: number, toUs: number}>, reset(): void }}
 */
export function createTrace() {
  const pinEvents = []
  const analogReads = []
  const touchReads = []
  let serialText = ''
  let lastUs = 0
  /** @type {Map<string, Array<{t: number, level: 0|1}>>} per-pin level events with consecutive duplicates merged */
  let levelCache = new Map()

  function noteTime(t) {
    if (typeof t === 'number' && Number.isFinite(t) && t > lastUs) lastUs = t
  }

  function levelsOf(pin) {
    let list = levelCache.get(pin)
    if (!list) {
      list = []
      for (const e of pinEvents) {
        if (e.pin !== pin || e.level === undefined) continue
        const prev = list[list.length - 1]
        if (prev && prev.level === e.level) continue
        list.push(e)
      }
      levelCache.set(pin, list)
    }
    return list
  }

  function recordPins(msg) {
    for (const change of msg.changes ?? []) {
      if (!change || typeof change.pin !== 'string') continue
      const t = typeof change.t === 'number' ? change.t : (msg.t ?? lastUs)
      noteTime(t)
      if (change.level === 0 || change.level === 1) pushCapped(pinEvents, { t, pin: change.pin, level: change.level })
      if (typeof change.duty === 'number') pushCapped(pinEvents, { t, pin: change.pin, duty: change.duty })
    }
    if (levelCache.size) levelCache = new Map()
  }

  function recordReads(msg) {
    for (const read of msg.reads ?? []) {
      if (!read || typeof read.pin !== 'string') continue
      const t = typeof read.t === 'number' ? read.t : (msg.t ?? lastUs)
      noteTime(t)
      const entry = { t, pin: read.pin, value: read.value }
      pushCapped(read.kind === 'touch' ? touchReads : analogReads, entry)
    }
  }

  return {
    pinEvents,
    analogReads,
    touchReads,
    get serialText() {
      return serialText
    },
    /** Latest virtual time (µs) seen in any recorded message — the "now" used to close the last segment. */
    nowUs() {
      return lastUs
    },
    /** Records one outbound runtime message (`pins`, `read`, `serial`; any other type only advances the clock). */
    record(msg) {
      if (!msg || typeof msg !== 'object') return
      noteTime(msg.t)
      switch (msg.type) {
        case 'pins':
          recordPins(msg)
          break
        case 'read':
          recordReads(msg)
          break
        case 'serial':
          if (typeof msg.text === 'string' && msg.text.length) {
            serialText += msg.text
            if (serialText.length > MAX_SERIAL_CHARS) serialText = serialText.slice(-MAX_SERIAL_CHARS)
          }
          break
        default:
          break
      }
    },
    /** Number of digital level changes on `pin` at or after `sinceUs` (default: since the start of the trace). */
    edgesOf(pin, sinceUs = 0) {
      const levels = levelsOf(pin)
      let n = 0
      for (let i = levels.length - 1; i >= 0 && levels[i].t >= sinceUs; i--) n++
      return n
    },
    /** Mean interval (µs) between the last ≤ 8 rising edges, or null with fewer than two rising edges. */
    periodOf(pin) {
      const rises = levelsOf(pin).filter((e) => e.level === 1)
      if (rises.length < 2) return null
      const recent = rises.slice(-(PERIOD_INTERVALS + 1))
      let sum = 0
      for (let i = 1; i < recent.length; i++) sum += recent[i].t - recent[i - 1].t
      return sum / (recent.length - 1)
    },
    /** Distinct PWM duty values (0..1) written to `pin`, in order of first appearance. */
    distinctDuties(pin) {
      const seen = []
      for (const e of pinEvents) {
        if (e.pin === pin && e.duty !== undefined && !seen.includes(e.duty)) seen.push(e.duty)
      }
      return seen
    },
    /** Contiguous level segments for `pin`; the last one is open-ended and closes at `nowUs()`. */
    segmentsOf(pin) {
      const levels = levelsOf(pin)
      return levels.map((e, i) => ({
        level: e.level,
        fromUs: e.t,
        toUs: i + 1 < levels.length ? levels[i + 1].t : Math.max(lastUs, e.t),
      }))
    },
    /** Empties every buffer and rewinds the clock. */
    reset() {
      pinEvents.length = 0
      analogReads.length = 0
      touchReads.length = 0
      serialText = ''
      lastUs = 0
      levelCache = new Map()
    },
  }
}

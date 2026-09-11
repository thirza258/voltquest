/**
 * `Serial` — Arduino's Print/Stream API with a modelled UART (CONTRACTS §7.4).
 *
 * The TX side is a 64-byte FIFO drained at 10 bits per byte per baud (1.04 ms/char at 9600, 87 µs at 115200).
 * `print`/`write` only block once the FIFO is full, which is exactly what makes a print-heavy `loop()` crawl —
 * the lesson "printing floods the monitor" depends on this being modelled, not faked.
 */

import { cFormat, charArrayToString, dtostrf, itoa, writeCharArray } from './format.js'

/** Hardware TX FIFO depth in bytes. */
export const TX_FIFO_BYTES = 64
/** Baud assumed when the sketch never called `Serial.begin()`. */
export const DEFAULT_BAUD = 9600
/** Bits on the wire per byte (1 start + 8 data + 1 stop). */
const BITS_PER_BYTE = 10

const num = (v) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
const int = (v) => Math.trunc(num(v))

/**
 * Creates the Serial device.
 * @param {object} core runtime core
 * @param {{ printf?: boolean }} [options] `printf` is only present on the ESP32 core
 * @returns {{ clazz: object, handleInput: (text: string) => void, reset: () => void, state: object }}
 */
export function createSerial(core, { printf = false } = {}) {
  const state = { baud: null, began: false, txBusyUntilUs: 0, timeoutMs: 1000 }
  let rx = ''

  const baud = () => state.baud ?? DEFAULT_BAUD
  const usPerByte = () => (BITS_PER_BYTE * 1e6) / baud()

  /** Enqueues one byte, sleeping only while the FIFO has no free slot. */
  function* transmit(count, ctx) {
    const per = usPerByte()
    for (let i = 0; i < count; i++) {
      const t = ctx.now()
      if (state.txBusyUntilUs < t) state.txBusyUntilUs = t
      const queued = (state.txBusyUntilUs - t) / per
      if (queued >= TX_FIFO_BYTES) {
        const waitUs = state.txBusyUntilUs - t - (TX_FIFO_BYTES - 1) * per
        yield ctx.sleep(Math.max(0, Math.round(waitUs)))
        if (state.txBusyUntilUs < ctx.now()) state.txBusyUntilUs = ctx.now()
      }
      state.txBusyUntilUs += per
    }
  }

  /** Emits `text` to the monitor and models the time it takes to leave the UART. */
  function* emit(text, ctx) {
    if (!text) return 0
    core.queueSerial(text)
    yield* transmit(text.length, ctx)
    return text.length
  }

  /** Renders a print() argument the way Arduino's Print does, honouring the optional base/decimals. */
  function render(args, ctx) {
    if (args.length === 0) return ''
    const base = args.length > 1 ? int(args[1]) : undefined
    return core.format(args[0], ctx.argTypes?.[0], base)
  }

  function takeUntil(terminator) {
    const idx = terminator ? rx.indexOf(terminator) : -1
    if (idx < 0) return null
    const out = rx.slice(0, idx)
    rx = rx.slice(idx + terminator.length)
    return out
  }

  /** Waits (in virtual time) for input, up to the configured stream timeout. */
  function* waitForInput(ctx, predicate) {
    const deadline = ctx.now() + state.timeoutMs * 1000
    while (!predicate()) {
      if (ctx.now() >= deadline) return false
      yield ctx.sleep(Math.min(1000, Math.max(1, deadline - ctx.now())))
    }
    return true
  }

  const methods = {
    begin: {
      returns: 'void',
      fn(args) {
        state.baud = args.length ? int(args[0]) || DEFAULT_BAUD : DEFAULT_BAUD
        state.began = true
        state.txBusyUntilUs = core.now()
        core.post({ type: 'serialBegin', baud: state.baud })
      },
    },
    end: { returns: 'void', fn() { state.began = false } },

    print: { returns: 'size_t', *fn(args, ctx) { return yield* emit(render(args, ctx), ctx) } },
    println: { returns: 'size_t', *fn(args, ctx) { return yield* emit(`${render(args, ctx)}\n`, ctx) } },
    write: {
      returns: 'size_t',
      *fn(args, ctx) {
        const v = args[0]
        let text
        if (typeof v === 'string') text = v
        else if (Array.isArray(v)) text = charArrayToString(v)
        else text = String.fromCharCode(int(v) & 0xFF)
        if (args.length > 1 && typeof v !== 'number') text = text.slice(0, int(args[1]))
        return yield* emit(text, ctx)
      },
    },
    printf: printf
      ? { returns: 'int', *fn(args, ctx) { return yield* emit(cFormat(String(args[0] ?? ''), args.slice(1), (ctx.argTypes ?? []).slice(1), core.intBits), ctx) } }
      : undefined,
    flush: {
      returns: 'void',
      *fn(args, ctx) {
        const remaining = state.txBusyUntilUs - ctx.now()
        if (remaining > 0) yield ctx.sleep(Math.round(remaining))
      },
    },
    availableForWrite: {
      returns: 'int',
      fn() {
        const queued = Math.max(0, (state.txBusyUntilUs - core.now()) / usPerByte())
        return Math.max(0, TX_FIFO_BYTES - Math.ceil(queued))
      },
    },

    available: { returns: 'int', fn: () => rx.length },
    read: { returns: 'int', fn() { if (!rx.length) return -1; const c = rx.charCodeAt(0); rx = rx.slice(1); return c } },
    peek: { returns: 'int', fn: () => (rx.length ? rx.charCodeAt(0) : -1) },
    readString: {
      returns: 'String',
      *fn(args, ctx) {
        yield* waitForInput(ctx, () => rx.length > 0)
        const out = rx
        rx = ''
        return out
      },
    },
    readStringUntil: {
      returns: 'String',
      *fn(args, ctx) {
        const terminator = typeof args[0] === 'string' ? args[0] : String.fromCharCode(int(args[0]) & 0xFF)
        const ok = yield* waitForInput(ctx, () => rx.indexOf(terminator) >= 0)
        if (!ok) { const out = rx; rx = ''; return out }
        return takeUntil(terminator) ?? ''
      },
    },
    readBytesUntil: {
      returns: 'size_t',
      *fn(args, ctx) {
        const terminator = typeof args[0] === 'string' ? args[0] : String.fromCharCode(int(args[0]) & 0xFF)
        const ok = yield* waitForInput(ctx, () => rx.indexOf(terminator) >= 0)
        const text = ok ? (takeUntil(terminator) ?? '') : (() => { const o = rx; rx = ''; return o })()
        return writeCharArray(args[1], text, int(args[2]) || Infinity)
      },
    },
    parseInt: {
      returns: 'long',
      *fn(args, ctx) {
        yield* waitForInput(ctx, () => /[-+]?\d/.test(rx))
        const m = /[-+]?\d+/.exec(rx)
        if (!m) { rx = ''; return 0 }
        rx = rx.slice(m.index + m[0].length)
        return Math.trunc(Number(m[0]))
      },
    },
    parseFloat: {
      returns: 'float',
      *fn(args, ctx) {
        yield* waitForInput(ctx, () => /[-+]?\d/.test(rx))
        const m = /[-+]?\d*\.?\d+/.exec(rx)
        if (!m) { rx = ''; return 0 }
        rx = rx.slice(m.index + m[0].length)
        return Number(m[0])
      },
    },
    setTimeout: { returns: 'void', fn(args) { state.timeoutMs = Math.max(0, int(args[0])) } },
  }
  if (!printf) delete methods.printf

  return {
    clazz: { construct: () => ({ __class: 'HardwareSerial' }), methods },
    /** Appends text received from the serial monitor. */
    handleInput(text) { if (typeof text === 'string') rx += text },
    reset() { state.baud = null; state.began = false; state.txBusyUntilUs = 0; state.timeoutMs = 1000; rx = '' },
    state,
  }
}

/**
 * The printf-family globals (`snprintf`, `sprintf`, `dtostrf`, `itoa`) that write into `char[]` buffers.
 * @param {object} core runtime core
 */
export function createFormatNatives(core) {
  const limitOf = (dest) => (Array.isArray(dest) ? dest.length : Infinity)
  return {
    snprintf: {
      returns: 'int',
      fn(args, ctx) {
        const [dest, size, fmt] = args
        const text = cFormat(charArrayToString(fmt), args.slice(3), (ctx.argTypes ?? []).slice(3), core.intBits)
        writeCharArray(dest, text, Math.min(Math.trunc(Number(size)) || 0, limitOf(dest)))
        return text.length
      },
    },
    sprintf: {
      returns: 'int',
      fn(args, ctx) {
        const [dest, fmt] = args
        const text = cFormat(charArrayToString(fmt), args.slice(2), (ctx.argTypes ?? []).slice(2), core.intBits)
        writeCharArray(dest, text, limitOf(dest))
        return text.length
      },
    },
    dtostrf: {
      returns: 'String',
      fn(args) {
        const text = dtostrf(Number(args[0]), Math.trunc(Number(args[1])) || 0, Math.trunc(Number(args[2])) || 0)
        writeCharArray(args[3], text, limitOf(args[3]))
        return text
      },
    },
    itoa: {
      returns: 'String',
      fn(args) {
        const text = itoa(args[0], Math.trunc(Number(args[2])) || 10)
        writeCharArray(args[1], text, limitOf(args[1]))
        return text
      },
    },
    ltoa: {
      returns: 'String',
      fn(args) {
        const text = itoa(args[0], Math.trunc(Number(args[2])) || 10)
        writeCharArray(args[1], text, limitOf(args[1]))
        return text
      },
    },
    strlen: { returns: 'size_t', fn: (args) => charArrayToString(args[0]).length },
    strcmp: { returns: 'int', fn: (args) => { const a = charArrayToString(args[0]); const b = charArrayToString(args[1]); return a < b ? -1 : a > b ? 1 : 0 } },
    strcpy: { returns: 'String', fn: (args) => { const t = charArrayToString(args[1]); writeCharArray(args[0], t, limitOf(args[0])); return t } },
  }
}

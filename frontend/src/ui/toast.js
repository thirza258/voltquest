import { create } from 'zustand'

const DEFAULT_TIMEOUT_MS = 5000

let seq = 0
/** Pending auto-dismiss timers, keyed by toast id. */
const timers = new Map()

/** @typedef {{ id:string, title?:string, message?:string, tone?:string, timeoutMs?:number, action?:{label:string,onClick:()=>void} }} Toast */

export const useToastStore = create((set) => ({
  /** @type {Toast[]} */
  toasts: [],
  _add: (toast) => set((s) => ({ toasts: [...s.toasts, toast] })),
  _remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  _clear: () => set({ toasts: [] }),
}))

/**
 * Queue a toast.
 * @param {{ title?:string, message?:string, tone?:'neutral'|'brand'|'success'|'warning'|'danger'|'volt'|'info',
 *           timeoutMs?:number, action?:{label:string,onClick:()=>void} }} toast
 * @returns {string} the toast id, usable with `dismiss`
 */
export function push(toast = {}) {
  const id = `t_${++seq}`
  const timeoutMs = Number.isFinite(toast.timeoutMs) ? toast.timeoutMs : DEFAULT_TIMEOUT_MS
  useToastStore.getState()._add({ tone: 'neutral', ...toast, timeoutMs, id })
  if (timeoutMs > 0) {
    timers.set(
      id,
      setTimeout(() => dismiss(id), timeoutMs),
    )
  }
  return id
}

/**
 * Remove a toast (and cancel its timer). Unknown ids are ignored.
 * @param {string} id
 */
export function dismiss(id) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
  useToastStore.getState()._remove(id)
}

/** Remove every toast. */
export function dismissAll() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  useToastStore.getState()._clear()
}

/** Stable, identity-safe API object — safe in dependency arrays. */
const api = Object.freeze({ push, dismiss, dismissAll })

/**
 * Toast controls. The returned object never changes identity, so it can be
 * used directly inside effects and callbacks.
 * @returns {{ push: typeof push, dismiss: typeof dismiss, dismissAll: typeof dismissAll }}
 */
export function useToast() {
  return api
}

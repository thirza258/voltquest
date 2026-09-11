// Shared class maps for the VoltQuest UI kit.
//
// Tailwind's JIT scans source text, so every class name here must be a complete
// literal string. Never build one by interpolation (`bg-${tone}-50` emits nothing).

/** @typedef {'neutral'|'brand'|'success'|'warning'|'danger'|'volt'|'info'} Tone */

/** Tone -> soft badge / callout surface (bg + text + border). */
export const TONE_SOFT = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  volt: 'bg-volt-50 text-volt-700 border-volt-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
}

/** Tone -> solid fill, used for progress bars, dots and meters. */
export const TONE_FILL = {
  neutral: 'bg-slate-400',
  brand: 'bg-brand-600',
  success: 'bg-emerald-600',
  warning: 'bg-amber-500',
  danger: 'bg-rose-600',
  volt: 'bg-volt-400',
  info: 'bg-blue-600',
}

/** Tone -> foreground text colour for values and icons. */
export const TONE_TEXT = {
  neutral: 'text-ink',
  brand: 'text-brand-700',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-rose-700',
  volt: 'text-volt-700',
  info: 'text-blue-700',
}

/** Tone -> icon colour on a soft surface. */
export const TONE_ICON = {
  neutral: 'text-slate-500',
  brand: 'text-brand-600',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-rose-600',
  volt: 'text-volt-600',
  info: 'text-blue-600',
}

/** Focus ring applied to every interactive element (DESIGN.md). */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1'

/** 150 ms hover/press transition. */
export const TRANSITION = 'transition-colors duration-150'

/** Control heights, all >= 28 px hit targets. */
export const CONTROL_SIZE = {
  sm: 'h-7 px-2 text-xxs',
  md: 'h-8 px-3 text-sm',
  lg: 'h-10 px-4 text-sm',
}

/** Uppercase micro-label used for panel titles and field labels. */
export const LABEL_CLASS = 'text-xxs font-semibold uppercase tracking-wide text-slate-500'

/**
 * Join class names, dropping falsy entries.
 * @param {...(string|false|null|undefined)} parts
 * @returns {string}
 */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

/**
 * True when the viewer asked for reduced motion. Safe in jsdom and SSR, where
 * `matchMedia` may be missing entirely.
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Clamp a number into a range, tolerating non-finite input.
 * @param {number} n
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(n, min, max) {
  const v = Number(n)
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, v))
}

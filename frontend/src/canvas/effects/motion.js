import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** Synchronous check of the OS "reduce motion" preference; false outside a browser. */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return Boolean(window.matchMedia(QUERY).matches)
  } catch {
    return false
  }
}

/** React hook mirroring `prefers-reduced-motion`, live-updating when the OS setting changes. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    let media
    try {
      media = window.matchMedia(QUERY)
    } catch {
      return undefined
    }
    const onChange = (event) => setReduced(Boolean(event.matches))
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

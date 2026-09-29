import { useEffect, useState } from 'react'

/**
 * Observed content box of an element, or `fallback` where ResizeObserver or layout is unavailable
 * (jsdom, first paint). IDE layouts treat the fallback as a wide desktop.
 */
export function useElementSize(ref, fallback = { width: 1440, height: 900 }) {
  const [size, setSize] = useState(fallback)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => {
      const box = element.getBoundingClientRect()
      if (box.width > 0 && box.height > 0) setSize(previous => previous.width === Math.round(box.width) && previous.height === Math.round(box.height) ? previous : { width: Math.round(box.width), height: Math.round(box.height) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}

export function useElementWidth(ref, fallback = 1440) {
  return useElementSize(ref, { width: fallback, height: 900 }).width
}

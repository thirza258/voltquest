import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PITCH } from '../engine/components/breadboard.js'
import { FALLBACK_SIZE, ZOOM_STEP, clampZoom, docBounds, fitView, screenToWorld, zoomAround } from './geometry.js'

const mod = (a, n) => ((a % n) + n) % n

/** Minimum on-screen dot spacing before the background grid is dropped (too dense to read). */
const MIN_GRID_PX = 9

/**
 * Live size of a DOM element. Falls back to {@link FALLBACK_SIZE} before the first real measurement
 * (jsdom and the first paint both report a zero rect); `measured` says whether the size is real.
 * @param {{ current: HTMLElement|null }} ref
 * @returns {{ width: number, height: number, measured: boolean }}
 */
export function useElementSize(ref) {
  const [size, setSize] = useState({ ...FALLBACK_SIZE, measured: false })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => {
      const rect = el.getBoundingClientRect?.()
      const w = Math.round(rect?.width ?? 0)
      const h = Math.round(rect?.height ?? 0)
      const next = w > 1 && h > 1 ? { width: w, height: h, measured: true } : { ...FALLBACK_SIZE, measured: false }
      setSize((prev) =>
        prev.width === next.width && prev.height === next.height && prev.measured === next.measured ? prev : next,
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return size
}

/**
 * Pan/zoom state for the canvas. Fits the document on mount, on the first real measurement and
 * whenever `doc.boardMode` changes — ordinary edits never yank the view.
 *
 * @param {{ doc: object, ref: { current: HTMLElement|null } }} params
 * @returns {{ view, size, setView, panBy, zoomBy, zoomAt, zoomTo, fit, actualSize, toWorld }}
 */
export function useViewport({ doc, ref }) {
  const size = useElementSize(ref)
  const [view, setView] = useState(() => ({ x: 0, y: 0, zoom: 1 }))

  const latest = useRef({ doc, size, view })
  latest.current = { doc, size, view }

  const fit = useCallback(() => {
    const { doc: d, size: s } = latest.current
    setView(fitView(docBounds(d), s))
  }, [])

  const fitted = useRef({ mode: undefined, measured: false })
  const boardMode = doc?.boardMode ?? null
  useEffect(() => {
    if (fitted.current.mode === boardMode && (fitted.current.measured || !size.measured)) return
    fitted.current = { mode: boardMode, measured: size.measured }
    fit()
  }, [boardMode, size.measured, fit])

  /** Pan by a screen-space delta. */
  const panBy = useCallback((dx, dy) => {
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }, [])

  /** Multiply the zoom, anchored at a screen point (defaults to the viewport centre). */
  const zoomBy = useCallback((factor, screenPt) => {
    setView((v) => {
      const { size: s } = latest.current
      const at = screenPt ?? { x: s.width / 2, y: s.height / 2 }
      return zoomAround(v, v.zoom * factor, at)
    })
  }, [])

  /** Set an absolute zoom, anchored at a screen point (defaults to the viewport centre). */
  const zoomTo = useCallback((zoom, screenPt) => {
    setView((v) => {
      const { size: s } = latest.current
      const at = screenPt ?? { x: s.width / 2, y: s.height / 2 }
      return zoomAround(v, clampZoom(zoom), at)
    })
  }, [])

  const zoomIn = useCallback((screenPt) => zoomBy(ZOOM_STEP, screenPt), [zoomBy])
  const zoomOut = useCallback((screenPt) => zoomBy(1 / ZOOM_STEP, screenPt), [zoomBy])
  const actualSize = useCallback(() => zoomTo(1), [zoomTo])

  /** Screen (svg-local) point → world point, using the current view. */
  const toWorld = useCallback((pt) => screenToWorld(latest.current.view, pt), [])

  return useMemo(
    () => ({ view, size, setView, panBy, zoomBy, zoomIn, zoomOut, zoomTo, fit, actualSize, toWorld }),
    [view, size, panBy, zoomBy, zoomIn, zoomOut, zoomTo, fit, actualSize, toWorld],
  )
}

/**
 * Faint 24 px dot grid locked to world coordinates. Drawn outside the viewport group (as a screen-space
 * pattern) so it costs one rect no matter how far the user zooms out.
 */
export const CanvasGrid = React.memo(function CanvasGrid({ view, width, height, patternId }) {
  const step = PITCH * view.zoom
  if (step < MIN_GRID_PX) return null
  return (
    <g data-canvas-grid>
      <defs>
        <pattern
          id={patternId}
          width={step}
          height={step}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${mod(view.x - step / 2, step)} ${mod(view.y - step / 2, step)})`}
        >
          <circle cx={step / 2} cy={step / 2} r={1.1} fill="#E2E8F0" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill={`url(#${patternId})`} />
    </g>
  )
})

/** The pan/zoom group: everything in world coordinates lives inside it. */
export const Viewport = React.memo(function Viewport({ view, children }) {
  return (
    <g data-viewport transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
      {children}
    </g>
  )
})

export default Viewport

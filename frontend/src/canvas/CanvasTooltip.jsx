import React from 'react'

/** Estimated tooltip box, used only to keep it inside the canvas (no measure pass, no reflow). */
const EST_WIDTH = 220
const EST_HEIGHT = 84
const GAP = 14

/** @typedef Hover {{ x:number, y:number, title:string, subtitle?:string, lines?:{label:string,value:string}[] }} */

/**
 * Floating HTML tooltip for whatever the pointer is over (hole, component or wire). Rendered outside
 * the SVG so PNG exports stay clean, and never interactive so it cannot steal the pointer.
 *
 * @param {{ hover: Hover|null, size: { width:number, height:number } }} props
 */
export const CanvasTooltip = React.memo(function CanvasTooltip({ hover, size }) {
  if (!hover) return null
  const width = size?.width ?? EST_WIDTH * 2
  const height = size?.height ?? EST_HEIGHT * 2
  const below = hover.y < EST_HEIGHT + GAP
  const left = Math.min(Math.max(hover.x, EST_WIDTH / 2 + 4), Math.max(width - EST_WIDTH / 2 - 4, EST_WIDTH / 2 + 4))
  const top = below ? Math.min(hover.y + GAP, height - 8) : Math.max(hover.y - GAP, 8)
  return (
    <div
      data-canvas-tooltip
      role="tooltip"
      className="pointer-events-none absolute z-20 max-w-[240px] rounded-md border border-slate-700 bg-slate-900/95 px-2.5 py-1.5 text-xxs text-slate-100 shadow-lg"
      style={{ left, top, transform: `translate(-50%, ${below ? '0' : '-100%'})` }}
    >
      <div className="font-semibold">{hover.title}</div>
      {hover.subtitle ? <div className="text-slate-400">{hover.subtitle}</div> : null}
      {(hover.lines ?? []).length > 0 ? (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          {hover.lines.map((line) => (
            <React.Fragment key={`${line.label}-${line.value}`}>
              <dt className="text-slate-400">{line.label}</dt>
              <dd className="tabular text-right font-medium text-slate-50">{line.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}
    </div>
  )
})

export default CanvasTooltip

import React, { useMemo } from 'react'
import { getBoard } from '../engine/boards/index.js'
import { rendererFor, placeComponents } from './ComponentLayer.jsx'
import { WireLayer } from './WireLayer.jsx'
import { placementOf, samePlacement } from './geometry.js'

const GHOST_OPACITY = 0.35

function sameWire(a, b) {
  return (a.from === b.from && a.to === b.to) || (a.from === b.to && a.to === b.from)
}

/**
 * Ghost doc minus everything the real document already has: a component with the same id at the
 * same placement, or a wire between the same two terminals, is considered done and hidden.
 */
export function ghostDiff(ghost, doc) {
  if (!ghost) return null
  const real = new Map((doc?.components ?? []).map((c) => [c.id, c]))
  const components = (ghost.components ?? []).filter((gc) => {
    const rc = real.get(gc.id)
    return !(rc && rc.type === gc.type && samePlacement(placementOf(rc), placementOf(gc)))
  })
  const wires = (ghost.wires ?? []).filter((gw) => !(doc?.wires ?? []).some((rw) => sameWire(rw, gw)))
  return { ...ghost, components, wires }
}

/**
 * Tier-3 hint overlay: the solution circuit drawn translucent and dashed, never interactive.
 * Renderers receive `ghost` so they can simplify their artwork.
 */
export const GhostLayer = React.memo(function GhostLayer({ ghost, doc, palette = 'standard' }) {
  const remaining = useMemo(() => ghostDiff(ghost, doc), [ghost, doc])
  const placed = useMemo(() => (remaining ? placeComponents(remaining) : []), [remaining])
  if (!remaining || (placed.length === 0 && remaining.wires.length === 0)) return null
  return (
    <g data-layer="ghost" data-export-hide className="vq-ghost" opacity={GHOST_OPACITY} style={{ pointerEvents: 'none' }}>
      {placed.map(({ comp, def, origin }) => {
        const Renderer = rendererFor(comp.type)
        return (
          <g key={comp.id} data-ghost-component={comp.id} transform={`translate(${origin.x} ${origin.y}) rotate(${comp.rotation ?? 0})`}>
            <Renderer
              comp={comp}
              def={def}
              state={undefined}
              peripheral={undefined}
              control={undefined}
              running={false}
              powered={false}
              selected={false}
              ghost
              damaged={false}
              burntPins={undefined}
              board={def.category === 'mcu' ? getBoard(comp.type) : null}
              tone={0}
              onControl={undefined}
              interactive={false}
            />
          </g>
        )
      })}
      <WireLayer doc={remaining} selectedIds={null} palette={palette} ghost />
    </g>
  )
})

export default GhostLayer

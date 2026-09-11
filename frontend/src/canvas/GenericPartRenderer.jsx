import React from 'react'
import { PITCH } from '../engine/components/breadboard.js'
import { localBodyBox } from './geometry.js'

const PAD_RADIUS = PITCH * 0.22

/**
 * Fallback renderer used when `RENDERERS[type]` is missing: a labelled rounded box covering the
 * footprint body plus a pad at every footprint pin (§4.2 local coordinates, pin i at (dx·P, dy·P)).
 * Accepts the full renderer prop set (§10) but only uses what a generic box can show.
 */
function GenericPartRendererImpl({ comp, def, state, ghost, damaged, powered, selected }) {
  const box = localBodyBox(def)
  const pins = def?.footprint?.pins ?? []
  const label = def?.name ?? comp?.type ?? 'part'
  const blown = state?.state === 'blown' || damaged
  const fill = blown ? '#FEE2E2' : ghost ? '#F8FAFC' : '#F1F5F9'
  const stroke = blown ? '#F43F5E' : selected ? '#0D9488' : '#94A3B8'
  const showValue = !!state && powered !== false && Number.isFinite(state.current)
  return (
    <g data-generic-renderer={comp?.type ?? ''}>
      <rect
        x={box.x + 2}
        y={box.y + 2}
        width={Math.max(box.width - 4, 4)}
        height={Math.max(box.height - 4, 4)}
        rx={4}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.25}
        strokeDasharray={ghost ? '4 3' : undefined}
      />
      <text
        x={box.x + box.width / 2}
        y={box.y + box.height / 2 + (showValue ? -2 : 4)}
        textAnchor="middle"
        fontSize={Math.min(11, Math.max(8, box.width / 6))}
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fill="#334155"
        style={{ pointerEvents: 'none' }}
      >
        {label}
      </text>
      {showValue && (
        <text
          x={box.x + box.width / 2}
          y={box.y + box.height / 2 + 9}
          textAnchor="middle"
          fontSize={8}
          fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
          fill="#64748B"
          style={{ pointerEvents: 'none' }}
        >
          {`${(state.current * 1000).toFixed(1)} mA`}
        </text>
      )}
      {pins.map((pin) => (
        <g key={pin.id} data-generic-pin={pin.id}>
          <circle cx={pin.dx * PITCH} cy={pin.dy * PITCH} r={PAD_RADIUS} fill="#CBD5E1" stroke="#64748B" strokeWidth={1} />
          <title>{pin.label ?? pin.id}</title>
        </g>
      ))}
    </g>
  )
}

/** Fallback part renderer (memoised like every renderer per §10). */
export const GenericPartRenderer = React.memo(GenericPartRendererImpl)
export default GenericPartRenderer

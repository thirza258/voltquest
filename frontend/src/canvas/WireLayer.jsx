import React, { useMemo } from 'react'
import { terminalPosition } from '../engine/components/breadboard.js'
import * as registry from '../engine/components/registry.js'
import { wirePathD, wireHex, wireOutlineHex, WIRE_STROKE, WIRE_OUTLINE, WIRE_HIT_STROKE } from './wirePath.js'

/** World positions of every wire endpoint in the document (null entries for dangling terminals). */
export function wireEndpoints(doc) {
  const out = new Map()
  for (const w of doc?.wires ?? []) {
    for (const ref of [w.from, w.to]) {
      if (out.has(ref)) continue
      let pos = null
      try {
        pos = terminalPosition(doc, ref, registry)
      } catch {
        pos = null
      }
      out.set(ref, pos)
    }
  }
  return out
}

/** One wire: outline + coloured core + wide invisible hit stroke; hover thickening via CSS. */
export const WireItem = React.memo(function WireItem({ wire, from, to, selected, palette, ghost }) {
  const d = wirePathD(from, to)
  const hex = wireHex(wire.color, palette)
  const outline = wireOutlineHex(wire.color, palette)
  return (
    <g
      data-wire-id={wire.id}
      data-wire-color={wire.color}
      className={`vq-wire${selected ? ' vq-wire-selected' : ''}`}
      style={{ cursor: ghost ? undefined : 'pointer' }}
    >
      {selected && (
        <path d={d} fill="none" stroke="#14B8A6" strokeOpacity={0.35} strokeWidth={WIRE_STROKE + 8} strokeLinecap="round" data-export-hide />
      )}
      <path
        className="vq-wire-outline"
        d={d}
        fill="none"
        stroke={outline}
        strokeWidth={WIRE_STROKE + 2 * WIRE_OUTLINE}
        strokeLinecap="round"
        strokeDasharray={ghost ? '7 5' : undefined}
      />
      <path
        className="vq-wire-core"
        d={d}
        fill="none"
        stroke={hex}
        strokeWidth={WIRE_STROKE}
        strokeLinecap="round"
        strokeDasharray={ghost ? '7 5' : undefined}
      />
      <circle cx={from.x} cy={from.y} r={3.2} fill={outline} />
      <circle cx={to.x} cy={to.y} r={3.2} fill={outline} />
      {!ghost && (
        <path
          className="vq-wire-hit"
          data-export-hide
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={WIRE_HIT_STROKE}
          strokeLinecap="round"
          style={{ pointerEvents: 'stroke' }}
        />
      )}
    </g>
  )
})

/** The rubber-band wire while drawing: dashed until it snaps onto a terminal. */
export const WireDraft = React.memo(function WireDraft({ draft, palette }) {
  if (!draft) return null
  const end = draft.targetPos ?? draft.cursor
  if (!end) return null
  const d = wirePathD(draft.fromPos, end)
  const hex = wireHex(draft.color, palette)
  const snapped = !!draft.target && draft.target !== draft.from
  return (
    <g data-wire-draft={snapped ? 'snapped' : 'free'} data-export-hide style={{ pointerEvents: 'none' }}>
      <path d={d} fill="none" stroke={wireOutlineHex(draft.color, palette)} strokeWidth={WIRE_STROKE + 2} strokeLinecap="round" strokeOpacity={0.7} strokeDasharray={snapped ? undefined : '8 6'} />
      <path d={d} fill="none" stroke={hex} strokeWidth={WIRE_STROKE} strokeLinecap="round" strokeOpacity={0.85} strokeDasharray={snapped ? undefined : '8 6'} />
      <circle cx={draft.fromPos.x} cy={draft.fromPos.y} r={5} fill="none" stroke={hex} strokeWidth={2} />
      {snapped && <circle cx={end.x} cy={end.y} r={6} fill="none" stroke="#0D9488" strokeWidth={2} />}
    </g>
  )
})

/** All wires of a document (also used for the ghost blueprint with `ghost`). */
export const WireLayer = React.memo(function WireLayer({ doc, selectedIds, palette = 'standard', ghost = false }) {
  const endpoints = useMemo(() => wireEndpoints(doc), [doc])
  const selected = useMemo(() => new Set(selectedIds ?? []), [selectedIds])
  return (
    <g data-layer={ghost ? 'ghost-wires' : 'wires'}>
      {(doc?.wires ?? []).map((wire) => {
        const from = endpoints.get(wire.from)
        const to = endpoints.get(wire.to)
        if (!from || !to) return null
        return <WireItem key={wire.id} wire={wire} from={from} to={to} selected={selected.has(wire.id)} palette={palette} ghost={ghost} />
      })}
    </g>
  )
})

export default WireLayer

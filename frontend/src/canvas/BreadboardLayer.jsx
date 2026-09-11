import React, { useMemo } from 'react'
import { PITCH, BREADBOARD_TYPES, boardSize, boardHoles, holesInStrip } from '../engine/components/breadboard.js'

/** Breadboard body colours per cosmetic skin (DESIGN.md: classic is the default). */
export const SKINS = {
  classic: { body: '#F5F5F4', border: '#D6D3D1', channel: '#E7E5E4', text: '#78716C' },
  mint: { body: '#ECFDF5', border: '#A7F3D0', channel: '#D1FAE5', text: '#047857' },
  slate: { body: '#E2E8F0', border: '#94A3B8', channel: '#CBD5E1', text: '#475569' },
}

const FONT = 'Inter, ui-sans-serif, system-ui, sans-serif'
const HOLE_RADIUS = 4.2
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
const LETTER_Y = { a: 4, b: 5, c: 6, d: 7, e: 8, f: 11, g: 12, h: 13, i: 14, j: 15 }

function rowNumbers(rows) {
  const out = [1]
  for (let r = 5; r <= rows; r += 5) out.push(r)
  return out
}

function railLine(holes, y, color) {
  if (holes.length === 0) return null
  const x1 = holes[0].x - PITCH * 0.5
  const x2 = holes[holes.length - 1].x + PITCH * 0.5
  return <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
}

/**
 * Static artwork of one breadboard type (body, channel, numbers, letters, rail lines, holes) in
 * board-local coordinates. Memoised on (type, skin) so it renders once per type.
 */
const BoardArt = React.memo(function BoardArt({ type, skin }) {
  const colors = SKINS[skin] ?? SKINS.classic
  const { width, height } = boardSize(type)
  const rows = BREADBOARD_TYPES[type]?.rows ?? 30
  const holes = useMemo(() => boardHoles(type), [type])
  const rails = useMemo(
    () => ({
      TP: holesInStrip(type, 'TP'),
      TN: holesInStrip(type, 'TN'),
      BN: holesInStrip(type, 'BN'),
      BP: holesInStrip(type, 'BP'),
    }),
    [type],
  )
  const numbers = rowNumbers(rows)
  const rowX = (r) => (1.5 + (r - 1)) * PITCH
  const rightX = (rows + 1.25) * PITCH
  return (
    <g data-breadboard-art={type}>
      <rect x={0} y={0} width={width} height={height} rx={8} fill={colors.body} stroke={colors.border} strokeWidth={1.5} />
      <rect x={PITCH * 0.5} y={9 * PITCH} width={width - PITCH} height={PITCH} rx={3} fill={colors.channel} />
      {railLine(rails.TP, 0.5 * PITCH, '#F43F5E')}
      {railLine(rails.TN, 2.5 * PITCH, '#3B82F6')}
      {railLine(rails.BN, 16.5 * PITCH, '#3B82F6')}
      {railLine(rails.BP, 18.5 * PITCH, '#F43F5E')}
      <g fontFamily={FONT} fontSize={9} fill={colors.text} style={{ pointerEvents: 'none' }}>
        <text x={0.75 * PITCH} y={1 * PITCH + 3} textAnchor="middle" fill="#E11D48" fontWeight={700}>+</text>
        <text x={0.75 * PITCH} y={2 * PITCH + 3} textAnchor="middle" fill="#2563EB" fontWeight={700}>−</text>
        <text x={0.75 * PITCH} y={17 * PITCH + 3} textAnchor="middle" fill="#2563EB" fontWeight={700}>−</text>
        <text x={0.75 * PITCH} y={18 * PITCH + 3} textAnchor="middle" fill="#E11D48" fontWeight={700}>+</text>
        {numbers.map((r) => (
          <React.Fragment key={r}>
            <text x={rowX(r)} y={3 * PITCH + 3} textAnchor="middle">{r}</text>
            <text x={rowX(r)} y={16 * PITCH + 3} textAnchor="middle">{r}</text>
          </React.Fragment>
        ))}
        {LETTERS.map((l) => (
          <React.Fragment key={l}>
            <text x={0.75 * PITCH} y={LETTER_Y[l] * PITCH + 3} textAnchor="middle">{l}</text>
            <text x={rightX} y={LETTER_Y[l] * PITCH + 3} textAnchor="middle">{l}</text>
          </React.Fragment>
        ))}
      </g>
      <g data-breadboard-holes={type} fill="#1E293B" stroke="#64748B" strokeWidth={1.6}>
        {holes.map((h) => (
          <circle key={h.name} data-hole={h.name} cx={h.x} cy={h.y} r={HOLE_RADIUS} />
        ))}
      </g>
    </g>
  )
})

/** One breadboard instance positioned in world space. */
export const BreadboardLayer = React.memo(function BreadboardLayer({ board, skin = 'classic' }) {
  return (
    <g data-breadboard-id={board.id} transform={`translate(${board.x} ${board.y})`}>
      <BoardArt type={board.type} skin={skin} />
    </g>
  )
})

/**
 * The single hover overlay: a rounded rect covering every hole of the hovered strip. The colour comes
 * from a CSS class (main strip soft green, + rail red, − rail blue) — no per-hole handlers or state.
 */
export const StripHighlight = React.memo(function StripHighlight({ board, strip }) {
  const holes = useMemo(() => (board && strip ? holesInStrip(board.type, strip) : []), [board, strip])
  if (!board || holes.length === 0) return null
  const xs = holes.map((h) => h.x)
  const ys = holes.map((h) => h.y)
  const pad = PITCH * 0.42
  const x = board.x + Math.min(...xs) - pad
  const y = board.y + Math.min(...ys) - pad
  const width = Math.max(...xs) - Math.min(...xs) + 2 * pad
  const height = Math.max(...ys) - Math.min(...ys) + 2 * pad
  const rail = holes[0].rail
  const cls = rail === '+' ? 'vq-strip vq-strip-plus' : rail === '-' ? 'vq-strip vq-strip-minus' : 'vq-strip vq-strip-main'
  return (
    <rect
      data-strip-highlight={strip}
      data-export-hide
      className={cls}
      x={x}
      y={y}
      width={width}
      height={height}
      rx={pad}
      style={{ pointerEvents: 'none' }}
    />
  )
})

export default BreadboardLayer

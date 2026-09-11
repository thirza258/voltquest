import { memo } from 'react'

/** Crack polylines in unit coordinates (0..1), radiating from just off-centre. */
const CRACKS = [
  [[0.48, 0.5], [0.36, 0.28], [0.3, 0.06]],
  [[0.48, 0.5], [0.66, 0.38], [0.86, 0.32], [0.98, 0.14]],
  [[0.48, 0.5], [0.44, 0.72], [0.26, 0.96]],
  [[0.48, 0.5], [0.62, 0.7], [0.8, 0.92]],
  [[0.36, 0.28], [0.18, 0.34], [0.04, 0.3]],
  [[0.66, 0.38], [0.72, 0.58]],
]

/**
 * Gray tint + jagged cracks drawn over a damaged part's body. Position it with a parent transform.
 * @param {{ width: number, height: number, x?: number, y?: number, rx?: number }} props
 */
function CrackOverlayImpl({ width, height, x = 0, y = 0, rx = 3 }) {
  const w = Math.max(1, Number(width) || 0)
  const h = Math.max(1, Number(height) || 0)
  const toPoints = (line) => line.map(([px, py]) => `${(x + px * w).toFixed(1)},${(y + py * h).toFixed(1)}`).join(' ')
  return (
    <g aria-hidden="true" pointerEvents="none" data-crack-overlay>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill="#0F172A" opacity={0.18} />
      {CRACKS.map((line, i) => (
        <g key={i}>
          <polyline points={toPoints(line)} fill="none" stroke="#F8FAFC" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
          <polyline points={toPoints(line)} fill="none" stroke="#1F2937" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
    </g>
  )
}

export const CrackOverlay = memo(CrackOverlayImpl)
export default CrackOverlay

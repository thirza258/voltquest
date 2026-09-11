import { memo, useEffect } from 'react'
import { useReducedMotion } from './motion.js'

export const SMOKE_DURATION_MS = 1600
const SMOKE_REDUCED_MS = 500

/** Four gray puffs with staggered start offsets (local px, relative to the origin of the effect). */
const PUFFS = [
  { dx: 0, dy: 0, r: 7, delay: 0, drift: -4 },
  { dx: -8, dy: -6, r: 5.5, delay: 120, drift: -12 },
  { dx: 9, dy: -4, r: 6, delay: 220, drift: 10 },
  { dx: 2, dy: -14, r: 4.5, delay: 340, drift: 3 },
]

const KEYFRAMES = `
@keyframes vq-smoke-rise {
  0%   { transform: translate(0, 0) scale(0.6); opacity: 0; }
  15%  { opacity: 0.85; }
  100% { transform: translate(var(--vq-drift, 0px), -46px) scale(1.9); opacity: 0; }
}
@keyframes vq-smoke-fade {
  0%   { opacity: 0.8; }
  100% { opacity: 0; }
}
.vq-smoke-puff { transform-box: fill-box; transform-origin: center; will-change: transform, opacity; }
@media (prefers-reduced-motion: reduce) {
  .vq-smoke-puff { animation-name: vq-smoke-fade !important; }
}
`

/**
 * Comedic "magic smoke" puff for a blown part. Plays once (≈1.6 s; 0.5 s fade under reduced motion),
 * then calls `onDone` so the parent can unmount it.
 * @param {{ x: number, y: number, onDone?: () => void }} props
 */
function SmokePuffImpl({ x, y, onDone }) {
  const reduced = useReducedMotion()
  const durationMs = reduced ? SMOKE_REDUCED_MS : SMOKE_DURATION_MS

  useEffect(() => {
    if (typeof onDone !== 'function') return undefined
    const timer = setTimeout(onDone, durationMs)
    return () => clearTimeout(timer)
  }, [onDone, durationMs])

  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true" pointerEvents="none" data-effect="smoke-puff">
      <defs>
        <style>{KEYFRAMES}</style>
      </defs>
      {PUFFS.map((puff, i) => (
        <circle
          key={i}
          className="vq-smoke-puff"
          cx={puff.dx}
          cy={puff.dy}
          r={puff.r}
          fill="#94A3B8"
          opacity={0}
          style={{
            '--vq-drift': `${puff.drift}px`,
            animation: `${reduced ? 'vq-smoke-fade' : 'vq-smoke-rise'} ${durationMs - puff.delay}ms ease-out ${reduced ? 0 : puff.delay}ms forwards`,
          }}
        />
      ))}
    </g>
  )
}

export const SmokePuff = memo(SmokePuffImpl)
export default SmokePuff

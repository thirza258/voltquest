import { memo, useEffect } from 'react'
import { useReducedMotion } from './motion.js'

export const SPARKLE_DURATION_MS = 900

const KEYFRAMES = `
@keyframes vq-sparkle-twinkle {
  0%   { transform: scale(0.3) rotate(0deg); opacity: 0; }
  40%  { transform: scale(1.1) rotate(20deg); opacity: 1; }
  100% { transform: scale(0.6) rotate(45deg); opacity: 0; }
}
.vq-sparkle { transform-box: fill-box; transform-origin: center; will-change: transform, opacity; }
@media (prefers-reduced-motion: reduce) {
  .vq-sparkle { animation: none !important; opacity: 0.9 !important; }
}
`

/** Four-point star path centred on the origin with the given radius. */
function starPath(r) {
  const inner = r * 0.28
  return [
    `M 0 ${-r}`, `L ${inner} ${-inner}`, `L ${r} 0`, `L ${inner} ${inner}`,
    `L 0 ${r}`, `L ${-inner} ${inner}`, `L ${-r} 0`, `L ${-inner} ${-inner}`, 'Z',
  ].join(' ')
}

/**
 * Small amber sparkle (success / "aha" moments). Loops when `loop` is set, otherwise plays once and calls `onDone`.
 * @param {{ x: number, y: number, size?: number, color?: string, loop?: boolean, onDone?: () => void }} props
 */
function SparkleImpl({ x, y, size = 8, color = '#F59E0B', loop = false, onDone }) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (loop || typeof onDone !== 'function') return undefined
    const timer = setTimeout(onDone, reduced ? 300 : SPARKLE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [loop, onDone, reduced])

  const twinkle = (durationMs, delayMs) =>
    reduced ? 'none' : `vq-sparkle-twinkle ${durationMs}ms ease-in-out ${delayMs}ms ${loop ? 'infinite' : '1 forwards'}`
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true" pointerEvents="none" data-effect="sparkle">
      <defs>
        <style>{KEYFRAMES}</style>
      </defs>
      <path className="vq-sparkle" d={starPath(size)} fill={color} opacity={reduced ? 0.9 : 0} style={{ animation: twinkle(SPARKLE_DURATION_MS, 0) }} />
      <path
        className="vq-sparkle"
        d={starPath(size * 0.45)}
        transform={`translate(${size * 1.1} ${-size * 0.9})`}
        fill={color}
        opacity={reduced ? 0.7 : 0}
        style={{ animation: twinkle(Math.round(SPARKLE_DURATION_MS * 0.8), 120) }}
      />
    </g>
  )
}

export const Sparkle = memo(SparkleImpl)
export default Sparkle

import React from 'react'

/**
 * Stylesheet for the canvas-local `vq-*` classes used by BreadboardLayer, WireLayer, GhostLayer and
 * the hint/badge overlays. It lives inside the `<svg>` (not `index.css`, which the canvas does not own)
 * so a serialised export carries the same look. Colours follow docs/DESIGN.md.
 */
export const CANVAS_CSS = `
.vq-strip { pointer-events: none; }
.vq-strip-main { fill: rgba(16,185,129,0.25); }
.vq-strip-plus { fill: rgba(244,63,94,0.18); }
.vq-strip-minus { fill: rgba(59,130,246,0.18); }

.vq-pin { fill: transparent; }
.vq-pin:hover { fill: rgba(20,184,166,0.40); }

.vq-wire .vq-wire-core, .vq-wire .vq-wire-outline { transition: stroke-width 90ms ease-out; }
.vq-wire:hover .vq-wire-core { stroke-width: 5.5; }
.vq-wire:hover .vq-wire-outline { stroke-width: 8; }
.vq-wire-selected .vq-wire-core { stroke-width: 5.5; }
.vq-wire-selected .vq-wire-outline { stroke-width: 8; }

.vq-ghost { pointer-events: none; }

@keyframes vq-hint-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
.vq-hint { animation: vq-hint-pulse 1.4s ease-in-out infinite; }

@keyframes vq-badge-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}
.vq-badge-pulse { transform-box: fill-box; transform-origin: center; animation: vq-badge-pulse 1.6s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .vq-hint { animation: none; opacity: 0.85; }
  .vq-badge-pulse { animation: none; }
  .vq-wire .vq-wire-core, .vq-wire .vq-wire-outline { transition: none; }
}
`

/** Injects {@link CANVAS_CSS} once per canvas, inside the SVG so exports keep the styling. */
export const CanvasStyles = React.memo(function CanvasStyles() {
  return <style>{CANVAS_CSS}</style>
})

export default CanvasStyles

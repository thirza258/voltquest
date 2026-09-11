import React, { useMemo } from 'react'
import { PITCH, terminalPosition } from '../engine/components/breadboard.js'
import * as registry from '../engine/components/registry.js'
import { normalizeHighlights } from './geometry.js'

const RING_RADIUS = PITCH * 0.6
const BOX_PAD = 5

/** The MCU component of a document, or null. */
function mcuComponent(doc) {
  for (const comp of doc?.components ?? []) {
    if (registry.getDef(comp.type)?.category === 'mcu') return comp
  }
  return null
}

/**
 * Turn the `highlights` prop into drawable targets.
 *
 * Accepts every tier-2 shape in play: `terminals` and `componentIds` (CONTRACTS §10) plus `mcuPins`
 * and `componentTypes` (QUEST_SCHEMA tier-2 targets), as one object or an array of them.
 *
 * @param {object|object[]|null} highlights
 * @param {object} doc CircuitDoc
 * @returns {{ rings: {key,x,y}[], boxes: {key,x,y,width,height}[] }}
 */
export function resolveHighlightTargets(highlights, doc) {
  const rings = []
  const boxes = []
  const seen = new Set()
  const addRing = (key, pos) => {
    if (!pos || seen.has(`r:${key}`)) return
    seen.add(`r:${key}`)
    rings.push({ key, x: pos.x, y: pos.y })
  }
  const addBox = (key, comp) => {
    if (!comp || seen.has(`b:${key}`)) return
    let bounds = null
    try {
      bounds = registry.componentBounds(comp, doc)
    } catch {
      bounds = null
    }
    if (!bounds || !(bounds.width > 0) || !(bounds.height > 0)) return
    seen.add(`b:${key}`)
    boxes.push({ key, ...bounds })
  }

  const byId = new Map((doc?.components ?? []).map((c) => [c.id, c]))
  let mcu
  let mcuPins

  for (const group of normalizeHighlights(highlights)) {
    for (const ref of group.terminals ?? []) {
      let pos = null
      try {
        pos = terminalPosition(doc, ref, registry)
      } catch {
        pos = null
      }
      addRing(ref, pos)
    }
    for (const id of group.componentIds ?? []) addBox(id, byId.get(id))
    for (const type of group.componentTypes ?? []) {
      for (const comp of doc?.components ?? []) if (comp.type === type) addBox(comp.id, comp)
    }
    const pinNames = group.mcuPins ?? []
    if (pinNames.length > 0) {
      if (mcu === undefined) {
        mcu = mcuComponent(doc)
        try {
          mcuPins = mcu ? registry.resolvePins(mcu, doc).pins : null
        } catch {
          mcuPins = null
        }
      }
      for (const pin of pinNames) {
        const entry = mcuPins?.[pin]
        if (entry) addRing(`${mcu.id}:${pin}`, entry)
      }
    }
  }

  return { rings, boxes }
}

/**
 * Tier-2 hint overlay: a pulsing brand outline around the highlighted terminals and components.
 * Purely decorative — never interactive and never exported to PNG.
 */
export const HighlightLayer = React.memo(function HighlightLayer({ highlights, doc }) {
  const targets = useMemo(() => resolveHighlightTargets(highlights, doc), [highlights, doc])
  if (targets.rings.length === 0 && targets.boxes.length === 0) return null
  return (
    <g data-layer="highlights" data-export-hide className="vq-hint" style={{ pointerEvents: 'none' }}>
      {targets.rings.map((t) => (
        <circle
          key={`ring-${t.key}`}
          data-highlight-terminal={t.key}
          cx={t.x}
          cy={t.y}
          r={RING_RADIUS}
          fill="rgba(20,184,166,0.14)"
          stroke="#14B8A6"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {targets.boxes.map((b) => (
        <rect
          key={`box-${b.key}`}
          data-highlight-component={b.key}
          x={b.x - BOX_PAD}
          y={b.y - BOX_PAD}
          width={b.width + 2 * BOX_PAD}
          height={b.height + 2 * BOX_PAD}
          rx={7}
          fill="none"
          stroke="#14B8A6"
          strokeWidth={2.5}
          strokeDasharray="7 5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
})

export default HighlightLayer

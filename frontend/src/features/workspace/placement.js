import { boardHoles } from '../../engine/components/breadboard.js'
import { componentBounds, createComponent, defaultMcuPlacement, getDef, resolvePins } from '../../engine/components/registry.js'

/** Find a usable click-to-add location without overlapping existing device pins or bodies. */
export function placementForPart(type, doc) {
  const def = getDef(type)
  if (!def) return null
  if (def.category === 'mcu') return defaultMcuPlacement(type, doc.boardMode)
  if (def.mount === 'free') return { position: { x: 0, y: -600 } }
  const used = new Set(doc.components.flatMap(c => Object.values(resolvePins(c, doc).pins).map(p => p.hole).filter(Boolean)))
  const boxes = doc.components.map(c => componentBounds(c, doc))
  for (const bb of doc.breadboards) for (const hole of boardHoles(bb.type)) {
    if (hole.kind !== 'main') continue
    const placement = { anchor: { board: bb.id, hole: hole.name }, rotation: 0 }
    const candidate = createComponent(type, placement)
    const pins = resolvePins(candidate, doc)
    if (!pins.valid || Object.values(pins.pins).some(p => used.has(p.hole))) continue
    const box = componentBounds(candidate, doc)
    if (boxes.some(b => box.x < b.x + b.width && box.x + box.width > b.x && box.y < b.y + b.height && box.y + box.height > b.y)) continue
    return placement
  }
  return null
}

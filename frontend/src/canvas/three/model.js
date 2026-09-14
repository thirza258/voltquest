import { PITCH, boardSize, holeWorldPosition, terminalPosition } from '../../engine/components/breadboard.js'
import { getDef, resolvePins } from '../../engine/components/registry.js'

export const BOARD_TOP = 0.7
export const WIRE_COLORS = { red: '#EF4444', black: '#1F2937', yellow: '#F59E0B', green: '#10B981', blue: '#3B82F6', orange: '#F97316', white: '#E5E7EB', purple: '#8B5CF6' }

/** Project the existing world onto the X/Z worktop; one unit is one hole pitch. */
export function worldPoint(point, height = BOARD_TOP) {
  return [point.x / PITCH, height, point.y / PITCH]
}

/** Pure geometry adapter. No second circuit document, guessed pin locations or simulation. */
export function circuitModel(doc) {
  const boards = (doc.breadboards ?? []).map(board => ({ ...board, width: boardSize(board.type).width / PITCH, depth: boardSize(board.type).height / PITCH }))
  const parts = doc.components.flatMap(comp => {
    const def = getDef(comp.type)
    const origin = comp.anchor ? holeWorldPosition(doc, comp.anchor.board, comp.anchor.hole) : comp.position
    if (!def || !origin) return []
    const height = comp.anchor ? BOARD_TOP : 0
    return [{ comp, def, origin: worldPoint(origin, height), rotation: -(comp.rotation ?? 0) * Math.PI / 180,
      pins: Object.entries(resolvePins(comp, doc).pins).map(([name, pin]) => ({ name, ...pin, point: worldPoint(pin, height + (def.category === 'mcu' ? 0.8 : 0.04)) })) }]
  })
  const headers = new Map(parts.flatMap(part => part.pins.map(pin => [`${part.comp.id}:${pin.name}`, pin.point])))
  const endpoint = ref => {
    if (headers.has(ref)) return headers.get(ref)
    const point = terminalPosition(doc, ref)
    return point ? worldPoint(point, BOARD_TOP + 0.04) : null
  }
  const wires = doc.wires.flatMap((wire, index) => {
    const from = endpoint(wire.from), to = endpoint(wire.to)
    if (!from || !to) return []
    const distance = Math.hypot(to[0] - from[0], to[2] - from[2])
    const lift = Math.max(from[1], to[1]) + Math.min(6, Math.max(1.4, distance * 0.18)) + (index % 4) * 0.18
    // Explicit bends stay in world coordinates; straight jumpers arc above their two exact terminals.
    const bends = (wire.points ?? []).map(point => worldPoint(point, lift))
    const points = [from, [from[0], lift, from[2]], ...bends, [to[0], lift, to[2]], to]
    return [{ ...wire, points, color: WIRE_COLORS[wire.color] ?? WIRE_COLORS.red }]
  })
  return { boards, parts, wires }
}

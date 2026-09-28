import { SCENE_SIZE } from './fixtures.js'
import { createRandom } from './results.js'

/**
 * Deterministic drawings of the workbench scenes. The same shape list renders as React SVG in
 * the studio and as standalone .svg files in course packs, so boxes drawn in either place use
 * identical pixel coordinates (640 × 480, no scaling).
 */

function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] }

/** @returns {{ tag: string, attrs: object, text?: string }[]} */
export function sceneShapes(scene) {
  const { width, height } = SCENE_SIZE
  const shapes = [{ tag: 'rect', attrs: { x: 0, y: 0, width, height, fill: '#E9DCC7' } }]
  for (let x = 40; x < width; x += 40) shapes.push({ tag: 'line', attrs: { x1: x, y1: 0, x2: x, y2: height, stroke: '#DCCBB0', 'stroke-width': 1 } })
  for (let y = 40; y < height; y += 40) shapes.push({ tag: 'line', attrs: { x1: 0, y1: y, x2: width, y2: y, stroke: '#DCCBB0', 'stroke-width': 1 } })
  const random = createRandom(scene.seed)
  for (let i = 0; i < 7; i++) shapes.push({ tag: 'circle', attrs: { cx: Math.round(random() * width), cy: Math.round(random() * height), r: 3 + Math.round(random() * 3), fill: '#A8A29E' } })
  for (const polygon of scene.panels) {
    const [p0, p1, p2, p3] = polygon
    shapes.push({ tag: 'polygon', attrs: { points: polygon.map(point => point.join(',')).join(' '), fill: '#1E3A8A', stroke: '#93C5FD', 'stroke-width': 3 } })
    for (const t of [1 / 3, 2 / 3]) {
      const [a, b] = [lerp(p0, p1, t), lerp(p3, p2, t)], [c, d] = [lerp(p0, p3, t), lerp(p1, p2, t)]
      shapes.push({ tag: 'line', attrs: { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#60A5FA', 'stroke-width': 2 } })
      shapes.push({ tag: 'line', attrs: { x1: c[0], y1: c[1], x2: d[0], y2: d[1], stroke: '#60A5FA', 'stroke-width': 2 } })
    }
  }
  for (const box of scene.boxes) {
    const { x, y, width: w, height: h } = box
    if (box.label === 'Drone') {
      const cx = x + w / 2, cy = y + h / 2, radius = Math.min(w, h) * 0.16
      const rotors = [[x + w * 0.16, y + h * 0.2], [x + w * 0.84, y + h * 0.2], [x + w * 0.16, y + h * 0.8], [x + w * 0.84, y + h * 0.8]]
      for (const [rx, ry] of rotors) shapes.push({ tag: 'line', attrs: { x1: cx, y1: cy, x2: rx, y2: ry, stroke: '#334155', 'stroke-width': 8, 'stroke-linecap': 'round' } })
      for (const [rx, ry] of rotors) {
        shapes.push({ tag: 'circle', attrs: { cx: rx, cy: ry, r: radius, fill: '#CBD5E1', 'fill-opacity': 0.75, stroke: '#475569', 'stroke-width': 3 } })
        shapes.push({ tag: 'circle', attrs: { cx: rx, cy: ry, r: 5, fill: '#0F172A' } })
      }
      shapes.push({ tag: 'rect', attrs: { x: cx - w * 0.14, y: cy - h * 0.13, width: w * 0.28, height: h * 0.26, rx: 10, fill: '#0F766E', stroke: '#134E4A', 'stroke-width': 3 } })
      shapes.push({ tag: 'circle', attrs: { cx, cy, r: 6, fill: '#FDE68A' } })
    } else if (box.label === 'Battery') {
      shapes.push({ tag: 'rect', attrs: { x, y, width: w - 10, height: h, rx: 8, fill: '#374151', stroke: '#111827', 'stroke-width': 3 } })
      shapes.push({ tag: 'rect', attrs: { x: x + w - 10, y: y + h * 0.3, width: 10, height: h * 0.4, fill: '#9CA3AF' } })
      shapes.push({ tag: 'rect', attrs: { x: x + 6, y: y + 6, width: (w - 22) * 0.55, height: h - 12, rx: 4, fill: '#F59E0B' } })
      shapes.push({ tag: 'text', attrs: { x: x + w * 0.68, y: y + h / 2 + 6, 'font-size': 16, 'font-family': 'sans-serif', fill: '#F9FAFB', 'text-anchor': 'middle' }, text: 'LiPo' })
    } else {
      shapes.push({ tag: 'rect', attrs: { x, y, width: w, height: h - 10, rx: 4, fill: '#15803D', stroke: '#14532D', 'stroke-width': 3 } })
      shapes.push({ tag: 'circle', attrs: { cx: x + w / 2, cy: y + (h - 10) / 2, r: Math.min(w, h) * 0.2, fill: '#E5E7EB', stroke: '#6B7280', 'stroke-width': 2 } })
      for (let i = 0; i < 4; i++) shapes.push({ tag: 'line', attrs: { x1: x + w * (0.2 + i * 0.2), y1: y + h - 10, x2: x + w * (0.2 + i * 0.2), y2: y + h, stroke: '#D4D4D8', 'stroke-width': 3 } })
    }
  }
  return shapes
}

const escapeText = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const format = value => typeof value === 'number' ? String(Math.round(value * 100) / 100) : escapeText(value)
/** Standalone SVG file with explicit pixel size, so Label Studio reads 640 × 480 as the natural size. */
export function sceneSvg(scene) {
  const { width, height } = SCENE_SIZE
  const body = sceneShapes(scene).map(shape => {
    const attrs = Object.entries(shape.attrs).map(([key, value]) => `${key}="${format(value)}"`).join(' ')
    return shape.text ? `  <${shape.tag} ${attrs}>${escapeText(shape.text)}</${shape.tag}>` : `  <${shape.tag} ${attrs}/>`
  }).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <title>VoltQuest workbench ${scene.id}</title>\n${body}\n</svg>\n`
}

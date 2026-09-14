import { CanvasTexture, SRGBColorSpace } from 'three'
import { PITCH, boardHoles } from '../../engine/components/breadboard.js'

/** Locally painted labels and hole patterns; no remote models, fonts or textures. */
export function paintSurface({ kind, type, label, color = '#293342', def, data, segments, width, depth }) {
  const canvas = document.createElement('canvas')
  const scale = Math.min(48, 2048 / Math.max(width, depth))
  canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(depth * scale)
  const ctx = canvas.getContext('2d')
  ctx.scale(canvas.width / width, canvas.height / depth)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  function text(value, x, y, size, fill) {
    ctx.fillStyle = fill; ctx.font = `500 ${size}px monospace`; ctx.fillText(value, x, y)
  }
  if (kind === 'breadboard') {
    ctx.fillStyle = '#f5f5f4'; ctx.fillRect(0, 0, width, depth)
    for (const [y, color] of [[0.45, '#ef4444'], [2.6, '#3b82f6'], [16.4, '#3b82f6'], [18.6, '#ef4444']]) {
      ctx.fillStyle = color; ctx.fillRect(1, y, width - 2, 0.06)
      text(color === '#ef4444' ? '+' : '−', 0.55, y, 0.45, color)
    }
    for (const hole of boardHoles(type)) {
      const x = hole.x / PITCH, y = hole.y / PITCH
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(x - 0.16, y - 0.16, 0.32, 0.32)
      ctx.fillStyle = '#475569'; ctx.fillRect(x - 0.105, y - 0.105, 0.21, 0.21)
    }
    for (let row = 1; row <= (type === 'full' ? 63 : 30); row++) {
      if (row !== 1 && row % 5) continue
      for (const y of [3.2, 15.8]) text(String(row), row + 0.5, y, 0.33, '#64748b')
    }
    for (const [i, letter] of [...'abcdefghij'].entries()) text(letter, 0.55, i < 5 ? i + 4 : i + 6, 0.36, '#64748b')
  } else if (kind === 'controller') {
    const offset = def.mount === 'board' ? 0.5 : 0
    for (const pin of def.footprint.pins) {
      ctx.save()
      ctx.translate(pin.dx + offset, pin.dy + offset + (pin.dy < depth / 2 ? 0.8 : -0.8))
      ctx.rotate(-Math.PI / 2)
      text(pin.label, 0, 0, Math.min(0.32, depth / 12), '#f1f5f9')
      ctx.restore()
    }
    text(label, width / 2, depth * 0.78, Math.min(width / Math.max(12, label.length), 0.7), '#f8fafc')
  } else if (kind === 'display') {
    ctx.fillStyle = '#102635'; ctx.fillRect(0, 0, width, depth)
    if (type === 'oled_ssd1306' && data?.pixels) {
      ctx.fillStyle = '#a5f3fc'
      for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
        if ((data.pixels[Math.floor(y / 8) * 128 + x] ?? 0) & (1 << (y % 8))) ctx.fillRect(x / 128 * width, y / 64 * depth, width / 128, depth / 64)
      }
    } else if (type === 'seven_segment') {
      const bars = { a: [0.3, 0.15, 0.4, 0.07], b: [0.7, 0.2, 0.07, 0.27], c: [0.7, 0.53, 0.07, 0.27], d: [0.3, 0.8, 0.4, 0.07], e: [0.23, 0.53, 0.07, 0.27], f: [0.23, 0.2, 0.07, 0.27], g: [0.3, 0.47, 0.4, 0.07], dp: [0.85, 0.8, 0.05, 0.07] }
      for (const [name, [x, y, w, h]] of Object.entries(bars)) { ctx.fillStyle = segments?.[`seg_${name}`] ? '#ef4444' : '#334155'; ctx.fillRect(x * width, y * depth, w * width, h * depth) }
    } else if (data?.lines && data.backlight !== false) {
      data.lines.slice(0, 2).forEach((line, i) => text(String(line), width / 2, depth * (0.3 + i * 0.4), width / 12, '#a3e635'))
    } else text(label, width / 2, depth / 2, width / Math.max(10, label.length), '#94a3b8')
  } else {
    ctx.fillStyle = color; ctx.fillRect(0, 0, width, depth)
    text(label, width / 2, depth / 2, Math.min(depth * 0.4, width / Math.max(5, label.length) * 1.4), '#f8fafc')
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

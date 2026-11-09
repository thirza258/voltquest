import { useRef, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { formatIp } from '../../engine/network/addr.js'
import { DEVICE_TYPES, hostAddressing, isHost } from '../../engine/network/model.js'
import { buildNetwork, lineUp } from '../../engine/network/sim.js'

export const CANVAS = { width: 760, height: 420 }
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))

/** Simple original glyphs: a round router, a flat switch, a monitor and a tower. */
function Glyph({ type, selected }) {
  const stroke = selected ? '#0f766e' : '#334155', fill = selected ? '#ccfbf1' : '#ffffff'
  if (type === 'router') return <g><circle r="21" fill={fill} stroke={stroke} strokeWidth="2.5" /><path d="M-10 -4 L0 -12 L10 -4 M-10 4 L0 12 L10 4" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></g>
  if (type === 'switch') return <g><rect x="-28" y="-14" width="56" height="28" rx="5" fill={fill} stroke={stroke} strokeWidth="2.5" /><path d="M-16 -4 H14 M10 -8 L14 -4 L10 0 M16 4 H-14 M-10 0 L-14 4 L-10 8" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>
  if (type === 'server') return <g><rect x="-15" y="-22" width="30" height="44" rx="3" fill={fill} stroke={stroke} strokeWidth="2.5" /><path d="M-9 -12 H9 M-9 -4 H9 M-9 4 H9" stroke={stroke} strokeWidth="2" strokeLinecap="round" /><circle cx="0" cy="14" r="2" fill={stroke} /></g>
  return <g><rect x="-20" y="-17" width="40" height="27" rx="3" fill={fill} stroke={stroke} strokeWidth="2.5" /><path d="M-6 16 H6 M0 10 V16" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" /></g>
}

/**
 * The cabled topology. Link ends show green when that port is up and red when it is down. In
 * simulation mode the link of the selected event is highlighted with an envelope near its target.
 * Devices can be dragged when `onMove` is given; selection works by click, tap or keyboard.
 */
export default function TopologyCanvas({ project, state, selectedId, onSelect, onMove, highlight = null, label }) {
  const { t } = useI18n()
  const svg = useRef(null)
  const [drag, setDrag] = useState(null)
  const net = buildNetwork(project, state)
  const position = device => drag?.id === device.id ? drag : device
  const byId = new Map(project.devices.map(device => [device.id, device]))
  // Read-only labs frame their devices; the editable bench keeps the whole canvas so positions stay put.
  const viewBox = (() => {
    if (onMove || !project.devices.length) return `0 0 ${CANVAS.width} ${CANVAS.height}`
    const xs = project.devices.map(device => device.x), ys = project.devices.map(device => device.y)
    let x0 = Math.min(...xs) - 70, y0 = Math.min(...ys) - 50
    const width = Math.max(Math.max(...xs) + 70 - x0, 360), height = Math.max(Math.max(...ys) + 70 - y0, 200)
    x0 -= (width - (Math.max(...xs) + 70 - x0)) / 2
    y0 -= (height - (Math.max(...ys) + 70 - y0)) / 2
    return `${Math.round(x0)} ${Math.round(y0)} ${Math.round(width)} ${Math.round(height)}`
  })()
  function point(event) {
    const matrix = svg.current?.getScreenCTM?.()
    if (!matrix) return null
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: clamp(p.x, 30, CANVAS.width - 30), y: clamp(p.y, 30, CANVAS.height - 30) }
  }
  function start(event, device) {
    onSelect(device.id)
    if (!onMove || event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ id: device.id, x: device.x, y: device.y, moved: false })
  }
  function move(event) {
    if (!drag) return
    const p = point(event)
    if (p) setDrag(previous => ({ ...previous, ...p, moved: true }))
  }
  function end() {
    if (drag?.moved) onMove(drag.id, drag.x, drag.y)
    setDrag(null)
  }
  return <svg ref={svg} viewBox={viewBox} role="group" aria-label={label} className={`block h-auto w-full select-none rounded-lg border border-line bg-white ${onMove ? 'touch-none' : ''}`}
    style={{ backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '24px 24px' }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
    {project.links.map(link => {
      const a = byId.get(link.a.device), b = byId.get(link.b.device)
      if (!a || !b) return null
      const pa = position(a), pb = position(b)
      const lit = highlight && ((highlight.fromId === a.id && highlight.toId === b.id) || (highlight.fromId === b.id && highlight.toId === a.id))
      const end = (from, to, device, port) => {
        const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1
        return { x: from.x + dx / length * 34, y: from.y + dy / length * 34, lx: from.x + dx / length * 50, ly: from.y + dy / length * 50 + 3, up: lineUp(net, device, port), port }
      }
      const ends = [end(pa, pb, a, link.a.port), end(pb, pa, b, link.b.port)]
      return <g key={link.id}>
        <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={lit ? '#0d9488' : '#64748b'} strokeWidth={lit ? 5 : 2} />
        {ends.map(item => <g key={item.port}>
          <circle cx={item.x} cy={item.y} r="5" fill={item.up ? '#16a34a' : '#dc2626'} stroke="#fff" strokeWidth="1.5"><title>{`${item.port}: ${item.up ? t('up') : t('down')}`}</title></circle>
          <text x={item.lx} y={item.ly} textAnchor="middle" fill="#475569" stroke="#fff" strokeWidth="3" paintOrder="stroke" className="hidden text-[10px] sm:inline">{item.port}</text>
        </g>)}
        {lit && (() => {
          const target = highlight.toId === a.id ? pa : pb, source = highlight.toId === a.id ? pb : pa
          const x = source.x + (target.x - source.x) * 0.65, y = source.y + (target.y - source.y) * 0.65
          return <g transform={`translate(${x} ${y})`}><rect x="-11" y="-8" width="22" height="16" rx="2" fill="#fef3c7" stroke="#b45309" strokeWidth="1.5" /><path d="M-11 -8 L0 1 L11 -8" fill="none" stroke="#b45309" strokeWidth="1.5" /></g>
        })()}
      </g>
    })}
    {project.devices.map(device => {
      const p = position(device), selected = device.id === selectedId
      const me = isHost(device) ? hostAddressing(device) : null
      return <g key={device.id} transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={0} aria-pressed={selected}
        aria-label={`${device.name}, ${t(DEVICE_TYPES[device.type].label)}`} className="cursor-pointer focus:outline-none"
        onPointerDown={event => start(event, device)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(device.id) } }}>
        {selected && <circle r="32" fill="none" stroke="#14b8a6" strokeWidth="2" strokeDasharray="4 3" />}
        <Glyph type={device.type} selected={selected} />
        <text y="40" textAnchor="middle" fontWeight="600" fill="#0f172a" stroke="#fff" strokeWidth="4" paintOrder="stroke" className="text-[18px] sm:text-[13px]">{device.name}</text>
        {me?.ip !== null && me?.ip !== undefined && <text y="56" textAnchor="middle" fill="#475569" stroke="#fff" strokeWidth="3" paintOrder="stroke" className="text-[14px] sm:text-[10px]">{formatIp(me.ip)}</text>}
      </g>
    })}
  </svg>
}

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { formatIp } from '../../engine/network/addr.js'
import { DEVICE_TYPES, freePorts, hostAddressing, isHost } from '../../engine/network/model.js'
import { buildNetwork, lineUp } from '../../engine/network/sim.js'

export const CANVAS = { width: 780, height: 440 }
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))

/** Authentic Cisco Packet Tracer visual device glyphs */
function Glyph({ type, selected, isGhost = false }) {
  const opacity = isGhost ? 0.6 : 1

  if (type === 'router') {
    return (
      <g opacity={opacity} className="transition-transform duration-150">
        {/* Router 3D base cylinder */}
        <ellipse cx="0" cy="5" rx="27" ry="17" fill="#0369a1" />
        <path d="M-27 0 V5 C-27 16 27 16 27 5 V0 Z" fill="#0284c7" stroke="#0369a1" strokeWidth="1.5" />
        {/* Router top disc */}
        <ellipse
          cx="0"
          cy="0"
          rx="27"
          ry="15"
          fill={selected ? '#38bdf8' : '#0284c7'}
          stroke={selected ? '#0284c7' : '#0369a1'}
          strokeWidth="2"
        />
        {/* Cisco 4-way crossed arrows */}
        {/* West arrow (pointing in) */}
        <path d="M -18 0 L -8 0 M -12 -3 L -8 0 L -12 3" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* East arrow (pointing in) */}
        <path d="M 18 0 L 8 0 M 12 -3 L 8 0 L 12 3" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* North arrow (pointing out) */}
        <path d="M 0 0 L 0 -8 M -3 -5 L 0 -8 L 3 -5" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* South arrow (pointing out) */}
        <path d="M 0 0 L 0 8 M -3 5 L 0 8 L 3 5" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Center hub dot */}
        <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
      </g>
    )
  }

  if (type === 'switch') {
    return (
      <g opacity={opacity} className="transition-transform duration-150">
        {/* Switch 3D base / shadow */}
        <rect x="-30" y="-12" width="60" height="30" rx="4" fill="#0369a1" />
        {/* Switch front face */}
        <rect x="-30" y="4" width="60" height="14" rx="2" fill="#075985" />
        {/* Switch top face */}
        <rect
          x="-30"
          y="-14"
          width="60"
          height="20"
          rx="3"
          fill={selected ? '#38bdf8' : '#0284c7'}
          stroke={selected ? '#0284c7' : '#0369a1'}
          strokeWidth="1.5"
        />
        {/* Opposing directional arrows (Catalyst switch symbol) */}
        <path d="M -20 -6 H 18 M 13 -9 L 18 -6 L 13 -3" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 20 -2 H -18 M -13 -5 L -18 -2 L -13 1" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Front panel port LED lights */}
        {[-22, -16, -10, -4, 4, 10, 16, 22].map((x, i) => (
          <circle key={i} cx={x} cy="11" r="1.3" fill="#22c55e" />
        ))}
      </g>
    )
  }

  if (type === 'server') {
    return (
      <g opacity={opacity} className="transition-transform duration-150">
        {/* Server tower rack chassis */}
        <rect
          x="-16"
          y="-25"
          width="32"
          height="50"
          rx="3"
          fill={selected ? '#e0f2fe' : '#1e293b'}
          stroke={selected ? '#0284c7' : '#0f172a'}
          strokeWidth="2"
        />
        {/* Server drive bays */}
        <rect x="-12" y="-19" width="24" height="7" rx="1" fill="#334155" stroke="#475569" strokeWidth="1" />
        <circle cx="-8" cy="-15.5" r="1.2" fill="#22c55e" />
        <rect x="-12" y="-9" width="24" height="7" rx="1" fill="#334155" stroke="#475569" strokeWidth="1" />
        <circle cx="-8" cy="-5.5" r="1.2" fill="#22c55e" />
        <rect x="-12" y="1" width="24" height="7" rx="1" fill="#334155" stroke="#475569" strokeWidth="1" />
        <circle cx="-8" cy="4.5" r="1.2" fill="#eab308" />
        {/* Front ventilation grille */}
        <line x1="-12" y1="13" x2="12" y2="13" stroke="#475569" strokeWidth="1.5" strokeDasharray="2 2" />
        <line x1="-12" y1="17" x2="12" y2="17" stroke="#475569" strokeWidth="1.5" strokeDasharray="2 2" />
        {/* Power button */}
        <circle cx="0" cy="21" r="1.5" fill="#38bdf8" />
      </g>
    )
  }

  // PC / Laptop
  return (
    <g opacity={opacity} className="transition-transform duration-150">
      {/* PC Monitor */}
      <rect
        x="-24"
        y="-22"
        width="32"
        height="24"
        rx="2"
        fill="#334155"
        stroke={selected ? '#0284c7' : '#1e293b'}
        strokeWidth="1.5"
      />
      {/* Screen display */}
      <rect x="-21" y="-19" width="26" height="18" rx="1" fill={selected ? '#38bdf8' : '#0284c7'} />
      {/* Desktop window mock on screen */}
      <rect x="-18" y="-17" width="10" height="7" rx="1" fill="#ffffff" opacity="0.8" />
      {/* Monitor Stand & Base */}
      <path d="M-10 2 H-6 V6 H-14 V8 H-2 V6 H-10 Z" fill="#64748b" />
      {/* Tower CPU unit beside monitor */}
      <rect x="12" y="-22" width="13" height="30" rx="2" fill="#475569" stroke="#334155" strokeWidth="1.5" />
      <line x1="15" y1="-17" x2="22" y2="-17" stroke="#94a3b8" strokeWidth="1.5" />
      <line x1="15" y1="-13" x2="22" y2="-13" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="18.5" cy="-7" r="1.5" fill="#22c55e" />
      <rect x="15" y="-1" width="7" height="6" fill="#1e293b" />
    </g>
  )
}

/**
 * Cisco Packet Tracer Topology Canvas:
 * - Dotted schematic blueprint grid
 * - Interactive cabling with live rubber-band wire & port selector menu
 * - Device placement by click
 * - Triangular green/red link status indicators
 * - Dragging, selection, and deletion
 */
export default function TopologyCanvas({
  project,
  state,
  selectedId,
  onSelect,
  onMove,
  highlight = null,
  label,
  activeTool = 'select',
  placingType = null,
  onAddDevice = null,
  onConnect = null,
  onRemoveCable = null,
  onRemoveDevice = null,
  onOpenDeviceModal = null,
}) {
  const { t } = useI18n()
  const svg = useRef(null)
  const [drag, setDrag] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [cableSource, setCableSource] = useState(null) // { device, port }
  const [portMenu, setPortMenu] = useState(null) // { device, x, y, isTarget }
  const [inspectPop, setInspectPop] = useState(null) // device id

  const net = buildNetwork(project, state)
  const position = device => drag?.id === device.id ? drag : device
  const byId = new Map(project.devices.map(device => [device.id, device]))

  // ViewBox bounds
  const viewBox = (() => {
    if (onMove || !project.devices.length) return `0 0 ${CANVAS.width} ${CANVAS.height}`
    const xs = project.devices.map(device => device.x), ys = project.devices.map(device => device.y)
    let x0 = Math.min(...xs) - 80, y0 = Math.min(...ys) - 60
    const width = Math.max(Math.max(...xs) + 80 - x0, 380), height = Math.max(Math.max(...ys) + 80 - y0, 220)
    x0 -= (width - (Math.max(...xs) + 80 - x0)) / 2
    y0 -= (height - (Math.max(...ys) + 80 - y0)) / 2
    return `${Math.round(x0)} ${Math.round(y0)} ${Math.round(width)} ${Math.round(height)}`
  })()

  function getPoint(event) {
    const matrix = svg.current?.getScreenCTM?.()
    if (!matrix) return null
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: clamp(p.x, 30, CANVAS.width - 30), y: clamp(p.y, 30, CANVAS.height - 30) }
  }

  // Handle pointer down on device
  function handleDevicePointerDown(event, device) {
    if (event.button !== 0 && event.button !== undefined) return

    // 1. DELETE TOOL
    if (activeTool === 'delete') {
      event.stopPropagation()
      if (onRemoveDevice) onRemoveDevice(device.id)
      return
    }

    // 2. INSPECT TOOL
    if (activeTool === 'inspect') {
      event.stopPropagation()
      setInspectPop(inspectPop === device.id ? null : device.id)
      return
    }

    // 3. CABLING TOOL
    if (activeTool === 'cable' || activeTool === 'auto-cable') {
      event.stopPropagation()
      if (!cableSource) {
        // First device
        if (activeTool === 'auto-cable') {
          const free = freePorts(project, device)
          if (free.length > 0) {
            setCableSource({ device, port: free[0] })
          }
        } else {
          // Open port menu for source device
          setPortMenu({ device, x: device.x, y: device.y, isTarget: false })
        }
      } else if (cableSource.device.id !== device.id) {
        // Second device
        if (activeTool === 'auto-cable') {
          const free = freePorts(project, device)
          if (free.length > 0 && onConnect) {
            onConnect(
              { device: cableSource.device.id, port: cableSource.port },
              { device: device.id, port: free[0] }
            )
            setCableSource(null)
          }
        } else {
          // Open port menu for target device
          setPortMenu({ device, x: device.x, y: device.y, isTarget: true })
        }
      }
      return
    }

    // 4. SELECT / MOVE TOOL
    onSelect(device.id)
    if (onMove) {
      event.currentTarget.setPointerCapture?.(event.pointerId)
      setDrag({ id: device.id, x: device.x, y: device.y, moved: false })
    }
  }

  // Handle pointer move
  function handlePointerMove(event) {
    const p = getPoint(event)
    if (p) setMousePos(p)

    if (drag) {
      if (p) setDrag(previous => ({ ...previous, ...p, moved: true }))
    }
  }

  // Handle pointer up
  function handlePointerUp() {
    if (drag?.moved && onMove) {
      onMove(drag.id, drag.x, drag.y)
    }
    setDrag(null)
  }

  // Handle canvas background click
  function handleCanvasClick(event) {
    if (event.target === svg.current) {
      const p = getPoint(event)
      if (activeTool === 'place' && placingType && onAddDevice && p) {
        onAddDevice(placingType, p.x, p.y)
      } else {
        setCableSource(null)
        setPortMenu(null)
        setInspectPop(null)
      }
    }
  }

  // Close port menu or cancel cabling on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setCableSource(null)
        setPortMenu(null)
        setInspectPop(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="relative select-none">
      <svg
        ref={svg}
        viewBox={viewBox}
        role="group"
        aria-label={label}
        className={`block h-auto w-full select-none rounded-lg border border-slate-300 bg-white shadow-xs ${
          activeTool === 'cable' || activeTool === 'auto-cable' ? 'cursor-crosshair' : activeTool === 'delete' ? 'cursor-not-allowed' : activeTool === 'place' ? 'cursor-copy' : onMove ? 'touch-none' : ''
        }`}
        style={{
          backgroundImage: 'radial-gradient(#94a3b8 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
          backgroundColor: '#fafbfc',
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleCanvasClick}
      >
        {/* Subtle Logical Workspace Watermark in upper-right */}
        <text x={CANVAS.width - 15} y="22" textAnchor="end" className="text-[11px] font-mono font-bold tracking-widest text-slate-400 select-none pointer-events-none">
          LOGICAL WORKSPACE
        </text>

        {/* Existing Links / Cables */}
        {project.links.map(link => {
          const a = byId.get(link.a.device), b = byId.get(link.b.device)
          if (!a || !b) return null
          const pa = position(a), pb = position(b)
          const lit = highlight && ((highlight.fromId === a.id && highlight.toId === b.id) || (highlight.fromId === b.id && highlight.toId === a.id))

          // Calculate endpoint positions and angles for Packet Tracer status triangles
          const dx = pb.x - pa.x, dy = pb.y - pa.y, length = Math.hypot(dx, dy) || 1
          const angle = Math.atan2(dy, dx)

          const endA = {
            x: pa.x + (dx / length) * 36,
            y: pa.y + (dy / length) * 36,
            lx: pa.x + (dx / length) * 52,
            ly: pa.y + (dy / length) * 52 + 3,
            up: lineUp(net, a, link.a.port),
            port: link.a.port,
            angle: angle * (180 / Math.PI),
          }
          const endB = {
            x: pb.x - (dx / length) * 36,
            y: pb.y - (dy / length) * 36,
            lx: pb.x - (dx / length) * 52,
            ly: pb.y - (dy / length) * 52 + 3,
            up: lineUp(net, b, link.b.port),
            port: link.b.port,
            angle: (angle + Math.PI) * (180 / Math.PI),
          }

          return (
            <g
              key={link.id}
              className={activeTool === 'delete' ? 'cursor-pointer group' : ''}
              onClick={e => {
                if (activeTool === 'delete' && onRemoveCable) {
                  e.stopPropagation()
                  onRemoveCable(link.id)
                }
              }}
            >
              {/* Invisible thicker stroke for easy hover & click */}
              <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="transparent" strokeWidth="16" />

              {/* Cable line */}
              <line
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke={lit ? '#0d9488' : activeTool === 'delete' ? '#f43f5e' : '#334155'}
                strokeWidth={lit ? 4.5 : activeTool === 'delete' ? 3 : 2.5}
                strokeDasharray={link.type === 'crossover' ? '6 4' : undefined}
                className="transition-all"
              />

              {/* Packet Tracer triangular link lights at both ends */}
              {[endA, endB].map((item, idx) => (
                <g key={idx} transform={`translate(${item.x} ${item.y}) rotate(${item.angle})`}>
                  {/* Triangular status indicator pointing along the wire */}
                  <polygon
                    points="6,0 -4,-5 -4,5"
                    fill={item.up ? '#22c55e' : '#ef4444'}
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  >
                    <title>{`${item.port}: ${item.up ? t('up') : t('down')}`}</title>
                  </polygon>
                  {/* Circular backing for accessibility tests */}
                  <circle cx="0" cy="0" r="5" fill={item.up ? '#16a34a' : '#dc2626'} opacity="0">
                    <title>{`${item.port}: ${item.up ? t('up') : t('down')}`}</title>
                  </circle>
                </g>
              ))}

              {/* Port Name Labels next to indicators */}
              {[endA, endB].map((item, idx) => (
                <g key={`lbl-${idx}`}>
                  <rect
                    x={item.lx - 14}
                    y={item.ly - 7}
                    width="28"
                    height="12"
                    rx="2"
                    fill="#ffffff"
                    stroke="#cbd5e1"
                    strokeWidth="0.8"
                    opacity="0.9"
                  />
                  <text
                    x={item.lx}
                    y={item.ly + 2}
                    textAnchor="middle"
                    fill="#334155"
                    fontSize="8.5"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    {item.port}
                  </text>
                </g>
              ))}

              {/* Simulation Mode Envelope Packet Animation */}
              {lit && (() => {
                const target = highlight.toId === a.id ? pa : pb
                const source = highlight.toId === a.id ? pb : pa
                const x = source.x + (target.x - source.x) * 0.65
                const y = source.y + (target.y - source.y) * 0.65
                return (
                  <g transform={`translate(${x} ${y})`} className="animate-bounce">
                    <rect x="-13" y="-9" width="26" height="18" rx="2" fill="#fef3c7" stroke="#b45309" strokeWidth="1.5" />
                    <path d="M-13 -9 L0 2 L13 -9" fill="none" stroke="#b45309" strokeWidth="1.5" />
                  </g>
                )
              })()}
            </g>
          )
        })}

        {/* Dynamic Rubber-Band Cable Line while Cabling */}
        {cableSource && (
          <g className="pointer-events-none">
            <line
              x1={cableSource.device.x}
              y1={cableSource.device.y}
              x2={mousePos.x}
              y2={mousePos.y}
              stroke="#0284c7"
              strokeWidth="2.5"
              strokeDasharray="5 3"
            />
            <circle cx={mousePos.x} cy={mousePos.y} r="5" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
          </g>
        )}

        {/* Ghost Device Preview while placing a new device */}
        {activeTool === 'place' && placingType && (
          <g transform={`translate(${mousePos.x} ${mousePos.y})`} className="pointer-events-none">
            <Glyph type={placingType} selected={false} isGhost />
            <text y="38" textAnchor="middle" fontSize="12" fill="#0284c7" fontWeight="bold">
              Click to place
            </text>
          </g>
        )}

        {/* Devices */}
        {project.devices.map(device => {
          const p = position(device)
          const selected = device.id === selectedId
          const me = isHost(device) ? hostAddressing(device) : null

          return (
            <g
              key={device.id}
              transform={`translate(${p.x} ${p.y})`}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${device.name}, ${t(DEVICE_TYPES[device.type].label)}`}
              className={`cursor-pointer focus:outline-none ${activeTool === 'delete' ? 'hover:opacity-75' : ''}`}
              onPointerDown={event => handleDevicePointerDown(event, device)}
              onDoubleClick={() => onOpenDeviceModal?.(device.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(device.id)
                  onOpenDeviceModal?.(device.id)
                }
              }}
            >
              {/* Packet Tracer Device Selection Dotted Ring */}
              {selected && (
                <rect
                  x="-36"
                  y="-32"
                  width="72"
                  height="64"
                  rx="6"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              )}

              {/* Cisco Glyph */}
              <Glyph type={device.type} selected={selected} />

              {/* Device Name Label (Bold) */}
              <text
                y="38"
                textAnchor="middle"
                fontWeight="700"
                fill="#0f172a"
                stroke="#fff"
                strokeWidth="4"
                paintOrder="stroke"
                className="text-[14px] sm:text-[13px] font-sans"
              >
                {device.name}
              </text>

              {/* Subtitle / IP Address / Model */}
              <text
                y="52"
                textAnchor="middle"
                fill="#475569"
                stroke="#fff"
                strokeWidth="3"
                paintOrder="stroke"
                className="text-[11px] sm:text-[10px] font-mono"
              >
                {me?.ip !== null && me?.ip !== undefined
                  ? formatIp(me.ip)
                  : device.type === 'router'
                  ? '1941'
                  : device.type === 'switch'
                  ? '2960'
                  : ''}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Port Selection Popup Menu (Packet Tracer style) */}
      {portMenu && (
        <div
          className="absolute z-30 min-w-44 rounded-md border border-slate-700 bg-slate-900/95 p-2 shadow-xl text-white text-xs backdrop-blur-xs"
          style={{
            left: `${Math.min(portMenu.x + 20, CANVAS.width - 180)}px`,
            top: `${Math.min(portMenu.y - 20, CANVAS.height - 180)}px`,
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-1.5">
            <span className="font-semibold text-sky-400">
              {portMenu.device.name} Ports
            </span>
            <button
              type="button"
              className="text-slate-400 hover:text-white"
              onClick={() => setPortMenu(null)}
            >
              ✕
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {DEVICE_TYPES[portMenu.device.type].ports.map(port => {
              const connected = project.links.some(
                l =>
                  (l.a.device === portMenu.device.id && l.a.port === port) ||
                  (l.b.device === portMenu.device.id && l.b.port === port)
              )
              return (
                <button
                  key={port}
                  type="button"
                  disabled={connected}
                  onClick={() => {
                    if (portMenu.isTarget) {
                      if (onConnect && cableSource) {
                        onConnect(
                          { device: cableSource.device.id, port: cableSource.port },
                          { device: portMenu.device.id, port }
                        )
                        setCableSource(null)
                      }
                    } else {
                      setCableSource({ device: portMenu.device, port })
                    }
                    setPortMenu(null)
                  }}
                  className={`w-full flex items-center justify-between rounded px-2 py-1 font-mono text-[11px] transition-colors ${
                    connected
                      ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-800 text-slate-200 hover:bg-sky-700 hover:text-white cursor-pointer'
                  }`}
                >
                  <span>{port}</span>
                  <span className={`text-[9px] ${connected ? 'text-amber-500' : 'text-emerald-400'}`}>
                    {connected ? 'In Use' : 'Available'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Inspect Tables Popover */}
      {inspectPop && (() => {
        const d = project.devices.find(item => item.id === inspectPop)
        if (!d) return null
        return (
          <div
            className="absolute z-30 w-72 rounded-md border border-slate-700 bg-slate-900/95 p-3 shadow-xl text-white text-xs backdrop-blur-xs"
            style={{
              left: `${Math.min(d.x + 20, CANVAS.width - 300)}px`,
              top: `${Math.min(d.y - 20, CANVAS.height - 200)}px`,
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-2">
              <span className="font-bold text-sky-400 font-mono">{d.name} Summary</span>
              <button type="button" className="text-slate-400 hover:text-white" onClick={() => setInspectPop(null)}>✕</button>
            </div>
            <div className="space-y-2 font-mono text-[11px]">
              <div>
                <span className="text-slate-400">Type:</span> {DEVICE_TYPES[d.type].label}
              </div>
              {d.type === 'router' && (
                <div>
                  <span className="text-slate-400">Active Routes:</span> {(d.config.routes || []).length} static
                </div>
              )}
              {d.type === 'switch' && (
                <div>
                  <span className="text-slate-400">VLANs:</span> {Object.keys(d.config.vlans || {}).join(', ')}
                </div>
              )}
              {isHost(d) && (
                <div>
                  <span className="text-slate-400">IP Mode:</span> {d.config.ipMode} ({d.config.ip || 'none'})
                </div>
              )}
              <button
                type="button"
                className="w-full mt-2 rounded bg-sky-700 py-1 text-center font-sans font-semibold text-white hover:bg-sky-800"
                onClick={() => {
                  setInspectPop(null)
                  onOpenDeviceModal?.(d.id)
                }}
              >
                Configure Device →
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

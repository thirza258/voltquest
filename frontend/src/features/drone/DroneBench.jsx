import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { MOUNTS, compatibleLink, droneDef, mountOf, positionOf, portsOf } from '../../engine/drone/document.js'
import { clamp } from '../../engine/drone/config.js'
import { useDocumentStore } from '../../store/documentStore.js'
import { useSimStore } from '../../store/simStore.js'
import { Button, Tabs } from '../../ui/index.js'
import { newId } from '../../lib/ids.js'
import { addDronePart, commitDrone } from './DroneConfigurator.jsx'
import { DND_MIME } from '../../canvas/geometry.js'
import './drone.css'

const COLORS = { power: '#e11d48', phase: '#475569', signal: '#0d9488', i2c: '#6366f1', uart: '#d97706' }
const select = id => useDocumentStore.getState().select(id)
const sim = () => useSimStore.getState().sim

function Stick({ x, y, onChange, label, centerY = true }) {
  const { t } = useI18n(), active = useRef(null)
  function move(e) {
    if (active.current !== e.pointerId) return
    const r = e.currentTarget.getBoundingClientRect()
    onChange(clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1), clamp(1 - (e.clientY - r.top) / r.height * 2, -1, 1))
  }
  function release(e) { if (active.current !== e.pointerId) return; active.current = null; onChange(0, centerY ? 0 : y) }
  return <div className="drone-stick" role="group" aria-label={t(label)} onPointerDown={e => { active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e) }} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
    <span className="drone-stick-dot" style={{ left: `${(x + 1) * 50}%`, top: `${(1 - y) * 50}%` }} /><span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[10px] text-slate-600">{t(label)}</span>
  </div>
}

export function Transmitter({ state }) {
  const { t } = useI18n(), rc = state?.flight?.rc ?? { throttle: 0, roll: 0, pitch: 0, yaw: 0, arm: false, mode: 'hover', signal: true }
  const controls = useRef(rc); controls.current = rc
  const update = patch => { controls.current = { ...controls.current, ...patch }; sim()?.setSticks(patch) }
  useEffect(() => {
    const down = e => {
      if (e.target.closest('input,textarea,select,button,[contenteditable=true],.monaco-editor') || !e.target.closest('[data-drone-controls]')) return
      const keys = { ArrowUp: ['pitch', .1], ArrowDown: ['pitch', -.1], ArrowLeft: ['roll', -.1], ArrowRight: ['roll', .1], w: ['throttle', .05], s: ['throttle', -.05], a: ['yaw', -.1], d: ['yaw', .1] }
      const pair = keys[e.key]
      if (pair) { e.preventDefault(); update({ [pair[0]]: clamp(controls.current[pair[0]] + pair[1], pair[0] === 'throttle' ? 0 : -1, 1) }) }
      if (e.key === ' ') { e.preventDefault(); update({ arm: !controls.current.arm }) }
    }
    const blur = () => { sim()?.setSticks({ signal: false, arm: false, roll: 0, pitch: 0, yaw: 0 }) }
    window.addEventListener('keydown', down); window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('blur', blur) }
  }, [])
  return <div className="z-10 shrink-0 space-y-2 border-t border-line bg-white p-3" data-drone-controls tabIndex={0} aria-label={t('Virtual transmitter')}>
    <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant={rc.arm ? 'danger' : 'primary'} disabled={state?.status !== 'running'} onClick={() => update({ arm: !rc.arm })}>{rc.arm ? t('DISARM') : t('ARM')}</Button><label className="text-xs">{t('Flight mode')} <select className="rounded border border-line p-1.5" value={rc.mode} onChange={e => update({ mode: e.target.value })}>{['raw', 'rate', 'angle', 'hover'].map(m => <option value={m} key={m}>{t(m)}</option>)}</select></label><label className="flex gap-1 text-xs"><input type="checkbox" checked={rc.signal} onChange={e => update({ signal: e.target.checked })} />{t('Receiver signal')}</label></div>
    <div className="flex items-center justify-between gap-3"><Stick label="Throttle / yaw" x={rc.yaw} y={rc.throttle * 2 - 1} centerY={false} onChange={(yaw, y) => update({ yaw, throttle: (y + 1) / 2 })} /><div className="grid min-w-0 flex-1 grid-cols-2 gap-2">{['throttle', 'roll', 'pitch', 'yaw'].map(axis => <label className="min-w-0 text-[11px] capitalize text-slate-600" key={axis}>{t(axis)} {Math.round(rc[axis] * 100)}%<input className="block w-full accent-teal-600" aria-label={t(`RC ${axis}`)} type="range" min={axis === 'throttle' ? 0 : -1} max="1" step="0.01" value={rc[axis]} onChange={e => update({ [axis]: Number(e.target.value) })} /></label>)}</div><Stick label="Pitch / roll" x={rc.roll} y={rc.pitch} onChange={(roll, pitch) => update({ roll, pitch })} /></div>
    <p className="text-[11px] text-slate-600">{t('Run, keep throttle low for 1 second, then ARM. Hover mode: 50% holds height. W/S throttle, arrows pitch/roll, A/D yaw, Space arm when this panel has focus. Sliders also accept arrow keys.')}</p>
  </div>
}

function Wiring({ doc, readOnly }) {
  const { t } = useI18n(), [from, setFrom] = useState(''), [to, setTo] = useState(''), [kind, setKind] = useState('power'), [error, setError] = useState('')
  const ports = doc.components.flatMap(c => Object.keys(portsOf(c)).map(pin => `${c.id}:${pin}`))
  function add(e) { e.preventDefault(); if (!compatibleLink(doc, from, to, kind)) { setError('Choose two compatible connector sockets.'); return }
    try { commitDrone({ ...doc, links: [...doc.links, { id: newId('w'), from, to, kind, awg: 16, lengthM: .15 }] }); setError('') } catch (err) { setError(err.message) }
  }
  return <details className="border-t border-line bg-white p-3"><summary className="cursor-pointer text-sm font-medium">{t('Connector wiring')} · {doc.links.length}</summary>
    {!readOnly && <form onSubmit={add} className="mt-3 grid grid-cols-2 gap-2">{[['From socket', from, setFrom], ['To socket', to, setTo]].map(([label, value, setter]) => <label className="min-w-0 text-xs" key={label}>{t(label)}<select className="mt-1 w-full min-w-0 rounded border border-line p-1.5" value={value} onChange={e => setter(e.target.value)}><option value="">{t('Choose socket')}</option>{ports.map(p => <option key={p}>{p}</option>)}</select></label>)}<label className="text-xs">{t('Connector type')}<select className="ml-2 rounded border p-1.5" value={kind} onChange={e => setKind(e.target.value)}>{Object.keys(COLORS).map(k => <option key={k}>{k}</option>)}</select></label><Button size="sm" type="submit">{t('Connect')}</Button>{error && <p className="col-span-2 text-xs text-rose-700" role="alert">{t(error)}</p>}</form>}
    <div className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">{doc.links.map(l => <button className="block w-full break-all rounded border border-line p-1.5 text-left hover:bg-slate-50" key={l.id} onClick={() => select(l.id)}>{l.from} → {l.to} · {l.kind}</button>)}</div>
  </details>
}

export function DroneDiagram({ doc, state, selectedIds, ghost, readOnly }) {
  const { t } = useI18n(), [moving, setMoving] = useState(null), [error, setError] = useState('')
  const drag = useRef(null), suppressClick = useRef(false), [preview, setPreview] = useState(null)
  useEffect(() => {
    const cancel = () => { drag.current = null; setPreview(null); setMoving(null) }
    const key = e => { if (e.key === 'Escape') cancel() }
    window.addEventListener('blur', cancel); window.addEventListener('keydown', key)
    return () => { window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key) }
  }, [])
  function point(e) { const svg = e.currentTarget, p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()) }
  function nearest(p, mounts) { const mount = [...mounts].sort((a, b) => Math.hypot(p.x - MOUNTS[a][0], p.y - MOUNTS[a][1]) - Math.hypot(p.x - MOUNTS[b][0], p.y - MOUNTS[b][1]))[0]; if (!mount || Math.hypot(p.x - MOUNTS[mount][0], p.y - MOUNTS[mount][1]) > 55) throw new Error('Drop onto a compatible frame mount.'); return mount }
  function release(e) {
    const active = drag.current; if (!active || active.pointer !== e.pointerId) return
    drag.current = null; setPreview(null)
    if (Math.hypot(e.clientX - active.x, e.clientY - active.y) < 4) { select(active.id); return }
    suppressClick.current = true
    const p = doc.components.find(c => c.id === active.id)
    try { const mount = nearest(point(e), droneDef(p.type)?.mounts ?? ['stack']); if (mount !== mountOf(doc, p.id)) commitDrone({ ...doc, mounts: doc.mounts.map(m => m.componentId === p.id ? { ...m, mount } : m) }); setError('') } catch (err) { setError(err.message) }
  }
  function place(mount) {
    if (!moving || readOnly) return
    try { commitDrone({ ...doc, mounts: doc.mounts.map(m => m.componentId === moving ? { ...m, mount } : m) }); setMoving(null); setError('') } catch (err) { setError(err.message) }
  }
  return <div className="relative"><svg data-canvas-svg viewBox="0 0 600 500" className="w-full" style={{ touchAction: readOnly ? 'auto' : 'none' }} role="img" aria-label={t('Drone assembly and connector diagram')}
    onDragOver={e => { if (!readOnly && [...e.dataTransfer.types].includes(DND_MIME)) e.preventDefault() }}
    onDrop={e => { if (readOnly) return; e.preventDefault(); const type = e.dataTransfer.getData(DND_MIME), def = droneDef(type); if (!def) return; try { const next = addDronePart(doc, type, nearest(point(e), def.mounts)); commitDrone(next); select(next.components.at(-1).id); setError('') } catch (err) { setError(err.message) } }}
    onPointerDown={e => { suppressClick.current = false; const id = e.target.closest('[data-drone-part]')?.dataset.dronePart; if (readOnly || !id || e.button !== 0) return; drag.current = { id, pointer: e.pointerId, x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId) }}
    onPointerMove={e => { if (drag.current?.pointer === e.pointerId) setPreview(point(e)) }} onPointerUp={release} onPointerCancel={() => { drag.current = null; setPreview(null) }} onLostPointerCapture={() => { drag.current = null; setPreview(null) }}>
    <rect width="600" height="500" fill="#f8fafc" /><path d="M160 110L440 390M440 110L160 390" stroke="#cbd5e1" strokeWidth="30" /><rect x="252" y="200" width="96" height="105" rx="12" fill="#e2e8f0" stroke="#94a3b8" />
    <text x="300" y="28" textAnchor="middle" fill="#475569" fontSize="13">{t('FRONT ↑ · Quad-X · named mounts')}</text>
    {ghost && <g opacity="0.3" stroke="#14b8a6" strokeWidth="3" strokeDasharray="6 4">{ghost.links.map(l => { const a = positionOf(ghost, l.from.split(':')[0]), b = positionOf(ghost, l.to.split(':')[0]); return <line key={l.id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} /> })}</g>}
    {doc.links.map(l => { const a = positionOf(doc, l.from.split(':')[0]), b = positionOf(doc, l.to.split(':')[0]); return <g key={l.id} tabIndex={0} role="button" aria-label={`${l.from} to ${l.to}`} onClick={() => select(l.id)} onKeyDown={e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); select(l.id) } }}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="transparent" strokeWidth="12" /><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={selectedIds.includes(l.id) ? '#0f172a' : COLORS[l.kind]} strokeWidth={selectedIds.includes(l.id) ? 4 : 1.7} /><title>{l.from} → {l.to} · {l.awg} AWG</title></g> })}
    {Object.entries(MOUNTS).filter(([m]) => !m.startsWith('prop') && m !== 'frame').map(([mount, [x, y]]) => <g key={mount} role="button" tabIndex={moving ? 0 : -1} aria-label={`${t('Place at')} ${mount}`} onClick={() => place(mount)} onKeyDown={e => { if (e.key === 'Enter') place(mount) }}><circle cx={x} cy={y} r="26" fill="none" stroke={moving ? '#14b8a6' : '#94a3b8'} strokeDasharray="4 3" /><text x={x} y={y + 46} fontSize="11" textAnchor="middle" fill="#475569">{mount}</text></g>)}
    {doc.components.filter(p => p.type !== 'drone_frame').map(p => {
      const [x, y] = positionOf(doc, p.id), damaged = state?.damaged?.[p.id], motor = p.type === 'brushless_motor', prop = p.type === 'drone_prop'
      if (prop && !p.props.fitted) return null
      return <g key={p.id} data-drone-part={p.id} transform={`translate(${x} ${y})`} tabIndex={0} role="button" aria-label={`${droneDef(p.type)?.name ?? p.type} ${mountOf(doc, p.id)}`} style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return } if (moving) place(mountOf(doc, p.id)); else select(p.id) }} onDoubleClick={() => { if (!readOnly && !prop) setMoving(p.id) }} onKeyDown={e => { if (e.key === 'Enter') select(p.id); if (e.key === 'Escape') setMoving(null) }}>
        {prop ? <ellipse rx="56" ry="11" fill={damaged ? '#fda4af' : '#99f6e4'} fillOpacity="0.65" stroke={selectedIds.includes(p.id) ? '#0f172a' : '#0d9488'} transform={`rotate(${p.props.direction === 'cw' ? 35 : -35})`} /> : motor ? <circle r="22" fill={damaged ? '#ffe4e6' : '#fff'} stroke={selectedIds.includes(p.id) ? '#0d9488' : '#475569'} strokeWidth="3" /> : <rect x="-29" y="-16" width="58" height="32" rx="5" fill={damaged ? '#ffe4e6' : '#fff'} stroke={selectedIds.includes(p.id) ? '#0d9488' : '#64748b'} strokeWidth="2" />}
        {!prop && <text textAnchor="middle" y="4" fontSize="10" fill="#0f172a">{motor ? p.props.direction.toUpperCase() : p.type === doc.mcu ? 'ESP32 FC' : p.type.replace('imu_', '').replace('baro_', '').replace('rx_', '')}</text>}
        {damaged && <><path d="M-10 -25Q-30 -50 -5 -65Q15 -75 0 -95" fill="none" stroke="#64748b" strokeWidth="8" opacity=".6" /><text y="-28" textAnchor="middle" fill="#be123c" fontSize="12">{t('DAMAGED')}</text></>}
      </g>
    })}
    {preview && <circle cx={preview.x} cy={preview.y} r="27" fill="#5eead4" fillOpacity=".5" stroke="#0d9488" pointerEvents="none" />}
  </svg>{moving && <p className="absolute inset-x-2 bottom-1 rounded bg-white p-2 text-xs">{t('Select a compatible empty mount.')} <button className="underline" onClick={() => setMoving(null)}>{t('Cancel move')}</button></p>}{error && <p role="alert" className="p-2 text-xs text-rose-700">{t(error)}</p>}</div>
}

function FlightView({ flight, doc }) {
  const frames = useRef({ from: [0, 0, 0, 0], to: [0, 0, 0, 0], at: 0 }), [pose, setPose] = useState([0, 0, 0, 0])
  useEffect(() => { const previous = frames.current; frames.current = { from: previous.to, to: [...(flight?.position ?? [0, 0, 0]), flight?.attitude[1] ?? 0], at: performance.now() } }, [flight])
  useEffect(() => {
    let frame
    const animate = now => { const f = frames.current, fraction = clamp((now - f.at) / 20, 0, 1); setPose(previous => { const next = f.to.map((v, i) => f.from[i] + (v - f.from[i]) * fraction); return next.every((v, i) => v === previous[i]) ? previous : next }); frame = requestAnimationFrame(animate) }
    frame = requestAnimationFrame(animate); return () => cancelAnimationFrame(frame)
  }, [])
  const { t } = useI18n(), [orbit, setOrbit] = useState(0)
  const p = pose.slice(0, 3), a = [0, pose[3], 0]
  const project = ([x, y, z]) => { const angle = orbit * Math.PI / 180; return [150 + (x * Math.cos(angle) - y * Math.sin(angle)) * 45, 375 + (x * Math.sin(angle) + y * Math.cos(angle)) * 14 - z * 70] }
  const [x, y] = project(p)
  return <div><svg viewBox="0 0 600 450" className="w-full" role="img" aria-label={t('Flight view')}><rect width="600" height="450" fill="#f1f5f9" /><path d="M0 375H600M0 305H600M0 235H600M0 165H600M0 95H600" stroke="#cbd5e1" strokeDasharray="4 4" /><path d="M0 375L180 435H600V375" fill="#e2e8f0" /><text x="12" y="24" fontSize="13" fill="#475569">{t('Hangar · orbit view · 3D physics')}</text>
    {doc.course.map((g, i) => { const [gx, gy] = project([g.x, g.y, g.z]); return <g key={i}><ellipse cx={gx} cy={gy} rx={g.radius * 23} ry={g.radius * 70} fill="none" stroke={i < (flight?.gatesPassed ?? 0) ? '#059669' : '#6366f1'} strokeWidth="5" /><text x={gx} y={gy - g.radius * 70 - 10} textAnchor="middle" fill="#475569" fontSize="12">{t('Gate')} {i + 1}</text></g> })}
    <ellipse cx={x} cy={project([p[0], p[1], 0])[1]} rx="25" ry="5" fill="#94a3b8" opacity=".4" />
    <g transform={`translate(${x} ${y}) rotate(${-a[1]})`}><path d="M-25 -8L25 8M25 -8L-25 8" stroke={flight?.crashed ? '#be123c' : '#0f172a'} strokeWidth="5" /><ellipse cx="-25" cy="-8" rx="15" ry="4" fill="#5eead4" /><ellipse cx="25" cy="-8" rx="15" ry="4" fill="#5eead4" /><ellipse cx="-25" cy="8" rx="15" ry="4" fill="#99f6e4" /><ellipse cx="25" cy="8" rx="15" ry="4" fill="#99f6e4" /><rect x="-8" y="-6" width="16" height="12" rx="3" fill="#0d9488" /></g>
  </svg><label className="flex items-center gap-2 px-3 text-xs">{t('Orbit camera')}<input type="range" min="-90" max="90" value={orbit} onChange={e => setOrbit(Number(e.target.value))} /></label></div>
}

function Blackbox({ flight }) {
  const { t } = useI18n(), [axis, setAxis] = useState(0), [cursor, setCursor] = useState(100)
  const rows = (flight?.blackbox ?? []).slice(-500), count = rows.length, index = Math.min(count - 1, Math.floor(cursor / 100 * (count - 1)))
  const line = value => rows.map((r, i) => `${i / Math.max(1, count - 1) * 580 + 10},${130 - clamp(value(r), -100, 100)}`).join(' ')
  return <div className="space-y-3 p-3"><h3 className="font-semibold">{t('Blackbox · last 10 seconds')}</h3><select aria-label={t('Blackbox axis')} className="rounded border p-2" value={axis} onChange={e => setAxis(Number(e.target.value))}>{['Roll', 'Pitch', 'Yaw'].map((a, i) => <option value={i} key={a}>{t(a)}</option>)}</select><svg viewBox="0 0 600 260" className="w-full rounded border border-line" role="img" aria-label={t('Setpoint and gyro plot')}><rect width="600" height="260" fill="white" /><path d="M10 130H590" stroke="#cbd5e1" /><polyline points={line(r => r.setpoint[axis])} fill="none" stroke="#0d9488" strokeWidth="2" /><polyline points={line(r => r.gyro[axis])} fill="none" stroke="#e11d48" strokeWidth="2" /><line x1={10 + cursor * 5.8} x2={10 + cursor * 5.8} y1="0" y2="260" stroke="#64748b" strokeDasharray="4 4" /></svg><p className="text-xs">{t('Teal: setpoint · Rose: gyro · degrees/second (±100 scale)')}</p><svg viewBox="0 0 600 260" className="w-full rounded border border-line" role="img" aria-label={t('Motor outputs and battery voltage plot')}><rect width="600" height="260" fill="white" />{['#0d9488', '#6366f1', '#d97706', '#e11d48'].map((color, i) => <polyline key={color} points={line(r => (r.motorOutputs[i] - .5) * 180)} fill="none" stroke={color} strokeWidth="2" />)}<polyline points={line(r => (r.batteryV / 25 - .5) * 180)} fill="none" stroke="#0f172a" strokeDasharray="5 3" strokeWidth="2" /></svg><p className="text-xs">{t('M1 teal · M2 indigo · M3 amber · M4 rose: 0–100%. Dashed: pack voltage, 0–25 V.')}</p><label className="block text-xs">{t('Inspect sample')}<input type="range" className="w-full" min="0" max="100" value={cursor} onChange={e => setCursor(Number(e.target.value))} /></label>{rows[index] && <p className="text-xs tabular-nums">{(rows[index].t / 1e6).toFixed(2)} s · {rows[index].batteryV.toFixed(2)} V · {t('Motor outputs')} {rows[index].motorOutputs.map(n => `${Math.round(n * 100)}%`).join(' / ')}</p>}{!count && <p className="text-sm text-slate-600">{t('Run a sketch to record telemetry.')}</p>}</div>
}

export default function DroneBench({ doc, state, selectedIds, ghost, readOnly, sandbox }) {
  const { t } = useI18n(), [view, setView] = useState('bench'), [speed, setSpeed] = useState(1)
  const flight = state?.flight
  useEffect(() => { setSpeed(1) }, [state?.runId])
  return <div className="drone-bench flex h-full min-h-0 flex-col overflow-hidden bg-slate-50" aria-label={t('Drone workbench')}>
    <Tabs size="sm" tabs={['bench', 'flight', 'stand', 'blackbox'].map(id => ({ id, label: t(id) }))} value={view} onChange={setView} />
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-line bg-white px-3 py-2 text-xs tabular-nums" aria-label={t('Flight telemetry')}><strong>{flight?.armed ? t('ARMED') : t('DISARMED')}</strong><span>{(flight?.electrical.V_bus ?? 0).toFixed(2)} V</span><span>{(flight?.electrical.currentA ?? 0).toFixed(1)} A</span><span>{(flight?.position[2] ?? 0).toFixed(2)} m</span><span>{t('Gates')} {flight?.gatesPassed ?? 0}/{doc.course.length}</span>{flight?.saturated && <strong className="text-amber-800">{t('Mixer saturated')}</strong>}{flight?.crashed && <strong className="text-rose-700">{t('CRASHED')}</strong>}</div>
    <div className="min-h-0 flex-1 overflow-auto">
    {view === 'bench' && <><DroneDiagram doc={doc} state={state} selectedIds={selectedIds} ghost={ghost} readOnly={readOnly} /><Wiring doc={doc} readOnly={readOnly} /></>}
    {view === 'flight' && <FlightView doc={doc} flight={flight} />}
    {view === 'stand' && <div className="space-y-4 p-4"><h2 className="font-semibold">{t('Thrust stand · props off')}</h2><p className="text-sm text-slate-600">{t('The stand locks the frame. With props removed, thrust is zero even when the shaft spins.')}</p>{[0, 1, 2, 3].map(i => <div key={i} className="rounded border border-line bg-white p-3 text-sm">M{i + 1} · {flight?.rpm[i].toFixed(0) ?? 0} RPM · {flight?.motorCurrentA[i].toFixed(2) ?? 0} A · {flight?.thrustN[i].toFixed(2) ?? 0} N · {Math.round(flight?.pulses[i] ?? 1000)} µs · {flight?.escArmed[i] ? t('ESC ready') : t('Hold 1000 µs for 1 s')}</div>)}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={doc.flight.bench} disabled={readOnly || !sandbox} onChange={e => commitDrone({ ...doc, flight: { ...doc.flight, bench: e.target.checked } })} />{t('Clamp to stand (blocks arming with props fitted)')}</label>{['roll', 'pitch'].map(axis => <label className="block text-xs" key={axis}>{t(`Bench tilt ${axis}`)}<input className="w-full" type="range" min="-45" max="45" defaultValue="0" onChange={e => sim()?.setBenchTilt({ [axis]: Number(e.target.value) })} /></label>)}</div>}
    {view === 'blackbox' && <Blackbox flight={flight} />}
    {!!flight?.warnings.length && <div role="status" className="mx-3 my-2 max-h-32 space-y-2 overflow-auto rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{flight.warnings.map((w, i) => <p key={`${w.code}${i}`}>{t(w.message)}</p>)}</div>}
    <div className="mt-auto flex flex-wrap gap-2 p-3"><Button size="sm" variant="secondary" onClick={() => useSimStore.getState().reset()}>{t('Repair / reset')}</Button><Button size="sm" variant="secondary" disabled={state?.status !== 'running'} onClick={() => sim()?.disturb([40, -20, 0])}>{t('Apply disturbance')}</Button>{sandbox && <><Button size="sm" variant="secondary" title={t('Replay requires the same build, sketch and complete input recording.')} disabled={!flight?.replayAvailable} onClick={async () => { if ((await sim().replayFlight()).ok) { setView('flight'); setSpeed(1) } }}>{t('Replay sticks')}</Button><label className="text-xs">{t('Speed')} <select className="rounded border p-1.5" value={speed} onChange={e => { const speed = Number(e.target.value); setSpeed(speed); sim()?.setSpeed(speed) }}>{[.25, .5, 1].map(n => <option key={n} value={n}>{n}×</option>)}</select></label></>}</div>
    {sandbox && !readOnly && <details className="border-t border-line p-3"><summary className="cursor-pointer text-sm">{t('Course editor')}</summary><div className="mt-2 space-y-2">{doc.course.map((gate, i) => <div className="flex flex-wrap gap-2" key={i}>{['x', 'y', 'z', 'radius'].map(k => <label key={k} className="text-xs">{t('Gate')} {i + 1} {k}<input type="number" step="0.1" className="ml-1 w-16 rounded border p-1" value={gate[k]} onChange={e => { try { commitDrone({ ...doc, course: doc.course.map((g, j) => i === j ? { ...g, [k]: e.target.valueAsNumber } : g) }) } catch { /* Incomplete numeric input is not committed. */ } }} /></label>)}<button className="text-xs text-rose-700 underline" onClick={() => commitDrone({ ...doc, course: doc.course.filter((_, j) => i !== j) })}>{t('Remove gate')}</button></div>)}<Button size="sm" disabled={doc.course.length >= 24} onClick={() => commitDrone({ ...doc, course: [...doc.course, { x: Math.min(15, (doc.course.at(-1)?.x ?? 0) + 2), y: 0, z: 1.5, radius: .9 }] })}>{t('Add gate')}</Button></div></details>}
    </div>
    <Transmitter state={state} />
  </div>
}

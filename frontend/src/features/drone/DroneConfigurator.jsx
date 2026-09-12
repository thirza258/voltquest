import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { CONFIG_FIELDS, PRESETS, clone, deriveConfig, feasibility } from '../../engine/drone/config.js'
import { createDroneDoc, DIRECTIONS, droneDef, mountOf, validateDroneDoc } from '../../engine/drone/document.js'
import { useDocumentStore } from '../../store/documentStore.js'
import { useSimStore } from '../../store/simStore.js'
import { Button, Modal } from '../../ui/index.js'
import PartsDrawer from '../workspace/PartsDrawer.jsx'
import { newId } from '../../lib/ids.js'

const LABELS = { wheelbaseMm: 'Wheelbase (mm)', frameMassG: 'Frame mass (g)', maxPropIn: 'Maximum prop (in)', kv: 'Motor Kv (RPM/V)', massG: 'Mass per part (g)', maxCurrentA: 'Motor limit (A)', phaseResistanceMohm: 'Winding resistance (mΩ)', noLoadCurrentA: 'No-load current (A)', diameterIn: 'Diameter (in)', pitchIn: 'Pitch (in)', blades: 'Blade count', continuousA: 'Continuous per channel (A)', burstA: 'Burst per channel (A)', becVolts: 'BEC voltage (V)', becAmps: 'BEC current (A)', cells: 'LiPo cells (S)', capacityMah: 'Capacity (mAh)', cRating: 'Discharge rating (C)', internalResistanceMohm: 'Pack resistance (mΩ)' }
export function commitDrone(doc) { validateDroneDoc(doc); useDocumentStore.getState().setDoc(doc) }
export function addDronePart(doc, type, target) {
  const def = droneDef(type), mount = target ?? def?.mounts.find(m => !doc.mounts.some(p => p.mount === m))
  if (!mount || !def?.mounts.includes(mount) || doc.mounts.some(p => p.mount === mount)) throw new Error('Choose a compatible empty mount. Remove an existing part in Inspect first.')
  const id = newId('c'), direction = DIRECTIONS[Number(mount.replace(/\D/g, '')) - 1] ?? 'ccw'
  const props = ['brushless_motor', 'drone_prop'].includes(type) ? { direction, ...(type === 'drone_prop' ? { fitted: false } : {}) } : {}
  return validateDroneDoc({ ...doc, components: [...doc.components, { id, type, props, rotation: 0 }], mounts: [...doc.mounts, { componentId: id, mount }] })
}
export function DroneSpec({ config }) {
  const { t } = useI18n()
  const d = useMemo(() => deriveConfig(config), [config])
  return <dl className="grid grid-cols-2 gap-2 text-xs tabular-nums" aria-label={t('Build estimates')}>{[['All-up weight', `${d.auwG.toFixed(0)} g`], ['Thrust / weight', `${d.twr.toFixed(2)} : 1`], ['Hover throttle', `${(d.hoverThrottle * 100).toFixed(0)} %`], ['Hover estimate', `${d.hoverMinutes.toFixed(1)} min`], ['Pack peak current', `${d.peakCurrentA.toFixed(1)} A`], ['Sag at full throttle', `${d.busV.toFixed(2)} V`]].map(([label, value]) => <div className="rounded border border-line bg-slate-50 p-2" key={label}><dt className="text-slate-600">{t(label)}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>)}</dl>
}

export default function DroneConfigurator({ doc, readOnly }) {
  const { t } = useI18n(), c = doc.droneConfig
  const [preset, setPreset] = useState(null), [error, setError] = useState('')
  const warnings = useMemo(() => {
    const rows = feasibility(c)
    for (const [type, count] of [['brushless_motor', 4], ['esc', 4], ['imu_mpu6050', 1], ['rx_elrs', 1]]) {
      if (doc.components.filter(p => p.type === type).length < count) rows.push({ code: type, message: 'Assembly is incomplete.', hint: `Required: ${count} × ${droneDef(type).name}.` })
    }
    return rows
  }, [c, doc.components])
  function edit(section, key, value) {
    try { commitDrone({ ...doc, droneConfig: { ...c, [section]: { ...c[section], [key]: value } } }); setError('') } catch (e) { setError(e.message) }
  }
  function add(type) {
    try { const next = addDronePart(doc, type); commitDrone(next); useDocumentStore.getState().select(next.components.at(-1).id); setError('') } catch (e) { setError(e.message) }
  }
  return <section className="space-y-4 p-3" aria-label={t('Drone configurator')}>
    <h2 className="font-semibold">{t('Custom drone builder')}</h2>
    <p className="text-xs leading-relaxed text-slate-600">{t('Specify a quad-X, connect its parts, then run your sketch. Build edits stop the current run. Estimates are a teaching model, not measured performance.')}</p>
    <DroneSpec config={c} />
    <label className="block text-xs">{t('Flight controller')}<select className="mt-1 w-full rounded border border-line p-2" disabled={readOnly} value={c.fc.board} onChange={e => setPreset({ config: { ...clone(c), fc: { ...c.fc, board: e.target.value } } })}><option value="esp32">ESP32</option><option value="esp32s3">ESP32-S3</option></select></label>
    {!readOnly && <label className="block text-sm">{t('Clone a preset')}<select className="mt-1 w-full rounded border border-line p-2" value="" onChange={e => setPreset(PRESETS.find(p => p.id === e.target.value))}><option value="">{t('Choose a build…')}</option>{PRESETS.map(p => <option key={p.id} value={p.id}>{p.config.name}</option>)}</select></label>}
    {warnings.map(w => <div key={w.code} className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><strong>{t(w.message)}</strong><p className="mt-1">{t(w.hint)}</p></div>)}
    {error && <p className="text-sm text-rose-700" role="alert">{t(error)}</p>}
    {Object.entries(CONFIG_FIELDS).map(([section, fields]) => <details key={section} open={section === 'airframe'} className="rounded border border-line p-2"><summary className="cursor-pointer text-sm font-semibold capitalize">{t(section)}</summary><div className="mt-3 grid grid-cols-2 gap-3">{Object.entries(fields).map(([key, [min, max, step]]) => <label key={key} className="min-w-0 text-xs text-slate-600">{t(LABELS[key])}<input type="number" aria-label={`${t(section)} ${t(LABELS[key])}`} className="mt-1 w-full min-w-0 rounded border border-line p-1.5 text-ink" value={c[section][key]} min={min} max={max} step={step} disabled={readOnly} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n) && n >= min && n <= max) edit(section, key, n) }} /></label>)}</div></details>)}
    <label className="block text-xs">{t('ESC protocol')}<select className="mt-1 w-full rounded border border-line p-2" disabled={readOnly} value={c.esc.protocol} onChange={e => edit('esc', 'protocol', e.target.value)}>{['pwm', 'oneshot125', 'dshot600'].map(p => <option key={p}>{p}</option>)}</select></label>
    <label className="block text-xs">{t('ESC package')}<select className="mt-1 w-full rounded border border-line p-2" disabled={readOnly} value={c.esc.kind} onChange={e => edit('esc', 'kind', e.target.value)}><option value="4in1">4-in-1</option><option value="single">4 × single</option></select></label>
    <label className="block text-xs">{t('Motor stator')}<select className="mt-1 w-full rounded border border-line p-2" disabled={readOnly} value={c.motors.stator} onChange={e => edit('motors', 'stator', e.target.value)}>{['1404', '2207', '2806'].map(s => <option key={s}>{s}</option>)}</select></label>
    <PartsDrawer bench="drone" readOnly={readOnly} onAdd={add} />
    <Modal open={!!preset} title={t('Replace this build with a preset?')} description={t('This replaces the assembly and wiring. Your sketch is retained. Undo restores the previous build.')} onClose={() => setPreset(null)} footer={<><Button variant="secondary" onClick={() => setPreset(null)}>{t('Cancel')}</Button><Button onClick={() => { commitDrone(createDroneDoc(clone(preset.config), { bench: doc.flight.bench })); useSimStore.getState().reset(); setPreset(null) }}>{t('Clone build')}</Button></>} />
  </section>
}

export function DroneInspector({ doc, selectedIds, readOnly, state }) {
  const { t } = useI18n(), [error, setError] = useState('')
  const id = selectedIds[0], part = doc.components.find(p => p.id === id), link = doc.links.find(p => p.id === id)
  if (!part && !link) return <p className="p-3 text-sm text-slate-600">{t('Select a part or connector to inspect its mount, wiring and live values.')}</p>
  const editPart = patch => commitDrone({ ...doc, components: doc.components.map(p => p.id === id ? { ...p, props: { ...p.props, ...patch } } : p) })
  return <section className="space-y-3 p-3 text-sm"><h2 className="font-semibold">{part ? droneDef(part.type)?.name ?? doc.mcu : t('Connector link')}</h2><p className="break-all text-xs text-slate-600">{id}</p>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {part && <><label className="block">{t('Frame mount')}<select className="mt-1 w-full rounded border border-line p-2" value={mountOf(doc, id)} disabled={readOnly} onChange={e => { try { commitDrone({ ...doc, mounts: doc.mounts.map(m => m.componentId === id ? { ...m, mount: e.target.value } : m) }); setError('') } catch (err) { setError(err.message) } }}>{(droneDef(part.type)?.mounts ?? ['stack']).map(m => <option key={m}>{m}</option>)}</select></label>
      {['brushless_motor', 'drone_prop'].includes(part.type) && <label className="block">{t('Rotation direction')}<select className="ml-2 rounded border border-line p-2" value={part.props.direction} disabled={readOnly} onChange={e => editPart({ direction: e.target.value })}><option value="cw">CW</option><option value="ccw">CCW</option></select></label>}
      {part.type === 'drone_prop' && <label className="flex gap-2"><input type="checkbox" checked={part.props.fitted} disabled={readOnly} onChange={e => editPart({ fitted: e.target.checked })} />{t('Propeller fitted')}</label>}
      {part.type === 'lipo' && <Button variant="danger" size="sm" disabled={readOnly} onClick={() => commitDrone({ ...doc, links: doc.links.map(l => ({ ...l, from: l.from === `${id}:pos` ? `${id}:neg` : l.from === `${id}:neg` ? `${id}:pos` : l.from, to: l.to === `${id}:pos` ? `${id}:neg` : l.to === `${id}:neg` ? `${id}:pos` : l.to })) })}>{t('Reverse pack polarity')}</Button>}
      {state?.damaged?.[id] && <p className="rounded bg-rose-50 p-2 text-rose-700">{t('Damaged — repair before the next run.')}</p>}
      <ul className="space-y-2 text-xs">{doc.links.filter(l => l.from.startsWith(`${id}:`) || l.to.startsWith(`${id}:`)).map(l => <li key={l.id}><button className="break-all text-left text-brand-700 underline" onClick={() => useDocumentStore.getState().select(l.id)}>{l.from} → {l.to}</button></li>)}</ul>
      {part.type !== doc.mcu && <Button variant="danger" size="sm" disabled={readOnly} onClick={() => commitDrone({ ...doc, components: doc.components.filter(p => p.id !== id), mounts: doc.mounts.filter(m => m.componentId !== id), links: doc.links.filter(l => ![l.from, l.to].some(e => e.startsWith(`${id}:`))) })}>{t('Remove part')}</Button>}
    </>}
    {link && <><p className="break-all">{link.from} → {link.to}</p><p>{link.kind}</p><label className="block">{t('Wire gauge (AWG)')}<select className="ml-2 rounded border p-2" value={link.awg} disabled={readOnly} onChange={e => commitDrone({ ...doc, links: doc.links.map(l => l.id === id ? { ...l, awg: Number(e.target.value) } : l) })}>{[12, 14, 16, 18, 20, 22, 24].map(n => <option key={n}>{n}</option>)}</select></label><label className="block">{t('Length (m)')}<input className="ml-2 w-20 rounded border p-2" type="number" min="0.01" max="2" step="0.01" value={link.lengthM} disabled={readOnly} onChange={e => { if (e.target.valueAsNumber >= .01 && e.target.valueAsNumber <= 2) commitDrone({ ...doc, links: doc.links.map(l => l.id === id ? { ...l, lengthM: e.target.valueAsNumber } : l) }) }} /></label><Button variant="danger" disabled={readOnly} onClick={() => commitDrone({ ...doc, links: doc.links.filter(l => l.id !== id) })}>{t('Remove link')}</Button></>}
  </section>
}

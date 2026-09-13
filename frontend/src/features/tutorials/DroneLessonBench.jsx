import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { DroneDiagram, FlightView } from '../drone/DroneBench.jsx'
import { Button } from '../../ui/index.js'

/** Isolated tutorial controls: never write to the campaign/sandbox document or simulation stores. */
export default function DroneLessonBench({ doc, state, simulation, selectedIds, onSelect }) {
  const { t } = useI18n()
  const [tilt, setTilt] = useState({ roll: 0, pitch: 0 })
  const rc = state?.flight?.rc ?? { arm: false, throttle: 0, signal: true }
  const flight = state?.flight
  const update = patch => simulation.current?.setSticks({ ...patch, mode: 'hover', signal: true })
  useEffect(() => {
    const blur = () => simulation.current?.setSticks({ arm: false, signal: false, throttle: 0 })
    window.addEventListener('blur', blur)
    return () => window.removeEventListener('blur', blur)
  }, [simulation])
  // Run/reset creates a new virtual timeline. Keep the stand controls consistent with its reset pose.
  useEffect(() => { if (!state?.millis) setTilt({ roll: 0, pitch: 0 }) }, [state?.millis])
  return <div className="min-w-0">
    <p className="border-b border-line p-3 text-sm text-ink-secondary">{t(doc.flight.bench ? 'Clamped bench · all propellers removed' : 'Virtual flight · propellers fitted · assisted hover')}</p>
    {doc.flight.bench ? <DroneDiagram doc={doc} state={state} selectedIds={selectedIds} readOnly onSelect={id => onSelect([id])} /> : <FlightView flight={flight} doc={doc} />}
    <div className="space-y-3 border-t border-line p-4" role="group" aria-label={t('Drone lesson controls')}>
      <div className="flex flex-wrap items-center gap-3"><Button size="sm" disabled={state?.status !== 'running'} variant={rc.arm ? 'danger' : 'primary'} onClick={() => update({ arm: !rc.arm })}>{t(rc.arm ? 'DISARM' : 'ARM')}</Button><span className="text-xs text-slate-600">{t('Run at low throttle for one virtual second before arming.')}</span></div>
      {doc.flight.bench ? <div className="grid grid-cols-2 gap-3">{['roll', 'pitch'].map(axis => <label key={axis} className="text-sm text-ink-secondary">{t(axis === 'roll' ? 'Bench roll' : 'Bench pitch')} {tilt[axis]}°<input aria-label={t(axis === 'roll' ? 'Bench roll' : 'Bench pitch')} type="range" min="-30" max="30" step="1" value={tilt[axis]} className="block w-full accent-teal-700" onChange={event => { const value = Number(event.target.value); setTilt(previous => ({ ...previous, [axis]: value })); simulation.current?.setBenchTilt({ [axis]: value }) }} /></label>)}</div>
        : <label className="block text-sm text-ink-secondary">{t('Throttle')} {Math.round(rc.throttle * 100)}%<input aria-label={t('Drone tutorial throttle')} type="range" min="0" max="1" step="0.01" value={rc.throttle} className="block w-full accent-teal-700" onChange={event => update({ throttle: Number(event.target.value) })} /></label>}
      <dl className="grid grid-cols-2 gap-2 text-xs text-ink-secondary" aria-label={t('Drone lesson telemetry')}>
        <div><dt>{t('Height')}</dt><dd>{(flight?.position?.[2] ?? 0).toFixed(2)} m</dd></div>
        <div><dt>{t('Vertical speed')}</dt><dd>{(flight?.velocity?.[2] ?? 0).toFixed(2)} m/s</dd></div>
        <div><dt>{t('Roll / pitch')}</dt><dd>{(flight?.attitude?.[0] ?? 0).toFixed(1)}° / {(flight?.attitude?.[1] ?? 0).toFixed(1)}°</dd></div>
        <div><dt>{t('Flight state')}</dt><dd>{t(flight?.crashed ? 'Crashed' : flight?.landed ? 'Landed' : flight?.armed ? 'Armed' : 'Disarmed')}</dd></div>
        {(flight?.rpm ?? [0, 0, 0, 0]).map((rpm, i) => <div key={i}><dt>{t('Motor {number}', { number: i + 1 })}</dt><dd>{Math.round(rpm)} RPM · {Math.round(flight?.pulses?.[i] ?? 1000)} µs</dd></div>)}
      </dl>
      <p className="text-xs text-slate-600">{t('The prepared assembly is read-only. Bench tilt, transmitter controls and code remain interactive. Leaving the window disarms the tutorial.')}</p>
    </div>
    <details className="border-t border-line p-4"><summary className="cursor-pointer text-sm font-semibold">{t('Drone connector table')}</summary><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">{t('From socket')}</th><th className="p-2">{t('To socket')}</th><th className="p-2">{t('Connector type')}</th></tr></thead><tbody>{doc.links.map(link => <tr key={link.id}><td className="break-all p-2">{link.from}</td><td className="break-all p-2">{link.to}</td><td className="p-2">{link.kind}</td></tr>)}</tbody></table></div></details>
  </div>
}

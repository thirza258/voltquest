import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'

const buttonClass = 'rounded-md border border-line-strong bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-40'

/**
 * Simulation mode: the recorded events of the last command, one delivery per row, replayed step by
 * step. Each row shows which device sent the frame, which one received it, and the protocol; the
 * details list the headers layer by layer and what the receiving device decided.
 */
export default function SimulationPanel({ events, index, onIndex, onClear, limited }) {
  const { t } = useI18n()
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return undefined
    if (index >= events.length - 1) { setPlaying(false); return undefined }
    const timer = setTimeout(() => onIndex(index + 1), 700)
    return () => clearTimeout(timer)
  }, [playing, index, events.length, onIndex])
  const current = events[index]
  return <section aria-labelledby="network-events-title" className="min-w-0 rounded-lg border border-line bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="network-events-title" className="font-semibold text-ink">{t('Event list')} <span className="text-sm font-normal text-slate-600">({events.length})</span></h3>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={buttonClass} disabled={!events.length || index <= 0} onClick={() => { setPlaying(false); onIndex(index - 1) }}>{t('Back')}</button>
        <button type="button" className={buttonClass} disabled={!events.length || index >= events.length - 1} onClick={() => { setPlaying(false); onIndex(index + 1) }}>{t('Step')}</button>
        <button type="button" className={buttonClass} disabled={events.length < 2} aria-pressed={playing} onClick={() => { if (!playing && index >= events.length - 1) onIndex(0); setPlaying(!playing) }}>{t(playing ? 'Pause' : 'Play')}</button>
        <button type="button" className={buttonClass} disabled={!events.length} onClick={() => { setPlaying(false); onClear() }}>{t('Clear')}</button>
      </div>
    </div>
    {!events.length ? <p className="mt-3 text-sm text-slate-600">{t('Run ping, tracert, a web request or a DHCP request. Every frame that crosses a cable appears here, in order.')}</p> : <>
      {limited && <p role="alert" className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">{t('The event limit was reached, so the rest of this operation was not recorded. A cabling loop is the usual cause.')}</p>}
      <div className="mt-3 max-h-56 overflow-auto rounded border border-line">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">{t('Recorded events')}</caption>
          <thead className="sticky top-0 bg-surface-sunken text-slate-600"><tr><th scope="col" className="px-2 py-1">#</th><th scope="col" className="px-2 py-1">{t('Time (s)')}</th><th scope="col" className="px-2 py-1">{t('From')}</th><th scope="col" className="px-2 py-1">{t('To')}</th><th scope="col" className="px-2 py-1">{t('Type')}</th></tr></thead>
          <tbody>{events.map((event, i) => <tr key={event.seq} className={i === index ? 'bg-brand-50' : 'hover:bg-slate-50'}>
            <td className="px-2 py-1"><button type="button" aria-current={i === index ? 'true' : undefined} className="font-mono underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500" onClick={() => { setPlaying(false); onIndex(i) }} aria-label={t('Show event {number}', { number: event.seq })}>{event.seq}</button></td>
            <td className="px-2 py-1 font-mono">{(event.time / 1000).toFixed(3)}</td>
            <td className="px-2 py-1">{event.from}</td><td className="px-2 py-1">{event.to}</td>
            <td className="px-2 py-1"><span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold">{event.protocol}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
      {current && <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t('Headers, outermost first')}</h4>
          <dl className="mt-1 space-y-1 text-xs">{current.layers.map(layer => <div key={layer.layer} className="rounded bg-surface-sunken px-2 py-1"><dt className="font-semibold">{layer.layer}</dt><dd className="break-words font-mono">{layer.text}</dd></div>)}</dl>
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t('What {device} did', { device: current.to })}</h4>
          <p className="mt-1 text-xs text-slate-600">{t('Arrived on {port} from {device} {from}.', { port: current.toPort, device: current.from, from: current.fromPort })}</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5">{current.notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
        </div>
      </div>}
    </>}
  </section>
}

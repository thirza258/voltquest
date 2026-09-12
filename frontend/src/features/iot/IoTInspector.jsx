import { useState } from 'react'
import { Button } from '../../ui/index.js'

export default function IoTInspector({ state, onPublish }) {
  const [topic, setTopic] = useState('weather/temperature')
  const [payload, setPayload] = useState('24.5')
  const [notice, setNotice] = useState('')
  return <section className="space-y-4 overflow-auto p-3 text-sm" aria-label="IoT inspector">
    <div><h3 className="font-semibold">WiFi</h3><p className="text-slate-600">{state?.wifi?.status ?? 'idle'} · {state?.wifi?.ssid || 'No network'}</p><p className="text-xs text-slate-600">IP {state?.wifi?.ip || '—'} · RSSI {state?.wifi?.rssi ?? '—'} dBm</p></div>
    <div><h3 className="font-semibold">HTTP routes</h3>{state?.http?.routes?.length ? <ul className="font-mono text-xs">{state.http.routes.map(route => <li key={route}>{route}</li>)}</ul> : <p className="text-slate-600">No server routes registered.</p>}</div>
    <div><h3 className="font-semibold">MQTT · {state?.mqtt?.connected ? 'connected' : 'disconnected'}</h3><div className="mt-2 space-y-2">{Object.entries(state?.mqtt?.topics ?? {}).map(([name, entry]) => <div key={name} className="rounded border border-line p-2"><p className="break-all font-mono text-xs text-brand-700">{name}</p><p className="break-all">{entry.value}</p><p className="text-xs text-slate-600">{entry.count} messages · {(entry.t / 1000000).toFixed(2)} s</p></div>)}</div></div>
    <form className="space-y-2" onSubmit={event => { event.preventDefault(); onPublish?.(topic, payload); setNotice(`Published to ${topic}`) }}><label className="block text-xs text-slate-600">Topic<input required aria-label="MQTT topic" value={topic} onChange={e => setTopic(e.target.value)} className="mt-1 w-full rounded border border-line-strong p-2 text-ink" /></label><label className="block text-xs text-slate-600">Payload<input aria-label="MQTT payload" value={payload} onChange={e => setPayload(e.target.value)} className="mt-1 w-full rounded border border-line-strong p-2 text-ink" /></label><Button type="submit" size="sm" disabled={state?.status !== 'running'}>Publish to virtual broker</Button>{notice && <p role="status" className="text-xs text-slate-600">{notice}</p>}</form>
    <pre aria-label="Network log" className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-sunken p-2 text-xs">{[...(state?.mqtt?.log ?? []).map(e => `${e.dir} ${e.topic ?? ''} ${e.payload ?? ''}`), ...(state?.http?.log ?? []).map(e => `${e.method} ${e.path} → ${e.status}`)].slice(-60).join('\n') || 'Network activity appears here.'}</pre>
  </section>
}

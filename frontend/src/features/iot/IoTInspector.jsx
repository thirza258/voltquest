import { useI18n } from '../../i18n/index.jsx'
import { useState } from 'react'
import { Button } from '../../ui/index.js'

export default function IoTInspector({ state, onPublish }) {
  const { t } = useI18n()
  const [topic, setTopic] = useState('weather/temperature')
  const [payload, setPayload] = useState('24.5')
  const [notice, setNotice] = useState('')
  return <section className="space-y-4 overflow-auto p-3 text-sm" aria-label={t("IoT inspector")}>
    <div><h3 className="font-semibold">{t("WiFi")}</h3><p className="text-slate-600">{state?.wifi?.status ?? t("idle")} · {state?.wifi?.ssid || t("No network")}</p><p className="text-xs text-slate-600">{t("IP ")}{state?.wifi?.ip || '—'}{t(" · RSSI ")}{state?.wifi?.rssi ?? '—'}{t(" dBm")}</p></div>
    <div><h3 className="font-semibold">{t("HTTP routes")}</h3>{state?.http?.routes?.length ? <ul className="font-mono text-xs">{state.http.routes.map(route => <li key={route}>{route}</li>)}</ul> : <p className="text-slate-600">{t("No server routes registered.")}</p>}</div>
    <div><h3 className="font-semibold">{t("MQTT · ")}{state?.mqtt?.connected ? t("connected") : t("disconnected")}</h3><div className="mt-2 space-y-2">{Object.entries(state?.mqtt?.topics ?? {}).map(([name, entry]) => <div key={name} className="rounded border border-line p-2"><p className="break-all font-mono text-xs text-brand-700">{name}</p><p className="break-all">{entry.value}</p><p className="text-xs text-slate-600">{entry.count}{t(" messages · ")}{(entry.t / 1000000).toFixed(2)}{t(" s")}</p></div>)}</div></div>
    <form className="space-y-2" onSubmit={event => { event.preventDefault(); onPublish?.(topic, payload); setNotice(`Published to ${topic}`) }}><label className="block text-xs text-slate-600">{t("Topic")}<input required aria-label={t("MQTT topic")} value={topic} onChange={e => setTopic(e.target.value)} className="mt-1 w-full rounded border border-line-strong p-2 text-ink" /></label><label className="block text-xs text-slate-600">{t("Payload")}<input aria-label={t("MQTT payload")} value={payload} onChange={e => setPayload(e.target.value)} className="mt-1 w-full rounded border border-line-strong p-2 text-ink" /></label><Button type="submit" size="sm" disabled={state?.status !== 'running'}>{t("Publish to virtual broker")}</Button>{notice && <p role="status" className="text-xs text-slate-600">{notice}</p>}</form>
    <pre aria-label={t("Network log")} className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-sunken p-2 text-xs">{[...(state?.mqtt?.log ?? []).map(e => `${e.dir} ${e.topic ?? ''} ${e.payload ?? ''}`), ...(state?.http?.log ?? []).map(e => `${e.method} ${e.path} → ${e.status}`)].slice(-60).join('\n') || t("Network activity appears here.")}</pre>
  </section>
}

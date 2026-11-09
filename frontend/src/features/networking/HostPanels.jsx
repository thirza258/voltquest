import { useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { isIp, isMask } from '../../engine/network/addr.js'

const fieldClass = 'mt-1 block w-full min-w-0 rounded-md border border-line-strong bg-white px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-surface-sunken disabled:text-slate-500'
const buttonClass = 'rounded-md bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1'
const secondaryClass = 'rounded-md border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500'

/** Static or DHCP addressing for a PC or server, like a desktop network settings dialog. */
export function IpConfiguration({ device, onApply, onDhcp }) {
  const { t } = useI18n()
  const config = device.config
  const [draft, setDraft] = useState({ ip: config.ip, mask: config.mask, gateway: config.gateway, dns: config.dns })
  const [error, setError] = useState('')
  const dhcp = config.ipMode === 'dhcp'
  function apply(event) {
    event.preventDefault()
    if (!isIp(draft.ip) || !isMask(draft.mask)) { setError(t('Enter a valid IPv4 address and subnet mask.')); return }
    if ((draft.gateway && !isIp(draft.gateway)) || (draft.dns && !isIp(draft.dns))) { setError(t('The gateway and DNS server must be IPv4 addresses or empty.')); return }
    setError(''); onApply({ ipMode: 'static', ...draft })
  }
  const lease = config.lease
  return <form onSubmit={apply} className="space-y-3">
    <fieldset className="flex flex-wrap gap-4 text-sm">
      <legend className="sr-only">{t('Address assignment')}</legend>
      <label className="flex items-center gap-2"><input type="radio" name={`${device.id}-mode`} checked={!dhcp} onChange={() => onApply({ ipMode: 'static' })} className="accent-teal-700" />{t('Static')}</label>
      <label className="flex items-center gap-2"><input type="radio" name={`${device.id}-mode`} checked={dhcp} onChange={() => onDhcp()} className="accent-teal-700" />{t('DHCP')}</label>
    </fieldset>
    {dhcp ? <div className="space-y-2 rounded-md border border-line bg-surface-sunken p-3 text-sm">
      <p>{lease ? t('Leased address {ip} / {mask}, gateway {gateway}, DNS {dns}.', { ip: lease.ip, mask: lease.mask, gateway: lease.gateway || '—', dns: lease.dns || '—' }) : t('No lease yet. Request an address from a DHCP server.')}</p>
      <button type="button" className={secondaryClass} onClick={onDhcp}>{t('Request an address')}</button>
    </div> : <div className="grid gap-3 sm:grid-cols-2">
      {[['ip', 'IPv4 address'], ['mask', 'Subnet mask'], ['gateway', 'Default gateway'], ['dns', 'DNS server']].map(([key, label]) =>
        <label key={key} className="text-sm">{t(label)}<input value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value.trim() })} className={fieldClass} inputMode="decimal" autoComplete="off" /></label>)}
      <div className="sm:col-span-2"><button type="submit" className={buttonClass}>{t('Apply settings')}</button></div>
    </div>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </form>
}

/** A minimal browser: one URL, one GET, the page text or a readable failure. */
export function WebBrowser({ onBrowse }) {
  const { t } = useI18n()
  const [url, setUrl] = useState('http://')
  const [result, setResult] = useState(null)
  return <div className="space-y-3">
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); setResult(onBrowse(url)) }}>
      <label className="sr-only" htmlFor="network-browser-url">{t('Address')}</label>
      <input id="network-browser-url" value={url} onChange={event => setUrl(event.target.value)} className={`${fieldClass} mt-0`} autoComplete="off" spellCheck={false} />
      <button type="submit" className={buttonClass}>{t('Go')}</button>
    </form>
    <div role="status" className="min-h-24 rounded-md border border-line bg-white p-3 text-sm">
      {!result ? <p className="text-slate-500">{t('Enter a URL such as http://192.168.1.10/ or a name your DNS server knows.')}</p>
        : result.ok ? <><p className="text-xs font-semibold text-emerald-700">HTTP {result.status}</p><p className="mt-2 whitespace-pre-wrap leading-6">{result.body}</p></>
          : <p className="font-semibold text-rose-700">{t(result.message)}</p>}
    </div>
  </div>
}

/** Server services: the HTTP page and the DNS A records. */
export function ServerServices({ device, onChange }) {
  const { t } = useI18n()
  const { http, dns } = device.config.services
  const [record, setRecord] = useState({ name: '', ip: '' })
  const [error, setError] = useState('')
  function addRecord(event) {
    event.preventDefault()
    if (!/^[a-z0-9]([a-z0-9.-]{0,62})$/i.test(record.name) || !isIp(record.ip)) { setError(t('Enter a host name (letters, digits, dots, hyphens) and an IPv4 address.')); return }
    setError(''); onChange({ http, dns: { ...dns, records: [...dns.records.filter(item => item.name.toLowerCase() !== record.name.toLowerCase()), record] } }); setRecord({ name: '', ip: '' })
  }
  return <div className="space-y-4 text-sm">
    <fieldset className="space-y-2 rounded-md border border-line p-3">
      <legend className="px-1 font-semibold">HTTP</legend>
      <label className="flex items-center gap-2"><input type="checkbox" checked={http.enabled} onChange={event => onChange({ http: { ...http, enabled: event.target.checked }, dns })} className="accent-teal-700" />{t('Serve web pages on TCP port 80')}</label>
      <label className="block">{t('Page text')}<textarea value={http.page} maxLength={2000} rows={3} onChange={event => onChange({ http: { ...http, page: event.target.value }, dns })} className={fieldClass} /></label>
    </fieldset>
    <fieldset className="space-y-2 rounded-md border border-line p-3">
      <legend className="px-1 font-semibold">DNS</legend>
      <label className="flex items-center gap-2"><input type="checkbox" checked={dns.enabled} onChange={event => onChange({ http, dns: { ...dns, enabled: event.target.checked } })} className="accent-teal-700" />{t('Answer DNS queries on UDP port 53')}</label>
      <ul className="space-y-1">{dns.records.map(item => <li key={item.name} className="flex flex-wrap items-center justify-between gap-2 rounded bg-surface-sunken px-2 py-1 font-mono text-xs">{item.name} A {item.ip}
        <button type="button" className="font-sans text-xs font-semibold text-rose-700 underline" onClick={() => onChange({ http, dns: { ...dns, records: dns.records.filter(other => other.name !== item.name) } })}>{t('Remove {name}', { name: item.name })}</button></li>)}</ul>
      <form onSubmit={addRecord} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs">{t('Name')}<input value={record.name} onChange={event => setRecord({ ...record, name: event.target.value.trim() })} className={fieldClass} /></label>
        <label className="text-xs">{t('IPv4 address')}<input value={record.ip} onChange={event => setRecord({ ...record, ip: event.target.value.trim() })} className={fieldClass} /></label>
        <button type="submit" className={`${secondaryClass} self-end`}>{t('Add record')}</button>
      </form>
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </fieldset>
  </div>
}

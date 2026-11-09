import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { SECURITY_BRIDGES, getTopic } from './learningMap.js'
import { BridgeCard } from './ConnectedMap.jsx'

/** Short labels for the diagram; the cards and links use the full course titles. */
const LABELS = {
  'net-foundations': 'Network layers', 'net-services': 'DHCP and DNS', 'net-vlans': 'VLANs', 'net-acl': 'Access lists', 'net-nat': 'NAT and PAT',
  'cyber-http': 'Reading HTTP', 'cyber-sql': 'SQL injection', 'cyber-capstone': 'Hardening capstone', 'cyber-ssrf': 'Server-side request forgery', 'cyber-idor': 'Object authorization',
}
const side = kind => [...new Map(SECURITY_BRIDGES.flatMap(bridge => bridge.steps.filter(step => step.kind === kind)).map(step => [step.id, step])).values()]

/**
 * Networking ↔ web security, course by course. The diagram pairs the networking courses (left)
 * with the security courses (right) each bridge joins; the selected bridge is drawn in teal.
 */
export default function SecurityBridges({ current }) {
  const { t } = useI18n()
  const [selectedId, setSelectedId] = useState(SECURITY_BRIDGES[0].id)
  const bridge = SECURITY_BRIDGES.find(item => item.id === selectedId)
  const left = side('networking'), right = side('cyber')
  const rows = Math.max(left.length, right.length), height = rows * 40 + 16
  const y = (list, id) => 24 + list.findIndex(step => step.id === id) * 40 + (rows - list.length) * 20
  const other = getTopic(current === 'networking' ? 'cybersecurity' : 'networking')
  return <section id="security-bridges" aria-labelledby="security-bridges-title" className="mb-8 scroll-mt-6 rounded-lg border border-line bg-white p-5">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id="security-bridges-title" className="text-lg font-semibold text-ink">{t('Networking ↔ cybersecurity')}</h2>
      <Link to={other.hub} className="text-sm font-semibold text-brand-700 underline focus:outline-none focus:ring-2 focus:ring-brand-500">{t(current === 'networking' ? 'Open the cybersecurity courses' : 'Open the networking courses')}</Link>
    </div>
    <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{t('Each bridge pairs networking courses with web-security courses that look at the same traffic from another layer: who can connect, and what a permitted request may do.')}</p>
    <svg viewBox={`0 0 640 ${height}`} aria-hidden="true" className="mt-4 hidden h-auto w-full max-w-2xl sm:block">
      {SECURITY_BRIDGES.flatMap(item => item.steps.filter(step => step.kind === 'networking').flatMap(a => item.steps.filter(step => step.kind === 'cyber').map(b =>
        <line key={`${item.id}-${a.id}-${b.id}`} x1="232" y1={y(left, a.id)} x2="408" y2={y(right, b.id)} strokeWidth={item.id === selectedId ? 3 : 1.5} strokeDasharray="6 5"
          className={item.id === selectedId ? 'stroke-brand-600' : 'stroke-slate-300'} />)))}
      {left.map(step => <g key={step.id}><circle cx="232" cy={y(left, step.id)} r="5" className={bridge.steps.some(item => item.id === step.id) ? 'fill-brand-600' : 'fill-slate-400'} />
        <text x="222" y={y(left, step.id) + 4} textAnchor="end" fontSize="13" className="fill-ink">{t(LABELS[step.id] ?? step.title)}</text></g>)}
      {right.map(step => <g key={step.id}><circle cx="408" cy={y(right, step.id)} r="5" className={bridge.steps.some(item => item.id === step.id) ? 'fill-brand-600' : 'fill-slate-400'} />
        <text x="418" y={y(right, step.id) + 4} fontSize="13" className="fill-ink">{t(LABELS[step.id] ?? step.title)}</text></g>)}
    </svg>
    <div role="group" aria-label={t('Networking and security bridges')} className="mt-4 flex flex-wrap gap-2">
      {SECURITY_BRIDGES.map(item => <button key={item.id} type="button" aria-pressed={item.id === selectedId} onClick={() => setSelectedId(item.id)}
        className={`min-h-9 rounded-md border px-3 py-1 text-left text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${item.id === selectedId ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-white text-ink hover:border-brand-500'}`}>{t(item.title)}</button>)}
    </div>
    <BridgeCard bridge={bridge} titleId="security-bridge-title" level={3} />
  </section>
}

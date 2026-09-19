import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'

/** Navigation only; curriculum and execution stay in the lazy route. */
export default function ComputerPromo() {
  const { t } = useI18n()
  return <section className="mb-7 rounded-lg border border-teal-200 bg-teal-50 p-5" aria-label={t('Computer architecture & assembly')}><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Computer architecture & assembly')}</p><h2 className="mt-2 text-xl font-semibold">{t('From logic gates to your own computer')}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{t('18 courses about gates, binary arithmetic, latches, registers, memory, CPU control and assembly. Build and test modules, then transfer the ideas to a Minecraft redstone computer or another medium.')}</p><div className="mt-4 flex flex-wrap gap-3">{[['/computer-architecture', 'Explore computer fundamentals'], ['/computer-architecture?stage=assembly', 'Assembly courses'], ['/sandbox?bench=computer', 'Open computer sandbox']].map(([to, text]) => <Link key={to} to={to} className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500">{t(text)}</Link>)}</div></section>
}

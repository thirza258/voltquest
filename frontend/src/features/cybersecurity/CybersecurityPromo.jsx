import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'

/** Navigation-only card: do not pull the curriculum or lab engine into other learning routes. */
export default function CybersecurityPromo() {
  const { t } = useI18n()
  return <section className="mb-7 rounded-lg border border-teal-200 bg-teal-50 p-5" aria-label={t('Cybersecurity learning path')}>
    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Cybersecurity learning path')}</p>
    <h2 className="mt-2 text-xl font-semibold">{t('Find the flaw. Understand it. Fix it.')}</h2>
    <p className="mt-2 text-sm leading-6 text-ink-secondary">{t('Ten web security courses with guided vulnerability labs, editable requests, practice questions and exams. Investigate a fictional shop, apply defenses and verify your fixes.')}</p>
    <div className="mt-4 flex flex-wrap gap-3"><Link to="/cybersecurity" className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500">{t('Explore cybersecurity courses')}</Link><Link to="/sandbox?bench=cybersecurity" className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500">{t('Open cybersecurity sandbox')}</Link></div>
  </section>
}

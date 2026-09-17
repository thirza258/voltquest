import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'

/** Keep the numerical runtime and curriculum out of unrelated learning routes. */
export default function MatlabPromo() {
  const { t } = useI18n()
  return <section className="mb-7 rounded-lg border border-teal-200 bg-teal-50 p-5" aria-label={t('MATLAB learning path')}>
    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('MATLAB learning path')}</p><h2 className="mt-2 text-xl font-semibold">{t('MATLAB: compute, model and simulate')}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{t('Eighteen courses from arrays and plotting to simulation, optimization and parallel computing. Includes section questions, exams, a searchable function reference and an editable numerical sandbox.')}</p><div className="mt-4 flex flex-wrap gap-3"><Link to="/matlab" className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500">{t('Explore MATLAB courses')}</Link><Link to="/sandbox?bench=matlab" className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500">{t('Open MATLAB sandbox')}</Link></div>
  </section>
}

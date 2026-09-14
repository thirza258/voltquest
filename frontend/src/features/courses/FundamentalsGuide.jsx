import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { getTutorialFundamentals } from './fundamentals.js'

export const fundamentalsLinkClass = 'inline-block min-h-8 rounded text-sm font-medium text-brand-700 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-brand-500'

export function FundamentalsExplanation({ guide }) {
  const { t } = useI18n()
  return <div>
    <h3 className="text-base font-semibold text-ink">{t(guide.topic)}</h3>
    <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <p className="text-sm leading-7 text-ink-secondary">{t(guide.explanation)}</p>
      <div className="rounded-md bg-surface-sunken p-4"><h4 className="text-sm font-semibold text-ink">{t('What to observe')}</h4><p className="mt-2 text-sm leading-relaxed text-ink-secondary">{t(guide.observation)}</p></div>
    </div>
  </div>
}

export default function FundamentalsGuide({ tutorialId }) {
  const { t } = useI18n()
  const guide = getTutorialFundamentals(tutorialId)
  if (!guide) return null
  return <section className="mb-6 min-w-0 rounded-lg border border-teal-200 bg-white p-5" aria-labelledby="tutorial-fundamentals-title">
    <h2 id="tutorial-fundamentals-title" className="mb-4 text-xl font-semibold text-ink">{t('Fundamentals behind this tutorial')}</h2>
    <FundamentalsExplanation guide={guide} />
    <Link className={`${fundamentalsLinkClass} mt-3`} to={`/courses?tutorial=${tutorialId}#tutorial-fundamentals`} target="_blank" rel="noopener noreferrer">{t('Study related course sections')}</Link>
    <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('Course links open in a new tab so your current experiment or answers stay here.')}</p>
  </section>
}

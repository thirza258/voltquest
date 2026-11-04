import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { CONNECTED_PATH, nextStepOf, prerequisiteOf } from './learningPath.js'

/**
 * The combined view of the connected path. `current` is the stage whose hub
 * renders it, so the same component marks "you are here" on every page.
 */
export default function ConnectedPath({ current }) {
  const { t } = useI18n()
  if (!current) return null
  const next = nextStepOf(current)
  return <section aria-label={t('Connected learning path')} className="mb-8 rounded-lg border border-line bg-white p-5">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-lg font-semibold text-ink">{t('Connected learning path')}</h2>
      <p className="text-sm text-slate-600">{t('Electronics → robotics → vision. Each stage builds on the one before it.')}</p>
    </div>
    <ol className="mt-4 grid gap-3 md:grid-cols-3">
      {CONNECTED_PATH.map((stage, index) => {
        const here = stage.id === current
        const prerequisite = prerequisiteOf(stage.id)
        return <li key={stage.id} aria-current={here ? 'step' : undefined} className={`flex min-w-0 flex-col rounded-lg border p-4 ${here ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-line'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t('Stage {number}', { number: index + 1 })}</p>
          <h3 className="mt-1 text-base font-semibold text-ink">{t(stage.title)}</h3>
          {here ? <p className="mt-1 text-xs font-semibold text-brand-700">{t('You are here')}</p>
            : <Link to={stage.href} className="mt-1 text-xs font-semibold text-brand-700 underline focus:outline-none focus:ring-2 focus:ring-brand-500">{t('Open stage')}</Link>}
          <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-secondary">{t(stage.summary)}</p>
          <p className="mt-3 text-xs text-slate-600">{prerequisite ? t('Prerequisite: {stage}', { stage: t(prerequisite.title) }) : t('Starting point')}</p>
          <nav aria-label={t('Resources for {stage}', { stage: t(stage.title) })} className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-brand-700">
            <Link to={stage.startHref} className="underline focus:outline-none focus:ring-2 focus:ring-brand-500">{t(stage.startLabel)}</Link>
            <Link to={stage.labHref} className="underline focus:outline-none focus:ring-2 focus:ring-brand-500">{t(stage.labLabel)}</Link>
          </nav>
        </li>
      })}
    </ol>
    <p className="mt-4 border-t border-line pt-3 text-sm text-slate-600">{next
      ? <>{t('Next step')}: <Link className="font-semibold text-brand-700 underline focus:outline-none focus:ring-2 focus:ring-brand-500" to={next.href}>{t(next.title)}</Link></>
      : t('End of the connected path. The vision capstone combines all three stages.')}</p>
  </section>
}

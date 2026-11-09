import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { connectionsAt, getTopic, hasConnections } from './learningMap.js'

const linkClass = 'rounded font-medium text-brand-700 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-brand-500'

/**
 * The connected learning map seen from one lesson page: the bridges this lesson is a step of
 * (with the steps on either side), the foundation courses it is built on, and where a foundation
 * course is used. Renders nothing for lessons that are not on the map.
 */
export default function LessonConnections({ href, className = '' }) {
  const { t } = useI18n()
  if (!hasConnections(href)) return null
  const { bridges, usedIn, builtOn } = connectionsAt(href)
  return <section id="connected-courses" aria-labelledby="connected-courses-title" className={`min-w-0 scroll-mt-6 rounded-lg border border-line bg-white p-5 sm:p-6 ${className}`}>
    <h2 id="connected-courses-title" className="text-xl font-semibold text-ink">{t('Connected courses')}</h2>
    <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{t('This lesson is part of the connected learning map. Follow a bridge to see the same idea from another topic.')} {t('Links open in a new tab, so your work on this page stays as it is.')}</p>
    {bridges.length > 0 && <ul className="mt-4 grid gap-3 md:grid-cols-2">{bridges.map(({ bridge, index, previous, next }) => {
      const [a, b] = bridge.between.map(getTopic)
      return <li key={bridge.id} className="min-w-0 rounded-lg border border-line p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t(a.short)} ↔ {t(b.short)}</p>
        <h3 className="mt-1 font-semibold text-ink">{t(bridge.title)}</h3>
        <p className="mt-1 text-xs text-slate-600">{t('Step {number} of {total}', { number: index + 1, total: bridge.steps.length })}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{t(bridge.steps[index].note)}</p>
        <nav aria-label={t('Bridge steps: {title}', { title: t(bridge.title) })} className="mt-3 flex flex-col gap-1.5 text-sm">
          {previous && <p className="min-w-0"><span className="text-slate-600">{t('Previous step')}: </span><Link to={previous.href} className={linkClass} target="_blank" rel="noopener noreferrer">{t(previous.title)}</Link></p>}
          {next ? <p className="min-w-0"><span className="text-slate-600">{t('Next step')}: </span><Link to={next.href} className={linkClass} target="_blank" rel="noopener noreferrer">{t(next.title)}</Link></p>
            : <p className="text-slate-600">{t('Last step of this bridge')}</p>}
        </nav>
      </li>
    })}</ul>}
    {builtOn.length > 0 && <div className="mt-5">
      <h3 className="font-semibold text-ink">{t('Built on')}</h3>
      <ul className="mt-2 space-y-2 text-sm">{builtOn.map(link => <li key={`${link.course.id}-${link.lesson.id}`} className="min-w-0 leading-relaxed">
        <span className="text-xs font-semibold text-slate-600">{t(getTopic(link.foundation).short)}: </span><Link to={link.course.href} className={linkClass} target="_blank" rel="noopener noreferrer">{t(link.course.title)}</Link>
        <span className="text-ink-secondary"> — {t(link.note)}</span>
      </li>)}</ul>
    </div>}
    {usedIn.length > 0 && <div className="mt-5">
      <h3 className="font-semibold text-ink">{t('Used in')}</h3>
      <ul className="mt-2 space-y-2 text-sm">{usedIn.map(link => <li key={`${link.course.id}-${link.lesson.id}`} className="min-w-0 leading-relaxed">
        <span className="text-xs font-semibold text-slate-600">{t(getTopic(link.topic).short)}: </span><Link to={link.lesson.href} className={linkClass} target="_blank" rel="noopener noreferrer">{t(link.lesson.title)}</Link>
        <span className="text-ink-secondary"> — {t(link.note)}</span>
      </li>)}</ul>
    </div>}
  </section>
}

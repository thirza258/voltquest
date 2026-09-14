import { useEffect, useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { getTutorialFundamentals } from './fundamentals.js'
import { getFundamentalReading, getLearningTutorial, LEARNING_GROUPS, LEARNING_TUTORIALS } from './learningCatalog.js'
import { FundamentalsExplanation, fundamentalsLinkClass } from './FundamentalsGuide.jsx'

export default function FundamentalsExplorer() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const sectionRef = useRef(null)
  const tutorial = getLearningTutorial(params.get('tutorial'))
  const guide = getTutorialFundamentals(tutorial?.id)
  useEffect(() => {
    if (hash === '#tutorial-fundamentals') sectionRef.current?.scrollIntoView?.({ block: 'start' })
  }, [hash, tutorial?.id])

  function selectTutorial(id) {
    const next = new URLSearchParams(params)
    if (id) next.set('tutorial', id)
    else next.delete('tutorial')
    setParams(next, { replace: true })
  }

  return <section id="tutorial-fundamentals" ref={sectionRef} className="mb-7 scroll-mt-6 rounded-lg border border-teal-200 bg-white p-5 sm:p-6" aria-labelledby="fundamentals-explorer-title">
    <h2 id="fundamentals-explorer-title" className="text-xl font-semibold text-ink">{t('Find the fundamentals for your tutorial')}</h2>
    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">{t('Choose any tutorial to see why it works, what to observe and which course sections explain the underlying ideas.')}</p>
    <p className="mt-2 text-sm text-slate-600">{t('Explore the fundamentals for all {count} tutorials and labs.', { count: LEARNING_TUTORIALS.length })}</p>
    <label className="mt-4 block max-w-2xl text-sm font-medium text-ink-secondary"><span>{t('Choose a tutorial')}</span>
      <select className="mt-2 block h-11 w-full min-w-0 rounded-md border border-line-strong bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" value={tutorial?.id ?? ''} onChange={event => selectTutorial(event.target.value)}>
        <option value="">{t('Select a tutorial…')}</option>
        {LEARNING_GROUPS.map(group => <optgroup key={group.id} label={t(group.title)}>{group.entries.map(entry => <option key={entry.id} value={entry.id}>{t(entry.title)}</option>)}</optgroup>)}
      </select>
    </label>
    {guide && <div className="mt-6 border-t border-line pt-5" aria-label={t('Fundamentals behind this tutorial')}>
      <FundamentalsExplanation guide={guide} />
      <nav className="mt-5" aria-label={t('Read the course sections')}><h3 className="font-semibold text-ink">{t('Read the course sections')}</h3><ul className="mt-3 grid gap-3 md:grid-cols-2">
        {guide.readings.map(reading => {
          const target = getFundamentalReading(reading)
          return <li key={`${reading.courseId}:${reading.lessonId}`}><Link to={target.path} target="_blank" rel="noopener noreferrer" className={`${fundamentalsLinkClass} w-full rounded-md border border-line p-3`}><span className="block">{t(target.sectionTitle)}</span><span className="mt-1 block text-xs font-normal text-slate-600">{t(target.courseTitle)}</span></Link></li>
        })}
      </ul></nav>
      <Link className={`${fundamentalsLinkClass} mt-4`} to={tutorial.path} target="_blank" rel="noopener noreferrer">{t('Open tutorial in a new tab')}</Link>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{t('Course links open in a new tab so your current experiment or answers stay here.')}</p>
    </div>}
  </section>
}

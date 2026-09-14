import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { fundamentalsForCourse } from './fundamentals.js'
import { getLearningTutorial } from './learningCatalog.js'
import { FundamentalsExplanation, fundamentalsLinkClass } from './FundamentalsGuide.jsx'

export default function CourseTutorialFundamentals({ courseId }) {
  const { t } = useI18n()
  const guides = fundamentalsForCourse(courseId)
  if (!guides.length) return null
  return <section id="tutorial-fundamentals" className="min-w-0 scroll-mt-6 rounded-lg border border-line bg-white p-5 sm:p-6" aria-labelledby="course-fundamentals-title">
    <h2 id="course-fundamentals-title" className="text-xl font-semibold text-ink">{t('Tutorial fundamentals')}</h2>
    <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{t('See how these principles explain the code, circuit or behavior in each related tutorial. Open a guide for an explanation and an observation to try.')}</p>
    <div className="mt-5 space-y-3">{guides.map(guide => {
      const tutorial = getLearningTutorial(guide.tutorialId)
      return <details key={tutorial.id} id={`fundamentals-${tutorial.id}`} className="scroll-mt-6 rounded-md border border-line p-4">
        <summary className="min-h-8 cursor-pointer rounded text-base font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500">{t(tutorial.title)}</summary>
        <div className="mt-4"><FundamentalsExplanation guide={guide} /><Link className={`${fundamentalsLinkClass} mt-3`} to={tutorial.path} target="_blank" rel="noopener noreferrer">{t('Open tutorial in a new tab')}</Link></div>
      </details>
    })}</div>
  </section>
}

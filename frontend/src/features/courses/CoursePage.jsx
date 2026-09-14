import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, FlaskConical } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { Badge } from '../../ui/index.js'
import { COURSES, getCourse, getTrack } from './content.js'
import { readCourseProgress, saveCourseProgress } from './progress.js'
import { courseLinkClass } from './CoursesPage.jsx'
import Assessment from './Assessment.jsx'
import CourseTutorialFundamentals from './CourseTutorialFundamentals.jsx'
import { fundamentalsForCourse } from './fundamentals.js'
import CourseCodeExample from './CourseCodeExample.jsx'

const panelClass = 'min-w-0 rounded-lg border border-line bg-white p-5 sm:p-6'

export default function CoursePage() {
  const { courseId } = useParams()
  const { t } = useI18n()
  const course = getCourse(courseId)
  if (!course) return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-4xl p-8"><h1 className="mb-4 text-2xl font-semibold">{t('Course not found')}</h1><Link to="/courses" className={courseLinkClass}>{t('Browse courses')}</Link></main></div>
  // Course identity resets in-progress choices; locale changes keep the same mounted session.
  return <CourseSession key={course.id} course={course} />
}

function CourseSession({ course }) {
  const { t } = useI18n()
  const { hash } = useLocation()
  const [progress, setProgress] = useState(() => readCourseProgress(course))
  const [storageFailed, setStorageFailed] = useState(false)
  const headingRef = useRef(null)
  const track = getTrack(course.track)
  const siblings = COURSES.filter(item => item.track === course.track)
  const index = siblings.findIndex(item => item.id === course.id)
  const previous = siblings[index - 1]
  const next = siblings[index + 1]
  useEffect(() => {
    const section = hash ? document.getElementById(hash.slice(1)) : null
    if (section) {
      if (section.tagName === 'DETAILS') section.open = true
      section.scrollIntoView?.({ block: 'start' })
    } else headingRef.current?.focus()
  }, [hash])

  function save(nextProgress) {
    setProgress(nextProgress)
    setStorageFailed(!saveCourseProgress(course, nextProgress))
  }
  function markRead(id) {
    save({ ...progress, read: progress.read.includes(id) ? progress.read.filter(item => item !== id) : [...progress.read, id] })
  }
  function recordExam(result) {
    const stored = readCourseProgress(course)
    save({ ...progress, attempts: Math.max(progress.attempts, stored.attempts) + 1,
      bestPercent: Math.max(progress.bestPercent ?? 0, stored.bestPercent ?? 0, result.percent), lastPercent: result.percent })
  }

  return <div className="min-h-screen bg-surface-page">
    <AppHeader />
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <Link to={`/courses?track=${course.track}`} className={courseLinkClass}><ArrowLeft size={16} />{t(track.title)}</Link>
      <header className="my-6 max-w-4xl">
        <div className="mb-3 flex flex-wrap gap-2"><Badge tone="brand">{t('Course {number} of {total}', { number: course.order, total: siblings.length })}</Badge><Badge>{t(course.difficulty)}</Badge><Badge>{t('{minutes} min', { minutes: course.minutes })}</Badge></div>
        <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-ink outline-none sm:text-4xl">{t(course.title)}</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-secondary">{t(course.summary)}</p>
        <p className="mt-3 text-sm text-slate-600">{t('Progress is saved in this browser, shared by people using it. These self-study exams do not award campaign XP or certification.')}</p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className={`${panelClass} lg:sticky lg:top-6`} aria-label={t('Course outline')}>
          <h2 className="font-semibold text-ink">{t('In this course')}</h2>
          <nav className="mt-4 flex flex-col gap-3 text-sm" aria-label={t('Course sections')}>
            {course.lessons.map((lesson, i) => <a key={lesson.id} href={`#${lesson.id}`} className={courseLinkClass}>{progress.read.includes(lesson.id) && <CheckCircle2 size={14} className="shrink-0" />}{i + 1}. {t(lesson.title)}</a>)}
            {fundamentalsForCourse(course.id).length > 0 && <a href="#tutorial-fundamentals" className={courseLinkClass}>{t('Tutorial fundamentals')}</a>}
            <a href="#worked-example" className={courseLinkClass}>{t('Worked example')}</a>
            {course.codeExample && <a href="#code-example" className={courseLinkClass}>{t('Code walkthrough and experiment')}</a>}
            <a href="#formulas" className={courseLinkClass}>{t('Theory and formulas')}</a>
            <a href="#application" className={courseLinkClass}>{t('Apply it to a device')}</a>
            <a href="#practice" className={courseLinkClass}>{t('Practice questions')}</a>
            <a href="#exam" className={courseLinkClass}>{t('Course exam')}</a>
          </nav>
          <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-slate-600">
            <p>{t('{count} of 3 lessons read', { count: progress.read.length })}</p>
            <p>{t('Exam attempts: {count}', { count: progress.attempts })}</p>
            {progress.bestPercent !== null && <><p className="font-medium text-brand-700">{t('Best exam score: {percent}%', { percent: progress.bestPercent })}</p><p>{t('Last exam score: {percent}%', { percent: progress.lastPercent })}</p></>}
            {progress.bestPercent >= course.exam.passPercent && <p className="font-semibold text-emerald-700">{t('Exam passed')}</p>}
          </div>
          {course.prerequisites.length > 0 && <div className="mt-5 border-t border-line pt-4 text-sm"><h3 className="mb-2 font-semibold text-ink">{t('Recommended preparation')}</h3>{course.prerequisites.map(id => <Link key={id} to={`/courses/${id}`} className={courseLinkClass}>{t(getCourse(id).title)}</Link>)}<p className="mt-2 text-slate-600">{t('You can study any course without unlocking it first.')}</p></div>}
        </aside>
        <div className="min-w-0 space-y-6">
          {storageFailed && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t('This browser could not save progress. You can keep learning, but this visit’s progress may be lost after leaving.')}</p>}
          {course.lessons.map((lesson, i) => <section key={lesson.id} id={lesson.id} className={`${panelClass} scroll-mt-6`} aria-labelledby={`${lesson.id}-title`}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Lesson {number}', { number: i + 1 })}</p>
            <h2 id={`${lesson.id}-title`} className="text-xl font-semibold text-ink">{t(lesson.title)}</h2>
            <p className="mt-4 text-base leading-7 text-ink-secondary">{t(lesson.text)}</p>
            <label className="mt-5 inline-flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium text-brand-700"><input type="checkbox" checked={progress.read.includes(lesson.id)} onChange={() => markRead(lesson.id)} className="h-4 w-4 accent-teal-700 focus:ring-2 focus:ring-brand-500" />{t('Mark lesson {number} as read', { number: i + 1 })}</label>
          </section>)}
          <CourseTutorialFundamentals courseId={course.id} />
          <section id="worked-example" className={`${panelClass} scroll-mt-6`} aria-labelledby="example-title"><h2 id="example-title" className="text-xl font-semibold text-ink">{t('Worked example')}</h2><p className="mt-4 text-base leading-7 text-ink-secondary">{t(course.workedExample)}</p></section>
          {course.codeExample && <CourseCodeExample course={course} />}
          <section id="formulas" className={`${panelClass} scroll-mt-6`} aria-labelledby="formulas-title">
            <h2 id="formulas-title" className="text-xl font-semibold text-ink">{t('Theory and formulas')}</h2>
            <div className="mt-5 space-y-5">{course.formulas.map(formula => <article key={formula.title} className="min-w-0 rounded-lg border border-line p-4">
              <h3 className="font-semibold text-ink">{t(formula.title)}</h3>
              <p className="my-4 overflow-x-auto rounded-md bg-surface-sunken p-3 font-mono text-base leading-relaxed text-ink">{formula.equation}</p>
              <dl className="space-y-3 text-sm leading-relaxed text-ink-secondary">
                <div><dt className="font-semibold text-ink">{t('Symbols and units')}</dt><dd className="mt-1">{t(formula.symbols)}</dd></div>
                <div><dt className="font-semibold text-ink">{t('When this formula applies')}</dt><dd className="mt-1">{t(formula.assumptions)}</dd></div>
                <div><dt className="font-semibold text-brand-700">{t('Worked calculation')}</dt><dd className="mt-1">{t(formula.example)}</dd></div>
              </dl>
            </article>)}</div>
          </section>
          <section id="application" className={`${panelClass} scroll-mt-6`} aria-labelledby="application-title">
            <h2 id="application-title" className="text-xl font-semibold text-ink">{t('Apply it to a device')}</h2><p className="mt-4 text-base leading-7 text-ink-secondary">{t(course.application)}</p>
            {[course.lab, ...(course.extraLabs ?? [])].map((lab, i) => <div key={lab.tutorialId} className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4"><h3 className="flex items-center gap-2 font-semibold text-ink"><FlaskConical size={18} />{t('Related circuit lab')} {course.extraLabs?.length ? i + 1 : ''}</h3><p className="mt-2 text-sm leading-relaxed text-ink-secondary">{t(lab.task)}</p><Link to={`/tutorials/${lab.tutorialId}`} target="_blank" rel="noopener noreferrer" className={`${courseLinkClass} mt-3`}>{t('Open related lab in a new tab')}<ArrowRight size={14} /></Link><p className="mt-2 text-xs text-slate-600">{t('The lab opens separately so your current exam choices stay here. It practises selected concepts with prepared wiring.')}</p></div>)}
          </section>
          <section id="practice" className={`${panelClass} scroll-mt-6`} aria-labelledby="practice-title"><h2 id="practice-title" className="mb-4 text-xl font-semibold text-ink">{t('Practice questions')}</h2><Assessment questions={course.practice} /></section>
          <section id="exam" className={`${panelClass} scroll-mt-6`} aria-labelledby="exam-title"><h2 id="exam-title" className="mb-4 text-xl font-semibold text-ink">{t('Course exam')}</h2><Assessment questions={course.exam.questions} exam passPercent={course.exam.passPercent} onResult={recordExam} /></section>
          {course.sources.length > 0 && <section className={panelClass} aria-labelledby="sources-title"><h2 id="sources-title" className="text-lg font-semibold text-ink">{t('Reference reading')}</h2><ul className="mt-3 space-y-3 text-sm">{course.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className={courseLinkClass}>{source.title}</a></li>)}</ul></section>}
          <nav className="flex flex-col justify-between gap-4 border-t border-line pt-6 text-sm sm:flex-row" aria-label={t('Course navigation')}>
            {previous ? <Link to={`/courses/${previous.id}`} className={courseLinkClass}><ArrowLeft size={16} />{t('Previous course')}</Link> : <Link to="/courses" className={courseLinkClass}>{t('All courses')}</Link>}
            {next ? <Link to={`/courses/${next.id}`} className={courseLinkClass}>{t('Next course')}<ArrowRight size={16} /></Link> : <Link to={course.track === 'electrical' ? '/courses?track=iot-parts' : '/courses'} className={courseLinkClass}>{t(course.track === 'electrical' ? 'Explore IoT parts courses' : 'Back to all courses')}<ArrowRight size={16} /></Link>}
          </nav>
        </div>
      </div>
    </main>
  </div>
}

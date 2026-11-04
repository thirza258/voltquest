import CourseRewards from './CourseRewards.jsx'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, CheckCircle2, Clock } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { Badge, EmptyState } from '../../ui/index.js'
import { COURSES, COURSE_TRACKS } from './content.js'
import { readCourseProgress } from './progress.js'
import { fundamentalsForCourse } from './fundamentals.js'
import { getLearningTutorial } from './learningCatalog.js'
import FundamentalsExplorer from './FundamentalsExplorer.jsx'
import AllCoursesSection from './AllCoursesSection.jsx'
import ConnectedPath from './ConnectedPath.jsx'

const fieldClass = 'h-10 w-full rounded-md border border-line-strong bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
export const courseLinkClass = 'inline-flex items-center gap-2 rounded-md font-medium text-brand-700 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500'

export default function CoursesPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const track = params.get('track') ?? ''
  const difficulty = params.get('difficulty') ?? ''
  const query = params.get('q') ?? ''
  const matches = COURSES.filter(course => (!track || course.track === track)
    && (!difficulty || course.difficulty === difficulty)
    && [course.title, course.summary, ...course.lessons.map(lesson => lesson.title),
      ...fundamentalsForCourse(course.id).flatMap(guide => [guide.topic, getLearningTutorial(guide.tutorialId).title])]
      .flatMap(text => [text, t(text)]).join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const progress = Object.fromEntries(COURSES.map(course => [course.id, readCourseProgress(course)]))
  const passed = COURSES.filter(course => progress[course.id].bestPercent >= course.exam.passPercent).length
  function filter(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return <div className="min-h-screen bg-surface-page">
    <AppHeader />
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <CourseRewards />
      <Link to="/tutorials" className={courseLinkClass}>{t('Back to tutorials')}</Link>
      <div className="my-7 max-w-3xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-700">{t('Learn the principles. Write the program. Build the device.')}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{t('Programming, electronics & IoT courses')}</h1>
        <p className="mt-4 text-base leading-relaxed text-ink-secondary">{t('Learn C and Arduino C++ for Uno, Nano and ESP32 alongside electronics, IoT and drone foundations. Study examples, experiment in guided labs, answer practice questions and take a course exam.')}</p>
        <div className="mt-5 flex flex-wrap gap-2"><Badge tone="brand"><BookOpen size={12} />{t('{count} courses', { count: COURSES.length })}</Badge><Badge>{t('Fundamental → Intermediate')}</Badge><Badge tone="success">{t('{count} exams passed', { count: passed })}</Badge></div>
        <p className="mt-4 text-sm text-slate-600">{t('Progress is saved in this browser, shared by people using it. These self-study exams do not award campaign XP or certification.')}</p>
      </div>
      <nav className="mb-6 flex flex-wrap gap-4" aria-label={t('Continue your learning path')}><Link to="/courses?track=programming" className={courseLinkClass}>{t('C, C++ & Arduino / ESP32 programming')}</Link><Link to="/robotics" className={courseLinkClass}>{t('Robotics & ROS 2 learning path')}</Link><Link to="/vision" className={courseLinkClass}>{t('Computer vision: OpenCV, transformers & integration')}</Link></nav>
      <ConnectedPath current="electronics" />
      <AllCoursesSection className="mb-8" />
      <FundamentalsExplorer />
      <div className="mb-7 grid gap-4 rounded-lg border border-line bg-white p-4 md:grid-cols-3">
        <label className="space-y-1 text-sm text-ink-secondary"><span>{t('Search courses')}</span><input type="search" value={query} onChange={event => filter('q', event.target.value)} className={fieldClass} /></label>
        <label className="space-y-1 text-sm text-ink-secondary"><span>{t('Learning track')}</span><select value={track} onChange={event => filter('track', event.target.value)} className={fieldClass}><option value="">{t('All tracks')}</option>{COURSE_TRACKS.map(item => <option key={item.id} value={item.id}>{t(item.title)}</option>)}</select></label>
        <label className="space-y-1 text-sm text-ink-secondary"><span>{t('Course level')}</span><select value={difficulty} onChange={event => filter('difficulty', event.target.value)} className={fieldClass}><option value="">{t('All levels')}</option>{['Fundamental', 'Intermediate'].map(level => <option key={level} value={level}>{t(level)}</option>)}</select></label>
      </div>
      <p role="status" className="mb-5 text-sm text-slate-600">{t('{count} courses found', { count: matches.length })}</p>
      {COURSE_TRACKS.filter(item => !track || item.id === track).map(item => {
        const entries = matches.filter(course => course.track === item.id)
        if (!entries.length) return null
        const trackPassed = COURSES.filter(course => course.track === item.id && progress[course.id].bestPercent >= course.exam.passPercent).length
        return <section key={item.id} aria-labelledby={`track-${item.id}`} className="mb-10">
          <div className="mb-4"><h2 id={`track-${item.id}`} className="text-2xl font-semibold text-ink">{t(item.title)}</h2><p className="mt-2 text-sm text-ink-secondary">{t(item.summary)}</p><p className="mt-2 text-sm text-brand-700">{t('{count} of {total} exams passed', { count: trackPassed, total: COURSES.filter(course => course.track === item.id).length })}</p></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{entries.map(course => {
            const result = progress[course.id]
            return <Link key={course.id} to={`/courses/${course.id}`} className="group flex min-w-0 flex-col rounded-lg border border-line bg-white p-5 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><Badge tone={course.difficulty === 'Fundamental' ? 'brand' : 'info'}>{t('Course {number}', { number: course.order })} · {t(course.difficulty)}</Badge><span className="inline-flex items-center gap-1 text-xs text-slate-600"><Clock size={12} />{t('{minutes} min', { minutes: course.minutes })}</span></div>
              <h3 className="text-lg font-semibold text-ink group-hover:text-brand-700">{t(course.title)}</h3><p className="mt-2 flex-1 text-sm leading-relaxed text-ink-secondary">{t(course.summary)}</p>
              <p className="mt-4 text-xs text-slate-600">{t('3 lessons · 2 practice questions · 5-question exam')}</p>
              {fundamentalsForCourse(course.id).length > 0 && <p className="mt-2 text-xs text-brand-700">{t('Tutorial connections: {count}', { count: fundamentalsForCourse(course.id).length })}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">{result.bestPercent >= course.exam.passPercent ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} />{t('Passed')} · {result.bestPercent}%</span> : <span className="text-slate-600">{t('{count} of 3 lessons read', { count: result.read.length })}</span>}<span className="inline-flex items-center gap-1 font-medium text-brand-700">{t('Open course')}<ArrowRight size={14} /></span></div>
            </Link>
          })}</div>
        </section>
      })}
      {!matches.length && <EmptyState icon={<BookOpen />} title={t('No courses match')} description={t('Try another topic, track or course level.')} action={<button className={courseLinkClass} onClick={() => setParams({})}>{t('Clear filters')}</button>} />}
    </main>
  </div>
}

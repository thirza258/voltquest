import CourseRewards from '../courses/CourseRewards.jsx'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import content from '@content/cybersecurity.json'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { readCourseProgress } from '../courses/progress.js'
import SandboxBenchLayout from '../sandbox/SandboxBenchLayout.jsx'
import CyberCourse from './CyberCourse.jsx'
import CyberLab from './CyberLab.jsx'
import { fieldClass, linkClass, panelClass } from './styles.js'

export const CYBER_COURSES = content.courses

function CyberHub() {
  const { t } = useI18n()
  const [search, setSearch] = useSearchParams()
  const query = search.get('q') ?? '', difficulty = search.get('difficulty') ?? ''
  const progress = Object.fromEntries(CYBER_COURSES.map(course => [course.id, readCourseProgress(course)]))
  const passed = CYBER_COURSES.filter(course => progress[course.id].bestPercent >= course.exam.passPercent)
  const next = CYBER_COURSES.find(course => !passed.includes(course)) ?? CYBER_COURSES[0]
  const matches = CYBER_COURSES.filter(course => (!difficulty || course.difficulty === difficulty) && [course.title, course.summary, ...course.lessons.map(section => section.title)].flatMap(text => [text, t(text)]).join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  function filter(key, value) { const params = new URLSearchParams(search); value ? params.set(key, value) : params.delete(key); setSearch(params, { replace: true }) }
  return <>
    <Link to="/tutorials" className={linkClass}>{t('Back to tutorials')}</Link>
    <header className="my-7 overflow-hidden rounded-xl border border-teal-200 bg-teal-50 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-5"><div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-widest text-brand-700">{t('Cybersecurity learning path')} · {t('Fundamental → Advanced')}</p><h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{t('Find the flaw. Understand it. Fix it.')}</h1><p className="mt-4 text-base leading-7 text-ink-secondary">{t('Learn web security by investigating VoltShop, a fictional web application. Follow a request from input to impact, apply a defense and prove the intended behavior still works.')}</p></div><ShieldCheck size={72} strokeWidth={1.3} className="hidden shrink-0 text-brand-700 sm:block" aria-hidden="true" /></div>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-teal-900">{['10 courses · 40 theory sections', '10 guided labs · 30 practice questions', '10 exams · pass with 80%'].map(text => <span key={text} className="rounded-md border border-teal-200 bg-white px-3 py-2">{t(text)}</span>)}</div>
      <div className="mt-6 flex flex-wrap gap-3"><Link className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white focus:ring-2 focus:ring-brand-500" to={`/cybersecurity/${next.id}`}>{t('Continue the cybersecurity path')}<ArrowRight size={16} /></Link><Link className="rounded-md border border-brand-600 bg-white px-4 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500" to="/sandbox?bench=cybersecurity">{t('Open cybersecurity sandbox')}</Link></div>
    </header>
    <section className={`${panelClass} mb-6`} aria-label={t('Learning path stages')}><div className="grid gap-5 md:grid-cols-3">{[['01–03', 'Read requests and trust boundaries', 'HTTP, ownership checks and trusted session roles.'], ['04–07', 'Follow input to its impact', 'SQL, HTML output, file paths and state-changing requests.'], ['08–10', 'Investigate, repair and report', 'Server-side URLs, profile fields and a complete shop investigation.']].map(([range, title, description]) => <div key={range}><p className="font-mono text-xs text-brand-700">{range}</p><h2 className="mt-2 font-semibold">{t(title)}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{t(description)}</p></div>)}</div><p className="mt-5 border-t border-line pt-4 text-sm leading-6 text-slate-600">{t('Start with no security experience. Basic JSON helps; the first course explains HTTP. All topics are open, and the labs require no installation or external target.')}</p></section>
    <div className="mb-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">{t('Search cybersecurity courses')}<input type="search" className={`${fieldClass} mt-1`} value={query} onChange={event => filter('q', event.target.value)} /></label><label className="text-sm">{t('Course level')}<select className={`${fieldClass} mt-1`} value={difficulty} onChange={event => filter('difficulty', event.target.value)}><option value="">{t('All levels')}</option>{['Fundamental', 'Intermediate', 'Advanced'].map(level => <option key={level} value={level}>{t(level)}</option>)}</select></label></div>
    <p role="status" className="mb-5 text-sm text-slate-600">{t('{count} courses found', { count: matches.length })} · {t('{count} of {total} exams passed', { count: passed.length, total: CYBER_COURSES.length })}</p>
    <div className="grid gap-4 md:grid-cols-2">{matches.map(course => <Link key={course.id} to={`/cybersecurity/${course.id}`} className={`${panelClass} flex flex-col hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500`}><p className="text-xs font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')}</p><h2 className="mt-3 text-xl font-semibold">{t(course.title)}</h2><p className="mt-3 flex-1 text-sm leading-6 text-ink-secondary">{t(course.summary)}</p><p className="mt-4 text-xs text-slate-600">{t('4 lessons · guided tutorial · 3 practice questions · 5-question exam')}</p><div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm"><span className="text-slate-600">{progress[course.id].bestPercent >= course.exam.passPercent ? `${t('Passed')} · ${progress[course.id].bestPercent}%` : t('{count} of {total} sections read', { count: progress[course.id].read.length, total: course.lessons.length })}</span><span className="font-semibold text-brand-700">{t('Open course')} →</span></div></Link>)}</div>
    {!matches.length && <div className={panelClass}><h2 className="font-semibold">{t('No courses match')}</h2><button className={`${linkClass} mt-3 text-sm`} onClick={() => setSearch({})}>{t('Clear filters')}</button></div>}
    <p className="mt-6 text-sm leading-6 text-slate-600">{t('Progress is saved in this browser, shared by people using it. These self-study exams do not award campaign XP or certification.')}</p>
  </>
}

export default function CybersecurityPage({ sandbox = false }) {
  const { t, locale } = useI18n()
  const { lessonId } = useParams()
  const [search] = useSearchParams()
  const requested = sandbox ? search.get('lesson') : lessonId
  const course = CYBER_COURSES.find(item => item.id === requested)
  const index = course ? CYBER_COURSES.indexOf(course) : -1
  if (requested && !course) return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><h1 className="text-2xl font-semibold">{t('Course not found')}</h1><Link to="/cybersecurity" className={`${linkClass} mt-4 inline-block`}>{t('All cybersecurity courses')}</Link></main></div>
  if (sandbox) {
    return (
      <SandboxBenchLayout
        bench="cybersecurity"
        title={t('Cybersecurity sandbox')}
        description={t('Choose a web lab, build your own requests and keep an investigation notebook. Open its course for the explanation, guided tutorial and exam.')}
        courseLink={course ? `/cybersecurity/${course.id}` : '/cybersecurity'}
        courseLinkLabel={t(course ? 'Back to the course' : 'All cybersecurity courses')}
        localeNotice={locale === 'id' ? t('Cybersecurity course narratives, questions and technical traces are currently in English. Interface controls support Indonesian.') : null}
      >
        <CyberLab key={course?.id ?? 'free'} initialLab={course?.lab ?? 'http'} free />
      </SandboxBenchLayout>
    )
  }
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <CourseRewards />
    {locale === 'id' && <p className="mb-5 text-sm leading-6 text-slate-600">{t('Cybersecurity course narratives, questions and technical traces are currently in English. Interface controls support Indonesian.')}</p>}
    {course ? <CyberCourse key={course.id} course={course} previous={CYBER_COURSES[index - 1]} next={CYBER_COURSES[index + 1]} /> : <CyberHub />}
  </main></div>
}

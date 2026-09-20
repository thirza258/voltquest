import CourseRewards from '../courses/CourseRewards.jsx'
import { useEffect } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { readCourseProgress } from '../courses/progress.js'
import { MATLAB_COURSES } from './project.js'
import SandboxBenchLayout from '../sandbox/SandboxBenchLayout.jsx'
import MatlabCourse from './MatlabCourse.jsx'
import MatlabLab from './MatlabLab.jsx'
import FunctionReference from './FunctionReference.jsx'
import { fieldClass, linkClass, panelClass } from './styles.js'

function MatlabHub() {
  const { t } = useI18n(), { hash } = useLocation()
  const [search, setSearch] = useSearchParams()
  const query = search.get('q') ?? '', difficulty = search.get('difficulty') ?? ''
  const progress = Object.fromEntries(MATLAB_COURSES.map(course => [course.id, readCourseProgress(course)]))
  const passed = MATLAB_COURSES.filter(course => progress[course.id].bestPercent >= course.exam.passPercent)
  const next = MATLAB_COURSES.find(course => !passed.includes(course)) ?? MATLAB_COURSES[0]
  const matches = MATLAB_COURSES.filter(course => (!difficulty || course.difficulty === difficulty) && [course.title, course.summary, ...course.functions, ...course.lessons.map(lesson => lesson.title)].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' }) }, [hash])
  function filter(key, value) { const params = new URLSearchParams(search); value ? params.set(key, value) : params.delete(key); setSearch(params, { replace: true }) }
  return <>
    <Link to="/tutorials" className={linkClass}>{t('Back to tutorials')}</Link>
    <header className="my-7 max-w-4xl"><p className="text-sm font-semibold text-brand-700">{t('MATLAB learning path')} · {t('Fundamental → Advanced')}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t('MATLAB: compute, model and simulate')}</h1><p className="mt-4 text-base leading-7 text-ink-secondary">{t('Learn MATLAB from the first calculation to numerical simulation and high-performance computing. Study detailed explanations, answer a question in every section, edit runnable examples and complete a course exam.')}</p><div className="mt-5 flex flex-wrap gap-3 text-sm font-medium text-brand-700"><span>{t('18 courses · 72 sections')}</span><span>{t('72 section questions · 18 exams')}</span><span>{t('244 reference entries · 73 browser functions')}</span></div><div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white focus:ring-2 focus:ring-brand-500" to={`/matlab/${next.id}`}>{t('Continue the MATLAB path')}</Link><Link className="rounded-md border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500" to="/sandbox?bench=matlab">{t('Open MATLAB sandbox')}</Link><a href="#function-reference" className={`${linkClass} self-center text-sm`}>{t('Browse MATLAB functions')}</a></div></header>
    <section className={`${panelClass} mb-6`} aria-label={t('Learning path stages')}><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[['01–05', 'Build a foundation', 'Workspace, arrays, mathematics, programs and plots.'], ['06–09', 'Analyze numerical data', 'Linear algebra, statistics, fitting and calculus.'], ['10–14', 'Model and simulate', 'ODEs, signals, control, Monte Carlo and optimization.'], ['15–18', 'Scale and apply', 'Performance, parallel/GPU concepts, toolboxes and a thermal capstone.']].map(([range, title, description]) => <div key={range}><p className="font-mono text-xs text-brand-700">{range}</p><h2 className="mt-2 font-semibold">{t(title)}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{t(description)}</p></div>)}</div><p className="mt-5 border-t border-line pt-4 text-sm leading-6 text-slate-600">{t('Start with basic arithmetic; all courses are open. Browser scripts use a documented MATLAB-style numerical subset. Desktop companions explain MATLAB, optional toolboxes, Simulink and parallel/GPU workflows with their actual product requirements.')}</p></section>
    <div className="mb-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">{t('Search MATLAB courses')}<input type="search" className={`${fieldClass} mt-1`} value={query} onChange={event => filter('q', event.target.value)} /></label><label className="text-sm">{t('Course level')}<select className={`${fieldClass} mt-1`} value={difficulty} onChange={event => filter('difficulty', event.target.value)}><option value="">{t('All levels')}</option>{['Fundamental', 'Intermediate', 'Advanced'].map(level => <option key={level} value={level}>{t(level)}</option>)}</select></label></div>
    <p role="status" className="mb-5 text-sm text-slate-600">{t('{count} courses found', { count: matches.length })} · {t('{count} of {total} exams passed', { count: passed.length, total: MATLAB_COURSES.length })}</p>
    <div className="grid gap-4 md:grid-cols-2">{matches.map(course => <Link key={course.id} to={`/matlab/${course.id}`} className={`${panelClass} flex flex-col hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500`}><p className="text-xs font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')}</p><h2 className="mt-3 text-xl font-semibold">{course.title}</h2><p className="mt-3 flex-1 text-sm leading-6 text-ink-secondary">{course.summary}</p><p className="mt-4 text-xs text-slate-600">{t('4 sections with questions · editable lab · 5-question exam')}</p><div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm"><span className="text-slate-600">{progress[course.id].bestPercent >= course.exam.passPercent ? `${t('Passed')} · ${progress[course.id].bestPercent}%` : t('{count} of {total} sections read', { count: progress[course.id].read.length, total: course.lessons.length })}</span><span className="font-semibold text-brand-700">{t('Open course')} →</span></div></Link>)}</div>
    {!matches.length && <div className={panelClass}><h2 className="font-semibold">{t('No courses match')}</h2><button className={`${linkClass} mt-3 text-sm`} onClick={() => setSearch({})}>{t('Clear filters')}</button></div>}
    <FunctionReference />
    <p className="mt-6 text-sm leading-6 text-slate-600">{t('Progress is saved in this browser, shared by people using it. These self-study exams do not award campaign XP or certification.')}</p>
  </>
}

export default function MatlabPage({ sandbox = false }) {
  const { t, locale } = useI18n(), { lessonId } = useParams(), [search] = useSearchParams()
  const requested = sandbox ? search.get('lesson') : lessonId
  const course = MATLAB_COURSES.find(item => item.id === requested), index = course ? MATLAB_COURSES.indexOf(course) : -1
  if (requested && !course) return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><h1 className="text-2xl font-semibold">{t('Course not found')}</h1><Link to="/matlab" className={`${linkClass} mt-4 inline-block`}>{t('All MATLAB courses')}</Link></main></div>
  if (sandbox) {
    return (
      <SandboxBenchLayout
        bench="matlab"
        title={t('MATLAB sandbox')}
        description={t('Compute with editable scripts, inspect arrays, plot results and keep a numerical notebook. Choose a preset to explore another topic.')}
        courseLink={course ? `/matlab/${course.id}` : '/matlab'}
        courseLinkLabel={t(course ? 'Back to the course' : 'All MATLAB courses')}
        localeNotice={locale === 'id' ? t('MATLAB narratives, questions and function descriptions are currently in English. Interface controls support Indonesian.') : null}
      >
        <MatlabLab key={course?.id ?? 'free'} initialLesson={course?.id} free />
      </SandboxBenchLayout>
    )
  }
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <CourseRewards />
    {locale === 'id' && <p className="mb-5 text-sm text-slate-600">{t('MATLAB narratives, questions and function descriptions are currently in English. Interface controls support Indonesian.')}</p>}
    {course ? <MatlabCourse key={course.id} course={course} previous={MATLAB_COURSES[index - 1]} next={MATLAB_COURSES[index + 1]} /> : <MatlabHub />}
  </main></div>
}

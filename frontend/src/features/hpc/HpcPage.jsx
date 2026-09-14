import { Link, useParams, useSearchParams } from 'react-router-dom'
import content from '@content/hpc.json'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { readCourseProgress } from '../courses/progress.js'
import HpcCourse, { hpcLinkClass } from './HpcCourse.jsx'
import HpcLab, { fieldClass, panelClass } from './HpcLab.jsx'

export const HPC_COURSES = content.courses

function HpcHub() {
  const { t } = useI18n()
  const [search, setSearch] = useSearchParams()
  const query = search.get('q') ?? '', difficulty = search.get('difficulty') ?? ''
  const progress = Object.fromEntries(HPC_COURSES.map(course => [course.id, readCourseProgress(course)]))
  const passed = HPC_COURSES.filter(course => progress[course.id].bestPercent >= course.exam.passPercent)
  const next = HPC_COURSES.find(course => !passed.includes(course)) ?? HPC_COURSES[0]
  const matches = HPC_COURSES.filter(course => (!difficulty || course.difficulty === difficulty) && [course.title, course.summary, ...course.outcomes, ...course.lessons.map(lesson => lesson.title)].flatMap(text => [text, t(text)]).join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  function filter(key, value) { const params = new URLSearchParams(search); value ? params.set(key, value) : params.delete(key); setSearch(params, { replace: true }) }
  return <>
    <Link to="/tutorials" className={hpcLinkClass}>{t('Back to tutorials')}</Link>
    <header className="my-7 max-w-4xl"><p className="text-sm font-semibold text-brand-700">{t('C / C++ learning path')} · {t('Fundamental → Advanced')}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t('High-performance computing in C & C++')}</h1><p className="mt-4 text-base leading-7 text-ink-secondary">{t('Learn to make numerical programs correct, measurable and faster. Follow ten courses from native C/C++ foundations through memory, SIMD, OpenMP and MPI to a verified distributed stencil.')}</p><div className="mt-5 flex flex-wrap gap-3 text-sm font-medium text-brand-700"><span>{t('10 courses · 40 detailed sections')}</span><span>{t('10 experiments · 30 practice questions · 10 exams')}</span></div><p className="mt-4 text-sm leading-6 text-slate-600">{t('Every course includes C17 and C++17 source, formulas, worked calculations, edge-case tests and an applied challenge. Read in order or open any topic; there are no unlock gates.')}</p><div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white focus:ring-2 focus:ring-brand-500" to={`/hpc/${next.id}`}>{t('Continue the HPC path')}</Link><Link className="rounded-md border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500" to="/sandbox?bench=hpc">{t('Open HPC sandbox')}</Link></div></header>
    <section className={`${panelClass} mb-6`} aria-label={t('Learning path stages')}><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[['01–02', 'Build and measure', 'Correctness, memory ownership and reproducible benchmarks.'], ['03–05', 'Optimize one core', 'Locality, cache tiling and compiler vectorization.'], ['06–08', 'Use multiple cores', 'OpenMP, scheduling, scaling and resource limits.'], ['09–10', 'Distribute and verify', 'MPI collectives, halo exchange and a complete capstone.']].map(([range, title, description]) => <div key={range}><p className="font-mono text-xs text-brand-700">{range}</p><h2 className="mt-2 font-semibold">{t(title)}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{t(description)}</p></div>)}</div><p className="mt-5 border-t border-line pt-4 text-sm text-slate-600">{t('Preparation: basic loops, functions and arrays in C or C++. Browser labs need no installation. Native testing uses a local compiler; the parallel courses also need OpenMP or MPI.')}</p></section>
    <div className="mb-5 grid gap-4 sm:grid-cols-2"><label className="text-sm"><span>{t('Search HPC courses')}</span><input type="search" className={`${fieldClass} mt-1`} value={query} onChange={event => filter('q', event.target.value)} /></label><label className="text-sm"><span>{t('Course level')}</span><select className={`${fieldClass} mt-1`} value={difficulty} onChange={event => filter('difficulty', event.target.value)}><option value="">{t('All levels')}</option>{['Fundamental', 'Intermediate', 'Advanced'].map(level => <option key={level} value={level}>{t(level)}</option>)}</select></label></div>
    <p role="status" className="mb-5 text-sm text-slate-600">{t('{count} courses found', { count: matches.length })} · {t('{count} of {total} exams passed', { count: passed.length, total: HPC_COURSES.length })}</p>
    <div className="grid gap-4 md:grid-cols-2">{matches.map(course => <Link key={course.id} to={`/hpc/${course.id}`} className={`${panelClass} flex flex-col hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500`}><p className="text-xs font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')} · C17 / C++17</p><h2 className="mt-3 text-xl font-semibold">{t(course.title)}</h2><p className="mt-3 flex-1 text-sm leading-6 text-ink-secondary">{t(course.summary)}</p><p className="mt-4 text-xs text-slate-600">{t('4 sections · interactive lab · native tests · 5-question exam')}</p><div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm"><span className="text-slate-600">{progress[course.id].bestPercent >= course.exam.passPercent ? `${t('Passed')} · ${progress[course.id].bestPercent}%` : t('{count} of {total} sections read', { count: progress[course.id].read.length, total: course.lessons.length })}</span><span className="font-semibold text-brand-700">{t('Open course')} →</span></div></Link>)}</div>
    {!matches.length && <div className={panelClass}><h2 className="font-semibold">{t('No courses match')}</h2><button className={`${hpcLinkClass} mt-3 text-sm`} onClick={() => setSearch({})}>{t('Clear filters')}</button></div>}
    <p className="mt-6 text-sm leading-6 text-slate-600">{t('Progress is saved in this browser, shared by people using it. These self-study exams do not award campaign XP or certification.')}</p>
  </>
}

export default function HpcPage({ sandbox = false }) {
  const { t, locale } = useI18n()
  const { lessonId } = useParams()
  const [search] = useSearchParams()
  const requested = sandbox ? search.get('lesson') : lessonId
  const course = HPC_COURSES.find(item => item.id === requested)
  const index = course ? HPC_COURSES.indexOf(course) : -1
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
    {locale === 'id' && <p className="mb-5 text-sm text-slate-600">{t('HPC course narratives, questions and native source are currently in English. Interface controls support Indonesian.')}</p>}
    {requested && !course ? <><h1 className="text-2xl font-semibold">{t('Course not found')}</h1><Link to="/hpc" className={`${hpcLinkClass} mt-4 inline-block`}>{t('All HPC courses')}</Link></>
      : sandbox ? <><Link to={course ? `/hpc/${course.id}` : '/hpc'} className={hpcLinkClass}>{t(course ? 'Back to the course' : 'All HPC courses')}</Link><h1 className="mb-3 mt-6 text-3xl font-semibold">{t('HPC sandbox')}</h1><p className="mb-6 max-w-3xl text-sm leading-6 text-ink-secondary">{t('Explore performance models, test numerical behavior, edit native source and keep an experiment notebook. Choose a lab below or open its course for the full explanation.')}</p><HpcLab key={course?.id ?? 'free'} initialLab={course?.lab ?? 'correctness'} free /></>
        : course ? <HpcCourse key={course.id} course={course} previous={HPC_COURSES[index - 1]} next={HPC_COURSES[index + 1]} /> : <HpcHub />}
  </main></div>
}

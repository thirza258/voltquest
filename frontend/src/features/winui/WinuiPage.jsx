import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { readCourseProgress } from '../courses/progress.js'
import CourseRewards from '../courses/CourseRewards.jsx'
import WinuiCourse from './WinuiCourse.jsx'
import { WINUI_COURSES, WINUI_STAGES, fieldClass, filterWinuiCourses, linkClass, panelClass } from './content.js'

function WinuiHub() {
  const { t } = useI18n(), [params, setParams] = useSearchParams()
  const query = params.get('q') ?? '', stage = params.get('stage') ?? '', difficulty = params.get('difficulty') ?? ''
  const progress = Object.fromEntries(WINUI_COURSES.map(course => [course.id, readCourseProgress(course)]))
  const passed = WINUI_COURSES.filter(course => progress[course.id].bestPercent >= 80)
  const next = WINUI_COURSES.find(course => !passed.includes(course)) ?? WINUI_COURSES[0]
  const matches = filterWinuiCourses(query, stage, difficulty)
  function filter(key, value) {
    const updated = new URLSearchParams(params)
    value ? updated.set(key, value) : updated.delete(key)
    setParams(updated, { replace: true })
  }
  return <>
    <Link to="/courses" className={linkClass}>{t('All courses')}</Link>
    <header className="my-7 max-w-4xl">
      <p className="text-sm font-semibold text-brand-700">{t('C++ / WinUI 3 desktop development')}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t('Build Windows desktop apps with C++')}</h1>
      <p className="mt-4 leading-7 text-ink-secondary">{t('Go from your first XAML window to a task notebook you can build on Windows. Learn C++/WinRT events, binding, navigation, asynchronous work, files, HTTP APIs, accessibility and packaging through guided native labs.')}</p>
      <p className="mt-4 text-sm font-semibold text-brand-700">{t('13 courses · 52 section checkpoints · 13 exams')}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white focus:ring-2 focus:ring-brand-500" to={`/winui/${next.id}`}>{t('Continue the WinUI path')}</Link>
        <Link className="rounded-md border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500" to="/winui/winui-capstone">{t('Explore the task notebook capstone')}</Link>
      </div>
    </header>
    <section className={`${panelClass} mb-6`} aria-label={t('Learning path stages')}>
      <div className="grid gap-5 md:grid-cols-3">{WINUI_STAGES.map(item => <div key={item.id}><p className="font-mono text-xs text-brand-700">{item.range}</p><h2 className="mt-2 font-semibold">{t(item.title)}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{t(item.summary)}</p></div>)}</div>
      <p className="mt-5 border-t border-line pt-4 text-sm leading-6 text-slate-600">{t('Study and take exams in any browser. Native labs require Windows, Visual Studio with C++ WinUI support, a Windows SDK and the Windows App SDK. VoltQuest provides source and instructions; it does not run WinUI in the browser.')}</p>
    </section>
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      <label className="text-sm">{t('Search WinUI courses')}<input type="search" value={query} className={`${fieldClass} mt-1`} onChange={event => filter('q', event.target.value)} /></label>
      <label className="text-sm">{t('Learning stage')}<select value={stage} className={`${fieldClass} mt-1`} onChange={event => filter('stage', event.target.value)}><option value="">{t('All stages')}</option>{WINUI_STAGES.map(item => <option value={item.id} key={item.id}>{t(item.title)}</option>)}</select></label>
      <label className="text-sm">{t('Difficulty')}<select value={difficulty} className={`${fieldClass} mt-1`} onChange={event => filter('difficulty', event.target.value)}><option value="">{t('All difficulties')}</option>{['Fundamental', 'Intermediate'].map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
    </div>
    <p role="status" className="mb-5 text-sm text-slate-600">{t('{count} courses found', { count: matches.length })} · {t('{count} of {total} exams passed', { count: passed.length, total: WINUI_COURSES.length })}</p>
    <div className="grid gap-4 md:grid-cols-2">{matches.map(course => <Link key={course.id} to={`/winui/${course.id}`} className={`${panelClass} flex flex-col hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500`}>
      <p className="text-xs font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')}</p>
      <h2 className="mt-3 text-xl font-semibold">{course.title}</h2><p className="mt-3 flex-1 text-sm leading-6 text-ink-secondary">{course.summary}</p>
      <p className="mt-4 text-xs text-slate-600">{t('4 sections with questions · Windows source lab · 5-question exam')}</p>
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm"><span className="text-slate-600">{progress[course.id].bestPercent >= 80 ? `${t('Passed')} · ${progress[course.id].bestPercent}%` : t('{count} of {total} sections read', { count: progress[course.id].read.length, total: 4 })}</span><span className="font-semibold text-brand-700">{t('Open course')} →</span></div>
    </Link>)}</div>
    {!matches.length && <div className={panelClass}><h2 className="font-semibold">{t('No courses match')}</h2><button className={`${linkClass} mt-3`} onClick={() => setParams({})}>{t('Clear filters')}</button></div>}
  </>
}

export default function WinuiPage() {
  const { t, locale } = useI18n(), { lessonId } = useParams()
  const index = WINUI_COURSES.findIndex(course => course.id === lessonId), course = WINUI_COURSES[index]
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><CourseRewards />
    {locale === 'id' && <p className="mb-5 text-sm text-slate-600">{t('WinUI course narratives, questions and native source are currently in English. Interface controls and learning rewards support Indonesian.')}</p>}
    {lessonId && !course ? <><h1 className="text-2xl font-semibold">{t('Course not found')}</h1><Link className={`${linkClass} mt-4 inline-block`} to="/winui">{t('All C++ / WinUI courses')}</Link></>
      : course ? <WinuiCourse key={course.id} course={course} previous={WINUI_COURSES[index - 1]} next={WINUI_COURSES[index + 1]} /> : <WinuiHub />}
  </main></div>
}

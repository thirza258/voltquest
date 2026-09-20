import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { readCourseProgress } from '../courses/progress.js'
import CourseRewards from '../courses/CourseRewards.jsx'
import QtCourse from './QtCourse.jsx'
import { QT_COURSES, QT_STAGES, fieldClass, filterQtCourses, linkClass, panelClass } from './content.js'

function QtHub() {
  const { t } = useI18n(), [params, setParams] = useSearchParams()
  const query = params.get('q') ?? '', stage = params.get('stage') ?? '', difficulty = params.get('difficulty') ?? ''
  const progress = Object.fromEntries(QT_COURSES.map(course => [course.id, readCourseProgress(course)]))
  const passed = QT_COURSES.filter(course => progress[course.id].bestPercent >= 80)
  const next = QT_COURSES.find(course => !passed.includes(course)) ?? QT_COURSES[0]
  const matches = filterQtCourses(query, stage, difficulty)
  function filter(key, value) {
    const updated = new URLSearchParams(params)
    value ? updated.set(key, value) : updated.delete(key)
    setParams(updated, { replace: true })
  }
  return <>
    <Link to="/courses" className={linkClass}>{t('All courses')}</Link>
    <header className="my-7 max-w-4xl">
      <p className="text-sm font-semibold text-brand-700">{t('Qt 6 / C++ desktop development')}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t('Build desktop apps with Qt and C++')}</h1>
      <p className="mt-4 leading-7 text-ink-secondary">{t('Create desktop apps for Windows, macOS and Linux. Learn Qt Widgets, modern C++, model/view, files, SQLite, networking, background work and Qt Quick/QML, then build and package a task manager.')}</p>
      <p className="mt-4 text-sm font-semibold text-brand-700">{t('16 courses · 64 section checkpoints · 16 exams')}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white focus:ring-2 focus:ring-brand-500" to={`/qt/${next.id}`}>{t('Continue the Qt path')}</Link>
        <Link className="rounded-md border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500" to="/qt/qt-capstone">{t('Explore the Qt task manager capstone')}</Link>
      </div>
    </header>
    <section className={`${panelClass} mb-6`} aria-label={t('Learning path stages')}>
      <div className="grid gap-5 md:grid-cols-4">{QT_STAGES.map(item => <div key={item.id}><p className="font-mono text-xs text-brand-700">{item.range}</p><h2 className="mt-2 font-semibold">{t(item.title)}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{t(item.summary)}</p></div>)}</div>
      <p className="mt-5 border-t border-line pt-4 text-sm leading-6 text-slate-600">{t('Read lessons and take exams here. To build the native apps, install a desktop Qt 6.5 or newer kit, a compatible C++17 compiler and CMake. Each ZIP is a complete project. Qt Creator is optional.')}</p>
    </section>
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      <label className="text-sm">{t('Search Qt courses')}<input type="search" value={query} className={`${fieldClass} mt-1`} onChange={event => filter('q', event.target.value)} /></label>
      <label className="text-sm">{t('Learning stage')}<select value={stage} className={`${fieldClass} mt-1`} onChange={event => filter('stage', event.target.value)}><option value="">{t('All stages')}</option>{QT_STAGES.map(item => <option value={item.id} key={item.id}>{t(item.title)}</option>)}</select></label>
      <label className="text-sm">{t('Difficulty')}<select value={difficulty} className={`${fieldClass} mt-1`} onChange={event => filter('difficulty', event.target.value)}><option value="">{t('All difficulties')}</option>{['Fundamental', 'Intermediate'].map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
    </div>
    <p role="status" className="mb-5 text-sm text-slate-600">{t('{count} courses found', { count: matches.length })} · {t('{count} of {total} exams passed', { count: passed.length, total: QT_COURSES.length })}</p>
    <div className="grid gap-4 md:grid-cols-2">{matches.map(course => <Link key={course.id} to={`/qt/${course.id}`} className={`${panelClass} flex flex-col hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500`}>
      <p className="text-xs font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')}</p>
      <h2 className="mt-3 text-xl font-semibold">{course.title}</h2><p className="mt-3 flex-1 text-sm leading-6 text-ink-secondary">{course.summary}</p>
      <p className="mt-4 text-xs text-slate-600">{t('4 sections with questions · Qt source project · 5-question exam')}</p>
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm"><span className="text-slate-600">{progress[course.id].bestPercent >= 80 ? `${t('Passed')} · ${progress[course.id].bestPercent}%` : t('{count} of {total} sections read', { count: progress[course.id].read.length, total: 4 })}</span><span className="font-semibold text-brand-700">{t('Open course')} →</span></div>
    </Link>)}</div>
    {!matches.length && <div className={panelClass}><h2 className="font-semibold">{t('No courses match')}</h2><button className={`${linkClass} mt-3`} onClick={() => setParams({})}>{t('Clear filters')}</button></div>}
  </>
}

export default function QtPage() {
  const { t, locale } = useI18n(), { lessonId } = useParams()
  const index = QT_COURSES.findIndex(course => course.id === lessonId), course = QT_COURSES[index]
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><CourseRewards />
    {locale === 'id' && <p className="mb-5 text-sm text-slate-600">{t('Qt course narratives, questions and native source are currently in English. Interface controls and learning rewards support Indonesian.')}</p>}
    {lessonId && !course ? <><h1 className="text-2xl font-semibold">{t('Course not found')}</h1><Link className={`${linkClass} mt-4 inline-block`} to="/qt">{t('All C++ / Qt courses')}</Link></>
      : course ? <QtCourse key={course.id} course={course} previous={QT_COURSES[index - 1]} next={QT_COURSES[index + 1]} /> : <QtHub />}
  </main></div>
}

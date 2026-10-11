import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { downloadText } from '../../lib/download.js'
import { readCourseProgress, saveCourseProgress } from './progress.js'
import CourseRewards from './CourseRewards.jsx'
import Assessment from './Assessment.jsx'

const panelClass = 'min-w-0 rounded-lg border border-line bg-white p-5 sm:p-6'
const linkClass = 'rounded font-medium text-brand-700 underline decoration-brand-300 underline-offset-4 focus:outline-none focus:ring-2 focus:ring-brand-500'
const fieldClass = 'w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const codeClass = 'max-w-full overflow-x-auto rounded-md border border-line bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-800'

/** A reading-only course track (hub + course) driven by a `track` config; see CudaPage/PytorchPage. */
function filterCourses(track, query, difficulty) {
  const needle = query.trim().toLowerCase()
  return track.courses.filter(course => (!difficulty || course.difficulty === difficulty)
    && `${track.haystack} ${course.title} ${course.summary} ${course.lessons.map(lesson => lesson.title).join(' ')}`.toLowerCase().includes(needle))
}

function TrackHub({ track }) {
  const { t } = useI18n(), [params, setParams] = useSearchParams()
  const query = params.get('q') ?? '', difficulty = params.get('difficulty') ?? ''
  const progress = Object.fromEntries(track.courses.map(course => [course.id, readCourseProgress(course)]))
  const passed = track.courses.filter(course => progress[course.id].bestPercent >= 80)
  const next = track.courses.find(course => !passed.includes(course)) ?? track.courses[0]
  const matches = filterCourses(track, query, difficulty)
  function filter(key, value) {
    const updated = new URLSearchParams(params)
    value ? updated.set(key, value) : updated.delete(key)
    setParams(updated, { replace: true })
  }
  return <>
    <Link to="/courses" className={linkClass}>{t('All courses')}</Link>
    <header className="my-7 max-w-4xl">
      <p className="text-sm font-semibold text-brand-700">{t(track.eyebrow)}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t(track.title)}</h1>
      <p className="mt-4 leading-7 text-ink-secondary">{t(track.intro)}</p>
      <p className="mt-4 text-sm font-semibold text-brand-700">{t(track.metrics)}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white focus:ring-2 focus:ring-brand-500" to={`${track.base}/${next.id}`}>{t(track.continueLabel)}</Link>
        <Link className="rounded-md border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500" to={`${track.base}/${track.capstoneId}`}>{t(track.capstoneLabel)}</Link>
      </div>
    </header>
    <section className={`${panelClass} mb-6`}>
      <p className="text-sm leading-6 text-slate-600">{t(track.disclosure)}</p>
    </section>
    <div className="mb-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm">{t(track.searchLabel)}<input type="search" value={query} className={`${fieldClass} mt-1`} onChange={event => filter('q', event.target.value)} /></label>
      <label className="text-sm">{t('Difficulty')}<select value={difficulty} className={`${fieldClass} mt-1`} onChange={event => filter('difficulty', event.target.value)}><option value="">{t('All difficulties')}</option>{track.difficulties.map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
    </div>
    <p role="status" className="mb-5 text-sm text-slate-600">{t('{count} courses found', { count: matches.length })} · {t('{count} of {total} exams passed', { count: passed.length, total: track.courses.length })}</p>
    <div className="grid gap-4 md:grid-cols-2">{matches.map(course => <Link key={course.id} to={`${track.base}/${course.id}`} className={`${panelClass} flex flex-col hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500`}>
      <p className="text-xs font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')}</p>
      <h2 className="mt-3 text-xl font-semibold">{course.title}</h2><p className="mt-3 flex-1 text-sm leading-6 text-ink-secondary">{course.summary}</p>
      <p className="mt-4 text-xs text-slate-600">{t('4 sections with questions · downloadable source · 5-question exam')}</p>
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm"><span className="text-slate-600">{progress[course.id].bestPercent >= 80 ? `${t('Passed')} · ${progress[course.id].bestPercent}%` : t('{count} of {total} sections read', { count: progress[course.id].read.length, total: course.lessons.length })}</span><span className="font-semibold text-brand-700">{t('Open course')} →</span></div>
    </Link>)}</div>
    {!matches.length && <div className={panelClass}><h2 className="font-semibold">{t('No courses match')}</h2><button className={`${linkClass} mt-3`} onClick={() => setParams({})}>{t('Clear filters')}</button></div>}
  </>
}

function TrackCourse({ track, course, previous, next }) {
  const { t } = useI18n(), { hash } = useLocation(), heading = useRef(null)
  const [progress, setProgress] = useState(() => readCourseProgress(course))
  const [storageFailed, setStorageFailed] = useState(false)
  const [steps, setSteps] = useState([])
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' })
    else heading.current?.focus()
  }, [hash])
  function save(value) {
    setProgress(value)
    setStorageFailed(!saveCourseProgress(course, value))
  }
  function grade(result) {
    const stored = readCourseProgress(course)
    save({ ...progress, attempts: Math.max(progress.attempts, stored.attempts) + 1,
      bestPercent: Math.max(progress.bestPercent ?? 0, stored.bestPercent ?? 0, result.percent), lastPercent: result.percent })
  }
  async function copySource() {
    try {
      await navigator.clipboard.writeText(course.code)
      setNotice('Source copied. Paste it into your own editor to compile and run.')
    } catch {
      setNotice('Copy is unavailable. Select the source below or download it.')
    }
  }
  return <>
    <Link to={track.base} className={linkClass}>{t(track.allLabel)}</Link>
    <header className="my-7 max-w-4xl">
      <p className="text-sm font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')} · {track.tag}</p>
      <h1 ref={heading} tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">{course.title}</h1>
      <p className="mt-4 leading-7 text-ink-secondary">{course.summary}</p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm"><a className={linkClass} href="#guided-lab">{t('Jump to the guided lab')}</a><a className={linkClass} href="#source">{t('View and download the source')}</a></div>
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className={`${panelClass} lg:sticky lg:top-6`} aria-label={t('Course outline')}>
        <h2 className="font-semibold">{t('In this course')}</h2>
        <nav className="mt-4 flex flex-col gap-3 text-sm" aria-label={t('Course sections')}>
          {course.lessons.map((section, index) => <a className={linkClass} href={`#${section.id}`} key={section.id}>{index + 1}. {section.title}{progress.read.includes(section.id) ? ' ✓' : ''}</a>)}
          {[['guided-lab', 'Guided lab'], ['source', 'Downloadable source'], ['challenge', 'Applied challenge'], ['exam', 'Course exam']].map(([id, label]) => <a key={id} className={linkClass} href={`#${id}`}>{t(label)}</a>)}
        </nav>
        <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-slate-600">
          <p>{t('{count} of {total} sections read', { count: progress.read.length, total: course.lessons.length })}</p>
          <p>{t('Exam attempts: {count}', { count: progress.attempts })}</p>
          <p>{t('Best exam score')}: {progress.bestPercent === null ? '—' : `${progress.bestPercent}%`}</p>
          {progress.lastPercent !== null && <p>{t('Last exam score: {percent}%', { percent: progress.lastPercent })}</p>}
        </div>
        {previous && <p className="mt-4 text-sm"><span className="mb-2 block text-slate-600">{t('Recommended preparation')}</span><Link to={`${track.base}/${previous.id}`} className={linkClass}>{previous.title}</Link></p>}
      </aside>
      <div className="min-w-0 space-y-6">
        {storageFailed && <p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">{t('Browser storage is unavailable. Progress will last only for this visit.')}</p>}
        {course.lessons.map((section, index) => <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className={`${panelClass} scroll-mt-6`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Lesson {number}', { number: index + 1 })}</p>
          <h2 id={`${section.id}-title`} className="mt-2 text-xl font-semibold">{section.title}</h2>
          {section.paragraphs.map(paragraph => <p key={paragraph} className="mt-4 leading-7 text-ink-secondary">{paragraph}</p>)}
          <pre className={`${codeClass} mt-4`} tabIndex={0}><code>{section.example}</code></pre>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>{t('Common mistake')}</strong><p className="mt-1">{section.pitfall}</p></div>
          <label className="my-4 flex min-h-10 items-center gap-2 text-sm font-medium text-brand-700">
            <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={progress.read.includes(section.id)} onChange={() => save({ ...progress, read: progress.read.includes(section.id) ? progress.read.filter(id => id !== section.id) : [...progress.read, section.id] })} />
            {t('Mark lesson {number} as read', { number: index + 1 })}
          </label>
          <details className="border-t border-line pt-4"><summary className="cursor-pointer font-semibold text-brand-700">{t('Check this section')}</summary><div className="mt-4"><Assessment questions={[section.question]} /></div></details>
        </section>)}
        <section id="guided-lab" className={`${panelClass} scroll-mt-6`}>
          <h2 className="text-xl font-semibold">{t('Guided lab')}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{t('Work through these steps in your own environment. Step checks record your own observations for this visit; they do not execute or verify code.')}</p>
          <ol className="mt-4 space-y-4">{course.steps.map((step, index) => <li key={step}><label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" aria-label={t('Lab step {number}', { number: index + 1 })} className="mt-1 h-4 w-4 shrink-0 accent-teal-700" checked={steps.includes(index)} onChange={() => setSteps(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index])} /><span><strong>{index + 1}.</strong> {step}</span></label></li>)}</ol>
          <p className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6"><strong>{t('Expected result')}: </strong>{course.expected}</p>
        </section>
        <section id="source" className={`${panelClass} scroll-mt-6`}>
          <h2 className="text-xl font-semibold">{t('Downloadable source')}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{t('Read, copy or download this complete program, then compile and run it in your own environment. VoltQuest does not compile or run it in the browser.')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-md border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500" onClick={copySource}>{t('Copy source')}</button>
            <button type="button" className="rounded-md border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500" onClick={() => { if (!downloadText(course.code, `${course.id}.${track.codeExt}`)) setNotice('Download is unavailable. Select and copy the source below.') }}>{t('Download {file}', { file: `${course.id}.${track.codeExt}` })}</button>
          </div>
          <p role="status" className="mt-2 text-sm text-brand-700">{notice && t(notice)}</p>
          <pre className={`${codeClass} mt-3 max-h-[32rem] overflow-auto`} tabIndex={0} aria-label={t('Lesson source code')}><code>{course.code}</code></pre>
        </section>
        <section id="challenge" className={`${panelClass} scroll-mt-6`}><h2 className="text-xl font-semibold">{t('Applied challenge')}</h2><p className="mt-3 leading-7 text-ink-secondary">{course.challenge.task}</p><h3 className="mt-4 font-semibold">{t('Evidence to include')}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">{course.challenge.acceptance.map(item => <li key={item}>{item}</li>)}</ul></section>
        <section id="exam" className={`${panelClass} scroll-mt-6`}><h2 className="mb-4 text-xl font-semibold">{t('Course exam')}</h2><Assessment exam course={course} questions={course.exam.questions} passPercent={course.exam.passPercent} onResult={grade} /></section>
        <p className="text-sm leading-6 text-slate-600">{t('Section checks and exam scores are saved in this browser. Unsubmitted answers last for this visit. Self-study exams do not award campaign XP.')}</p>
        <section className={panelClass}><h2 className="text-lg font-semibold">{t('Reference reading')}</h2><p className="mt-2 text-sm text-slate-600">{t(track.reviewedNote, { date: course.reviewedAt ?? track.reviewedAt })}</p><ul className="mt-3 space-y-2 text-sm">{course.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className={linkClass}>{source.title}</a></li>)}</ul></section>
      </div>
    </div>
    <nav className="mt-6 flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-sm" aria-label={t('Course navigation')}>
      <Link className={linkClass} to={previous ? `${track.base}/${previous.id}` : track.base}>{t(previous ? 'Previous course' : track.allLabel)}</Link>
      <Link className={linkClass} to={next ? `${track.base}/${next.id}` : track.base}>{t(next ? 'Next course' : track.allLabel)}</Link>
    </nav>
  </>
}

export default function ReadingTrack({ track }) {
  const { t, locale } = useI18n(), { lessonId } = useParams()
  const index = track.courses.findIndex(course => course.id === lessonId), course = track.courses[index]
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><CourseRewards />
    {locale === 'id' && <p className="mb-5 text-sm text-slate-600">{t(track.langNote)}</p>}
    {lessonId && !course ? <><h1 className="text-2xl font-semibold">{t('Course not found')}</h1><Link className={`${linkClass} mt-4 inline-block`} to={track.base}>{t(track.allLabel)}</Link></>
      : course ? <TrackCourse key={course.id} track={track} course={course} previous={track.courses[index - 1]} next={track.courses[index + 1]} /> : <TrackHub track={track} />}
  </main></div>
}

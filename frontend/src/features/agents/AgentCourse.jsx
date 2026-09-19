import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { readCourseProgress, saveCourseProgress } from '../courses/progress.js'
import Assessment from '../courses/Assessment.jsx'
import AgentLab from './AgentLab.jsx'
import { linkClass, panelClass } from './styles.js'

export function GuidedSteps({ course, checkable = false }) {
  const { t } = useI18n()
  const [done, setDone] = useState([])
  return <section className={`${panelClass} mb-5`} aria-label={t('Guided tutorial steps')}><h2 className="text-xl font-semibold">{t('Guided tutorial')}</h2><p className="mt-3 text-sm leading-6 text-ink-secondary">{t('Predict the outcome, run the experiment, then inspect the evidence. Step checks are a personal checklist for this visit, separate from exam scores.')}</p><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6">{course.steps.map((step, index) => <li key={step}>{checkable ? <label className="flex items-start gap-3"><input className="mt-1 h-4 w-4 shrink-0 accent-teal-700" type="checkbox" checked={done.includes(index)} onChange={event => setDone(previous => event.target.checked ? [...previous, index] : previous.filter(value => value !== index))} /><span>{step}</span></label> : step}</li>)}</ol><p className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6"><strong>{t('Expected result')}: </strong>{course.expected}</p></section>
}

export default function AgentCourse({ course, previous, next }) {
  const { t } = useI18n(), { hash } = useLocation()
  const heading = useRef(null)
  const [progress, setProgress] = useState(() => readCourseProgress(course)), [storageFailed, setStorageFailed] = useState(false)
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' })
    else heading.current?.focus()
  }, [hash])
  function save(value) { setProgress(value); setStorageFailed(!saveCourseProgress(course, value)) }
  function grade(result) {
    const stored = readCourseProgress(course)
    save({ ...progress, attempts: Math.max(progress.attempts, stored.attempts) + 1, bestPercent: Math.max(progress.bestPercent ?? 0, stored.bestPercent ?? 0, result.percent), lastPercent: result.percent })
  }
  return <>
    <Link to="/ai-agents" className={linkClass}>{t('All AI agent courses')}</Link>
    <header className="my-7 max-w-4xl"><p className="text-sm font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')} · {t('AI agent learning path')}</p><h1 ref={heading} tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">{course.title}</h1><p className="mt-4 leading-7 text-ink-secondary">{course.summary}</p><div className="mt-4 flex flex-wrap gap-4 text-sm"><a href="#interactive-lab" className={linkClass}>{t('Jump to interactive sandbox')}</a><Link to={`/ai-agents/${course.id}/tutorial`} target="_blank" rel="noopener noreferrer" className={linkClass}>{t('Open guided tutorial in a new tab')}</Link></div></header>
    <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className={`${panelClass} lg:sticky lg:top-6`} aria-label={t('Course outline')}><h2 className="font-semibold">{t('In this course')}</h2><nav className="mt-4 flex flex-col gap-3 text-sm" aria-label={t('Course sections')}>{course.lessons.map((lesson, index) => <a href={`#${lesson.id}`} className={linkClass} key={lesson.id}>{index + 1}. {lesson.title}{progress.read.includes(lesson.id) ? ' ✓' : ''}</a>)}{[['interactive-lab', 'Guided tutorial'], ['challenge', 'Applied challenge'], ['exam', 'Course exam']].map(([id, label]) => <a href={`#${id}`} key={id} className={linkClass}>{t(label)}</a>)}</nav><div className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-slate-600"><p>{t('{count} of {total} sections read', { count: progress.read.length, total: 4 })}</p><p>{t('Exam attempts: {count}', { count: progress.attempts })}</p><p>{t('Best exam score')}: {progress.bestPercent === null ? '—' : `${progress.bestPercent}%`}</p>{progress.lastPercent !== null && <p>{t('Last exam score: {percent}%', { percent: progress.lastPercent })}</p>}</div>{previous && <p className="mt-4 text-sm"><span className="block text-slate-600">{t('Recommended preparation')}</span><Link to={`/ai-agents/${previous.id}`} className={linkClass}>{previous.title}</Link></p>}</aside>
      <div className="min-w-0 space-y-6">
        {storageFailed && <p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">{t('Browser storage is unavailable. Progress will last only for this visit.')}</p>}
        {course.lessons.map((lesson, index) => <section key={lesson.id} id={lesson.id} className={`${panelClass} scroll-mt-6`} aria-labelledby={`${lesson.id}-title`}><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Lesson {number}', { number: index + 1 })}</p><h2 id={`${lesson.id}-title`} className="mt-2 text-xl font-semibold">{lesson.title}</h2>{lesson.paragraphs.map(paragraph => <p key={paragraph} className="mt-4 leading-7 text-ink-secondary">{paragraph}</p>)}<div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>{t('Common mistake')}</strong><p className="mt-1">{lesson.pitfall}</p></div><label className="my-4 flex min-h-10 items-center gap-2 text-sm font-medium text-brand-700"><input type="checkbox" className="h-4 w-4 accent-teal-700" checked={progress.read.includes(lesson.id)} onChange={() => save({ ...progress, read: progress.read.includes(lesson.id) ? progress.read.filter(id => id !== lesson.id) : [...progress.read, lesson.id] })} />{t('Mark lesson {number} as read', { number: index + 1 })}</label><details className="border-t border-line pt-4"><summary className="cursor-pointer font-semibold text-brand-700">{t('Check this section')}</summary><div className="mt-4"><Assessment questions={[lesson.question]} /></div></details></section>)}
      </div>
    </div>
    <section id="interactive-lab" className="mt-8 scroll-mt-6"><GuidedSteps course={course} checkable /><AgentLab initialLesson={course.id} /><p className="mt-4 text-sm"><Link to={`/sandbox?bench=ai-agents&lesson=${course.id}`} target="_blank" rel="noopener noreferrer" className={linkClass}>{t('Open a sandbox copy in a new tab')}</Link></p></section>
    <section id="challenge" className={`${panelClass} mt-8 scroll-mt-6`}><h2 className="text-xl font-semibold">{t('Applied challenge')}</h2><p className="mt-3 leading-7 text-ink-secondary">{course.challenge.task}</p><h3 className="mt-4 font-semibold">{t('Evidence to include')}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">{course.challenge.acceptance.map(item => <li key={item}>{item}</li>)}</ul></section>
    <section id="exam" className={`${panelClass} mt-6 scroll-mt-6`}><h2 className="mb-4 text-xl font-semibold">{t('Course exam')}</h2><Assessment exam questions={course.exam.questions} passPercent={80} onResult={grade} /></section>
    <p className="mt-5 text-sm leading-6 text-slate-600">{t('Section checks and exam scores are saved in this browser. Unsubmitted answers last for this visit. Self-study exams do not award campaign XP.')}</p>
    <section className={`${panelClass} mt-6`}><h2 className="text-lg font-semibold">{t('Official reference reading')}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t('Sources reviewed on {date}. Product features, paths, availability and protocol versions can change; use the linked official documentation for your installed version.', { date: course.reviewedAt })}</p><ul className="mt-4 space-y-3 text-sm">{course.sources.map(source => <li key={source.url}><a className={linkClass} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul></section>
    <nav className="mt-6 flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-sm" aria-label={t('Course navigation')}><Link className={linkClass} to={previous ? `/ai-agents/${previous.id}` : '/ai-agents'}>{t(previous ? 'Previous course' : 'All AI agent courses')}</Link><Link className={linkClass} to={next ? `/ai-agents/${next.id}` : '/ai-agents'}>{t(next ? 'Next course' : 'All AI agent courses')}</Link></nav>
  </>
}

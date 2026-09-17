import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { Button } from '../../ui/index.js'
import { downloadText } from '../../lib/download.js'
import { readCourseProgress, saveCourseProgress } from '../courses/progress.js'
import Assessment from '../courses/Assessment.jsx'
import MatlabLab from './MatlabLab.jsx'
import { linkClass, panelClass } from './styles.js'

export default function MatlabCourse({ course, previous, next }) {
  const { t } = useI18n(), { hash } = useLocation()
  const heading = useRef(null)
  const [progress, setProgress] = useState(() => readCourseProgress(course)), [storageFailed, setStorageFailed] = useState(false)
  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null
    if (target) target.scrollIntoView?.({ block: 'start' })
    else heading.current?.focus()
  }, [hash])
  function save(value) { setProgress(value); setStorageFailed(!saveCourseProgress(course, value)) }
  function examResult(result) {
    const stored = readCourseProgress(course)
    save({ ...progress, attempts: Math.max(progress.attempts, stored.attempts) + 1,
      bestPercent: Math.max(progress.bestPercent ?? 0, stored.bestPercent ?? 0, result.percent), lastPercent: result.percent })
  }
  return <>
    <Link to="/matlab" className={linkClass}>{t('All MATLAB courses')}</Link>
    <header className="my-7 max-w-4xl"><p className="text-sm font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')} · MATLAB</p><h1 ref={heading} tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">{course.title}</h1><p className="mt-4 leading-7 text-ink-secondary">{course.summary}</p><a href="#interactive-lab" className={`${linkClass} mt-4 inline-block`}>{t('Jump to interactive sandbox')}</a></header>
    <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className={`${panelClass} lg:sticky lg:top-6`} aria-label={t('Course outline')}><h2 className="font-semibold">{t('In this course')}</h2><nav className="mt-4 flex flex-col gap-3 text-sm" aria-label={t('Course sections')}>
        {course.lessons.map((lesson, i) => <a key={lesson.id} href={`#${lesson.id}`} className={linkClass}>{i + 1}. {lesson.title}{progress.read.includes(lesson.id) ? ' ✓' : ''}</a>)}
        {[['interactive-lab', 'Guided experiment'], ['desktop-matlab', 'Continue in desktop MATLAB'], ['challenge', 'Applied challenge'], ['exam', 'Course exam']].map(([id, label]) => <a key={id} href={`#${id}`} className={linkClass}>{t(label)}</a>)}
      </nav><div className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-slate-600"><p>{t('{count} of {total} sections read', { count: progress.read.length, total: course.lessons.length })}</p><p>{t('Exam attempts: {count}', { count: progress.attempts })}</p><p>{t('Best exam score')}: {progress.bestPercent === null ? '—' : `${progress.bestPercent}%`}</p>{progress.lastPercent !== null && <p>{t('Last exam score: {percent}%', { percent: progress.lastPercent })}</p>}{progress.bestPercent >= course.exam.passPercent && <p className="font-semibold text-emerald-700">{t('Exam passed')}</p>}</div>{previous && <p className="mt-4 text-sm"><span className="block text-slate-600">{t('Recommended preparation')}</span><Link className={linkClass} to={`/matlab/${previous.id}`}>{previous.title}</Link></p>}</aside>
      <div className="min-w-0 space-y-6">
        {storageFailed && <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t('Browser storage is unavailable. Progress will last only for this visit.')}</p>}
        {course.lessons.map((lesson, index) => <section key={lesson.id} id={lesson.id} className={`${panelClass} scroll-mt-6`} aria-labelledby={`${lesson.id}-title`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Lesson {number}', { number: index + 1 })}</p><h2 id={`${lesson.id}-title`} className="mt-2 text-xl font-semibold">{lesson.title}</h2>
          {lesson.paragraphs.map(text => <p key={text} className="mt-4 leading-7 text-ink-secondary">{text}</p>)}
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>{t('Common mistake')}</strong><p className="mt-1">{lesson.pitfall}</p></div>
          <label className="my-4 flex min-h-10 items-center gap-2 text-sm font-medium text-brand-700"><input type="checkbox" className="h-4 w-4 accent-teal-700" checked={progress.read.includes(lesson.id)} onChange={() => save({ ...progress, read: progress.read.includes(lesson.id) ? progress.read.filter(id => id !== lesson.id) : [...progress.read, lesson.id] })} />{t('Mark lesson {number} as read', { number: index + 1 })}</label>
          <details className="border-t border-line pt-4"><summary className="cursor-pointer font-semibold text-brand-700">{t('Check this section')}</summary><div className="mt-4"><Assessment questions={[lesson.question]} /></div></details>
        </section>)}
        <section id="interactive-lab" className="scroll-mt-6"><div className={`${panelClass} mb-5`}><h2 className="text-xl font-semibold">{t('Guided experiment')}</h2><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-ink-secondary">{course.steps.map(step => <li key={step}>{step}</li>)}</ol><Link to={`/sandbox?bench=matlab&lesson=${course.id}`} target="_blank" rel="noopener noreferrer" className={`${linkClass} mt-4 inline-block text-sm`}>{t('Open a sandbox copy in a new tab')}</Link></div><MatlabLab initialLesson={course.id} /></section>
        <section id="desktop-matlab" className={`${panelClass} scroll-mt-6`}><h2 className="text-xl font-semibold">{t('Continue in desktop MATLAB')}</h2><p className="mt-3 text-sm font-medium text-brand-700">{t('Required products')}: {course.desktop.products}</p><p className="mt-3 text-sm leading-6 text-ink-secondary">{course.desktop.explanation}</p><pre className="my-4 overflow-x-auto rounded-md bg-slate-900 p-4 font-mono text-xs leading-6 text-slate-100" tabIndex={0}><code>{course.desktop.code}</code></pre><Button variant="secondary" onClick={() => downloadText(course.desktop.code, `${course.id}-desktop.m`)}>{t('Download desktop example')}</Button><p className="mt-3 text-xs leading-6 text-slate-600">{t('Run this companion in your own MATLAB installation with the listed products. Desktop-only functions are not executed by the browser sandbox.')}</p></section>
        <section id="challenge" className={`${panelClass} scroll-mt-6`}><h2 className="text-xl font-semibold">{t('Applied challenge')}</h2><p className="mt-3 leading-7 text-ink-secondary">{course.challenge.task}</p><h3 className="mt-4 font-semibold">{t('Evidence to include')}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-secondary">{course.challenge.acceptance.map(item => <li key={item}>{item}</li>)}</ul></section>
        <section id="exam" className={`${panelClass} scroll-mt-6`}><h2 className="mb-4 text-xl font-semibold">{t('Course exam')}</h2><Assessment exam questions={course.exam.questions} passPercent={course.exam.passPercent} onResult={examResult} /></section>
        <p className="text-sm leading-6 text-slate-600">{t('Section checks and exam scores are saved in this browser. Unsubmitted answers last for this visit. Self-study exams do not award campaign XP.')}</p>
        <section className={panelClass}><h2 className="text-lg font-semibold">{t('Reference reading')}</h2><ul className="mt-4 space-y-3 text-sm">{course.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className={linkClass}>{source.title}</a></li>)}</ul></section>
        <nav className="flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-sm" aria-label={t('Course navigation')}><Link className={linkClass} to={previous ? `/matlab/${previous.id}` : '/matlab'}>{t(previous ? 'Previous course' : 'All MATLAB courses')}</Link><Link className={linkClass} to={next ? `/matlab/${next.id}` : '/matlab'}>{t(next ? 'Next course' : 'Back to the MATLAB path')}</Link></nav>
      </div>
    </div>
  </>
}

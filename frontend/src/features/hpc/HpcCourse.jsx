import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { readCourseProgress, saveCourseProgress } from '../courses/progress.js'
import Assessment from '../courses/Assessment.jsx'
import HpcLab, { panelClass } from './HpcLab.jsx'

export const hpcLinkClass = 'rounded font-medium text-brand-700 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-brand-500'

export default function HpcCourse({ course, previous, next }) {
  const { t } = useI18n()
  const { hash } = useLocation()
  const heading = useRef(null)
  const [progress, setProgress] = useState(() => readCourseProgress(course))
  const [storageFailed, setStorageFailed] = useState(false)
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
    <Link to="/hpc" className={hpcLinkClass}>{t('All HPC courses')}</Link>
    <header className="my-7 max-w-4xl"><p className="text-sm font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')} · C17 / C++17</p><h1 ref={heading} tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">{t(course.title)}</h1><p className="mt-4 leading-7 text-ink-secondary">{t(course.summary)}</p><a href="#interactive-lab" className={`${hpcLinkClass} mt-4 inline-block`}>{t('Jump to interactive sandbox')}</a></header>
    <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className={`${panelClass} lg:sticky lg:top-6`} aria-label={t('Course outline')}><h2 className="font-semibold">{t('In this course')}</h2><nav className="mt-4 flex flex-col gap-3 text-sm" aria-label={t('Course sections')}>
        {course.lessons.map((lesson, i) => <a key={lesson.id} href={`#${lesson.id}`} className={hpcLinkClass}>{i + 1}. {t(lesson.title)}{progress.read.includes(lesson.id) ? ' ✓' : ''}</a>)}
        {[['formulas', 'Theory and formulas'], ['interactive-lab', 'Guided experiment'], ['native-testing', 'Native testing guide'], ['challenge', 'Applied challenge'], ['practice', 'Practice questions'], ['exam', 'Course exam']].map(([id, label]) => <a key={id} href={`#${id}`} className={hpcLinkClass}>{t(label)}</a>)}
      </nav><div className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-slate-600"><p>{t('{count} of {total} sections read', { count: progress.read.length, total: course.lessons.length })}</p><p>{t('Exam attempts: {count}', { count: progress.attempts })}</p><p>{t('Best exam score')}: {progress.bestPercent === null ? '—' : `${progress.bestPercent}%`}</p>{progress.lastPercent !== null && <p>{t('Last exam score: {percent}%', { percent: progress.lastPercent })}</p>}{progress.bestPercent >= course.exam.passPercent && <p className="font-semibold text-emerald-700">{t('Exam passed')}</p>}</div>{previous && <p className="mt-4 text-sm"><span className="block text-slate-600">{t('Recommended preparation')}</span><Link className={hpcLinkClass} to={`/hpc/${previous.id}`}>{t(previous.title)}</Link></p>}</aside>
      <div className="min-w-0 space-y-6">
        {storageFailed && <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t('Browser storage is unavailable. Progress will last only for this visit.')}</p>}
        <section className={panelClass}><h2 className="text-xl font-semibold">{t('What you will be able to do')}</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-secondary">{course.outcomes.map(item => <li key={item}>{t(item)}</li>)}</ul></section>
        {course.lessons.map((lesson, index) => <section key={lesson.id} id={lesson.id} className={`${panelClass} scroll-mt-6`} aria-labelledby={`${lesson.id}-title`}><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Lesson {number}', { number: index + 1 })}</p><h2 id={`${lesson.id}-title`} className="mt-2 text-xl font-semibold">{t(lesson.title)}</h2>{lesson.paragraphs.map(text => <p key={text} className="mt-4 leading-7 text-ink-secondary">{t(text)}</p>)}<div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>{t('Common mistake')}</strong><p className="mt-1">{t(lesson.pitfall)}</p></div><label className="mt-4 flex min-h-10 items-center gap-2 text-sm font-medium text-brand-700"><input type="checkbox" className="h-4 w-4 accent-teal-700" checked={progress.read.includes(lesson.id)} onChange={() => save({ ...progress, read: progress.read.includes(lesson.id) ? progress.read.filter(id => id !== lesson.id) : [...progress.read, lesson.id] })} />{t('Mark lesson {number} as read', { number: index + 1 })}</label></section>)}
        <section id="formulas" className={`${panelClass} scroll-mt-6`}><h2 className="text-xl font-semibold">{t('Theory and formulas')}</h2><div className="mt-4 space-y-4">{course.formulas.map(formula => <article key={formula.title} className="min-w-0 rounded-md border border-teal-200 bg-teal-50 p-4"><h3 className="font-semibold">{t(formula.title)}</h3><p className="my-4 overflow-x-auto font-mono text-sm leading-6">{formula.equation}</p><p className="text-sm leading-6">{t(formula.symbols)}</p><p className="mt-3 text-sm leading-6 text-teal-900"><strong>{t('When this formula applies')}: </strong>{t(formula.assumptions)}</p><p className="mt-3 text-sm leading-6"><strong>{t('Worked calculation')}: </strong>{t(formula.example)}</p></article>)}</div></section>
        <section id="interactive-lab" className="scroll-mt-6"><div className={`${panelClass} mb-5`}><h2 className="text-xl font-semibold">{t('Guided experiment')}</h2><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-ink-secondary">{course.steps.map(step => <li key={step}>{t(step)}</li>)}</ol><Link to={`/sandbox?bench=hpc&lesson=${course.id}`} target="_blank" rel="noopener noreferrer" className={`${hpcLinkClass} mt-4 inline-block text-sm`}>{t('Open a sandbox copy in a new tab')}</Link></div><HpcLab initialLab={course.lab} /></section>
        <section id="native-testing" className={`${panelClass} scroll-mt-6`}><h2 className="text-xl font-semibold">{t('Native testing guide')}</h2><h3 className="mt-4 font-semibold">{t('Walk through the source')}</h3><ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6 text-ink-secondary">{course.native.walkthrough.map(item => <li key={item}>{t(item)}</li>)}</ol><h3 className="mt-5 font-semibold">{t('Test cases and expected outcomes')}</h3><div className="mt-3 space-y-3">{course.native.tests.map(test => <div key={test.command} className="min-w-0 rounded border border-line p-3"><pre className="overflow-x-auto font-mono text-xs leading-6" tabIndex={0}><code>{test.command}</code></pre><p className="mt-2 text-sm leading-6 text-ink-secondary">{t(test.expect)}</p></div>)}</div></section>
        <section id="challenge" className={`${panelClass} scroll-mt-6`}><h2 className="text-xl font-semibold">{t('Applied challenge')}</h2><p className="mt-3 leading-7 text-ink-secondary">{t(course.challenge.task)}</p><h3 className="mt-4 font-semibold">{t('Evidence to include')}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-secondary">{course.challenge.acceptance.map(item => <li key={item}>{t(item)}</li>)}</ul></section>
        <section id="practice" className={`${panelClass} scroll-mt-6`}><h2 className="mb-4 text-xl font-semibold">{t('Practice questions')}</h2><Assessment questions={course.practice} /></section>
        <section id="exam" className={`${panelClass} scroll-mt-6`}><h2 className="mb-4 text-xl font-semibold">{t('Course exam')}</h2><Assessment exam questions={course.exam.questions} passPercent={course.exam.passPercent} onResult={examResult} /></section>
        <p className="text-sm leading-6 text-slate-600">{t('Section checks and exam scores are saved in this browser. Unsubmitted answers last for this visit. Self-study exams do not award campaign XP.')}</p>
        <section className={panelClass}><h2 className="text-lg font-semibold">{t('Reference reading')}</h2><ul className="mt-4 space-y-3 text-sm">{course.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className={hpcLinkClass}>{source.title}</a></li>)}</ul></section>
        <nav className="flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-sm" aria-label={t('Course navigation')}><Link className={hpcLinkClass} to={previous ? `/hpc/${previous.id}` : '/hpc'}>{t(previous ? 'Previous course' : 'All HPC courses')}</Link><Link className={hpcLinkClass} to={next ? `/hpc/${next.id}` : '/hpc'}>{t(next ? 'Next course' : 'Back to the HPC path')}</Link></nav>
      </div>
    </div>
  </>
}

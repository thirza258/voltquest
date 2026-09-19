import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import Assessment from '../courses/Assessment.jsx'
import { readCourseProgress, saveCourseProgress } from '../courses/progress.js'
import CyberLab from './CyberLab.jsx'
import { linkClass, panelClass } from './styles.js'

export default function CyberCourse({ course, previous, next }) {
  const { t } = useI18n()
  const { hash } = useLocation()
  const heading = useRef(null)
  const [progress, setProgress] = useState(() => readCourseProgress(course))
  const [storageError, setStorageError] = useState(false)
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' })
    else heading.current?.focus()
  }, [hash])
  function persist(value) { setProgress(value); setStorageError(!saveCourseProgress(course, value)) }
  function examResult(result) {
    const stored = readCourseProgress(course)
    persist({ ...progress, attempts: Math.max(stored.attempts, progress.attempts) + 1, bestPercent: Math.max(stored.bestPercent ?? 0, progress.bestPercent ?? 0, result.percent), lastPercent: result.percent })
  }
  return <>
    <Link to="/cybersecurity" className={linkClass}>{t('All cybersecurity courses')}</Link>
    <header className="my-7 max-w-4xl"><p className="text-sm font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')}</p><h1 ref={heading} tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">{t(course.title)}</h1><p className="mt-4 leading-7 text-ink-secondary">{t(course.summary)}</p><div className="mt-4 flex flex-wrap gap-4 text-sm"><a className={linkClass} href="#interactive-lab">{t('Jump to guided vulnerability lab')}</a><a className={linkClass} href="#exam">{t('Course exam')}</a></div></header>
    <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className={`${panelClass} lg:sticky lg:top-6`} aria-label={t('Course outline')}><h2 className="font-semibold">{t('In this course')}</h2><nav className="mt-4 flex flex-col gap-3 text-sm" aria-label={t('Course sections')}>{course.lessons.map((section, i) => <a key={section.id} href={`#${section.id}`} className={linkClass}>{i + 1}. {t(section.title)}{progress.read.includes(section.id) ? ' ✓' : ''}</a>)}{[['interactive-lab', 'Guided vulnerability tutorial'], ['challenge', 'Applied challenge'], ['practice', 'Practice questions'], ['exam', 'Course exam']].map(([id, label]) => <a key={id} href={`#${id}`} className={linkClass}>{t(label)}</a>)}</nav><div className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-slate-600"><p>{t('{count} of {total} sections read', { count: progress.read.length, total: course.lessons.length })}</p><p>{t('Exam attempts: {count}', { count: progress.attempts })}</p><p>{t('Best exam score')}: {progress.bestPercent == null ? '—' : `${progress.bestPercent}%`}</p>{progress.lastPercent != null && <p>{t('Last exam score: {percent}%', { percent: progress.lastPercent })}</p>}</div>{previous && <p className="mt-4 text-sm"><span className="mb-2 block text-slate-600">{t('Recommended preparation')}</span><Link to={`/cybersecurity/${previous.id}`} className={linkClass}>{t(previous.title)}</Link></p>}</aside>
      <div className="min-w-0 space-y-5">
        {storageError && <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t('Browser storage is unavailable. Progress will last only for this visit.')}</p>}
        {course.lessons.map((section, i) => <section key={section.id} id={section.id} className={`${panelClass} scroll-mt-6`} aria-labelledby={`${section.id}-title`}><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Lesson {number}', { number: i + 1 })}</p><h2 id={`${section.id}-title`} className="mt-2 text-xl font-semibold">{t(section.title)}</h2>{section.paragraphs.map((text, index) => <p key={index} className="mt-4 leading-7 text-ink-secondary">{t(text)}</p>)}<div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>{t('Common mistake')}</strong><p className="mt-1">{t(section.pitfall)}</p></div><label className="mt-4 flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-brand-700"><input type="checkbox" className="h-4 w-4 accent-teal-700" checked={progress.read.includes(section.id)} onChange={() => persist({ ...progress, read: progress.read.includes(section.id) ? progress.read.filter(id => id !== section.id) : [...progress.read, section.id] })} />{t('Mark lesson {number} as read', { number: i + 1 })}</label></section>)}
      </div>
    </div>
    <section id="interactive-lab" className="mt-8 scroll-mt-6"><div className={`${panelClass} mb-4`}><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Learn by investigating')}</p><h2 className="mt-2 text-2xl font-semibold">{t('Guided vulnerability tutorial')}</h2><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-ink-secondary">{course.steps.map(step => <li key={step}>{t(step)}</li>)}</ol><Link to={`/sandbox?bench=cybersecurity&lesson=${course.id}`} className={`${linkClass} mt-4 inline-block text-sm`} target="_blank" rel="noopener noreferrer">{t('Open a sandbox copy in a new tab')}</Link><p className="mt-2 text-xs leading-5 text-slate-600">{t('The separate tab starts this lesson’s preset. Your answers and current investigation stay in this tab; use notebook export/import to transfer edits.')}</p></div><CyberLab initialLab={course.lab} /></section>
    <section id="challenge" className={`${panelClass} mt-6 scroll-mt-6`}><h2 className="text-xl font-semibold">{t('Applied challenge')}</h2><p className="mt-3 leading-7 text-ink-secondary">{t(course.challenge)}</p></section>
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-2"><section id="practice" className={`${panelClass} scroll-mt-6`}><h2 className="mb-4 text-xl font-semibold">{t('Practice questions')}</h2><Assessment questions={course.practice} /></section><section id="exam" className={`${panelClass} scroll-mt-6`}><h2 className="mb-4 text-xl font-semibold">{t('Course exam')}</h2><Assessment exam course={course} questions={course.exam.questions} passPercent={course.exam.passPercent} onResult={examResult} /></section></div>
    <p className="mt-5 text-sm leading-6 text-slate-600">{t('Section checks and exam scores are saved in this browser. Unsubmitted answers last for this visit. Self-study exams do not award campaign XP.')}</p>
    <section className={`${panelClass} mt-6`}><h2 className="text-lg font-semibold">{t('Reference reading')}</h2><ul className="mt-3 space-y-3 text-sm">{course.sources.map(source => <li key={source.url}><a href={source.url} className={linkClass} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul></section>
    <nav className="mt-6 flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-sm" aria-label={t('Course navigation')}><Link className={linkClass} to={previous ? `/cybersecurity/${previous.id}` : '/cybersecurity'}>{t(previous ? 'Previous course' : 'All cybersecurity courses')}</Link><Link className={linkClass} to={next ? `/cybersecurity/${next.id}` : '/cybersecurity'}>{t(next ? 'Next course' : 'Back to the cybersecurity path')}</Link></nav>
  </>
}

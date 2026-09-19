import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { readCourseProgress, saveCourseProgress } from './progress.js'
import Assessment from './Assessment.jsx'
import FundamentalsGuide from './FundamentalsGuide.jsx'

/** Shared self-study shell for sandbox curricula. Key by lesson id, never by locale. */
export default function StudyLesson({ lesson, children, next, basePath, sandboxLink }) {
  const { t } = useI18n()
  const { hash } = useLocation()
  const [progress, setProgress] = useState(() => readCourseProgress(lesson))
  const [storageError, setStorageError] = useState(false)
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' })
  }, [hash])
  function persist(next) { setProgress(next); setStorageError(!saveCourseProgress(lesson, next)) }
  return <>
    <div className="mb-6 max-w-3xl"><p className="text-sm font-semibold text-brand-700">{t(lesson.difficulty)} · {lesson.minutes} {t('min')}</p><h1 className="mt-2 text-3xl font-semibold text-ink">{t(lesson.title)}</h1><p className="mt-3 leading-relaxed text-ink-secondary">{t(lesson.summary)}</p><a href="#interactive-lab" className="mt-4 inline-block rounded text-brand-700 underline focus:ring-2 focus:ring-brand-500">{t('Jump to interactive sandbox')}</a></div>
    <FundamentalsGuide tutorialId={lesson.id} />
    <div className="grid gap-4 lg:grid-cols-3">{lesson.lessons.map(section => <article id={section.id} key={section.id} className="scroll-mt-6 rounded-lg border border-line bg-white p-5"><h2 className="text-lg font-semibold">{t(section.title)}</h2><p className="mt-3 text-sm leading-relaxed text-ink-secondary">{t(section.text)}</p><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={progress.read.includes(section.id)} onChange={e => persist({ ...progress, read: e.target.checked ? [...progress.read, section.id] : progress.read.filter(id => id !== section.id) })} />{t('Mark section read')}</label></article>)}</div>
    <section className="mt-6" aria-label={t('Theory and formulas')}><h2 className="mb-3 text-xl font-semibold">{t('Theory and formulas')}</h2><div className="grid gap-4 md:grid-cols-2">{lesson.formulas.map(formula => <article key={formula.title} className="min-w-0 rounded-lg border border-teal-200 bg-teal-50 p-5"><h3 className="font-semibold">{t(formula.title)}</h3><p className="my-3 break-words font-mono text-sm leading-relaxed">{formula.equation}</p><p className="text-sm leading-relaxed text-slate-700">{t(formula.symbols)}</p><p className="mt-3 text-sm leading-relaxed text-teal-900">{t(formula.example)}</p></article>)}</div></section>
    <section className="my-6 rounded-lg border border-line bg-white p-5"><h2 className="font-semibold">{t('Guided experiment')}</h2><ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-ink-secondary">{lesson.steps.map(step => <li key={step}>{t(step)}</li>)}</ol></section>
    <div id="interactive-lab" className="scroll-mt-6">{children}</div>
    <p className="my-4 text-sm"><Link className="text-brand-700 underline" to={sandboxLink} target="_blank" rel="noopener noreferrer">{t('Open a sandbox copy in a new tab')}</Link></p>
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-2"><section><h2 className="mb-4 text-xl font-semibold">{t('Practice questions')}</h2><Assessment questions={lesson.practice} /></section><section><h2 className="mb-4 text-xl font-semibold">{t('Course exam')}</h2><p className="mb-4 text-sm text-slate-600">{t('Best exam score')}: {progress.bestPercent == null ? '—' : `${progress.bestPercent}%`} · {t('Attempts')}: {progress.attempts}</p><Assessment exam course={lesson} questions={lesson.exam.questions} passPercent={lesson.exam.passPercent} onResult={result => persist({ ...progress, attempts: progress.attempts + 1, bestPercent: Math.max(progress.bestPercent ?? 0, result.percent), lastPercent: result.percent })} /></section></div>
    <p className="mt-6 text-sm text-slate-600">{t('Section checks and exam scores are saved in this browser. Unsubmitted answers last for this visit. Self-study exams do not award campaign XP.')}</p>
    {storageError && <p role="alert" className="mt-2 text-sm text-amber-800">{t('Browser storage is unavailable. Progress will last only for this visit.')}</p>}
    <nav className="mt-8 flex flex-wrap gap-4 border-t border-line pt-5" aria-label={t('Lesson resources')}>{lesson.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 underline">{source.title}</a>)}{next && <Link className="text-sm font-semibold text-brand-700 underline" to={`${basePath}/${next.id}`}>{t('Next lesson')}: {t(next.title)}</Link>}</nav>
  </>
}

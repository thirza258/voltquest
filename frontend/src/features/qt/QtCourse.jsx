import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { readCourseProgress, saveCourseProgress } from '../courses/progress.js'
import Assessment from '../courses/Assessment.jsx'
import QtSources from './QtSources.jsx'
import { codeClass, linkClass, panelClass, QT_REVIEWED_AT } from './content.js'

export default function QtCourse({ course, previous, next }) {
  const { t } = useI18n(), { hash } = useLocation(), heading = useRef(null)
  const [progress, setProgress] = useState(() => readCourseProgress(course))
  const [storageFailed, setStorageFailed] = useState(false)
  const [steps, setSteps] = useState([])
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
  return <>
    <Link to="/qt" className={linkClass}>{t('All C++ / Qt courses')}</Link>
    <header className="my-7 max-w-4xl">
      <p className="text-sm font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')} · C++17 · Qt 6</p>
      <h1 ref={heading} tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">{course.title}</h1>
      <p className="mt-4 leading-7 text-ink-secondary">{course.summary}</p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm"><a className={linkClass} href="#desktop-lab">{t('Jump to Qt desktop lab')}</a><a className={linkClass} href="#native-source">{t('View and download C++ / Qt')}</a></div>
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className={`${panelClass} lg:sticky lg:top-6`} aria-label={t('Course outline')}>
        <h2 className="font-semibold">{t('In this course')}</h2>
        <nav className="mt-4 flex flex-col gap-3 text-sm" aria-label={t('Course sections')}>
          {course.lessons.map((section, index) => <a className={linkClass} href={`#${section.id}`} key={section.id}>{index + 1}. {section.title}{progress.read.includes(section.id) ? ' ✓' : ''}</a>)}
          {[['desktop-lab', 'Guided Qt desktop lab'], ['native-source', 'C++ / Qt lesson files'], ['challenge', 'Applied challenge'], ['exam', 'Course exam']].map(([id, label]) => <a key={id} className={linkClass} href={`#${id}`}>{t(label)}</a>)}
        </nav>
        <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-slate-600">
          <p>{t('{count} of {total} sections read', { count: progress.read.length, total: course.lessons.length })}</p>
          <p>{t('Exam attempts: {count}', { count: progress.attempts })}</p>
          <p>{t('Best exam score')}: {progress.bestPercent === null ? '—' : `${progress.bestPercent}%`}</p>
          {progress.lastPercent !== null && <p>{t('Last exam score: {percent}%', { percent: progress.lastPercent })}</p>}
        </div>
        {previous ? <p className="mt-4 text-sm"><span className="mb-2 block text-slate-600">{t('Recommended preparation')}</span><Link to={`/qt/${previous.id}`} className={linkClass}>{previous.title}</Link></p>
          : <p className="mt-4 text-sm"><Link to="/courses?track=programming" target="_blank" rel="noopener noreferrer" className={linkClass}>{t('Review C++ programming fundamentals')}</Link></p>}
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
        <section id="desktop-lab" className={`${panelClass} scroll-mt-6`}>
          <h2 className="text-xl font-semibold">{t('Guided Qt desktop lab')}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{t('Extract this course project, open its CMakeLists.txt in Qt Creator, and follow the build instructions. Step checks record your observations for this visit. Build and run the Qt app on your computer.')}</p>
          <ol className="mt-4 space-y-4">{course.steps.map((step, index) => <li key={step}><label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" aria-label={t('Qt desktop lab step {number}', { number: index + 1 })} className="mt-1 h-4 w-4 shrink-0 accent-teal-700" checked={steps.includes(index)} onChange={() => setSteps(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index])} /><span><strong>{index + 1}.</strong> {step}</span></label></li>)}</ol>
          <p className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6"><strong>{t('Expected result')}: </strong>{course.expected}</p>
        </section>
        <QtSources course={course} />
        <section id="challenge" className={`${panelClass} scroll-mt-6`}><h2 className="text-xl font-semibold">{t('Applied challenge')}</h2><p className="mt-3 leading-7 text-ink-secondary">{course.challenge.task}</p><h3 className="mt-4 font-semibold">{t('Evidence to include')}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">{course.challenge.acceptance.map(item => <li key={item}>{item}</li>)}</ul></section>
        <section id="exam" className={`${panelClass} scroll-mt-6`}><h2 className="mb-4 text-xl font-semibold">{t('Course exam')}</h2><Assessment exam course={course} questions={course.exam.questions} passPercent={course.exam.passPercent} onResult={grade} /></section>
        <p className="text-sm leading-6 text-slate-600">{t('Section checks and exam scores are saved in this browser. Unsubmitted answers last for this visit. Self-study exams do not award campaign XP.')}</p>
        <section className={panelClass}><h2 className="text-lg font-semibold">{t('Reference reading')}</h2><p className="mt-2 text-sm text-slate-600">{t('Qt documentation reviewed on {date}. Follow the documentation for your installed Qt kit and target operating system.', { date: QT_REVIEWED_AT })}</p><ul className="mt-3 space-y-2 text-sm">{course.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className={linkClass}>{source.title}</a></li>)}</ul></section>
      </div>
    </div>
    <nav className="mt-6 flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-sm" aria-label={t('Course navigation')}>
      <Link className={linkClass} to={previous ? `/qt/${previous.id}` : '/qt'}>{t(previous ? 'Previous course' : 'All C++ / Qt courses')}</Link>
      <Link className={linkClass} to={next ? `/qt/${next.id}` : '/qt'}>{t(next ? 'Next course' : 'All C++ / Qt courses')}</Link>
    </nav>
  </>
}

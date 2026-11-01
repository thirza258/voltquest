import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { readCourseProgress, saveCourseProgress } from '../courses/progress.js'
import Assessment from '../courses/Assessment.jsx'
import ExcelLab from './ExcelLab.jsx'

export default function ExcelCourse({ course, previous, next }) {
  const { t } = useI18n()
  const { hash } = useLocation()
  const heading = useRef(null)
  const [progress, setProgress] = useState(() => readCourseProgress(course))
  const [storageFailed, setStorageFailed] = useState(false)

  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null
    if (target) {
      target.scrollIntoView?.({ block: 'start' })
    } else {
      heading.current?.focus()
    }
  }, [hash])

  function save(value) {
    setProgress(value)
    setStorageFailed(!saveCourseProgress(course, value))
  }

  function examResult(result) {
    const stored = readCourseProgress(course)
    save({
      ...progress,
      attempts: Math.max(progress.attempts, stored.attempts) + 1,
      bestPercent: Math.max(progress.bestPercent ?? 0, stored.bestPercent ?? 0, result.percent),
      lastPercent: result.percent,
    })
  }

  const panelClass = 'rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-md'
  const linkClass = 'text-emerald-400 hover:text-emerald-300 underline font-medium'

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans text-slate-100 sm:px-6 lg:px-8">
      <Link to="/excel" className={linkClass}>
        ← {t('All Excel & Analytics courses')}
      </Link>

      <header className="my-7 max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
          {t(course.difficulty)} · {course.minutes} {t('min')} · Microsoft Excel & Analytics
        </p>
        <h1
          ref={heading}
          tabIndex={-1}
          className="mt-3 text-3xl font-bold tracking-tight text-white outline-none sm:text-4xl"
        >
          {course.title}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-300">{course.summary}</p>
        <div className="mt-4 flex flex-wrap gap-4">
          <a href="#interactive-lab" className={`${linkClass} inline-block`}>
            {t('Jump to interactive spreadsheet lab')} ↓
          </a>
          <Link to={`/sandbox?bench=excel`} className={`${linkClass} inline-block`}>
            {t('Open full Excel sandbox')} →
          </Link>
        </div>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Sticky Sidebar */}
        <aside className={`${panelClass} lg:sticky lg:top-6`} aria-label={t('Course outline')}>
          <h2 className="text-base font-semibold text-white">{t('In this course')}</h2>
          <nav className="mt-4 flex flex-col gap-2.5 text-xs" aria-label={t('Course sections')}>
            {course.lessons.map((lesson, i) => (
              <a key={lesson.id} href={`#${lesson.id}`} className={linkClass}>
                {i + 1}. {lesson.title}
                {progress.read.includes(lesson.id) ? ' ✓' : ''}
              </a>
            ))}
            <a href="#interactive-lab" className={linkClass}>
              {t('Interactive spreadsheet lab')}
            </a>
            <a href="#challenge" className={linkClass}>
              {t('Applied challenge')}
            </a>
            <a href="#exam" className={linkClass}>
              {t('Course certification exam')}
            </a>
          </nav>

          <div className="mt-6 space-y-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
            <p>
              {t('{count} of {total} sections read', {
                count: progress.read.length,
                total: course.lessons.length,
              })}
            </p>
            <p>{t('Exam attempts: {count}', { count: progress.attempts })}</p>
            <p>
              {t('Best exam score')}: {progress.bestPercent === null ? '—' : `${progress.bestPercent}%`}
            </p>
            {progress.lastPercent !== null && (
              <p>{t('Last exam score: {percent}%', { percent: progress.lastPercent })}</p>
            )}
            {progress.bestPercent >= course.exam.passPercent && (
              <p className="font-semibold text-emerald-400">✓ {t('Exam passed & certified')}</p>
            )}
          </div>

          {previous && (
            <p className="mt-6 text-xs border-t border-slate-800 pt-4">
              <span className="block text-slate-400">{t('Previous course')}</span>
              <Link className={linkClass} to={`/excel/${previous.id}`}>
                {previous.title}
              </Link>
            </p>
          )}
        </aside>

        {/* Main Content Area */}
        <div className="min-w-0 space-y-8">
          {storageFailed && (
            <p role="alert" className="rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200">
              {t('Browser storage is unavailable. Progress will last only for this visit.')}
            </p>
          )}

          {/* 4 Lessons with Theory & Practice */}
          {course.lessons.map((lesson, index) => (
            <section
              key={lesson.id}
              id={lesson.id}
              className={`${panelClass} scroll-mt-6`}
              aria-labelledby={`${lesson.id}-title`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                {t('Lesson {number}', { number: index + 1 })}
              </p>
              <h2 id={`${lesson.id}-title`} className="mt-2 text-2xl font-bold text-white">
                {lesson.title}
              </h2>
              {lesson.paragraphs.map((text, pIdx) => (
                <p key={pIdx} className="mt-4 leading-7 text-slate-300 text-sm">
                  {text}
                </p>
              ))}

              <div className="mt-5 rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-xs leading-6 text-amber-200/90">
                <strong className="text-amber-400 font-semibold">{t('Common pitfall to avoid')}:</strong>{' '}
                {lesson.pitfall}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
                <label className="flex items-center gap-2.5 text-xs font-medium text-emerald-400 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500"
                    checked={progress.read.includes(lesson.id)}
                    onChange={() =>
                      save({
                        ...progress,
                        read: progress.read.includes(lesson.id)
                          ? progress.read.filter((id) => id !== lesson.id)
                          : [...progress.read, lesson.id],
                      })
                    }
                  />
                  {t('Mark lesson {number} as completed', { number: index + 1 })}
                </label>
              </div>

              <details className="mt-4 border-t border-slate-800 pt-4 group">
                <summary className="cursor-pointer font-semibold text-xs text-emerald-400 hover:text-emerald-300">
                  {t('Check your understanding (Section Question)')} ↓
                </summary>
                <div className="mt-4">
                  <Assessment questions={[lesson.question]} />
                </div>
              </details>
            </section>
          ))}

          {/* Interactive Lab */}
          <section id="interactive-lab" className="scroll-mt-6">
            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Hands-On Practice
              </span>
              <h2 className="text-2xl font-bold text-white">Interactive Microsoft Excel Simulator Lab</h2>
            </div>
            <ExcelLab
              course={course}
              onNextStage={() => {
                document.getElementById('exam')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
              }}
            />
          </section>

          {/* Applied Challenge */}
          <section id="challenge" className={`${panelClass} scroll-mt-6`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Applied Challenge
            </span>
            <h2 className="mt-1 text-2xl font-bold text-white">Independent Analysis Mission</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{course.challenge}</p>
          </section>

          {/* 5-Question Certification Exam */}
          <section id="exam" className={`${panelClass} scroll-mt-6`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Certification
            </span>
            <h2 className="mb-4 mt-1 text-2xl font-bold text-white">
              Course Certification Exam (80% Passing Threshold)
            </h2>
            <Assessment
              exam
              course={course}
              questions={course.exam.questions}
              passPercent={course.exam.passPercent}
              onResult={examResult}
            />
          </section>

          {/* Navigation Links */}
          <nav
            className="flex flex-wrap justify-between gap-4 border-t border-slate-800 pt-6 text-sm"
            aria-label={t('Course navigation')}
          >
            <Link className={linkClass} to={previous ? `/excel/${previous.id}` : '/excel'}>
              ← {t(previous ? `Previous: ${previous.title}` : 'All Excel courses')}
            </Link>
            <Link className={linkClass} to={next ? `/excel/${next.id}` : '/excel'}>
              {t(next ? `Next: ${next.title}` : 'Back to Excel track overview')} →
            </Link>
          </nav>
        </div>
      </div>
    </div>
  )
}

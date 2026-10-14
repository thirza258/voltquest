import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import CourseRewards from '../courses/CourseRewards.jsx'
import Assessment from '../courses/Assessment.jsx'
import { readCourseProgress, saveCourseProgress } from '../courses/progress.js'
import { codeClass, linkClass, panelClass } from './project.js'
import { AVR_COURSES } from './avrProject.js'
import AvrIde from './AvrIde.jsx'
import SandboxBenchLayout from '../sandbox/SandboxBenchLayout.jsx'

function AvrHub() {
  const { t } = useI18n(), [search, setSearch] = useSearchParams()
  const query = search.get('q') ?? ''
  const progress = Object.fromEntries(AVR_COURSES.map(course => [course.id, readCourseProgress(course)]))
  const passed = AVR_COURSES.filter(course => progress[course.id].bestPercent >= 80)
  const next = AVR_COURSES.find(course => !passed.includes(course)) ?? AVR_COURSES[0]
  const matches = AVR_COURSES.filter(course => `${course.title} ${course.summary}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <>
    <Link to="/computer-architecture" className={linkClass}>{t('Computer architecture & assembly')}</Link>
    <header className="my-7 max-w-4xl"><p className="text-sm font-semibold text-brand-700">{t('AVR assembly')}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t('Program a real AVR in assembly')}</h1><p className="mt-4 leading-7 text-ink-secondary">{t('Write 8-bit AVR assembly in a real assembler IDE: load and move registers, do arithmetic and logic, read the status flags, branch and loop, use SRAM and pointers, drive I/O ports and call subroutines. Each course assembles to opcodes and runs on an in-browser ATmega simulator.')}</p><p className="mt-4 text-sm font-semibold text-brand-700">{AVR_COURSES.length} {t('courses · exams · shared certificate')}</p><div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white focus:ring-2 focus:ring-brand-500" to={`/avr/${next.id}`}>{t('Continue the AVR path')}</Link><Link className="rounded-md border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500" to="/sandbox?bench=avr">{t('Open the AVR assembler IDE')}</Link></div></header>
    <section className={`${panelClass} mb-6`}><p className="text-sm leading-6 text-slate-600">{t('The simulator models 32 registers, the SREG flags, a small data memory, the stack and PORTB output, executing a documented subset of about 45 AVR instructions. It is a teaching subset, not a full toolchain; the same programs assemble with avr-gcc/avra and run on real hardware.')}</p></section>
    <div className="mb-5"><label className="text-sm">{t('Search AVR courses')}<input type="search" className="mt-1 w-full max-w-md rounded-md border border-line-strong bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" value={query} onChange={event => setSearch(event.target.value ? { q: event.target.value } : {}, { replace: true })} /></label></div>
    <p role="status" className="mb-5 text-sm text-slate-600">{t('{count} courses found', { count: matches.length })} · {t('{count} of {total} exams passed', { count: passed.length, total: AVR_COURSES.length })}</p>
    <div className="grid gap-4 md:grid-cols-2">{matches.map(course => <Link key={course.id} to={`/avr/${course.id}`} className={`${panelClass} flex flex-col hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500`}><p className="text-xs font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')}</p><h2 className="mt-3 text-xl font-semibold">{course.title}</h2><p className="mt-3 flex-1 text-sm leading-6 text-ink-secondary">{course.summary}</p><div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm"><span className="text-slate-600">{progress[course.id].bestPercent >= 80 ? `${t('Passed')} · ${progress[course.id].bestPercent}%` : t('{count} of {total} sections read', { count: progress[course.id].read.length, total: course.lessons.length })}</span><span className="font-semibold text-brand-700">{t('Open course')} →</span></div></Link>)}</div>
    {!matches.length && <div className={panelClass}><h2 className="font-semibold">{t('No courses match')}</h2></div>}
    <p className="mt-6 text-sm leading-6 text-slate-600">{t('Progress and exam scores are saved in this browser. A passing exam issues the same self-study certificate as the other tracks.')}</p>
  </>
}

function AvrCourse({ course, previous, next }) {
  const { t } = useI18n(), { hash } = useLocation(), heading = useRef(null)
  const [progress, setProgress] = useState(() => readCourseProgress(course)), [storageFailed, setStorageFailed] = useState(false)
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' }); else heading.current?.focus() }, [hash])
  function save(value) { setProgress(value); setStorageFailed(!saveCourseProgress(course, value)) }
  function grade(result) {
    const stored = readCourseProgress(course)
    save({ ...progress, attempts: Math.max(progress.attempts, stored.attempts) + 1, bestPercent: Math.max(progress.bestPercent ?? 0, stored.bestPercent ?? 0, result.percent), lastPercent: result.percent })
  }
  return <>
    <Link to="/avr" className={linkClass}>{t('All AVR courses')}</Link>
    <header className="my-7 max-w-4xl"><p className="text-sm font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')} · {t('AVR assembly')}</p><h1 ref={heading} tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">{course.title}</h1><p className="mt-4 leading-7 text-ink-secondary">{course.summary}</p><a href="#avr-lab" className={`${linkClass} mt-4 inline-block text-sm`}>{t('Jump to the AVR assembler IDE')}</a></header>
    <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className={`${panelClass} lg:sticky lg:top-6`} aria-label={t('Course outline')}><h2 className="font-semibold">{t('In this course')}</h2><nav className="mt-4 flex flex-col gap-3 text-sm">{course.lessons.map((section, index) => <a className={linkClass} href={`#${section.id}`} key={section.id}>{index + 1}. {section.title}{progress.read.includes(section.id) ? ' ✓' : ''}</a>)}{[['avr-lab', 'AVR assembler IDE'], ['challenge', 'Applied challenge'], ['exam', 'Course exam']].map(([id, text]) => <a key={id} href={`#${id}`} className={linkClass}>{t(text)}</a>)}</nav><div className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-slate-600"><p>{t('{count} of {total} sections read', { count: progress.read.length, total: course.lessons.length })}</p><p>{t('Best exam score')}: {progress.bestPercent === null ? '—' : `${progress.bestPercent}%`}</p></div></aside>
      <div className="min-w-0 space-y-6">{storageFailed && <p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">{t('Browser storage is unavailable. Progress will last only for this visit.')}</p>}{course.lessons.map((section, index) => <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className={`${panelClass} scroll-mt-6`}><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Lesson {number}', { number: index + 1 })}</p><h2 id={`${section.id}-title`} className="mt-2 text-xl font-semibold">{section.title}</h2>{section.paragraphs.map(paragraph => <p className="mt-4 leading-7 text-ink-secondary" key={paragraph}>{paragraph}</p>)}<pre className={`${codeClass} mt-4`} tabIndex={0}>{section.example}</pre><div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>{t('Common mistake')}</strong><p className="mt-1">{section.pitfall}</p></div><label className="my-4 flex min-h-10 items-center gap-2 text-sm font-medium text-brand-700"><input type="checkbox" className="h-4 w-4 accent-teal-700" checked={progress.read.includes(section.id)} onChange={() => save({ ...progress, read: progress.read.includes(section.id) ? progress.read.filter(id => id !== section.id) : [...progress.read, section.id] })} />{t('Mark lesson {number} as read', { number: index + 1 })}</label><details className="border-t border-line pt-4"><summary className="cursor-pointer font-semibold text-brand-700">{t('Check this section')}</summary><div className="mt-4"><Assessment questions={[section.question]} /></div></details></section>)}</div>
    </div>
    <section id="avr-lab" className="mt-8 scroll-mt-6"><div className={`${panelClass} mb-5`}><h2 className="text-xl font-semibold">{t('AVR assembler IDE')}</h2><p className="mt-3 text-sm text-slate-600">{t('Assemble the starter, read its opcode listing, then step or run it on the simulator. Predict the registers and flags before you run.')}</p><ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6">{course.steps.map(step => <li key={step}>{step}</li>)}</ol><p className="mt-4 rounded bg-slate-50 p-3 text-sm leading-6"><strong>{t('Expected result')}: </strong>{course.expected}</p></div><div className="h-[640px] overflow-hidden rounded-lg border border-line"><AvrIde initialLesson={course.id} /></div><p className="mt-4 text-sm"><Link to="/sandbox?bench=avr" target="_blank" rel="noopener noreferrer" className={linkClass}>{t('Open the AVR assembler IDE in a new tab')}</Link></p></section>
    <section id="challenge" className={`${panelClass} mt-6 scroll-mt-6`}><h2 className="text-xl font-semibold">{t('Applied challenge')}</h2><p className="mt-3 leading-7 text-ink-secondary">{course.challenge.task}</p><h3 className="mt-4 font-semibold">{t('Evidence to include')}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">{course.challenge.acceptance.map(item => <li key={item}>{item}</li>)}</ul></section>
    <section id="exam" className={`${panelClass} mt-6 scroll-mt-6`}><h2 className="mb-4 text-xl font-semibold">{t('Course exam')}</h2><Assessment exam course={course} questions={course.exam.questions} passPercent={80} onResult={grade} /></section>
    <section className={`${panelClass} mt-6`}><h2 className="text-lg font-semibold">{t('Reference reading')}</h2><ul className="mt-3 space-y-2 text-sm">{course.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className={linkClass}>{source.title}</a></li>)}</ul></section>
    <nav className="mt-6 flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-sm"><Link className={linkClass} to={previous ? `/avr/${previous.id}` : '/avr'}>{t(previous ? 'Previous course' : 'All AVR courses')}</Link><Link className={linkClass} to={next ? `/avr/${next.id}` : '/avr'}>{t(next ? 'Next course' : 'All AVR courses')}</Link></nav>
  </>
}

export default function AvrPage({ sandbox = false }) {
  const { t, locale } = useI18n(), { lessonId } = useParams(), [search] = useSearchParams()
  const requested = sandbox ? search.get('lesson') : lessonId
  const course = AVR_COURSES.find(item => item.id === requested), index = course ? AVR_COURSES.indexOf(course) : -1
  if (requested && !course) return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><h1 className="text-2xl font-semibold">{t('Course not found')}</h1><Link to="/avr" className={`${linkClass} mt-4 inline-block`}>{t('All AVR courses')}</Link></main></div>
  if (sandbox) {
    return (
      <SandboxBenchLayout
        bench="avr"
        variant="app"
        description={t('A real AVR assembler IDE: edit AVR assembly, read opcode listings, and step or run the ATmega simulator with live registers, SREG flags and memory.')}
        courseLink={course ? `/avr/${course.id}` : '/avr'}
        courseLinkLabel={t(course ? 'Back to the course' : 'All AVR courses')}
        localeNotice={locale === 'id' ? t('AVR course narratives, questions and technical traces are currently in English. Interface controls support Indonesian.') : null}
      >
        <AvrIde key={course?.id ?? 'free'} initialLesson={course?.id} free />
      </SandboxBenchLayout>
    )
  }
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><CourseRewards />
    {course ? <AvrCourse key={course.id} course={course} previous={AVR_COURSES[index - 1]} next={AVR_COURSES[index + 1]} /> : <AvrHub />}
  </main></div>
}

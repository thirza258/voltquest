import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { readCourseProgress } from '../courses/progress.js'
import CourseRewards from '../courses/CourseRewards.jsx'
import { COMPUTER_COURSES, fieldClass, linkClass, panelClass } from './project.js'
import SandboxBenchLayout from '../sandbox/SandboxBenchLayout.jsx'
import ComputerCourse from './ComputerCourse.jsx'
import ComputerLab from './ComputerLab.jsx'
import AvrPage from './AvrPage.jsx'

function ComputerHub() {
  const { t } = useI18n(), [params, setParams] = useSearchParams()
  const query = params.get('q') ?? '', stage = params.get('stage') ?? ''
  const progress = Object.fromEntries(COMPUTER_COURSES.map(course => [course.id, readCourseProgress(course)]))
  const passed = COMPUTER_COURSES.filter(course => progress[course.id].bestPercent >= 80), next = COMPUTER_COURSES.find(course => !passed.includes(course)) ?? COMPUTER_COURSES[0]
  const matches = COMPUTER_COURSES.filter(course => (!stage || course.stage === stage) && `${course.title} ${course.summary} ${course.lessons.map(section => section.title).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  function filter(key, value) { const updated = new URLSearchParams(params); value ? updated.set(key, value) : updated.delete(key); setParams(updated, { replace: true }) }
  return <><Link to="/courses" className={linkClass}>{t('All courses')}</Link><header className="my-7 max-w-4xl"><p className="text-sm font-semibold text-brand-700">{t('Computer architecture & assembly')}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t('From logic gates to your own computer')}</h1><p className="mt-4 leading-7 text-ink-secondary">{t('Understand the fundamentals well enough to build in a different medium. Start with gates, build arithmetic and memory, then write assembly for a small CPU. Apply each module’s contract to redstone, electronic logic or your own design.')}</p><p className="mt-4 text-sm font-semibold text-brand-700">{t('18 courses · 72 section checkpoints · 18 exams')}</p><p className="mt-2 text-sm text-slate-600">{t('Eight gate-focused courses · six assembly courses · editable experiments')}</p><div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white focus:ring-2 focus:ring-brand-500" to={`/computer-architecture/${next.id}`}>{t('Continue the computer path')}</Link><Link className="rounded-md border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500" to="/sandbox?bench=computer">{t('Open computer sandbox')}</Link><Link className={linkClass} to="/computer-architecture?stage=assembly">{t('Go to assembly courses')}</Link><Link className={linkClass} to="/avr">{t('AVR assembly track')}</Link><Link className="rounded-md border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500" to="/sandbox?bench=avr">{t('Open the AVR assembler IDE')}</Link></div></header>
    <section className={`${panelClass} mb-6`} aria-label={t('Learning path stages')}><div className="grid gap-5 md:grid-cols-3">{[['01–08', 'Gates into arithmetic', 'Bits, truth tables, NAND, Boolean design, adders, routing and an ALU.'], ['09–12', 'Store and control', 'Latches, flip-flops, registers, memory and the fetch/decode/execute cycle.'], ['13–18', 'Program the machine', 'Assembly encodings, loads and stores, flags, loops, RISC-V comparisons and a CPU capstone.']].map(([range, title, text]) => <div key={range}><p className="font-mono text-xs text-brand-700">{range}</p><h2 className="mt-2 font-semibold">{t(title)}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{t(text)}</p></div>)}</div><p className="mt-5 border-t border-line pt-4 text-sm leading-6 text-slate-600">{t('Experiments model ideal logic and the VQ4 teaching ISA. Redstone notes explain how to transfer the design; Minecraft worlds, game ticks and native assembly execution are not simulated.')}</p></section>
    <div className="mb-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">{t('Search computer courses')}<input type="search" className={`${fieldClass} mt-1`} value={query} onChange={event => filter('q', event.target.value)} /></label><label className="text-sm">{t('Learning stage')}<select className={`${fieldClass} mt-1`} value={stage} onChange={event => filter('stage', event.target.value)}><option value="">{t('All stages')}</option><option value="gates">{t('Gates into arithmetic')}</option><option value="state">{t('Store and control')}</option><option value="assembly">{t('Assembly courses')}</option></select></label></div>
    <p role="status" className="mb-5 text-sm text-slate-600">{t('{count} courses found', { count: matches.length })} · {t('{count} of {total} exams passed', { count: passed.length, total: COMPUTER_COURSES.length })}</p>
    <div className="grid gap-4 md:grid-cols-2">{matches.map(course => <Link key={course.id} to={`/computer-architecture/${course.id}`} className={`${panelClass} flex flex-col hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500`}><p className="text-xs font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')}</p><h2 className="mt-3 text-xl font-semibold">{course.title}</h2><p className="mt-3 flex-1 text-sm leading-6 text-ink-secondary">{course.summary}</p><p className="mt-4 text-xs text-slate-600">{t('4 sections with questions · editable lab · 5-question exam')}</p><div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm"><span className="text-slate-600">{progress[course.id].bestPercent >= 80 ? `${t('Passed')} · ${progress[course.id].bestPercent}%` : t('{count} of {total} sections read', { count: progress[course.id].read.length, total: 4 })}</span><span className="font-semibold text-brand-700">{t('Open course')} →</span></div></Link>)}</div>
    {!matches.length && <div className={panelClass}><h2 className="font-semibold">{t('No courses match')}</h2><button className={`${linkClass} mt-3`} onClick={() => setParams({})}>{t('Clear filters')}</button></div>}
  </>
}

export default function ComputerPage({ sandbox = false }) {
  const { t, locale } = useI18n(), { lessonId } = useParams(), [params] = useSearchParams()
  const requested = sandbox ? params.get('lesson') : lessonId, course = COMPUTER_COURSES.find(item => item.id === requested), index = COMPUTER_COURSES.indexOf(course)
  if (requested && !course) return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><h1 className="text-2xl font-semibold">{t('Course not found')}</h1><Link to="/computer-architecture" className={`${linkClass} mt-4 inline-block`}>{t('All computer and assembly courses')}</Link></main></div>
  const avr = sandbox && params.get('asm')
  if (avr) return <AvrPage sandbox />
  if (sandbox) {
    return (
      <SandboxBenchLayout
        bench="computer"
        variant="page"
        description={t('Experiment with gates and stored state, or write and step VQ4 assembly programs. Save your designs and observations in a local notebook.')}
        courseLink={course ? `/computer-architecture/${course.id}` : '/computer-architecture'}
        courseLinkLabel={t(course ? 'Back to the course' : 'All computer and assembly courses')}
        localeNotice={locale === 'id' ? t('Computer course narratives, questions and technical traces are currently in English. Interface controls and learning rewards support Indonesian.') : null}
      >
        <ComputerLab key={course?.id ?? 'free'} initialLesson={course?.id} free />
      </SandboxBenchLayout>
    )
  }
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><CourseRewards />
    {locale === 'id' && <p className="mb-5 text-sm text-slate-600">{t('Computer course narratives, questions and technical traces are currently in English. Interface controls and learning rewards support Indonesian.')}</p>}
    {course ? <ComputerCourse key={course.id} course={course} previous={COMPUTER_COURSES[index - 1]} next={COMPUTER_COURSES[index + 1]} /> : <ComputerHub />}
  </main></div>
}

import CourseRewards from '../courses/CourseRewards.jsx'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { readCourseProgress } from '../courses/progress.js'
import { AGENT_COURSES } from './project.js'
import SandboxBenchLayout from '../sandbox/SandboxBenchLayout.jsx'
import AgentCourse, { GuidedSteps } from './AgentCourse.jsx'
import AgentLab from './AgentLab.jsx'
import { fieldClass, linkClass, panelClass } from './styles.js'

function AgentHub() {
  const { t } = useI18n(), [params, setParams] = useSearchParams()
  const query = params.get('q') ?? '', difficulty = params.get('difficulty') ?? '', tutorials = params.get('view') === 'tutorials'
  const progress = Object.fromEntries(AGENT_COURSES.map(course => [course.id, readCourseProgress(course)]))
  const passed = AGENT_COURSES.filter(course => progress[course.id].bestPercent >= 80)
  const next = AGENT_COURSES.find(course => !passed.includes(course)) ?? AGENT_COURSES[0]
  const matches = AGENT_COURSES.filter(course => (!difficulty || course.difficulty === difficulty) && `${course.title} ${course.summary} ${course.lessons.map(lesson => lesson.title).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  function filter(key, value) { const updated = new URLSearchParams(params); value ? updated.set(key, value) : updated.delete(key); setParams(updated, { replace: true }) }
  return <>
    <Link to="/courses" className={linkClass}>{t('All courses')}</Link><header className="my-7 max-w-4xl"><p className="text-sm font-semibold text-brand-700">{t('AI agent learning path')} · {t('Fundamental → Advanced')}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t('Understand agents. Build your own.')}</h1><p className="mt-4 text-base leading-7 text-ink-secondary">{t('Learn how Codex, Claude Code and Google Antigravity work with instructions, context, skills and tools. Explore MCP, app integrations and current agent workflows, then build a JavaScript CLI with a Python companion.')}</p><div className="mt-5 flex flex-wrap gap-3 text-sm font-medium text-brand-700"><span>{t('20 courses · 80 sections')}</span><span>{t('20 guided tutorials · 80 section questions')}</span><span>{t('20 exams · JavaScript + Python capstone')}</span></div><div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white focus:ring-2 focus:ring-brand-500" to={`/ai-agents/${next.id}`}>{t('Continue the AI agent path')}</Link><Link className="rounded-md border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500" to="/sandbox?bench=ai-agents">{t('Open AI agent sandbox')}</Link></div></header>
    <section className={`${panelClass} mb-6`} aria-label={t('Learning path stages')}><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[['01–05', 'Understand your agent', 'Models, harnesses, Codex, Claude Code, Antigravity and useful instructions.'], ['06–10', 'Control context and tools', 'Context, token budgets, cost accounting, validated tools and using skills.'], ['11–15', 'Build reliable integrations', 'Create skills, explore MCP, connect apps, enforce boundaries and retrieve evidence.'], ['16–20', 'Build and evaluate', 'Multimodal tools, subagents, durable workflows, evaluations and your own CLI.']].map(([range, title, description]) => <div key={range}><p className="font-mono text-xs text-brand-700">{range}</p><h2 className="mt-2 font-semibold">{t(title)}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{t(description)}</p></div>)}</div><p className="mt-5 border-t border-line pt-4 text-sm leading-6 text-slate-600">{t('Browser experiments use a scripted model and local app fixtures, with no paid calls. Native companions can connect to a real model and a scoped GitHub reader from your own terminal. Current product features are linked to official documentation reviewed on 2026-09-19.')}</p></section>
    <div className="mb-5 flex flex-wrap gap-2" aria-label={t('Learning view')}><button className={`rounded-md border px-4 py-2 text-sm font-semibold ${!tutorials ? 'border-brand-700 bg-teal-50 text-brand-700' : 'border-line'}`} aria-pressed={!tutorials} onClick={() => filter('view', '')}>{t('Courses and exams')}</button><button className={`rounded-md border px-4 py-2 text-sm font-semibold ${tutorials ? 'border-brand-700 bg-teal-50 text-brand-700' : 'border-line'}`} aria-pressed={tutorials} onClick={() => filter('view', 'tutorials')}>{t('Guided tutorials')}</button></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">{t('Search AI agent courses')}<input className={`${fieldClass} mt-1`} type="search" value={query} onChange={event => filter('q', event.target.value)} /></label><label className="text-sm">{t('Course level')}<select className={`${fieldClass} mt-1`} value={difficulty} onChange={event => filter('difficulty', event.target.value)}><option value="">{t('All levels')}</option>{['Fundamental', 'Intermediate', 'Advanced'].map(level => <option value={level} key={level}>{t(level)}</option>)}</select></label></div>
    <p role="status" className="mb-5 text-sm text-slate-600">{t('{count} courses found', { count: matches.length })} · {t('{count} of {total} exams passed', { count: passed.length, total: 20 })}</p>
    <div className="grid gap-4 md:grid-cols-2">{matches.map(course => <Link className={`${panelClass} flex flex-col hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500`} key={course.id} to={`/ai-agents/${course.id}${tutorials ? '/tutorial' : ''}`}><p className="text-xs font-medium text-brand-700">{t(course.difficulty)} · {course.minutes} {t('min')}</p><h2 className="mt-3 text-xl font-semibold">{course.title}</h2><p className="mt-3 flex-1 text-sm leading-6 text-ink-secondary">{tutorials ? course.steps[0] : course.summary}</p><p className="mt-4 text-xs text-slate-600">{t(tutorials ? 'Guided steps · editable sandbox · observed evidence' : '4 sections with questions · guided tutorial · 5-question exam')}</p><div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm"><span className="text-slate-600">{progress[course.id].bestPercent >= 80 ? `${t('Passed')} · ${progress[course.id].bestPercent}%` : t('{count} of {total} sections read', { count: progress[course.id].read.length, total: 4 })}</span><span className="font-semibold text-brand-700">{t(tutorials ? 'Open tutorial' : 'Open course')} →</span></div></Link>)}</div>
    {!matches.length && <div className={panelClass}><h2 className="font-semibold">{t('No courses match')}</h2><button className={`${linkClass} mt-3`} onClick={() => setParams({})}>{t('Clear filters')}</button></div>}
    <p className="mt-6 text-sm leading-6 text-slate-600">{t('Progress is saved in this browser, shared by people using it. These self-study exams do not award campaign XP or certification.')}</p>
  </>
}

export default function AgentsPage({ sandbox = false, tutorial = false }) {
  const { t, locale } = useI18n(), { lessonId } = useParams(), [params] = useSearchParams()
  const requested = sandbox ? params.get('lesson') : lessonId
  const course = AGENT_COURSES.find(item => item.id === requested), index = course ? AGENT_COURSES.indexOf(course) : -1
  if (requested && !course) return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><h1 className="text-2xl font-semibold">{t('Course not found')}</h1><Link to="/ai-agents" className={`${linkClass} mt-4 inline-block`}>{t('All AI agent courses')}</Link></main></div>
  if (sandbox) {
    return (
      <SandboxBenchLayout
        bench="ai-agents"
        title={t('AI agent sandbox')}
        description={t('Build an inspectable agent loop, manage context and cost, write skills and test app integrations in a local notebook.')}
        courseLink={course ? `/ai-agents/${course.id}` : '/ai-agents'}
        courseLinkLabel={t(course ? 'Back to the course' : 'All AI agent courses')}
        localeNotice={locale === 'id' ? t('AI agent narratives, questions and technical traces are currently in English. Interface controls support Indonesian.') : null}
      >
        <AgentLab key={course?.id ?? 'free'} initialLesson={course?.id} free />
      </SandboxBenchLayout>
    )
  }
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <CourseRewards />
    {locale === 'id' && <p className="mb-5 text-sm text-slate-600">{t('AI agent narratives, questions and technical traces are currently in English. Interface controls support Indonesian.')}</p>}
    {tutorial && course ? <><Link className={linkClass} to={`/ai-agents/${course.id}`}>{t('Back to the course')}</Link><header className="my-7"><p className="text-sm font-semibold text-brand-700">{t('Guided tutorial')}</p><h1 className="mt-3 text-3xl font-semibold">{course.title}</h1><p className="mt-3 leading-7 text-ink-secondary">{course.summary}</p></header><GuidedSteps key={`${course.id}-steps`} course={course} checkable /><AgentLab key={course.id} initialLesson={course.id} /><Link className={`${linkClass} mt-6 inline-block`} to={`/ai-agents/${course.id}#exam`}>{t('Continue to the course exam')}</Link></>
      : course ? <AgentCourse key={course.id} course={course} previous={AGENT_COURSES[index - 1]} next={AGENT_COURSES[index + 1]} /> : <AgentHub />}
  </main></div>
}

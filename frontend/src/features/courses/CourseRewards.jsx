import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Snowflake, Trophy } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { DAILY_GOAL, LEARNING_EVENT, LEARNING_KEY, learningSummary, readLearning, synchronizeLearning } from './learningRewards.js'

export default function CourseRewards() {
  const { t, locale } = useI18n()
  const [state, setState] = useState(() => readLearning()), [storageFailed, setStorageFailed] = useState(false)
  useEffect(() => {
    const refresh = event => {
      if (event?.type === 'storage' && event.key !== LEARNING_KEY && event.key !== 'vq.courses.v1' && event.key !== null) return
      const result = synchronizeLearning()
      setState(result.state); setStorageFailed(!result.ok || (event?.type === LEARNING_EVENT && !event.detail.ok))
    }
    refresh()
    window.addEventListener(LEARNING_EVENT, refresh); window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh)
    const timer = window.setInterval(refresh, 60000)
    return () => { window.clearInterval(timer); window.removeEventListener(LEARNING_EVENT, refresh); window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const summary = learningSummary(state), done = Math.min(DAILY_GOAL, summary.todayActions)
  return <section className="mb-6 min-w-0 rounded-lg border border-teal-200 bg-white p-4 sm:p-5" aria-label={t('Your learning journey')}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t('Your learning journey')}</h2><span className="text-xs text-slate-600">{t('Shared across all course paths · saved in this browser')}</span></div>
    <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div><p className="flex items-center gap-2 text-sm font-medium text-amber-800"><Flame size={17} aria-hidden="true" />{t('Study-day streak')}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{state.streak} <span className="text-sm font-normal text-slate-600">{t('days')}</span></p><p className="text-xs text-slate-600">{t('Best: {count} days', { count: state.bestStreak })}</p></div>
      <div><p className="flex items-center gap-2 text-sm font-medium text-sky-800"><Snowflake size={17} aria-hidden="true" />{t('Streak freezes')}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{state.freezes}<span className="text-sm font-normal text-slate-600"> / 2</span></p><p className="text-xs text-slate-600">{t('Next freeze in {count} study days', { count: 7 - state.activeDays % 7 })}</p></div>
      <div><p className="flex items-center gap-2 text-sm font-medium text-brand-700"><Trophy size={17} aria-hidden="true" />{t('Learning level {level}', { level: summary.level })}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{summary.xp} <span className="text-sm font-normal text-slate-600">{t('learning XP')}</span></p><p className="text-xs text-slate-600">{t('{count} XP to next level', { count: summary.toNext })}</p></div>
      <div><p className="text-sm font-medium text-brand-700">{t('Daily learning goal')}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{done}<span className="text-sm font-normal text-slate-600"> / {DAILY_GOAL} {t('study steps')}</span></p><progress className="mt-2 h-2 w-full accent-teal-700" aria-label={t('Daily learning goal')} max={DAILY_GOAL} value={done} /></div>
    </div>
    <p aria-live="polite" className="mt-4 text-sm text-brand-800">{t(done >= DAILY_GOAL ? 'Daily goal complete. Your learning counts.' : summary.studiedToday ? 'Today counts toward your streak. Keep exploring at your own pace.' : 'Read a new section or complete a checkpoint or exam to count today.')}</p>
    {summary.clockIssue && <p className="mt-2 text-sm text-amber-800">{t('Your device date is earlier than your last study date. Streak updates resume when the date catches up.')}</p>}
    {storageFailed && <p className="mt-2 text-sm text-amber-800">{t('Learning rewards could not be saved. Your course remains usable; check browser storage.')}</p>}
    <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-brand-700">{t('Milestones, recent days and freeze rules')}</summary>
      <ol className="mt-4 grid grid-cols-7 gap-1" aria-label={t('Last seven days')}>{summary.week.map(day => <li key={day.day} className={`min-w-0 rounded border p-1 text-center text-xs sm:p-2 ${day.state === 'Studied' ? 'border-teal-300 bg-teal-50' : day.state === 'Frozen' ? 'border-sky-300 bg-sky-50' : 'border-line bg-slate-50'}`}><time dateTime={day.day} className="block">{new Date(`${day.day}T12:00:00`).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', { weekday: 'short' })}</time><span className="mt-1 block break-words">{t(day.state)}</span><span className="mt-1 block text-slate-600">{day.day.slice(8)}</span></li>)}</ol>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('Learning badges')}>{summary.badges.map(badge => <li key={badge.name} className={`rounded-md border p-3 ${badge.unlocked ? 'border-amber-200 bg-amber-50' : 'border-line'}`}><p className="font-semibold">{badge.unlocked ? '✓ ' : ''}{t(badge.name)} <span className="text-xs font-normal text-slate-600">· {t(badge.unlocked ? 'Earned' : 'In progress')}</span></p><p className="mt-1 text-xs text-slate-600">{t(badge.detail)}</p></li>)}</ul>
      <div className="mt-4 space-y-2 text-xs leading-6 text-slate-600"><p>{t('Earn 10 learning XP once per new section, 5 once per fully correct practice set, 50 for a first exam pass and 25 more for a first perfect exam. Learning levels need 100 XP and are separate from campaign XP.')}</p><p>{t('One completed learning action keeps a day active. The daily goal is three distinct steps. Repeating the same quiz or exam counts once per local calendar day; unchecking and rechecking a rewarded section earns nothing extra.')}</p><p>{t('Start with one automatic freeze. Every seven active study days earns one more, up to two held. One freeze protects one missed day; frozen days preserve your streak but add no study days or XP. Today stays open until midnight in your device timezone.')}</p><p>{t('Freezes are used only when they can cover the entire missed gap. If the gap is too long, the streak restarts and your bank stays available. Existing section and exam milestones receive XP, but old undated progress does not create a past streak.')}</p><p>{t('These are personal learning rewards, shared by users of this browser profile. They do not grant account XP, prizes or certification.')}</p></div>
    </details>
    <Link to="/certificates" className="mt-4 inline-block text-sm font-medium text-brand-700 underline">{t('My certificates and verifier')}</Link>
  </section>
}

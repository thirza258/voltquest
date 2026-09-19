import { readJson, writeJson } from '../../lib/storage.js'

export const LEARNING_KEY = 'vq.learning.v1'
export const LEARNING_EVENT = 'vq-learning-changed'
export const DAILY_GOAL = 3
const DAY = 86400000
const rewardValue = key => key.startsWith('section:') ? 10 : key.startsWith('pass:') ? 50 : key.startsWith('perfect:') ? 25 : key.startsWith('practice:') ? 5 : 0
const courseKey = course => JSON.stringify([course.id, course.version])
const sectionKey = (course, id) => `section:${JSON.stringify([course.id, course.version, id])}`
const count = value => Number.isSafeInteger(value) && value >= 0

/** Local calendar dates compared as civil days, independent of DST day length. */
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function dayNumber(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const [year, month, date] = day.split('-').map(Number), time = Date.UTC(year, month - 1, date)
  if (new Date(time).toISOString().slice(0, 10) !== day) return null
  return time / DAY
}
const dayAt = value => new Date(value * DAY).toISOString().slice(0, 10)

export function newLearningState(legacy = {}) {
  const earned = {}
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    for (const [id, value] of Object.entries(legacy)) {
      if (!value || !Number.isSafeInteger(value.version) || value.version < 1 || !Array.isArray(value.read)) continue
      const course = { id, version: value.version }
      for (const section of new Set(value.read.filter(item => typeof item === 'string'))) earned[sectionKey(course, section)] = true
      if (Number.isSafeInteger(value.attempts) && value.attempts > 0 && [80, 100].includes(value.bestPercent)) earned[`pass:${courseKey(course)}`] = true
      if (value.attempts > 0 && value.bestPercent === 100) earned[`perfect:${courseKey(course)}`] = true
    }
  }
  // Older progress has no dates. Recognize milestones without inventing a past streak.
  return { version: 1, earned, streak: 0, bestStreak: 0, activeDays: 0, freezes: 1,
    frozenTotal: 0, lastStudyDay: null, coveredThrough: null, days: {} }
}

function validState(state) {
  return state?.version === 1 && state.earned && typeof state.earned === 'object' && !Array.isArray(state.earned)
    && Object.entries(state.earned).every(([key, value]) => rewardValue(key) > 0 && value === true)
    && ['streak', 'bestStreak', 'activeDays', 'freezes', 'frozenTotal'].every(key => count(state[key]))
    && state.freezes <= 2 && state.streak <= state.bestStreak && state.bestStreak <= state.activeDays
    && [state.lastStudyDay, state.coveredThrough].every(day => day === null || dayNumber(day) !== null)
    && ((state.lastStudyDay === null && state.coveredThrough === null && state.activeDays === 0)
      || (state.lastStudyDay !== null && state.coveredThrough !== null && state.lastStudyDay <= state.coveredThrough))
    && state.days && typeof state.days === 'object' && !Array.isArray(state.days)
    && Object.entries(state.days).every(([day, value]) => dayNumber(day) !== null && value && typeof value.frozen === 'boolean'
      && Array.isArray(value.actions) && value.actions.length <= 256 && value.actions.every(action => typeof action === 'string'))
}

/** Freeze closed missed days only. Today remains open; frozen days add no study days. */
export function reconcileLearning(state, today) {
  const number = dayNumber(today)
  if (number === null) throw new Error('Invalid study date.')
  const next = { ...state, earned: { ...state.earned }, days: { ...state.days } }
  if (!state.coveredThrough || today <= state.coveredThrough) return next
  const gap = number - dayNumber(state.coveredThrough) - 1
  if (gap <= 0) return next
  if (state.streak > 0 && gap <= state.freezes) {
    for (let offset = 1; offset <= gap; offset++) next.days[dayAt(dayNumber(state.coveredThrough) + offset)] = { frozen: true, actions: [] }
    next.freezes -= gap; next.frozenTotal += gap
  } else next.streak = 0 // Keep the bank if it cannot cover the entire gap.
  next.coveredThrough = dayAt(number - 1)
  next.days = Object.fromEntries(Object.entries(next.days).filter(([day]) => dayNumber(day) >= number - 34))
  return next
}

export function readLearning(date = new Date()) {
  const saved = readJson(LEARNING_KEY)
  return reconcileLearning(validState(saved) ? saved : newLearningState(readJson('vq.courses.v1', {})), localDay(date))
}

export function applyLearning(state, { actions = [], rewards = [] }, today) {
  const next = reconcileLearning(state, today)
  if (next.coveredThrough && today < next.coveredThrough) return next
  if (!actions.length) return next
  const previous = next.days[today] ?? { frozen: false, actions: [] }
  const unique = [...new Set([...previous.actions, ...actions])].slice(0, 256)
  if (next.lastStudyDay !== today) {
    next.streak += 1; next.activeDays += 1; next.bestStreak = Math.max(next.bestStreak, next.streak)
    if (next.activeDays % 7 === 0) next.freezes = Math.min(2, next.freezes + 1)
  }
  next.lastStudyDay = today; next.coveredThrough = today
  next.days[today] = { frozen: false, actions: unique }
  for (const key of rewards) if (rewardValue(key)) next.earned[key] = true
  next.days = Object.fromEntries(Object.entries(next.days).filter(([day]) => dayNumber(day) >= dayNumber(today) - 34))
  return next
}

function persist(state) {
  const ok = writeJson(LEARNING_KEY, state)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(LEARNING_EVENT, { detail: { ok } }))
  return ok
}

/** Called on view/focus/day changes so already consumed freezes stay consumed across visits. */
export function synchronizeLearning(date = new Date()) {
  const state = readLearning(date), saved = readJson(LEARNING_KEY)
  const ok = JSON.stringify(saved) === JSON.stringify(state) || writeJson(LEARNING_KEY, state)
  return { state, ok }
}

export function recordCourseLearning(course, previous, progress, state = readLearning(), date = new Date()) {
  const actions = [], rewards = [], key = courseKey(course)
  for (const lesson of course.lessons) {
    const reward = sectionKey(course, lesson.id)
    if (progress.read.includes(lesson.id) && !previous.read.includes(lesson.id) && !Object.hasOwn(state.earned, reward)) { actions.push(reward); rewards.push(reward) }
  }
  if (Number.isInteger(progress.attempts) && progress.attempts > previous.attempts && [0, 20, 40, 60, 80, 100].includes(progress.lastPercent)) {
    actions.push(`exam:${key}`)
    if (progress.lastPercent >= (course.exam?.passPercent ?? 80)) rewards.push(`pass:${key}`)
    if (progress.lastPercent === 100) rewards.push(`perfect:${key}`)
  }
  return !actions.length || persist(applyLearning(state, { actions, rewards }, localDay(date)))
}

export function recordPracticeLearning(questions, result, date = new Date()) {
  if (!questions.length || !result.complete) return true
  // Canonical text disambiguates older catalogues that reuse short question ids.
  const key = `practice:${JSON.stringify(questions.map(item => [item.id, item.lessonId, item.prompt]))}`
  return persist(applyLearning(readLearning(date), { actions: [key], rewards: result.percent === 100 ? [key] : [] }, localDay(date)))
}

export function learningSummary(state, date = new Date()) {
  const today = localDay(date), keys = Object.keys(state.earned), xp = keys.reduce((sum, key) => sum + rewardValue(key), 0)
  const sections = keys.filter(key => key.startsWith('section:')).length, exams = keys.filter(key => key.startsWith('pass:')).length
  const badges = [
    { name: 'First steps', unlocked: sections > 0, detail: 'Read your first section' },
    { name: 'Knowledge builder', unlocked: sections >= 10, detail: 'Read 10 sections' },
    { name: 'Exam explorer', unlocked: exams > 0, detail: 'Pass your first exam' },
    { name: 'Perfect score', unlocked: keys.some(key => key.startsWith('perfect:')), detail: 'Score 100% on an exam' },
    { name: 'Week of learning', unlocked: state.bestStreak >= 7, detail: 'Reach a 7-study-day streak' },
    { name: 'Course collector', unlocked: exams >= 5, detail: 'Pass 5 different course exams' },
    { name: 'Learning habit', unlocked: state.bestStreak >= 30, detail: 'Reach a 30-study-day streak' },
  ]
  return { xp, level: 1 + Math.floor(xp / 100), toNext: 100 - xp % 100, sections, exams, badges,
    todayActions: state.days[today]?.actions.length ?? 0, studiedToday: state.lastStudyDay === today,
    clockIssue: Boolean(state.coveredThrough && state.coveredThrough > today),
    week: Array.from({ length: 7 }, (_, i) => { const day = dayAt(dayNumber(today) - 6 + i); return { day, state: state.days[day]?.frozen ? 'Frozen' : state.days[day]?.actions.length ? 'Studied' : day === today ? 'Today' : 'No activity' } }) }
}

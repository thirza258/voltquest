import { readJson, writeJson } from '../../lib/storage.js'
import { readLearning, recordCourseLearning } from './learningRewards.js'

export const COURSE_PROGRESS_KEY = 'vq.courses.v1'
const emptyProgress = () => ({ read: [], attempts: 0, bestPercent: null, lastPercent: null })
const score = value => Number.isInteger(value) && value >= 0 && value <= 100 && value % 20 === 0

/** Browser-local self-study progress, deliberately separate from player XP and assessment credentials. */
export function readCourseProgress(course) {
  const saved = readJson(COURSE_PROGRESS_KEY)
  const entry = saved && Object.hasOwn(saved, course.id) ? saved[course.id] : null
  if (!entry || entry.version !== course.version) return emptyProgress()
  const read = Array.isArray(entry.read) ? course.lessons.filter(lesson => entry.read.includes(lesson.id)).map(lesson => lesson.id) : []
  if (!Number.isSafeInteger(entry.attempts) || entry.attempts < 1 || !score(entry.bestPercent)
    || !score(entry.lastPercent) || entry.bestPercent < entry.lastPercent) return { ...emptyProgress(), read }
  return { read, attempts: entry.attempts, bestPercent: entry.bestPercent, lastPercent: entry.lastPercent }
}

export function saveCourseProgress(course, progress) {
  const previous = readCourseProgress(course)
  const learning = readLearning()
  const saved = readJson(COURSE_PROGRESS_KEY)
  const entries = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  const ok = writeJson(COURSE_PROGRESS_KEY, { ...entries, [course.id]: { ...progress, version: course.version } })
  return ok && recordCourseLearning(course, previous, progress, learning)
}

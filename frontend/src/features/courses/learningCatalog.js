import firmware from '@content/tutorials.json'
import robotics from '@content/robotics.json'
import vision from '@content/vision.json'
import { getCourse } from './content.js'

// Only course routes need the combined catalog. Tutorial labs import fundamentals.js directly.
export const LEARNING_GROUPS = [
  { id: 'firmware', title: 'Firmware tutorials', basePath: '/tutorials', entries: firmware.tutorials },
  { id: 'robotics', title: 'Robotics tutorials', basePath: '/robotics', entries: robotics.tutorials },
  { id: 'vision', title: 'Computer vision labs', basePath: '/vision', entries: vision.tutorials },
]
export const LEARNING_TUTORIALS = LEARNING_GROUPS.flatMap(group => group.entries.map(entry => ({
  id: entry.id, title: entry.title, group: group.id, path: `${group.basePath}/${entry.id}`,
})))
export const getLearningTutorial = id => LEARNING_TUTORIALS.find(tutorial => tutorial.id === id) ?? null

/** Resolve canonical section ids against authored courses, never duplicated display titles. */
export function getFundamentalReading({ courseId, lessonId }) {
  const course = getCourse(courseId)
  const group = course ? null : LEARNING_GROUPS.find(group => group.id !== 'firmware' && group.entries.some(entry => entry.id === courseId))
  const study = course ?? group?.entries.find(entry => entry.id === courseId)
  const section = study?.lessons.find(lesson => lesson.id === lessonId)
  if (!section) return null
  return { courseTitle: study.title, sectionTitle: section.title, path: `${course ? '/courses' : group.basePath}/${courseId}#${lessonId}` }
}


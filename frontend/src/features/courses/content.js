// Imported only by the lazy course routes, keeping the curriculum out of the campaign chunk.
import content from '@content/courses.json'

export const COURSE_TRACKS = content.tracks
export const COURSES = content.courses
export const getCourse = id => COURSES.find(course => course.id === id) ?? null
export const getTrack = id => COURSE_TRACKS.find(track => track.id === id) ?? null

/** Incomplete or unknown choices never receive credit, even if a caller bypasses the form. */
export function gradeQuestions(questions, answers = {}) {
  const results = questions.map(question => {
    const answerId = Object.hasOwn(answers, question.id) ? answers[question.id] : null
    const answered = question.options.some(option => option.id === answerId)
    return { id: question.id, answered, correct: answered && answerId === question.answerId }
  })
  const correct = results.filter(result => result.correct).length
  return { results, correct, total: questions.length, complete: results.every(result => result.answered),
    percent: questions.length ? Math.round(100 * correct / questions.length) : 0 }
}

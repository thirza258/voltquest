import content from '@content/matlab.json'

export const MATLAB_COURSES = content.courses
export const MATLAB_STORAGE_PREFIX = 'vq.matlab.v1.'
export const MAX_PROJECT_BYTES = 65536
const bytes = text => new TextEncoder().encode(text).length

export function createMatlabProject(lesson = MATLAB_COURSES[0].id) {
  const course = MATLAB_COURSES.find(course => course.id === lesson)
  if (!course) throw new Error('Unknown MATLAB course preset.')
  return { format: 'voltquest-matlab', version: 1, lesson, code: course.code, notes: '' }
}

export function validateMatlabProject(value, expectedLesson) {
  if (!value || value.format !== 'voltquest-matlab' || value.version !== 1 || !MATLAB_COURSES.some(course => course.id === value.lesson)) throw new Error('This is not a supported MATLAB notebook.')
  if (expectedLesson && value.lesson !== expectedLesson) throw new Error('This notebook belongs to another course. Open it in the free MATLAB sandbox.')
  if (typeof value.code !== 'string' || bytes(value.code) > 32768 || typeof value.notes !== 'string' || bytes(value.notes) > 10240) throw new Error('Keep code within 32 KiB and notes within 10 KiB.')
  return { format: 'voltquest-matlab', version: 1, lesson: value.lesson, code: value.code, notes: value.notes }
}

export function parseMatlabProject(text, expectedLesson) {
  if (typeof text !== 'string' || bytes(text) > MAX_PROJECT_BYTES) throw new Error('MATLAB notebook files must fit within 64 KiB.')
  let value
  try { value = JSON.parse(text) } catch { throw new Error('The notebook file is not valid JSON.') }
  return validateMatlabProject(value, expectedLesson)
}

import content from '@content/avr.json'

/** The AVR-assembly stage of the computer-architecture track; each carries an `asm` starter. */
export const AVR_COURSES = content.courses
export const AVR_STORAGE_PREFIX = 'vq.avr.v1.'
export const MAX_AVR_BYTES = 40960
const bytes = text => new TextEncoder().encode(text).length

export function createAvrProject(lesson = AVR_COURSES[0]?.id) {
  const course = AVR_COURSES.find(item => item.id === lesson)
  if (!course) throw new Error('Unknown AVR course.')
  return { format: 'voltquest-avr', version: 1, lesson, source: course.asm, notes: '' }
}

export function validateAvrProject(value, expectedLesson) {
  if (!value || value.format !== 'voltquest-avr' || value.version !== 1 || !AVR_COURSES.some(course => course.id === value.lesson)) throw new Error('This is not a supported AVR notebook.')
  if (expectedLesson && value.lesson !== expectedLesson) throw new Error('This notebook belongs to another lesson. Open it in the free AVR workbench.')
  if (typeof value.source !== 'string' || bytes(value.source) > 20000 || typeof value.notes !== 'string' || bytes(value.notes) > 10000) throw new Error('Keep the program within 20 KB and notes within 10 KB.')
  return { format: 'voltquest-avr', version: 1, lesson: value.lesson, source: value.source, notes: value.notes }
}

export function parseAvrProject(text, expectedLesson) {
  if (typeof text !== 'string' || bytes(text) > MAX_AVR_BYTES) throw new Error('AVR notebooks must fit within 40 KB.')
  let value
  try { value = JSON.parse(text) } catch { throw new Error('The notebook file is not valid JSON.') }
  return validateAvrProject(value, expectedLesson)
}

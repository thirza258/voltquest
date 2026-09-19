import content from '@content/computer-architecture.json'
import { PRESETS } from '../../engine/computer/presets.js'

export const COMPUTER_COURSES = content.courses
export const STORAGE_PREFIX = 'vq.computer.v1.'
export const MAX_NOTEBOOK_BYTES = 98304
export const panelClass = 'min-w-0 rounded-lg border border-line bg-white p-5 sm:p-6'
export const fieldClass = 'w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-brand-500'
export const linkClass = 'rounded font-medium text-brand-700 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-brand-500'
export const codeClass = 'overflow-auto rounded-md bg-slate-900 p-4 font-mono text-xs leading-6 text-slate-100'

export function createProject(lesson = COMPUTER_COURSES[0].id) {
  if (!Object.hasOwn(PRESETS, lesson)) throw new Error('Unknown computer course.')
  const preset = PRESETS[lesson]
  return { format: 'voltquest-computer', version: 1, lesson, source: preset.source, inputs: { ...preset.inputs }, notes: '' }
}
export function validateProject(value, expectedLesson) {
  if (!value || value.format !== 'voltquest-computer' || value.version !== 1 || !Object.hasOwn(PRESETS, value.lesson)) throw new Error('This is not a supported computer notebook.')
  if (expectedLesson && value.lesson !== expectedLesson) throw new Error('This notebook belongs to another course. Open it in the free computer sandbox.')
  if (typeof value.source !== 'string' || value.source.length > 16384 || typeof value.notes !== 'string' || value.notes.length > 10000) throw new Error('Keep source within 16384 characters and notes within 10000 characters.')
  if (!value.inputs || typeof value.inputs !== 'object' || Array.isArray(value.inputs) || Object.keys(value.inputs).length > 16
    || Object.entries(value.inputs).some(([key, bit]) => !/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(key) || ![0, 1].includes(bit))) throw new Error('Notebook inputs must be at most sixteen named bits.')
  const project = { format: value.format, version: 1, lesson: value.lesson, source: value.source, inputs: { ...value.inputs }, notes: value.notes }
  if (new TextEncoder().encode(JSON.stringify(project, null, 2)).length > MAX_NOTEBOOK_BYTES) throw new Error('Computer notebooks must fit within 96 KiB.')
  return project
}
export function parseProject(text, expectedLesson) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_NOTEBOOK_BYTES) throw new Error('Computer notebooks must fit within 96 KiB.')
  let value
  try { value = JSON.parse(text) } catch { throw new Error('The notebook file is not valid JSON.') }
  return validateProject(value, expectedLesson)
}

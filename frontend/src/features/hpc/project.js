import { defaultParameters, validateParameters, LABS } from '../../engine/hpc/model.js'
import { exampleCode } from './examples.js'

export const HPC_STORAGE_PREFIX = 'vq.hpc.v1.'
export const MAX_PROJECT_BYTES = 200 * 1024
const bytes = text => new TextEncoder().encode(text).length

export function createHpcProject(lab = 'correctness') {
  return { format: 'voltquest-hpc', version: 1, lab, language: 'cpp', parameters: defaultParameters(lab),
    sources: { c: exampleCode(lab, 'c'), cpp: exampleCode(lab, 'cpp') }, notes: '' }
}

export function validateHpcProject(value, expectedLab) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.format !== 'voltquest-hpc' || value.version !== 1
    || !Object.hasOwn(LABS, value.lab) || !['c', 'cpp'].includes(value.language)) throw new Error('This is not a supported HPC experiment file.')
  if (expectedLab && value.lab !== expectedLab) throw new Error('Open this experiment in the free HPC sandbox; it belongs to a different course.')
  if (!value.sources || typeof value.sources !== 'object' || Array.isArray(value.sources)
    || ['c', 'cpp'].some(language => typeof value.sources[language] !== 'string' || bytes(value.sources[language]) > 64 * 1024)
    || typeof value.notes !== 'string' || bytes(value.notes) > 10 * 1024) throw new Error('Keep each source within 64 KiB and notes within 10 KiB.')
  const project = { format: 'voltquest-hpc', version: 1, lab: value.lab, language: value.language,
    parameters: validateParameters(value.lab, value.parameters), sources: { c: value.sources.c, cpp: value.sources.cpp }, notes: value.notes }
  if (bytes(JSON.stringify(project)) > MAX_PROJECT_BYTES) throw new Error('HPC experiment files must fit within 200 KiB.')
  return project
}

export function parseHpcProject(text, expectedLab) {
  if (typeof text !== 'string' || bytes(text) > MAX_PROJECT_BYTES) throw new Error('HPC experiment files must fit within 200 KiB.')
  let value
  try { value = JSON.parse(text) } catch { throw new Error('The experiment file is not valid JSON.') }
  return validateHpcProject(value, expectedLab)
}

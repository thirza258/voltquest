import { LABS, defaultControls } from '../../engine/cybersecurity/scenarios.js'
import { validateControls, validateRequest } from '../../engine/cybersecurity/model.js'

export const CYBER_STORAGE_PREFIX = 'vq.cybersecurity.v1.'
export const MAX_PROJECT_BYTES = 64 * 1024
const bytes = value => new TextEncoder().encode(value).length
export const requestDraft = request => ({ ...request, headers: JSON.stringify(request.headers, null, 2), body: JSON.stringify(request.body, null, 2) })
export function createCyberProject(lab = 'http') {
  if (!Object.hasOwn(LABS, lab)) throw new Error('Unknown cybersecurity lab.')
  return { format: 'voltquest-cybersecurity', version: 1, lab, request: requestDraft(LABS[lab].baseline), controls: defaultControls(lab), notes: '' }
}

export function validateCyberProject(value, expectedLab) {
  if (!value || typeof value !== 'object' || value.format !== 'voltquest-cybersecurity' || value.version !== 1 || !Object.hasOwn(LABS, value.lab)) throw new Error('This is not a supported cybersecurity notebook.')
  if (expectedLab && value.lab !== expectedLab) throw new Error('This notebook belongs to another lab. Open it in the free cybersecurity sandbox.')
  const request = value.request
  if (!request || !['GET', 'POST', 'PATCH'].includes(request.method) || typeof request.path !== 'string' || request.path.length > 2048 || ['headers', 'body'].some(key => typeof request[key] !== 'string' || request[key].length > 12000) || typeof value.notes !== 'string' || value.notes.length > 10000) throw new Error('Keep the path within 2048 characters, each JSON draft within 12000 and notes within 10000.')
  // Preserve even unfinished JSON drafts. Syntax and semantic request validation occur only on Send.
  const project = { format: 'voltquest-cybersecurity', version: 1, lab: value.lab, request: { method: request.method, path: request.path, headers: request.headers, body: request.body }, controls: validateControls(value.controls), notes: value.notes }
  if (bytes(JSON.stringify(project)) > MAX_PROJECT_BYTES) throw new Error('Cybersecurity notebooks must fit within 64 KiB.')
  return project
}

export function parseCyberProject(text, expectedLab) {
  if (typeof text !== 'string' || bytes(text) > MAX_PROJECT_BYTES) throw new Error('Cybersecurity notebooks must fit within 64 KiB.')
  let value
  try { value = JSON.parse(text) } catch { throw new Error('The notebook file is not valid JSON.') }
  return validateCyberProject(value, expectedLab)
}

export function parseRequestDraft(draft) {
  let headers, body
  try { headers = JSON.parse(draft.headers) } catch { throw new Error('Request headers are not valid JSON. Use an object of header names and string values.') }
  try { body = JSON.parse(draft.body) } catch { throw new Error('Request body is not valid JSON. Use an object of fields.') }
  return validateRequest({ method: draft.method, path: draft.path, headers, body })
}

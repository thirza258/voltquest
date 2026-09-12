import { readJson, removeKey, writeJson } from '../../lib/storage.js'

const INDEX = 'vq.project-cache'
const key = id => `vq.project-cache.${id}`
const LIMIT = 3

/** Keep a small offline fallback; drafts still hold edits newer than the saved snapshot. */
export function cacheProject(project) {
  if (!project?.id || !project.owner_id) return
  const ids = [project.id, ...readJson(INDEX, []).filter(id => id !== project.id)]
  for (const id of ids.slice(LIMIT)) removeKey(key(id))
  writeJson(key(project.id), project)
  writeJson(INDEX, ids.slice(0, LIMIT))
}
export function cachedProject(id, ownerId) {
  const project = readJson(key(id), null)
  return ownerId && project?.owner_id === ownerId ? project : null
}
export function cachedProjects(ownerId) {
  return readJson(INDEX, []).map(id => cachedProject(id, ownerId)).filter(Boolean)
}
export function removeCachedProject(id) {
  removeKey(key(id))
  writeJson(INDEX, readJson(INDEX, []).filter(item => item !== id))
}
export const isOfflineFailure = error => error?.status === 0 || error?.status >= 500

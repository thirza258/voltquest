/* global process, URL, fetch, AbortSignal, console */
// JavaScript comparison only. Run with Node 18+; WinUI C++ uses ApiClient.h.
const base = process.env.VQ_API_BASE || 'http://127.0.0.1:8766'
const url = new URL(base)
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) {
  throw new Error('This demo accepts only the local practice API.')
}
async function request(path, options = {}) {
  const response = await fetch(new URL(path, url), {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    headers: { Accept: 'application/json', ...options.headers },
  })
  // Like native HttpClient, fetch can return a response for 4xx/5xx.
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  if (response.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new Error('Expected JSON')
  // This short comparison trusts the bounded local fixture; the C++ helper streams with a byte limit.
  return response.json()
}
const before = await request('/tasks')
if (!Array.isArray(before.tasks)) throw new Error('Expected a tasks array')
console.log(`GET: ${before.tasks.length} task(s)`)
const created = await request('/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Created with fetch' }),
})
if (typeof created.title !== 'string' || !Number.isInteger(created.id)) throw new Error('Invalid created task')
console.log(`POST: ${created.id} ${created.title}`)
const after = await request('/tasks')
if (!after.tasks.some(task => task.id === created.id && task.title === created.title)) throw new Error('Readback failed')
console.log(`GET readback: ${after.tasks.length} task(s)`)

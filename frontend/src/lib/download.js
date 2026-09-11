/**
 * Trigger a browser download of `blob` as `filename`.
 * Uses a temporary object URL and a synthetic anchor click; revokes the URL afterwards.
 */
export function downloadBlob(blob, filename) {
  if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return false
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return true
}

/** Download a text file (default MIME text/plain, UTF-8). */
export function downloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  return downloadBlob(new Blob([String(text)], { type: mime }), filename)
}

/** Download `data` as pretty-printed JSON. */
export function downloadJson(data, filename) {
  return downloadText(JSON.stringify(data, null, 2), filename, 'application/json;charset=utf-8')
}

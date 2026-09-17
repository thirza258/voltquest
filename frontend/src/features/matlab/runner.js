import { runMatlab } from '../../engine/matlab/model.js'

export function startMatlab(source) {
  let worker, timer, finished = false, rejectRun
  const finish = () => { finished = true; clearTimeout(timer); worker?.terminate() }
  const promise = new Promise((resolve, reject) => {
    rejectRun = reject
    if (typeof Worker === 'undefined') {
      queueMicrotask(() => {
        if (finished) return
        try { const result = runMatlab(source); finish(); resolve(result) }
        catch (error) { finish(); reject(error) }
      })
      return
    }
    try {
      worker = new Worker(new URL('./matlab.worker.js', import.meta.url), { type: 'module' })
      worker.onmessage = ({ data }) => { if (finished) return; finish(); data.error ? reject(new Error(data.error)) : resolve(data.result) }
      worker.onerror = () => { if (finished) return; finish(); reject(new Error('The MATLAB sandbox worker could not start. Reload the page and try again.')) }
      timer = setTimeout(() => { finish(); reject(new Error('The script exceeded five seconds. Reduce its work and run again.')) }, 5000)
      worker.postMessage({ source })
    } catch (error) { finish(); reject(error) }
  })
  return { promise, cancel() { if (!finished) { finish(); rejectRun(new Error('Script stopped.')) } } }
}

import { runExperiment } from '../../engine/hpc/model.js'

/** A fresh bounded worker per request. Cancel/timeout always releases it. */
export function startExperiment(lab, parameters) {
  let worker, timer, finished = false, rejectRun
  const finish = () => { finished = true; clearTimeout(timer); worker?.terminate() }
  const promise = new Promise((resolve, reject) => {
    rejectRun = reject
    if (typeof Worker === 'undefined') {
      queueMicrotask(() => {
        if (finished) return
        try { const result = runExperiment(lab, parameters); finish(); resolve(result) }
        catch (error) { finish(); reject(error) }
      })
      return
    }
    try {
      worker = new Worker(new URL('./experiment.worker.js', import.meta.url), { type: 'module' })
      worker.onmessage = ({ data }) => { finish(); data.error ? reject(new Error(data.error)) : resolve(data.result) }
      worker.onerror = () => { finish(); reject(new Error('The experiment worker could not run. Try again or reload the page.')) }
      timer = setTimeout(() => { finish(); reject(new Error('The experiment exceeded its time limit. Try smaller settings.')) }, 5000)
      worker.postMessage({ lab, parameters })
    } catch (error) { finish(); reject(error) }
  })
  return { promise, cancel() { if (!finished) { finish(); rejectRun(new Error('Experiment cancelled.')) } } }
}

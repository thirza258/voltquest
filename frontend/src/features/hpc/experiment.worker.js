import { runExperiment } from '../../engine/hpc/model.js'

self.onmessage = ({ data }) => {
  try { self.postMessage({ result: runExperiment(data.lab, data.parameters) }) }
  catch (error) { self.postMessage({ error: error.message }) }
}

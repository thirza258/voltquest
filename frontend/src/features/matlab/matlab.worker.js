import { runMatlab } from '../../engine/matlab/model.js'

self.onmessage = ({ data }) => {
  try { self.postMessage({ result: runMatlab(data.source) }) }
  catch (error) { self.postMessage({ error: error.message }) }
}

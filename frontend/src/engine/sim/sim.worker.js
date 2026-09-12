// Web Worker entry — the only engine file allowed to touch `self` (CONTRACTS §8).
// `load` creates a runtime for the requested board; every other message goes to the runtime.
import { createRuntime } from '../runtime/index.js'
import { getBoard } from '../boards/index.js'

let runtime = null
const post = (msg) => self.postMessage(msg)

self.onmessage = (event) => {
  const msg = event?.data
  if (!msg || typeof msg !== 'object') return
  if (msg.type === 'load') {
    runtime?.stop?.()
    const board = getBoard(msg.board)
    if (!board) {
      post({ type: 'compiled', t: 0, ok: false, errors: [{ line: 0, col: 0, severity: 'error', message: `Unknown board '${msg.board}'` }], warnings: [] })
      return
    }
    runtime = createRuntime({ board, post, droneDoc: msg.droneDoc ?? null })
    runtime.load(msg.source)
    return
  }
  if (!runtime) return
  switch (msg.type) {
    case 'start':
      runtime.start()
      break
    case 'stop':
      runtime.stop()
      break
    case 'reset':
      runtime.reset()
      break
    default:
      runtime.handle(msg)
  }
}

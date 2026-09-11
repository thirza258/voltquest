import { expect } from 'vitest'
import { getBoard } from '../boards/index.js'
import { createRuntime } from './index.js'

export function sketch(source, { board = 'uno', env, realtime = false, now } = {}) {
  const messages = []
  const runtime = createRuntime({ board: getBoard(board), post: (message) => messages.push(message), realtime, now })
  const compiled = runtime.load(source)
  expect(compiled.errors).toEqual([])
  expect(compiled.ok).toBe(true)
  runtime.start()
  if (env) runtime.handle({ type: 'env', ...env })
  return {
    runtime, messages,
    advance(ms) {
      runtime.advance(ms)
      expect(runtime.getSnapshot().error).toBeNull()
    },
    text: () => messages.filter((message) => message.type === 'serial').map((message) => message.text).join(''),
    ofType: (type) => messages.filter((message) => message.type === type),
  }
}

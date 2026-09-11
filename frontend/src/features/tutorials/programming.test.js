import { describe, expect, it } from 'vitest'
import { TUTORIALS } from '../../content/index.js'
import { sketch } from '../../engine/runtime/testHarness.js'
import { tutorialCode } from './circuits.js'

const boards = ['uno', 'nano', 'esp32', 'esp32s3']
const outputs = [
  ['cpp-start', 'Starting once\nLoop number: 1\n'],
  ['cpp-variables', 'Count: 42\nVoltage: 3.30\n'],
  ['cpp-arithmetic', '3\n2\n3.40\n'],
  ['cpp-conditions', 'Comfortable\n'],
  ['cpp-functions', 'Approximate voltage: 2.50\n'],
  ['cpp-loops', '1\n4\n9\n16\n3\n2\n1\nFinished\n'],
  ['cpp-arrays', '100\n200\n300\nAverage: 200.00\n'],
]
const lessonCode = (id, board) => tutorialCode(TUTORIALS.find((tutorial) => tutorial.id === id), board)

describe.each(boards)('programming lesson behavior on %s', (board) => {
  it.each(outputs)('%s produces its explained result', (id, expected) => {
    const run = sketch(lessonCode(id, board), { board })
    run.advance(100)
    expect(run.text()).toContain(expected)
    if (id === 'cpp-variables') expect(run.text()).toContain(`Bytes in int: ${board.startsWith('esp32') ? 4 : 2}\n`)
    run.runtime.stop()
  })

  it('dispatches serial commands without fall-through and ignores line endings', () => {
    const run = sketch(lessonCode('cpp-commands', board), { board })
    run.advance(10)
    run.runtime.handle({ type: 'serialInput', text: 'hsx\r\n' })
    run.advance(30)
    expect(run.text()).toBe('Send h for help or s for status\nCommands: h=help, s=status\nReady\nUnknown command\n')
    run.runtime.stop()
  })

  it('toggles a non-blocking output every half second', () => {
    const run = sketch(lessonCode('cpp-nonblocking', board), { board })
    const pin = board.startsWith('esp32') ? 'GPIO18' : 'D9'
    run.advance(50)
    expect(run.runtime.getPinStates()[pin].level).toBe(0)
    run.advance(500)
    expect(run.runtime.getPinStates()[pin].level).toBe(1)
    run.advance(500)
    expect(run.runtime.getPinStates()[pin].level).toBe(0)
    run.runtime.stop()
  })

  it('advances and wraps the beacon state machine', () => {
    const run = sketch(lessonCode('cpp-state-machine', board), { board })
    const pin = board.startsWith('esp32') ? 'GPIO18' : 'D9'
    for (const [duration, level] of [[50, 1], [100, 0], [100, 1], [100, 0], [700, 1]]) {
      run.advance(duration)
      expect(run.runtime.getPinStates()[pin].level).toBe(level)
    }
    run.runtime.stop()
  })
})

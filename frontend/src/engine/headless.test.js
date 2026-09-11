import { describe, it, expect } from 'vitest'
import { LEVELS, LEVEL_ORDER } from '../content/index.js'
import { runLevelSolution, describeFailure } from './headless.js'

describe('authored quest reference solutions', () => {
  it('discovers the authored campaign levels', () => {
    expect(LEVEL_ORDER.length).toBeGreaterThan(0)
    expect(new Set(LEVEL_ORDER)).toEqual(new Set(Object.keys(LEVELS)))
  })

  it.each(LEVEL_ORDER)('%s passes through the complete simulation', async (levelId) => {
    const result = await runLevelSolution(LEVELS[levelId])
    expect(result.error, describeFailure(levelId, result)).toBeNull()
    expect(result.allPassed, describeFailure(levelId, result)).toBe(true)
    expect(result.stars).toBeGreaterThan(0)
    expect(result.elapsedMs).toBeGreaterThan(0)
  })
})

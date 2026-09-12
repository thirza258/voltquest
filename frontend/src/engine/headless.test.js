import { describe, it, expect } from 'vitest'
import { LEVELS, LEVEL_ORDER, WORLDS } from '../content/index.js'
import { runLevelSolution, describeFailure } from './headless.js'

describe('authored quest reference solutions', () => {
  it('discovers the authored campaign levels', () => {
    expect(LEVEL_ORDER).toHaveLength(14)
    expect(LEVEL_ORDER).toEqual(WORLDS.flatMap((world) => world.levelIds))
    expect(new Set(LEVEL_ORDER)).toEqual(new Set(Object.keys(LEVELS)))
  })

  it.each(LEVEL_ORDER)('%s passes through the complete simulation', async (levelId) => {
    const result = await runLevelSolution(LEVELS[levelId])
    expect(result.error, describeFailure(levelId, result)).toBeNull()
    expect(result.allPassed, describeFailure(levelId, result)).toBe(true)
    expect(result.stars, describeFailure(levelId, result)).toBe(3)
    expect(result.elapsedMs).toBeGreaterThan(0)
  })
})

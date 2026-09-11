import { describe, it, expect } from 'vitest'
import { levelForXp, xpForLevel, xpForCompletion, newlyUnlocked } from './xp.js'

describe('xp', () => {
  it('thresholds', () => {
    expect(xpForLevel(1)).toBe(0); expect(xpForLevel(2)).toBe(100); expect(xpForLevel(3)).toBe(300); expect(xpForLevel(4)).toBe(600)
  })
  it('levelForXp', () => {
    expect(levelForXp(0).level).toBe(1); expect(levelForXp(99).level).toBe(1); expect(levelForXp(100).level).toBe(2)
    expect(levelForXp(350)).toEqual({ level: 3, xpIntoLevel: 50, xpForNext: 300 })
  })
})

describe('xpForCompletion', () => {
  const level = { id: 'w1-l4', xp: 120 }
  it('awards the full amount on a first completion', () => {
    expect(xpForCompletion(level, 1, 0)).toBe(120)
    expect(xpForCompletion(level, 2, 0)).toBe(150)
    expect(xpForCompletion(level, 3, 0)).toBe(180)
    expect(xpForCompletion(level, 3)).toBe(180)
  })
  it('awards only the delta when improving stars', () => {
    expect(xpForCompletion(level, 2, 1)).toBe(30)
    expect(xpForCompletion(level, 3, 1)).toBe(60)
    expect(xpForCompletion(level, 3, 2)).toBe(30)
  })
  it('never goes negative or rewards a repeat', () => {
    expect(xpForCompletion(level, 2, 2)).toBe(0)
    expect(xpForCompletion(level, 1, 3)).toBe(0)
  })
  it('rounds like the backend and accepts a raw number', () => {
    expect(xpForCompletion({ xp: 90 }, 2, 0)).toBe(Math.round(90 * 1.25))
    expect(xpForCompletion(90, 3, 2)).toBe(Math.round(90 * 1.5) - Math.round(90 * 1.25))
  })
})

describe('newlyUnlocked', () => {
  const cosmetics = { skins: [{ id: 'classic', unlockLevel: 1 }, { id: 'mint', unlockLevel: 3 }], wirePalettes: [{ id: 'neon', unlockLevel: 4 }] }
  it('returns items crossed by the level-up', () => {
    expect(newlyUnlocked(cosmetics, 2, 4)).toEqual({ skins: [{ id: 'mint', unlockLevel: 3 }], wirePalettes: [{ id: 'neon', unlockLevel: 4 }] })
    expect(newlyUnlocked(cosmetics, 4, 4)).toEqual({ skins: [], wirePalettes: [] })
    expect(newlyUnlocked(null, 1, 9)).toEqual({ skins: [], wirePalettes: [] })
  })
})

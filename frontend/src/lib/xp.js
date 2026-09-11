/** Cumulative XP required to reach level n (level 1 at 0 xp). Mirrors backend/app/xp.py. */
export function xpForLevel(n) {
  if (n <= 1) return 0
  const k = n - 1
  return (100 * k * (k + 1)) / 2
}

/** levelForXp(xp) → { level, xpIntoLevel, xpForNext } */
export function levelForXp(xp) {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, xpIntoLevel: xp - base, xpForNext: next - base }
}

/** XP awarded for finishing a level with `stars` (1..3): base xp × (1 + 0.25·(stars − 1)). 0 for no stars. */
function xpForStars(baseXp, stars) {
  if (!stars || stars <= 0) return 0
  return Math.round(baseXp * (1 + 0.25 * (stars - 1)))
}

/**
 * XP gained by completing `level` with `stars` when the previous best was `prevStars`.
 * `level` may be a level object (`{ xp }`) or the base XP number. prevStars 0 → full amount;
 * never negative (stars never decrease). Mirrors backend `xp_for_completion`.
 */
export function xpForCompletion(level, stars, prevStars = 0) {
  const baseXp = typeof level === 'number' ? level : Number(level?.xp ?? 0)
  return Math.max(0, xpForStars(baseXp, stars) - xpForStars(baseXp, prevStars))
}

/**
 * Cosmetics that become unlocked when the player moves from `fromLevel` to `toLevel`.
 * @param {{ skins?: object[], wirePalettes?: object[] }} cosmetics content/cosmetics.json
 * @returns {{ skins: object[], wirePalettes: object[] }}
 */
export function newlyUnlocked(cosmetics, fromLevel, toLevel) {
  const pick = (items = []) => items.filter((c) => c.unlockLevel > fromLevel && c.unlockLevel <= toLevel)
  return { skins: pick(cosmetics?.skins), wirePalettes: pick(cosmetics?.wirePalettes) }
}

/**
 * Campaign progression rules (CONTRACTS §11.2 "Level gating").
 *
 * A level is available if it is the first in `LEVEL_ORDER`, or the level before it earned at least
 * one star. Locked levels are still reachable through "Skip ahead" — this is a teaching game, not a
 * paywall — so the rules only drive presentation.
 */

/** Stars earned on a level (0 when never completed). */
export function starsFor(progress, levelId) {
  return Number(progress?.[levelId]?.stars ?? 0)
}

/**
 * @param {string} levelId
 * @param {string[]} order LEVEL_ORDER
 * @param {object} progress playerStore.progress
 */
export function isAvailable(levelId, order = [], progress = {}) {
  const index = order.indexOf(levelId)
  if (index <= 0) return index === 0
  return starsFor(progress, order[index - 1]) >= 1
}

/** The level that gates `levelId`, or null when it is the first. */
export function blockedBy(levelId, order = []) {
  const index = order.indexOf(levelId)
  return index > 0 ? order[index - 1] : null
}

/**
 * The level the "Continue" button points at: the first without stars, falling back to the last one
 * when the campaign is finished.
 */
export function nextUpLevelId(order = [], progress = {}) {
  const next = order.find((id) => starsFor(progress, id) === 0)
  return next ?? order[order.length - 1] ?? null
}

/** Totals for the player summary strip. */
export function campaignTotals(order = [], progress = {}) {
  let stars = 0
  let completed = 0
  for (const id of order) {
    const earned = starsFor(progress, id)
    stars += earned
    if (earned > 0) completed += 1
  }
  return { stars, completed, total: order.length, maxStars: order.length * 3 }
}

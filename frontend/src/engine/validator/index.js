/**
 * Quest validator — CONTRACTS §9.
 *
 * Turns a level's declarative objectives into a live report the workspace renders: which steps pass,
 * why the failing ones fail, and how many stars the attempt has earned.
 *
 * Star rules (§9):
 *   ★    every objective passes
 *   ★★   ★ and nothing blew up this run — unless the level's whole point is the magic smoke, which
 *        `starCriteria.damageExpected` declares
 *   ★★★  ★★ and every `starCriteria.three` rule passes (the efficiency goal)
 *
 * Hints never cost stars.
 */
import * as defaultRegistry from '../components/registry.js'
import { evaluateRule, countCodeLines, RULE_TYPES } from './rules.js'

export { evaluateRule, RULE_TYPES }

/** Fill in the pieces a rule evaluator expects, so callers can pass a partial context. */
function normalizeContext(ctx) {
  return {
    doc: ctx.doc ?? ctx.sim?.compiled?.doc ?? null,
    compiled: ctx.compiled ?? ctx.sim?.compiled ?? null,
    sim: ctx.sim ?? null,
    code: ctx.code ?? '',
    board: ctx.board ?? ctx.sim?.compiled?.mcu?.board ?? null,
    registry: ctx.registry ?? defaultRegistry,
    sticky: ctx.sticky ?? {},
  }
}

/** Components that count toward the "keep it simple" star, i.e. everything but the board itself. */
function componentCount(doc, registry) {
  return (doc?.components ?? []).filter((c) => registry?.getDef?.(c.type)?.category !== 'mcu').length
}

/**
 * Evaluate every objective of a level.
 *
 * @param {object} level a level from content/quests
 * @param {object} ctx   { doc, compiled, sim, code, board, sticky, registry? }
 * @returns {{ objectives: object[], allPassed: boolean, stars: number, starReasons: string[], efficiency: object }}
 */
export function evaluateObjectives(level, ctx = {}) {
  const context = normalizeContext(ctx)
  const objectives = []

  for (const objective of level?.objectives ?? []) {
    const rules = (objective.rules ?? []).map((rule) => {
      const result = evaluateRule(rule, context)
      return { rule, passed: result.passed, detail: result.detail }
    })
    // An objective needs all of its rules; stickiness keeps it ticked once earned in this run.
    const passedNow = rules.length > 0 && rules.every((r) => r.passed)
    const passed = passedNow || context.sticky[objective.id] === true
    objectives.push({
      id: objective.id,
      text: objective.text,
      passed,
      rules,
      // The first unmet rule is what the hint panel explains.
      detail: passed ? null : rules.find((r) => !r.passed)?.detail ?? 'Not done yet',
    })
  }

  const allPassed = objectives.length > 0 && objectives.every((o) => o.passed)
  const efficiency = {
    codeLines: countCodeLines(context.code),
    componentCount: componentCount(context.doc, context.registry),
  }

  const starCriteria = level?.starCriteria ?? {}
  const starReasons = []
  let stars = 0

  if (allPassed) {
    stars = 1
  } else {
    const remaining = objectives.filter((o) => !o.passed).length
    starReasons.push(`${remaining} step${remaining === 1 ? '' : 's'} still to do`)
  }

  if (stars >= 1) {
    const damage = (context.sim?.events ?? []).filter((e) => e.type === 'blow' || e.type === 'burnt_pin')
    const shorted = (context.sim?.warningCodesSeen?.short_circuit ?? 0) > 0
    if (starCriteria.damageExpected || (damage.length === 0 && !shorted)) {
      stars = 2
    } else if (damage.length) {
      starReasons.push(`${damage.length} part${damage.length === 1 ? '' : 's'} damaged — fix the circuit, then Reset sim and run again`)
    } else {
      starReasons.push('Power was shorted to ground during this run')
    }
  }

  if (stars >= 2) {
    const threeRules = starCriteria.three ?? []
    const results = threeRules.map((rule) => evaluateRule(rule, context))
    if (results.every((r) => r.passed)) {
      stars = 3
    } else {
      const why = results.find((r) => !r.passed)?.detail
      starReasons.push(starCriteria.threeText ? `${starCriteria.threeText} — ${why ?? 'not yet'}` : why ?? 'Efficiency goal not met')
    }
  }

  return { objectives, allPassed, stars, starReasons, efficiency }
}

export default evaluateObjectives

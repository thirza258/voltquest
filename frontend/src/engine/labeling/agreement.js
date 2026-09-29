/**
 * Inter-annotator agreement measures computed offline from Label Studio annotations — the
 * Community Edition workflow, since built-in agreement metrics are a paid-edition feature.
 */

const annotatorKey = annotation => {
  const who = annotation.completed_by
  return who && typeof who === 'object' ? String(who.email ?? who.id) : String(who)
}
/** Latest non-cancelled annotation per annotator for a task. */
export function annotationsByAnnotator(task) {
  const latest = new Map()
  for (const annotation of task.annotations ?? []) {
    if (annotation.was_cancelled) continue
    const key = annotatorKey(annotation), previous = latest.get(key)
    if (!previous || String(annotation.updated_at ?? annotation.created_at ?? '') >= String(previous.updated_at ?? previous.created_at ?? '')) latest.set(key, annotation)
  }
  return latest
}
export function annotatorsOf(tasks) {
  return [...new Set(tasks.flatMap(task => [...annotationsByAnnotator(task).keys()]))].sort()
}

/** Classification label of one control; multi-choice selections become one sorted key. */
export function choiceOf(annotation, control) {
  const result = annotation?.result?.find(item => item.from_name === control && item.type === 'choices')
  return result ? [...result.value.choices].sort().join(' + ') : null
}

/** Cohen's kappa over paired labels; pairs with a missing label are excluded and counted. */
export function cohenKappa(pairs) {
  const complete = pairs.filter(([a, b]) => a !== null && a !== undefined && b !== null && b !== undefined)
  const n = complete.length
  if (!n) return { n: 0, excluded: pairs.length, observed: null, expected: null, kappa: null, categories: [] }
  const categories = [...new Set(complete.flat())].sort()
  const countA = Object.fromEntries(categories.map(c => [c, 0])), countB = { ...countA }
  let agree = 0
  for (const [a, b] of complete) { countA[a]++; countB[b]++; if (a === b) agree++ }
  const observed = agree / n
  const expected = categories.reduce((sum, c) => sum + (countA[c] / n) * (countB[c] / n), 0)
  const kappa = expected === 1 ? (observed === 1 ? 1 : 0) : (observed - expected) / (1 - expected)
  return { n, excluded: pairs.length - n, observed, expected, kappa, categories }
}

/** Fleiss' kappa: `ratings` is one array of category labels per item (same number of raters). */
export function fleissKappa(ratings) {
  const items = ratings.filter(item => item.length > 1)
  if (!items.length) return null
  const raters = items[0].length
  if (items.some(item => item.length !== raters)) throw new Error('Fleiss kappa needs the same number of ratings per item')
  const categories = [...new Set(items.flat())]
  const totals = Object.fromEntries(categories.map(c => [c, 0]))
  let agreementSum = 0
  for (const item of items) {
    const counts = {}
    for (const label of item) { counts[label] = (counts[label] ?? 0) + 1; totals[label]++ }
    agreementSum += (Object.values(counts).reduce((sum, count) => sum + count * (count - 1), 0)) / (raters * (raters - 1))
  }
  const observed = agreementSum / items.length
  const expected = categories.reduce((sum, c) => sum + (totals[c] / (items.length * raters)) ** 2, 0)
  return expected === 1 ? 1 : (observed - expected) / (1 - expected)
}

/** Intersection over union of two percentage boxes {x, y, width, height}. */
export function iou(a, b) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.width, b.x + b.width), y2 = Math.min(a.y + a.height, b.y + b.height)
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const union = a.width * a.height + b.width * b.height - intersection
  return union > 0 ? intersection / union : 0
}
const boxesOf = (annotation, control) => (annotation?.result ?? []).filter(item => item.from_name === control && item.type === 'rectanglelabels')
  .map(item => ({ id: item.id, label: item.value.rectanglelabels[0], x: item.value.x, y: item.value.y, width: item.value.width, height: item.value.height }))

/** Greedy one-to-one matching of same-label boxes, highest IoU first, keeping pairs at or above the threshold. */
export function matchBoxes(left, right, threshold = 0.5) {
  const candidates = []
  left.forEach((a, i) => right.forEach((b, j) => { if (a.label === b.label) candidates.push({ i, j, score: iou(a, b) }) }))
  candidates.sort((p, q) => q.score - p.score || p.i - q.i || p.j - q.j)
  const usedLeft = new Set(), usedRight = new Set(), matches = []
  for (const candidate of candidates) {
    if (candidate.score < threshold || usedLeft.has(candidate.i) || usedRight.has(candidate.j)) continue
    usedLeft.add(candidate.i); usedRight.add(candidate.j); matches.push(candidate)
  }
  return { matches, unmatchedLeft: left.filter((_, i) => !usedLeft.has(i)), unmatchedRight: right.filter((_, j) => !usedRight.has(j)) }
}
function f1(matched, leftTotal, rightTotal) {
  const precision = rightTotal ? matched / rightTotal : leftTotal ? 0 : 1
  const recall = leftTotal ? matched / leftTotal : rightTotal ? 0 : 1
  return { precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 }
}
/** Region agreement between two annotators: annotator A is treated as the reference. */
export function boxAgreement(tasks, control, annotatorA, annotatorB, threshold = 0.5) {
  let matched = 0, left = 0, right = 0, iouSum = 0
  for (const task of tasks) {
    const byAnnotator = annotationsByAnnotator(task)
    if (!byAnnotator.has(annotatorA) || !byAnnotator.has(annotatorB)) continue
    const a = boxesOf(byAnnotator.get(annotatorA), control), b = boxesOf(byAnnotator.get(annotatorB), control)
    const result = matchBoxes(a, b, threshold)
    matched += result.matches.length; left += a.length; right += b.length
    iouSum += result.matches.reduce((sum, match) => sum + match.score, 0)
  }
  return { ...f1(matched, left, right), matched, boxesA: left, boxesB: right, meanIoU: matched ? iouSum / matched : null, threshold }
}

const spansOf = (annotation, control) => (annotation?.result ?? []).filter(item => item.from_name === control && item.type === 'labels')
  .map(item => ({ start: item.value.start, end: item.value.end, label: item.value.labels[0] }))
/** Exact span agreement (same start, end and label) plus a lenient overlap-with-same-label count. */
export function spanAgreement(tasks, control, annotatorA, annotatorB) {
  let exact = 0, overlap = 0, left = 0, right = 0
  for (const task of tasks) {
    const byAnnotator = annotationsByAnnotator(task)
    if (!byAnnotator.has(annotatorA) || !byAnnotator.has(annotatorB)) continue
    const a = spansOf(byAnnotator.get(annotatorA), control), b = spansOf(byAnnotator.get(annotatorB), control)
    left += a.length; right += b.length
    const usedExact = new Set(), usedOverlap = new Set()
    for (const span of a) {
      const j = b.findIndex((other, index) => !usedExact.has(index) && other.start === span.start && other.end === span.end && other.label === span.label)
      if (j >= 0) { usedExact.add(j); exact++ }
      const k = b.findIndex((other, index) => !usedOverlap.has(index) && other.label === span.label && other.start < span.end && span.start < other.end)
      if (k >= 0) { usedOverlap.add(k); overlap++ }
    }
  }
  return { exact: f1(exact, left, right), overlap: f1(overlap, left, right), spansA: left, spansB: right }
}

/** Classification agreement for one Choices control between two annotators. */
export function choiceAgreement(tasks, control, annotatorA, annotatorB) {
  const pairs = [], disagreements = []
  for (const task of tasks) {
    const byAnnotator = annotationsByAnnotator(task)
    if (!byAnnotator.has(annotatorA) || !byAnnotator.has(annotatorB)) continue
    const a = choiceOf(byAnnotator.get(annotatorA), control), b = choiceOf(byAnnotator.get(annotatorB), control)
    pairs.push([a, b])
    if (a !== null && b !== null && a !== b) disagreements.push({ task: task.id, a, b })
  }
  return { ...cohenKappa(pairs), disagreements }
}

/** Majority vote per task; ties are reported instead of guessed. */
export function majorityVote(tasks, control) {
  return tasks.map(task => {
    const votes = {}
    for (const annotation of annotationsByAnnotator(task).values()) {
      if (annotation.ground_truth) continue
      const label = choiceOf(annotation, control)
      if (label !== null) votes[label] = (votes[label] ?? 0) + 1
    }
    const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const tie = ranked.length > 1 && ranked[0][1] === ranked[1][1]
    return { task: task.id, votes, label: ranked.length && !tie ? ranked[0][0] : null, tie }
  })
}

/** Accuracy of each annotator against annotations marked ground_truth. */
export function goldAccuracy(tasks, control) {
  const scores = {}
  for (const task of tasks) {
    const gold = (task.annotations ?? []).find(annotation => annotation.ground_truth && !annotation.was_cancelled)
    const expected = choiceOf(gold, control)
    if (expected === null) continue
    for (const [who, annotation] of annotationsByAnnotator(task)) {
      if (annotation === gold || annotation.ground_truth) continue
      const actual = choiceOf(annotation, control)
      if (actual === null) continue
      const score = scores[who] ??= { correct: 0, total: 0, misses: [] }
      score.total++
      if (actual === expected) score.correct++
      else score.misses.push({ task: task.id, expected, actual })
    }
  }
  return Object.fromEntries(Object.entries(scores).map(([who, score]) => [who, { ...score, accuracy: score.correct / score.total }]))
}

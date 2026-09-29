import { createRandom } from './results.js'

/**
 * A small, deterministic text classifier for the practice studio: multinomial Naive Bayes with
 * Laplace smoothing over lowercase word tokens. It is a real model trained on the learner's own
 * annotations — small enough to explain, not a replacement for the scikit-learn companion script.
 */

const STOP = new Set(['a', 'an', 'and', 'the', 'to', 'of', 'in', 'on', 'is', 'it', 'my', 'for', 'at', 'with', 'this', 'that', 'was', 'be', 'are', 'but', 'after', 'we', 'i'])
export function tokenize(text) {
  return (String(text).toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)?/g) ?? []).filter(token => !STOP.has(token))
}

/** @param {{text: string, label: string}[]} examples */
export function trainNaiveBayes(examples, { alpha = 1, labels } = {}) {
  const classes = labels ? [...labels] : [...new Set(examples.map(example => example.label))].sort()
  if (!examples.length || classes.length < 2) throw new Error('Train needs labeled examples from at least two classes.')
  const docCounts = Object.fromEntries(classes.map(label => [label, 0]))
  const tokenCounts = Object.fromEntries(classes.map(label => [label, {}]))
  const totals = Object.fromEntries(classes.map(label => [label, 0]))
  const vocabulary = new Set()
  for (const { text, label } of examples) {
    if (!Object.hasOwn(docCounts, label)) continue
    docCounts[label]++
    for (const token of tokenize(text)) {
      vocabulary.add(token)
      tokenCounts[label][token] = (tokenCounts[label][token] ?? 0) + 1
      totals[label]++
    }
  }
  const documents = Object.values(docCounts).reduce((sum, count) => sum + count, 0)
  return { kind: 'multinomial-naive-bayes', alpha, labels: classes, vocabulary: [...vocabulary].sort(), docCounts, tokenCounts, totals, documents }
}

/** Posterior probabilities per label (softmax of log scores); unseen tokens are ignored. */
export function predictProba(model, text) {
  const vocabularySize = model.vocabulary.length
  const known = new Set(model.vocabulary)
  const scores = model.labels.map(label => {
    let score = Math.log((model.docCounts[label] + model.alpha) / (model.documents + model.alpha * model.labels.length))
    for (const token of tokenize(text)) {
      if (!known.has(token)) continue
      score += Math.log(((model.tokenCounts[label][token] ?? 0) + model.alpha) / (model.totals[label] + model.alpha * vocabularySize))
    }
    return score
  })
  const max = Math.max(...scores)
  const exp = scores.map(score => Math.exp(score - max))
  const sum = exp.reduce((total, value) => total + value, 0)
  return Object.fromEntries(model.labels.map((label, index) => [label, exp[index] / sum]))
}
export function predictLabel(model, text) {
  const probs = predictProba(model, text)
  return model.labels.reduce((best, label) => probs[label] > probs[best] ? label : best, model.labels[0])
}

/** Accuracy, per-class precision/recall/F1, macro and weighted F1 and a confusion matrix (rows = truth). */
export function evaluate(model, examples) {
  const labels = model.labels
  const matrix = labels.map(() => labels.map(() => 0))
  let correct = 0
  for (const { text, label } of examples) {
    const predicted = predictLabel(model, text)
    const row = labels.indexOf(label)
    if (row < 0) continue
    matrix[row][labels.indexOf(predicted)]++
    if (predicted === label) correct++
  }
  const perClass = {}
  let macro = 0, weighted = 0, support = 0
  labels.forEach((label, i) => {
    const tp = matrix[i][i]
    const predicted = matrix.reduce((sum, row) => sum + row[i], 0)
    const actual = matrix[i].reduce((sum, value) => sum + value, 0)
    const precision = predicted ? tp / predicted : 0, recall = actual ? tp / actual : 0
    const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0
    perClass[label] = { precision, recall, f1, support: actual }
    macro += f1; weighted += f1 * actual; support += actual
  })
  return { accuracy: support ? correct / support : 0, macroF1: macro / labels.length, weightedF1: support ? weighted / support : 0, perClass, confusion: { labels, matrix }, support }
}

export const STRATEGIES = {
  'least-confidence': probs => 1 - Math.max(...Object.values(probs)),
  margin: probs => { const [first, second = 0] = Object.values(probs).sort((a, b) => b - a); return 1 - (first - second) },
  entropy: probs => -Object.values(probs).reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0),
}
/** Most uncertain first; ties break by task id so reruns give the same queue. */
export function rankByUncertainty(model, pool, strategy = 'least-confidence') {
  const measure = STRATEGIES[strategy]
  if (!measure) throw new Error(`Unknown strategy ${strategy}`)
  return pool.map(item => {
    const probs = predictProba(model, item.text)
    const label = model.labels.reduce((best, current) => probs[current] > probs[best] ? current : best, model.labels[0])
    return { id: item.id, probs, label, confidence: probs[label], uncertainty: measure(probs) }
  }).sort((a, b) => b.uncertainty - a.uncertainty || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Stratified shuffle split with a seeded generator: every class keeps its share in the test set. */
export function stratifiedSplit(items, labelOf, testFraction = 0.25, seed = 7) {
  const random = createRandom(seed)
  const groups = {}
  for (const item of items) (groups[labelOf(item)] ??= []).push(item)
  const train = [], test = []
  for (const label of Object.keys(groups).sort()) {
    const group = shuffle(groups[label], random)
    const count = Math.max(1, Math.round(group.length * testFraction))
    test.push(...group.slice(0, count)); train.push(...group.slice(count))
  }
  return { train, test }
}
function shuffle(items, random) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Pool-based simulation with a gold oracle: start from a stratified seed set, then add
 * `batchSize` tasks per round chosen by the strategy or at random, retrain and score on the
 * fixed test set. Returns both curves so the learner compares them on equal label budgets.
 */
export function simulateLearningCurve({ pool, test, seedSize = 8, batchSize = 8, rounds = 6, strategy = 'least-confidence', seed = 11 }) {
  const labels = [...new Set([...pool, ...test].map(item => item.label))].sort()
  const random = createRandom(seed)
  const seedSet = []
  for (const label of labels) seedSet.push(...shuffle(pool.filter(item => item.label === label), random).slice(0, Math.max(1, Math.floor(seedSize / labels.length))))
  const curve = mode => {
    let labeled = [...seedSet], remaining = pool.filter(item => !seedSet.includes(item))
    const order = createRandom(seed + 1)
    const points = []
    for (let round = 0; round <= rounds; round++) {
      const model = trainNaiveBayes(labeled, { labels })
      const score = evaluate(model, test)
      points.push({ labeled: labeled.length, macroF1: score.macroF1, accuracy: score.accuracy })
      if (round === rounds || !remaining.length) break
      const next = mode === 'random' ? shuffle(remaining, order).slice(0, batchSize)
        : rankByUncertainty(model, remaining, strategy).slice(0, batchSize).map(ranked => remaining.find(item => item.id === ranked.id))
      labeled = [...labeled, ...next]
      remaining = remaining.filter(item => !next.includes(item))
    }
    return points
  }
  return { strategy, labels, uncertainty: curve('uncertainty'), random: curve('random') }
}

/** Label Studio prediction object for a Choices/Text project, scored by the top probability. */
export function predictionFor(model, text, { control, object, modelVersion, id }) {
  const probs = predictProba(model, text)
  const label = model.labels.reduce((best, current) => probs[current] > probs[best] ? current : best, model.labels[0])
  return { model_version: modelVersion, score: Math.round(probs[label] * 1e4) / 1e4,
    result: [{ id, from_name: control, to_name: object, type: 'choices', value: { choices: [label] } }], probabilities: probs }
}

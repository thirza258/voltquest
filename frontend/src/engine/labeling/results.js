import { resolvePath } from './config.js'

/**
 * Label Studio result objects, shaped like the 1.23.1 editor serializes them: rectangles, polygons
 * and keypoints are percentages of the image with original_width/original_height; text spans use
 * character offsets with an exclusive end; time-series ranges carry start/end/instant; pairwise
 * stores `selected` with the Pairwise tag as to_name; relations link region ids.
 */

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'

/** Deterministic mulberry32 stream so tests, presets and notebooks reproduce the same region ids. */
export function createRandom(seed = 1) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function createIdGenerator(seed = 1) {
  const random = createRandom(seed)
  return () => Array.from({ length: 10 }, () => ID_ALPHABET[Math.floor(random() * ID_ALPHABET.length)]).join('')
}

const round = value => Math.round(value * 1e10) / 1e10
export function toPercent(pixels, size) { return round(pixels / size * 100) }
export function toPixels(percent, size) { return percent / 100 * size }

function base(id, control, objectName, type) {
  return { id, from_name: control, to_name: objectName, type, origin: 'manual' }
}
export function choicesResult({ id, control, object, choices }) {
  return { ...base(id, control, object, 'choices'), value: { choices: [...choices] } }
}
export function taxonomyResult({ id, control, object, paths }) {
  return { ...base(id, control, object, 'taxonomy'), value: { taxonomy: paths.map(path => [...path]) } }
}
export function spanResult({ id, control, object, text, start, end, labels }) {
  return { ...base(id, control, object, 'labels'), value: { start, end, text: text.slice(start, end), labels: [...labels] } }
}
function imageResult(id, control, object, type, size, value) {
  return { ...base(id, control, object, type), original_width: size.width, original_height: size.height, image_rotation: 0, value }
}
/** `box` is in image pixels; the result stores percentages like Label Studio. */
export function rectangleResult({ id, control, object, size, box, labels }) {
  return imageResult(id, control, object, 'rectanglelabels', size, { x: toPercent(box.x, size.width), y: toPercent(box.y, size.height),
    width: toPercent(box.width, size.width), height: toPercent(box.height, size.height), rotation: 0, rectanglelabels: [...labels] })
}
export function polygonResult({ id, control, object, size, points, labels }) {
  return imageResult(id, control, object, 'polygonlabels', size, { points: points.map(([x, y]) => [toPercent(x, size.width), toPercent(y, size.height)]),
    closed: true, polygonlabels: [...labels] })
}
export function keypointResult({ id, control, object, size, point, labels, width = 0.6 }) {
  return imageResult(id, control, object, 'keypointlabels', size, { x: toPercent(point.x, size.width), y: toPercent(point.y, size.height), width, keypointlabels: [...labels] })
}
export function rangeResult({ id, control, object, start, end, labels }) {
  return { ...base(id, control, object, 'timeserieslabels'), value: { start, end, instant: start === end, timeserieslabels: [...labels] } }
}
export function textareaResult({ id, control, object, text }) {
  return { ...base(id, control, object, 'textarea'), value: { text: Array.isArray(text) ? [...text] : [text] } }
}
export function ratingResult({ id, control, object, rating }) {
  return { ...base(id, control, object, 'rating'), value: { rating } }
}
export function numberResult({ id, control, object, number }) {
  return { ...base(id, control, object, 'number'), value: { number } }
}
export function pairwiseResult({ id, control, selected }) {
  return { ...base(id, control, control, 'pairwise'), value: { selected } }
}
export function relationResult({ from, to, labels = [], direction = 'right' }) {
  return { from_id: from, to_id: to, type: 'relation', direction, ...(labels.length ? { labels: [...labels] } : {}) }
}

export const REGION_TYPES = ['labels', 'rectanglelabels', 'polygonlabels', 'keypointlabels', 'timeserieslabels']
export function labelsOf(result) {
  return result.value?.[result.type] ?? []
}

const inPercent = value => Number.isFinite(value) && value >= 0 && value <= 100
/**
 * Checks results against the analyzed configuration and the task. Messages name the exact
 * field so learners can compare what they built with what Label Studio would store.
 */
export function validateResults(report, task, results) {
  const problems = [], ids = new Set(results.filter(result => result.id).map(result => result.id))
  for (const [index, result] of results.entries()) {
    const at = `Result ${index + 1}`
    if (result.type === 'relation') {
      if (!ids.has(result.from_id) || !ids.has(result.to_id)) problems.push(`${at}: relation links a region id that is not in this annotation.`)
      for (const label of result.labels ?? []) if (!report.relations.includes(label)) problems.push(`${at}: relation label "${label}" is not a <Relation> value.`)
      continue
    }
    const control = report.controls.find(item => item.name === result.from_name)
    if (!control) { problems.push(`${at}: from_name "${result.from_name}" is not a control in the configuration.`); continue }
    if (control.resultType !== result.type) problems.push(`${at}: type "${result.type}" does not match <${control.tag}> (${control.resultType}).`)
    const expectedTarget = control.tag === 'Pairwise' ? control.name : null
    if (expectedTarget ? result.to_name !== expectedTarget : !control.toName.includes(result.to_name)) problems.push(`${at}: to_name "${result.to_name}" is not the object ${control.name} labels.`)
    const allowed = control.labels.map(label => label.alias ?? label.value)
    const values = result.type === 'choices' ? result.value?.choices : REGION_TYPES.includes(result.type) ? labelsOf(result) : null
    if (values) {
      if (!control.dynamic) for (const value of values) if (!allowed.includes(value)) problems.push(`${at}: "${value}" is not a label of ${control.name}.`)
      if (result.type === 'choices' && control.attrs.choice !== 'multiple' && values.length > 1) problems.push(`${at}: ${control.name} allows one choice, but ${values.length} are stored.`)
      if (REGION_TYPES.includes(result.type) && !values.length) problems.push(`${at}: the region has no label.`)
    }
    const value = result.value ?? {}
    if (result.type === 'labels') {
      const object = report.objects.find(item => item.name === result.to_name)
      const text = object ? String(resolvePath(task.data, object.variable ?? '') ?? '') : ''
      if (!Number.isInteger(value.start) || !Number.isInteger(value.end) || value.start < 0 || value.end > text.length || value.start >= value.end) problems.push(`${at}: span offsets ${value.start}–${value.end} are outside the ${text.length}-character text.`)
      else if (value.text !== undefined && text.slice(value.start, value.end) !== value.text) problems.push(`${at}: text[${value.start}:${value.end}] is "${text.slice(value.start, value.end)}", not "${value.text}".`)
    }
    if (result.type === 'rectanglelabels') {
      if (![value.x, value.y, value.width, value.height].every(inPercent) || value.width <= 0 || value.height <= 0 || value.x + value.width > 100.0001 || value.y + value.height > 100.0001) problems.push(`${at}: the box must lie inside the image (0–100 %).`)
    }
    if (result.type === 'polygonlabels' && (!Array.isArray(value.points) || value.points.length < 3 || !value.points.every(point => inPercent(point[0]) && inPercent(point[1])))) problems.push(`${at}: a polygon needs at least three points inside the image.`)
    if (result.type === 'keypointlabels' && !(inPercent(value.x) && inPercent(value.y))) problems.push(`${at}: the keypoint must lie inside the image.`)
    if (['rectanglelabels', 'polygonlabels', 'keypointlabels'].includes(result.type) && !(result.original_width > 0 && result.original_height > 0)) problems.push(`${at}: original_width and original_height are required to convert percentages to pixels.`)
    if (result.type === 'timeserieslabels' && !(Number.isFinite(value.start) && Number.isFinite(value.end) && value.start <= value.end)) problems.push(`${at}: a range needs start ≤ end.`)
    if (result.type === 'rating') {
      const max = Number(control.attrs.maxRating ?? 5)
      if (!Number.isInteger(value.rating) || value.rating < 1 || value.rating > max) problems.push(`${at}: rating must be 1–${max}.`)
    }
    if (result.type === 'pairwise' && !['left', 'right'].includes(value.selected)) problems.push(`${at}: pairwise selected must be "left" or "right".`)
    if (result.type === 'textarea' && (!Array.isArray(value.text) || value.text.some(item => typeof item !== 'string'))) problems.push(`${at}: textarea text must be a list of strings.`)
  }
  for (const control of report.controls) {
    if (control.attrs.required === 'true' && !results.some(result => result.from_name === control.name)) problems.push(`${control.name} is required but has no result.`)
  }
  return problems
}

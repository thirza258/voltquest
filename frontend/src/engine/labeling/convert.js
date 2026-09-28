/**
 * Export conversions ported from label_studio_sdk 2.1.2's converter, the library Label Studio
 * 1.23.1 uses for JSON_MIN, CSV, YOLO, COCO, Pascal VOC and CONLL2003 exports. Behavior that
 * surprises people is kept on purpose, because learners must recognise it in real exports:
 * skipped annotations are dropped, every remaining annotation becomes its own record (newest
 * first), YOLO/VOC files for an image are overwritten by later records, and CONLL2003 tokens come
 * from the Treebank tokenizer as patched by Label Studio (it also splits "/").
 */

// ---------------------------------------------------------------- schema (converter.parse_config)
/** Control tags with name + toName, keyed by name; labels use alias || value in document order. */
export function converterSchema(report) {
  const schema = {}
  for (const control of report.controls) {
    if (!control.name || !control.toName.length || control.tag === 'Filter') continue
    const labels = [], labelAttrs = {}
    for (const label of control.labels) {
      const actual = label.attrs.alias || label.attrs.value
      if (!actual) continue
      if (!labelAttrs[actual]) labels.push(actual)
      labelAttrs[actual] = label.attrs
    }
    schema[control.name] = { type: control.node?.name ?? control.tag, toName: control.toName,
      inputs: control.toName.map(name => report.objects.find(object => object.name === name)).filter(Boolean), labels, labelAttrs }
  }
  return schema
}
function dataKeys(schema) {
  const keys = []
  for (const info of Object.values(schema)) for (const input of info.inputs) if (!keys.includes(input.value.replace(/^\$/, ''))) keys.push(input.value.replace(/^\$/, ''))
  return keys
}

// ------------------------------------------------------- records (Converter.annotation_result_from_task)
/** One record per non-cancelled annotation, newest first; tasks without annotations yield one empty record. */
export function annotationRecords(tasks, schema) {
  const records = []
  for (const task of tasks) {
    const annotations = task.annotations ?? []
    if (!annotations.length) { records.push(record(task, {}, {})); continue }
    const kept = annotations.filter(item => !(item.skipped || item.was_cancelled))
      .map((item, index) => ({ item, index }))
      .sort((a, b) => compareCreated(b.item, a.item) || a.index - b.index)
    for (const { item } of kept) {
      const outputs = {}
      for (const result of item.result ?? []) {
        const name = result.from_name
        if (!name || !schema[name]) continue
        const value = structuredClone(result.value ?? {})
        value.type = schema[name].type
        if ('original_width' in result) value.original_width = result.original_width
        if ('original_height' in result) value.original_height = result.original_height
        ;(outputs[name] ??= []).push(value)
      }
      records.push(record(task, outputs, item))
    }
  }
  return records
}
function compareCreated(a, b) {
  const left = a.created_at ?? '', right = b.created_at ?? ''
  return left < right ? -1 : left > right ? 1 : 0
}
function record(task, outputs, annotation) {
  return { id: task.id, input: task.data, output: outputs, completed_by: annotation.completed_by ?? {}, annotation_id: annotation.id ?? null,
    created_at: annotation.created_at ?? null, updated_at: annotation.updated_at ?? null, lead_time: annotation.lead_time ?? null }
}
function annotator(item, intId) {
  const who = item.completed_by
  if (who && typeof who === 'object') return who.email ?? null
  if (Number.isInteger(who) && intId) return who
  return String(who)
}

/** converter.utils.prettify_result */
export function prettifyResult(values) {
  const out = []
  let tagType = null
  for (const value of values) {
    const copy = structuredClone(value)
    tagType = copy.type
    delete copy.type
    if (tagType === 'Choices' && copy.choices?.length === 1) out.push(copy.choices[0])
    else if (tagType === 'TextArea' && copy.text?.length === 1) out.push(copy.text[0])
    else out.push(copy)
  }
  return ['Choices', 'TextArea'].includes(tagType) && out.length === 1 ? out[0] : out
}

// ------------------------------------------------------------------------------------ JSON_MIN / CSV
export function exportJsonMin(tasks, report) {
  const schema = converterSchema(report)
  return annotationRecords(tasks, schema).map(item => {
    const row = structuredClone(item.input)
    if (item.id !== undefined && item.id !== null) row.id = item.id
    for (const [name, value] of Object.entries(item.output)) row[name] = prettifyResult(value)
    Object.assign(row, { annotator: annotator(item, true), annotation_id: item.annotation_id, created_at: item.created_at, updated_at: item.updated_at, lead_time: item.lead_time })
    return row
  })
}

/** Compact JSON with "/" escaped, as ujson.dumps(…, ensure_ascii=False) writes it. */
export function ujsonDumps(value) {
  return JSON.stringify(value).replace(/\//g, '\\/')
}
function csvCell(value) {
  if (value === null || value === undefined) return '""'
  if (typeof value === 'number') return pythonNumber(value)
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  return `"${String(value).replace(/"/g, '""')}"`
}
export function exportCsv(tasks, report, separator = ',') {
  const schema = converterSchema(report)
  const records = annotationRecords(tasks, schema)
  const inputKeys = new Set(records.flatMap(item => Object.keys(item.input)))
  const colliding = new Set(records.flatMap(item => Object.keys(item.output)).filter(key => inputKeys.has(key)))
  const column = name => colliding.has(name) ? `_data_${name}` : name
  const rows = records.map(item => {
    const row = {}
    if (item.id !== undefined && item.id !== null) row.id = item.id
    for (const [name, value] of Object.entries(item.output)) {
      const pretty = prettifyResult(value)
      row[name] = typeof pretty === 'string' ? pretty : ujsonDumps(pretty)
    }
    for (const [name, value] of Object.entries(item.input)) row[column(name)] = value !== null && typeof value === 'object' ? ujsonDumps(value) : value
    Object.assign(row, { annotator: annotator(item, false), annotation_id: item.annotation_id, created_at: item.created_at, updated_at: item.updated_at, lead_time: item.lead_time })
    return row
  })
  const keys = [...new Set(['annotator', 'annotation_id', 'created_at', 'updated_at', 'lead_time', ...rows.flatMap(row => Object.keys(row))])].sort()
  const lines = [keys.map(key => `"${key}"`).join(separator), ...rows.map(row => keys.map(key => Object.hasOwn(row, key) ? csvCell(row[key]) : '""').join(separator))]
  return lines.join('\r\n') + '\r\n'
}

// ------------------------------------------------------------------------------- numbers as Python prints them
/** repr(float) for values this studio produces: shortest round-trip digits, ".0" for integral floats. */
export function pythonFloat(value) {
  if (!Number.isFinite(value)) return value > 0 ? 'inf' : value < 0 ? '-inf' : 'nan'
  if (Number.isInteger(value) && Math.abs(value) < 1e16) return `${value}.0`
  const magnitude = Math.abs(value)
  if (magnitude !== 0 && (magnitude < 1e-4 || magnitude >= 1e16)) {
    const [mantissa, exponent] = value.toExponential().split('e')
    const sign = exponent[0] === '-' ? '-' : '+', digits = exponent.replace(/^[+-]/, '')
    return `${mantissa}e${sign}${digits.padStart(2, '0')}`
  }
  return String(value)
}
function pythonNumber(value) { return Number.isInteger(value) ? String(value) : pythonFloat(value) }

// ------------------------------------------------------------------------------------ categories (_get_labels)
export function categoriesOf(schema) {
  const labels = new Set(), categories = [], byName = {}
  for (const info of Object.values(schema)) {
    for (const label of info.labels) labels.add(label)
    for (const [label, attrs] of Object.entries(info.labelAttrs)) {
      if (attrs.category === undefined) continue
      const id = Number.parseInt(attrs.category, 10)
      if (!Number.isInteger(id) || !/^\s*[+-]?\d+\s*$/.test(attrs.category)) continue
      categories.push({ id, name: label })
      byName[label] = id
    }
  }
  const used = new Set(Object.values(byName))
  let next = 0
  for (const label of [...labels].filter(label => !Object.hasOwn(byName, label)).sort()) {
    while (used.has(next)) next++
    categories.push({ id: next, name: label })
    byName[label] = next
    used.add(next)
  }
  return { categories, byName }
}
function basename(path) {
  const clean = String(path).split('/').at(-1)
  return clean
}
function stem(path) {
  const name = basename(path)
  const dot = name.lastIndexOf('.')
  return (dot > 0 ? name.slice(0, dot) : name).slice(0, 251)
}
function labelsOfRegion(label, keys) {
  for (const key of keys) if (label[key]?.length) return label[key]
  return []
}

// ------------------------------------------------------------------------------------------------ YOLO
/** @returns {{ files: Record<string,string>, categories: object[], skipped: string[] }} */
export function exportYolo(tasks, report) {
  const schema = converterSchema(report)
  const skipped = []
  if (report.controls.some(control => control.tag === 'KeyPointLabels')) skipped.push('KeyPointLabels use Label Studio\'s keypoint YOLO layout (parent rectangles and model_index); the studio does not reproduce it.')
  const { categories, byName } = categoriesOf(schema)
  const key = dataKeys(schema)[0]
  const files = {}
  for (const item of annotationRecords(tasks, schema)) {
    const path = item.input?.[key]
    if (typeof path !== 'string') { skipped.push(`Task ${item.id}: no image path in data.${key}.`); continue }
    const file = `labels/${stem(path)}.txt`
    const labels = Object.values(item.output).flat()
    const lines = []
    for (const label of labels) {
      const names = labelsOfRegion(label, ['rectanglelabels', 'polygonlabels', 'labels'])
      for (const name of names) {
        if (!Object.hasOwn(byName, name)) { byName[name] = categories.length; categories.push({ id: categories.length, name }) }
        const id = byName[name]
        if ('rectanglelabels' in label || 'labels' in label) {
          if (![label.x, label.y, label.width, label.height].every(Number.isFinite)) continue
          const x = (label.x + label.width / 2) / 100, y = (label.y + label.height / 2) / 100
          lines.push([id, pythonFloat(x), pythonFloat(y), pythonFloat(label.width / 100), pythonFloat(label.height / 100)].join(' '))
        } else if ('polygonlabels' in label && Array.isArray(label.points)) {
          lines.push([id, ...label.points.flatMap(([px, py]) => [pythonFloat(px / 100), pythonFloat(py / 100)])].join(' '))
        }
      }
    }
    files[file] = lines.map(line => `${line}\n`).join('')
  }
  files['classes.txt'] = categories.map(category => `${category.name}\n`).join('')
  files['notes.json'] = JSON.stringify({ categories, info: { year: new Date().getFullYear(), version: '1.0', contributor: 'Label Studio' } }, null, 2)
  return { files, categories, skipped }
}

// ------------------------------------------------------------------------------------------------ COCO
function polygonArea(xs, ys) {
  let a = 0, b = 0
  for (let i = 0; i < xs.length; i++) {
    const previous = (i - 1 + xs.length) % xs.length
    a += xs[i] * ys[previous]
    b += ys[i] * xs[previous]
  }
  return 0.5 * Math.abs(a - b)
}
/** `imageSizes` optionally maps an image path to its real pixel size, as the converter reads files. */
export function exportCoco(tasks, report, { imageSizes = {} } = {}) {
  const schema = converterSchema(report)
  const { categories, byName } = categoriesOf(schema)
  const key = dataKeys(schema)[0]
  const images = [], annotations = [], skipped = []
  for (const item of annotationRecords(tasks, schema)) {
    const path = item.input?.[key]
    const imageId = images.length
    let size = imageSizes[path] ?? null
    if (size) images.push({ width: size.width, height: size.height, id: imageId, file_name: path })
    const labels = Object.values(item.output).flat()
    if (!Object.keys(item.output).length || !labels.length) {
      if (!size) images.push({ width: null, height: null, id: imageId, file_name: path })
      continue
    }
    for (const label of labels) {
      const names = labelsOfRegion(label, ['rectanglelabels', 'polygonlabels', 'keypointlabels', 'labels'])
      if (!names.length) continue
      if (!size) {
        if (!('original_width' in label) || !('original_height' in label)) continue
        size = { width: label.original_width, height: label.original_height }
        images.push({ width: size.width, height: size.height, id: imageId, file_name: path })
      }
      const name = names[0]
      if (!Object.hasOwn(byName, name)) { byName[name] = categories.length; categories.push({ id: categories.length, name }) }
      const base = { id: annotations.length, image_id: imageId, category_id: byName[name] }
      if ('rectanglelabels' in label || 'labels' in label) {
        if (![label.x, label.y, label.width, label.height].every(Number.isFinite)) continue
        if (label.rotation) skipped.push(`Task ${item.id}: rotated boxes are converted to their axis-aligned bounds by Label Studio; the studio keeps rotation 0.`)
        const x = label.x * label.original_width / 100, y = label.y * label.original_height / 100
        const w = label.width * label.original_width / 100, h = label.height * label.original_height / 100
        annotations.push({ ...base, segmentation: [], bbox: [x, y, w, h], ignore: 0, iscrowd: 0, area: w * h })
      } else if ('polygonlabels' in label) {
        const points = label.points.map(([px, py]) => [px / 100 * size.width, py / 100 * size.height])
        const xs = points.map(point => point[0]), ys = points.map(point => point[1])
        const x1 = Math.min(...xs), y1 = Math.min(...ys)
        annotations.push({ ...base, segmentation: [points.flat()], bbox: [x1, y1, Math.max(...xs) - x1, Math.max(...ys) - y1], ignore: 0, iscrowd: 0, area: polygonArea(xs, ys) })
      } else if ('keypointlabels' in label) {
        skipped.push(`Task ${item.id}: keypoints need a parent rectangle for COCO keypoint export; the studio lists them but does not build keypoint arrays.`)
      }
    }
  }
  return { images, categories, annotations, info: { year: new Date().getFullYear(), version: '1.0', description: '', contributor: 'Label Studio', url: '' }, skipped }
}

// ------------------------------------------------------------------------------------------ Pascal VOC XML
const xmlEscape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export function exportVoc(tasks, report) {
  const schema = converterSchema(report)
  const key = dataKeys(schema)[0]
  const files = {}
  for (const item of annotationRecords(tasks, schema)) {
    const path = item.input?.[key]
    const boxes = Object.values(item.output).flat()
    if (!Object.keys(item.output).length || !boxes.length || !('original_width' in boxes[0]) || !('original_height' in boxes[0])) continue
    const width = boxes[0].original_width, height = boxes[0].original_height
    const node = (tag, text) => `<${tag}>${xmlEscape(text)}</${tag}>`
    const objects = []
    for (const box of boxes) {
      const labels = box.rectanglelabels ?? box.labels
      if (!labels?.length) continue
      // int() truncates each quantity before xmax = x + w, exactly like the converter.
      const x = Math.trunc(box.x / 100 * width), y = Math.trunc(box.y / 100 * height)
      const w = Math.trunc(box.width / 100 * width), h = Math.trunc(box.height / 100 * height)
      objects.push(['<object>', node('name', labels[0]), node('pose', 'Unspecified'), node('truncated', '0'), node('difficult', '0'),
        '<bndbox>', node('xmin', x), node('ymin', y), node('xmax', x + w), node('ymax', y + h), '</bndbox>', '</object>'].join('\n'))
    }
    files[`Annotations/${stem(path)}.xml`] = ['<?xml version="1.0" encoding="utf-8"?>', '<annotation>', node('folder', 'images'), node('filename', basename(path)),
      '<source>', node('database', 'MyDatabase'), node('annotation', 'COCO2017'), node('image', 'flickr'), node('flickrid', 'NULL'), node('annotator', annotator(item, false) ?? ''), '</source>',
      '<owner>', node('flickrid', 'NULL'), node('name', 'Label Studio'), '</owner>',
      '<size>', node('width', width), node('height', height), node('depth', 3), '</size>', node('segmented', '0'), ...objects, '</annotation>', ''].join('\n')
  }
  return { files }
}

// -------------------------------------------------------------------------------------------- CONLL2003
const TREEBANK = [
  [/^"/g, '``'], [/(``)/g, ' $1 '], [/([ ([{<])("|'{2})/g, '$1 `` '],
  // Label Studio's patched PUNCTUATION list (adds "/").
  [/([:,])([^\d])/g, ' $1 $2'], [/([:,])$/g, ' $1 '], [/\.\.\./g, ' ... '], [/[;@#$/%&]/g, ' $& '],
  [/([^.])(\.)([\])}>"']*)\s*$/g, '$1 $2$3 '], [/[?!]/g, ' $& '], [/([^'])' /g, "$1 ' "],
  [/[\][(){}<>]/g, ' $& '], [/--/g, ' -- '],
]
const ENDING = [[/''/g, " '' "], [/"/g, " '' "], [/([^' ])('[sS]|'[mM]|'[dD]|') /g, '$1 $2 '], [/([^' ])('ll|'LL|'re|'RE|'ve|'VE|n't|N'T) /g, '$1 $2 ']]
const CONTRACTIONS = [/\b(can)(not)\b/gi, /\b(d)('ye)\b/gi, /\b(gim)(me)\b/gi, /\b(gon)(na)\b/gi, /\b(got)(ta)\b/gi, /\b(lem)(me)\b/gi, /\b(more)('n)\b/gi, /\b(wan)(na)(?=\s)/gi, / ('t)(is)\b/gi, / ('t)(was)\b/gi]
/** nltk TreebankWordTokenizer().span_tokenize as used by Label Studio's CONLL2003 export. */
export function treebankSpans(text) {
  let working = text
  for (const [pattern, replacement] of TREEBANK) working = working.replace(pattern, replacement)
  working = ` ${working} `
  for (const [pattern, replacement] of ENDING) working = working.replace(pattern, replacement)
  for (const pattern of CONTRACTIONS) working = working.replace(pattern, ' $1 $2 ')
  let tokens = working.split(/\s+/).filter(Boolean)
  if (text.includes('"') || text.includes("''")) {
    const matched = [...text.matchAll(/``|'{2}|"/g)].map(match => match[0])
    tokens = tokens.map(token => ['"', '``', "''"].includes(token) ? matched.shift() : token)
  }
  const spans = []
  let point = 0
  for (const token of tokens) {
    const start = text.indexOf(token, point)
    if (start < 0) throw new Error(`Token "${token}" could not be aligned with the text`)
    point = start + token.length
    spans.push([start, point])
  }
  return spans
}
/** converter.utils.create_tokens_and_tags, including its end-of-span bookkeeping. */
export function tokensAndTags(text, spans) {
  const tokensAndIndex = treebankSpans(text).map(([start, end]) => [text.slice(start, end), start])
  if (!spans || !spans.every(span => span.start !== undefined && span.start !== null && span.end !== undefined && span.end !== null)) {
    return { tokens: tokensAndIndex.map(([token]) => token), tags: tokensAndIndex.map(() => 'O') }
  }
  const queue = [...spans].sort((a, b) => a.start - b.start)
  let span = queue.shift(), spanStart = span.start, spanEnd = span.end - 1, prefix = 'B-'
  const tokens = [], tags = []
  for (const [token, tokenStart] of tokensAndIndex) {
    tokens.push(token)
    const tokenEnd = tokenStart + token.length - 1
    if (tokenStart > spanEnd) {
      while (queue.length) {
        span = queue.shift()
        spanStart = span.start
        spanEnd = span.end - 1
        prefix = 'B-'
        if (tokenStart <= spanEnd) break
      }
    }
    if (!span || tokenEnd < spanStart || !span.labels?.length) tags.push('O')
    else if (spanStart <= tokenEnd && spanEnd >= tokenStart) { tags.push(prefix + span.labels[0]); prefix = 'I-' }
    else tags.push('O')
  }
  return { tokens, tags }
}
export function exportConll(tasks, report) {
  const schema = converterSchema(report)
  const key = dataKeys(schema)[0]
  let out = '-DOCSTART- -X- O\n'
  for (const item of annotationRecords(tasks, schema)) {
    const spans = Object.values(item.output).find(values => String(values[0]?.type).toLowerCase() === 'labels') ?? null
    const { tokens, tags } = tokensAndTags(String(item.input?.[key] ?? ''), spans)
    for (let i = 0; i < tokens.length; i++) out += `${tokens[i]} -X- _ ${tags[i]}\n`
    out += '\n'
  }
  return out
}

/** Which studio exports apply to a configuration, mirroring the formats Label Studio enables. */
export function availableExports(report) {
  const tags = new Set(report.controls.map(control => control.tag))
  const objects = new Set(report.objects.map(object => object.tag))
  return {
    JSON: true, JSON_MIN: true, CSV: true,
    YOLO: tags.has('RectangleLabels') || tags.has('PolygonLabels'),
    COCO: tags.has('RectangleLabels') || tags.has('PolygonLabels'),
    VOC: tags.has('RectangleLabels'),
    CONLL2003: tags.has('Labels') && objects.has('Text'),
  }
}

import { parseXml, walk, XmlError } from './xml.js'

/**
 * Labeling configuration analysis for the practice studio.
 *
 * `rejections` mirror what Label Studio 1.23.1's `/api/projects/validate/` refused when probed on
 * 2026-09-28 (malformed XML, DTDs, missing name/toName/value, Choices or Labels without children,
 * non-unique names, unknown toName targets). Everything else Label Studio saves, so the studio's
 * extra findings are `warnings`: configurations that save but label or export badly. This is a
 * teaching subset of the tag reference, not Label Studio's validator.
 */

const any = 'any'
const IMAGE = ['Image']
/** Object tags: they display task data read through `value`. */
export const OBJECT_TAGS = {
  Text: { data: 'text' }, HyperText: { data: 'html' }, Image: { data: 'url' }, Audio: { data: 'url' }, Video: { data: 'url' },
  TimeSeries: { data: 'series' }, Paragraphs: { data: 'messages' }, Table: { data: 'table' }, List: { data: 'list' },
}
/** Control tags: they create annotation results with `type` = resultType. */
export const CONTROL_TAGS = {
  Choices: { resultType: 'choices', targets: any, child: 'Choice', childrenRequired: true },
  Labels: { resultType: 'labels', targets: ['Text', 'HyperText', 'Audio', 'Video', 'Paragraphs', 'Image', 'TimeSeries'], child: 'Label', childrenRequired: true },
  RectangleLabels: { resultType: 'rectanglelabels', targets: IMAGE, child: 'Label' },
  PolygonLabels: { resultType: 'polygonlabels', targets: IMAGE, child: 'Label' },
  KeyPointLabels: { resultType: 'keypointlabels', targets: IMAGE, child: 'Label' },
  BrushLabels: { resultType: 'brushlabels', targets: IMAGE, child: 'Label' },
  EllipseLabels: { resultType: 'ellipselabels', targets: IMAGE, child: 'Label' },
  Rectangle: { resultType: 'rectangle', targets: IMAGE }, Polygon: { resultType: 'polygon', targets: IMAGE },
  KeyPoint: { resultType: 'keypoint', targets: IMAGE }, Brush: { resultType: 'brush', targets: IMAGE }, Ellipse: { resultType: 'ellipse', targets: IMAGE },
  TextArea: { resultType: 'textarea', targets: any }, Rating: { resultType: 'rating', targets: any },
  Number: { resultType: 'number', targets: any }, DateTime: { resultType: 'datetime', targets: any },
  Taxonomy: { resultType: 'taxonomy', targets: any, child: 'Choice' },
  Pairwise: { resultType: 'pairwise', targets: any, pair: true },
  Ranker: { resultType: 'ranker', targets: ['List'] },
  VideoRectangle: { resultType: 'videorectangle', targets: ['Video'] },
  TimelineLabels: { resultType: 'timelinelabels', targets: ['Video'], child: 'Label' },
  TimeSeriesLabels: { resultType: 'timeserieslabels', targets: ['TimeSeries'], child: 'Label' },
  ParagraphLabels: { resultType: 'paragraphlabels', targets: ['Paragraphs'], child: 'Label' },
  HyperTextLabels: { resultType: 'hypertextlabels', targets: ['HyperText'], child: 'Label' },
}
const CHILD_TAGS = ['Choice', 'Label', 'Relation', 'Channel', 'Panel']
export const VISUAL_TAGS = ['View', 'Header', 'Style', 'Collapse', 'Filter', 'Relations', ...CHILD_TAGS]
/** Tags the studio actually renders and labels; any other valid tag is reported as not rendered. */
export const STUDIO_TAGS = new Set(['View', 'Header', 'Text', 'Paragraphs', 'Image', 'TimeSeries', 'Channel', 'Choices', 'Choice',
  'Labels', 'Label', 'Relations', 'Relation', 'RectangleLabels', 'PolygonLabels', 'KeyPointLabels', 'TimeSeriesLabels',
  'TextArea', 'Rating', 'Number', 'Pairwise'])

const CANONICAL = Object.fromEntries([...Object.keys(OBJECT_TAGS), ...Object.keys(CONTROL_TAGS), ...VISUAL_TAGS].map(tag => [tag.toLowerCase(), tag]))
const BOOLEAN_ATTRS = ['required', 'showInline', 'zoom', 'zoomControl', 'canRotate', 'perRegion', 'perItem', 'editable', 'smart', 'smartOnly', 'selected', 'leafsOnly', 'showFullPath', 'randomize', 'allowNested', 'selectionEnabled', 'muted', 'showSubmitButton', 'skipDuplicates', 'transcription']
const NUMBER_ATTRS = ['maxRating', 'rows', 'min', 'max', 'step', 'maxUsages', 'frameRate', 'strokeWidth', 'defaultValue', 'maxSubmissions']
const ENUMS = {
  choice: { Choices: ['single', 'single-radio', 'multiple'], default: ['single', 'multiple'] },
  granularity: { default: ['symbol', 'word', 'sentence', 'paragraph'] },
  layout: { Choices: ['select', 'inline', 'vertical'], Paragraphs: ['none', 'dialogue'], default: null },
  visibleWhen: { default: ['region-selected', 'no-region-selected', 'choice-selected', 'choice-unselected'] },
}
const VARIABLE = /\$([A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*|\[\d+\])*)/g

export function canonicalTag(name) { return CANONICAL[String(name).toLowerCase()] ?? null }

/** Reads `$field`, `$meta.field` or `$items[2]` from task data; `undefined` when a step is missing. */
export function resolvePath(data, path) {
  let value = data
  for (const step of path.match(/[A-Za-z_][\w-]*|\[\d+\]/g) ?? []) {
    if (value === null || typeof value !== 'object') return undefined
    const key = step.startsWith('[') ? Number(step.slice(1, -1)) : step
    if (!Object.hasOwn(value, key)) return undefined
    value = value[key]
  }
  return value
}
export function variablesOf(value) {
  return [...String(value ?? '').matchAll(VARIABLE)].map(match => match[1])
}

function isTrue(value) { return value === 'true' }

/**
 * @returns {{ ok: boolean, rejections: object[], warnings: object[], objects: object[], controls: object[],
 *   relations: string[], dataKeys: string[], unsupported: string[], root: object|null }}
 */
export function analyzeConfig(xml) {
  const report = { ok: false, rejections: [], warnings: [], objects: [], controls: [], relations: [], dataKeys: [], unsupported: [], root: null }
  const reject = (message, node) => report.rejections.push({ message, line: node?.line ?? null })
  const warn = (message, node) => report.warnings.push({ message, line: node?.line ?? null })
  if (typeof xml !== 'string' || !xml.trim()) { reject('The labeling configuration is empty. Label Studio requires one.'); return report }
  let root
  try { root = parseXml(xml).root } catch (error) {
    if (!(error instanceof XmlError)) throw error
    report.rejections.push({ message: `XML is not well formed: ${error.reason}.`, line: error.line })
    return report
  }
  report.root = root
  if (canonicalTag(root.name) !== 'View') warn(`The root element is <${root.name}>. Label Studio saves it, but its templates and this studio expect a <View> root.`, root)

  const names = new Map(), unsupported = new Set(), hotkeys = new Map()
  walk(root, (node, parent) => {
    const tag = canonicalTag(node.name)
    node.tag = tag
    node.parentHint = parent
    if (!tag) { warn(`<${node.name}> is not a Label Studio tag in this reference. Label Studio saves unknown tags, but the labeling interface cannot use them.`, node); return }
    if (!STUDIO_TAGS.has(tag)) unsupported.add(tag)
    if (node.attrs.name !== undefined) {
      if (names.has(node.attrs.name)) reject(`The name "${node.attrs.name}" is used more than once. Label Studio rejects non-unique names.`, node)
      else names.set(node.attrs.name, node)
    }
    for (const key of node.attrOrder) {
      const value = node.attrs[key]
      if (BOOLEAN_ATTRS.includes(key) && !['true', 'false'].includes(value)) warn(`${tag} ${key}="${value}" is not "true" or "false"; the editor will not treat it as enabled.`, node)
      if (NUMBER_ATTRS.includes(key) && !Number.isFinite(Number(value))) warn(`${tag} ${key}="${value}" is not a number.`, node)
      const allowed = ENUMS[key]?.[tag] ?? ENUMS[key]?.default ?? null
      if (allowed && !allowed.includes(value)) warn(`${tag} ${key}="${value}" is not one of ${allowed.join(', ')}.`, node)
    }
    if (OBJECT_TAGS[tag]) {
      if (node.attrs.name === undefined) reject(`<${tag}> needs a name attribute ('name' is a required property).`, node)
      if (node.attrs.value === undefined) reject(`<${tag}> needs a value attribute such as value="$${tag === 'Image' ? 'image' : 'text'}".`, node)
      else {
        const variables = variablesOf(node.attrs.value)
        if (!variables.length) warn(`<${tag} name="${node.attrs.name ?? ''}"> value="${node.attrs.value}" has no $field, so every task shows the same literal value.`, node)
        for (const variable of variables) if (!report.dataKeys.includes(variable)) report.dataKeys.push(variable)
        report.objects.push({ name: node.attrs.name, tag, value: node.attrs.value, variable: variables[0] ?? null, attrs: { ...node.attrs }, line: node.line, node })
      }
    }
    if (CONTROL_TAGS[tag]) {
      const spec = CONTROL_TAGS[tag]
      if (node.attrs.name === undefined) reject(`<${tag}> needs a name attribute ('name' is a required property).`, node)
      if (node.attrs.toName === undefined) reject(`<${tag}> needs toName (case-sensitive) naming the object it labels ('toName' is a required property).`, node)
      const labels = []
      walk(node, child => {
        const childTag = canonicalTag(child.name)
        if (child === node || childTag !== spec.child) return
        if (child.attrs.value === undefined) { reject(`<${childTag}> inside <${tag}> needs a value attribute; text content is not accepted ('value' is a required property).`, child); return }
        labels.push({ value: child.attrs.value, alias: child.attrs.alias ?? null, hotkey: child.attrs.hotkey ?? null, background: child.attrs.background ?? null,
          category: child.attrs.category ?? null, attrs: { ...child.attrs }, depth: 0, line: child.line })
        if (child.attrs.hotkey) {
          if (hotkeys.has(child.attrs.hotkey)) warn(`Hotkey "${child.attrs.hotkey}" is assigned twice; one of the labels will not be reachable by keyboard.`, child)
          hotkeys.set(child.attrs.hotkey, child)
        }
      })
      if (spec.child && !labels.length && node.attrs.value === undefined) {
        if (spec.childrenRequired) reject(`<${tag} name="${node.attrs.name ?? ''}"> has no <${spec.child}> children ('${spec.child}' is a required property).`, node)
        else warn(`<${tag} name="${node.attrs.name ?? ''}"> has no <${spec.child}> children, so there is nothing to select.`, node)
      }
      const values = labels.map(label => label.value)
      for (const value of new Set(values.filter((value, index) => values.indexOf(value) !== index))) warn(`<${tag} name="${node.attrs.name}"> repeats the value "${value}"; results cannot tell the two options apart.`, node)
      if (values.some(value => !value.trim())) warn(`<${tag} name="${node.attrs.name}"> has an empty ${spec.child} value.`, node)
      if (node.attrs.visibleWhen?.startsWith('choice') && (!node.attrs.whenTagName || !node.attrs.whenChoiceValue)) warn(`${tag} visibleWhen="${node.attrs.visibleWhen}" needs both whenTagName and whenChoiceValue.`, node)
      report.controls.push({ name: node.attrs.name, tag, resultType: spec.resultType, toName: node.attrs.toName === undefined ? [] : node.attrs.toName.split(','),
        labels, attrs: { ...node.attrs }, line: node.line, node, dynamic: node.attrs.value !== undefined ? variablesOf(node.attrs.value)[0] ?? null : null })
      if (node.attrs.value !== undefined) for (const variable of variablesOf(node.attrs.value)) if (!report.dataKeys.includes(variable)) report.dataKeys.push(variable)
    }
    if (tag === 'Relations') {
      const relations = node.children.filter(child => child.type === 'element' && canonicalTag(child.name) === 'Relation')
      if (!relations.length) warn('<Relations> has no <Relation> children, so relations cannot carry labels.', node)
      for (const relation of relations) {
        if (relation.attrs.value === undefined) reject('<Relation> needs a value attribute.', relation)
        else report.relations.push(relation.attrs.value)
      }
    }
    if (tag === 'Header' && node.attrs.value === undefined && !node.children.some(child => child.type === 'text' && child.text.trim())) warn('<Header> has no value, so it shows nothing.', node)
    if (tag === 'TimeSeries' && !node.children.some(child => child.type === 'element' && canonicalTag(child.name) === 'Channel')) warn('<TimeSeries> has no <Channel>, so no signal is drawn.', node)
    if (['Choice', 'Label'].includes(tag) && parent && !walkUp(parent, p => CONTROL_TAGS[canonicalTag(p.name)]?.child === tag)) warn(`<${tag}> is outside a control tag and is ignored.`, node)
  })
  // Bindings are checked after every name is known, as Label Studio does.
  for (const control of report.controls) {
    for (const target of control.toName) {
      const node = names.get(target)
      if (!node) { reject(`toName="${target}" not found in names: [${[...names.keys()].map(name => `'${name}'`).sort().join(', ')}].`, control.node); continue }
      const targetTag = canonicalTag(node.name)
      if (!OBJECT_TAGS[targetTag]) warn(`<${control.tag} name="${control.name}"> points at <${targetTag} name="${target}">, which is not an object tag. Point toName at the data (Text, Image, …).`, control.node)
      else if (CONTROL_TAGS[control.tag].targets !== any && !CONTROL_TAGS[control.tag].targets.includes(targetTag)) warn(`<${control.tag}> labels ${CONTROL_TAGS[control.tag].targets.join(' or ')} objects, not <${targetTag}>. Label Studio saves this, but the editor cannot draw these regions.`, control.node)
    }
    if (CONTROL_TAGS[control.tag].pair && (control.toName.length !== 2 || control.toName[0] === control.toName[1])) warn('Pairwise needs exactly two different names in toName, e.g. toName="answer_a,answer_b".', control.node)
  }
  if (!report.controls.length && !report.rejections.length) warn('There is no control tag, so annotators have nothing to submit.', root)
  report.unsupported = [...unsupported].sort()
  report.ok = report.rejections.length === 0
  return report
}

function walkUp(node, test) {
  for (let current = node; current; current = current.parentHint) if (test(current)) return true
  return false
}

/** Checks tasks against the configuration's `$fields` (Label Studio imports them regardless). */
export function checkTasks(report, tasks) {
  const findings = []
  tasks.forEach((task, index) => {
    for (const object of report.objects) {
      for (const variable of variablesOf(object.value)) {
        if (resolvePath(task.data, variable) === undefined) findings.push({ task: index, field: variable, message: `Task ${index + 1}: data.${variable} is missing, so <${object.tag} name="${object.name}"> will be empty.` })
      }
    }
    for (const control of report.controls) {
      if (control.dynamic && !Array.isArray(resolvePath(task.data, control.dynamic))) findings.push({ task: index, field: control.dynamic, message: `Task ${index + 1}: data.${control.dynamic} must be a list of options for <${control.tag} name="${control.name}">.` })
    }
  })
  return findings
}

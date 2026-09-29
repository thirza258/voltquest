/**
 * A tolerant, inert HTML parser for the DevTools-style Elements view. It turns an HTML response
 * string into a node tree that the UI renders as plain spans — it never builds real DOM elements,
 * runs scripts or fires event handlers. It exists so learners can see, safely, that unencoded
 * markup becomes element nodes (the XSS lesson) while encoded output stays a single text node.
 */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const MAX_NODES = 500

/** Parse `<tag a="1" b=2 c>` attributes into ordered [name, value|null] pairs. */
function parseAttrs(source) {
  const attrs = []
  const re = /([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]*))?/g
  let match
  while ((match = re.exec(source)) && attrs.length < 40) {
    let value = match[2] ?? null
    if (value && (value[0] === '"' || value[0] === "'")) value = value.slice(1, -1)
    attrs.push([match[1], value])
  }
  return attrs
}

/**
 * Parse an HTML string into `{ type:'element'|'text', tag, attrs, children }` nodes. Unknown or
 * malformed markup degrades to text. Bounded to 500 nodes; the input is already response-sized.
 */
export function parseInertHtml(html) {
  if (typeof html !== 'string') return []
  const root = { type: 'root', children: [] }
  const stack = [root]
  let i = 0, count = 0
  const pushText = text => { if (text) stack[stack.length - 1].children.push({ type: 'text', value: text }) }
  while (i < html.length && count < MAX_NODES) {
    const lt = html.indexOf('<', i)
    if (lt < 0) { pushText(html.slice(i)); break }
    if (lt > i) pushText(html.slice(i, lt))
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      const stop = end < 0 ? html.length : end + 3
      stack[stack.length - 1].children.push({ type: 'comment', value: html.slice(lt + 4, end < 0 ? html.length : end) })
      count++; i = stop; continue
    }
    const gt = html.indexOf('>', lt)
    if (gt < 0) { pushText(html.slice(lt)); break }
    const raw = html.slice(lt + 1, gt).trim()
    count++
    if (raw.startsWith('/')) {
      const tag = raw.slice(1).trim().toLowerCase()
      for (let d = stack.length - 1; d > 0; d--) { if (stack[d].tag === tag) { stack.length = d; break } }
      i = gt + 1; continue
    }
    const nameMatch = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(raw)
    if (!nameMatch) { pushText(html.slice(lt, gt + 1)); i = gt + 1; continue }
    const tag = nameMatch[0].toLowerCase()
    const selfClose = raw.endsWith('/')
    const node = { type: 'element', tag, attrs: parseAttrs(raw.slice(nameMatch[0].length)), children: [] }
    stack[stack.length - 1].children.push(node)
    // Show raw text (never executed) inside script/style, then skip to the close tag.
    if (tag === 'script' || tag === 'style') {
      const close = html.toLowerCase().indexOf(`</${tag}`, gt + 1)
      const end = close < 0 ? html.length : close
      if (end > gt + 1) node.children.push({ type: 'text', value: html.slice(gt + 1, end) })
      i = close < 0 ? html.length : html.indexOf('>', close) + 1
      continue
    }
    if (!selfClose && !VOID.has(tag)) stack.push(node)
    i = gt + 1
  }
  return root.children
}

/** True for an on* attribute — code a real browser would run, shown here only as text. */
export const isEventAttr = name => /^on[a-z]/i.test(name)

/** Count element nodes and event-handler attributes in a parsed tree (for the Security summary). */
export function inspectSummary(nodes) {
  let elements = 0, handlers = 0
  const walk = list => list.forEach(node => {
    if (node.type === 'element') { elements++; handlers += node.attrs.filter(([name]) => isEventAttr(name)).length; walk(node.children) }
  })
  walk(nodes)
  return { elements, handlers }
}

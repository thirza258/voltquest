/**
 * Bounded XML parser for Label Studio labeling configurations. Plain JS with no DOM, so the
 * engine runs in Node tests and Workers alike. It accepts well-formed element/attribute/text
 * XML, comments, CDATA and an XML declaration; like Label Studio it refuses document type
 * declarations (no entity expansion). Positions are 1-based line/column of the offending token.
 */

export const XML_LIMITS = Object.freeze({ maxBytes: 65536, maxElements: 1500, maxDepth: 32, maxAttributes: 48 })

const NAME = /[A-Za-z_:][-A-Za-z0-9_:.]*/y
const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

export class XmlError extends Error {
  constructor(message, line, column) {
    super(`${message} (line ${line}, column ${column})`)
    this.name = 'XmlError'
    this.reason = message
    this.line = line
    this.column = column
  }
}

/** @returns {{ root: object, elements: number }} root = { type:'element', name, attrs, attrOrder, children, line, column } */
export function parseXml(source, limits = XML_LIMITS) {
  if (typeof source !== 'string') throw new XmlError('Configuration must be text', 1, 1)
  if (new TextEncoder().encode(source).length > limits.maxBytes) throw new XmlError(`Configuration is larger than ${limits.maxBytes} bytes`, 1, 1)
  let index = 0, root = null, elements = 0
  const stack = [], lineStarts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') lineStarts.push(i + 1)

  function position(at = index) {
    let low = 0, high = lineStarts.length - 1
    while (low < high) {
      const middle = (low + high + 1) >> 1
      if (lineStarts[middle] <= at) low = middle
      else high = middle - 1
    }
    return [low + 1, at - lineStarts[low] + 1]
  }
  const fail = (message, at = index) => { throw new XmlError(message, ...position(at)) }

  function decode(text, at) {
    return text.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z]+);|&/g, (match, entity, offset) => {
      if (!entity) fail('Unescaped "&" (write &amp;)', at + offset)
      if (entity[0] === '#') {
        const code = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
        if (!Number.isInteger(code) || code < 1 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) fail(`Invalid character reference &${entity};`, at + offset)
        return String.fromCodePoint(code)
      }
      if (!Object.hasOwn(ENTITIES, entity)) fail(`Unknown entity &${entity};`, at + offset)
      return ENTITIES[entity]
    })
  }
  function readName() {
    NAME.lastIndex = index
    const match = NAME.exec(source)
    if (!match) fail('Expected a tag or attribute name')
    index += match[0].length
    return match[0]
  }
  const skipSpace = () => { while (index < source.length && /\s/.test(source[index])) index++ }
  function addText(text, at) {
    if (!stack.length) {
      if (text.trim()) fail('Text outside the root element', at)
      return
    }
    stack.at(-1).children.push({ type: 'text', text, line: position(at)[0] })
  }

  if (source.startsWith('﻿')) index = 1
  while (index < source.length) {
    const start = index
    if (source[index] !== '<') {
      const end = source.indexOf('<', index)
      const raw = source.slice(index, end < 0 ? source.length : end)
      addText(decode(raw, index), start)
      index += raw.length
      continue
    }
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4)
      if (end < 0) fail('Unterminated comment')
      index = end + 3
      continue
    }
    if (source.startsWith('<![CDATA[', index)) {
      const end = source.indexOf(']]>', index + 9)
      if (end < 0) fail('Unterminated CDATA section')
      addText(source.slice(index + 9, end), start)
      index = end + 3
      continue
    }
    if (source.startsWith('<!', index)) fail('Document type declarations are not allowed')
    if (source.startsWith('<?', index)) {
      const end = source.indexOf('?>', index + 2)
      if (end < 0) fail('Unterminated processing instruction')
      if (root || stack.length || !/^<\?xml\s/i.test(source.slice(index, end + 2)) || source.slice(0, index).trim()) fail('Only an XML declaration at the start is allowed')
      index = end + 2
      continue
    }
    if (source[index + 1] === '/') {
      index += 2
      const name = readName()
      skipSpace()
      if (source[index] !== '>') fail('Expected ">" after closing tag name')
      index++
      const open = stack.pop()
      if (!open) fail(`Closing tag </${name}> has no opening tag`, start)
      if (open.name !== name) fail(`Mismatched closing tag </${name}> for <${open.name}>`, start)
      continue
    }
    index++
    const [line, column] = position(start)
    const element = { type: 'element', name: readName(), attrs: {}, attrOrder: [], children: [], line, column }
    if (++elements > limits.maxElements) fail(`More than ${limits.maxElements} elements`, start)
    if (root && !stack.length) fail('Only one root element is allowed', start)
    for (;;) {
      const before = index
      skipSpace()
      if (source.startsWith('/>', index)) { index += 2; break }
      if (source[index] === '>') { index++; stack.push(element); break }
      if (index >= source.length) fail(`Unterminated tag <${element.name}>`, start)
      if (index === before) fail('Expected whitespace between attributes')
      const attributeAt = index
      const name = readName()
      skipSpace()
      if (source[index] !== '=') fail(`Attribute ${name} needs a quoted value`, attributeAt)
      index++
      skipSpace()
      const quote = source[index]
      if (quote !== '"' && quote !== "'") fail(`Attribute ${name} value must be quoted`, attributeAt)
      const end = source.indexOf(quote, index + 1)
      if (end < 0) fail(`Unterminated value for attribute ${name}`, attributeAt)
      const raw = source.slice(index + 1, end)
      if (raw.includes('<')) fail(`Attribute ${name} contains "<" (write &lt;)`, attributeAt)
      if (Object.hasOwn(element.attrs, name)) fail(`Duplicate attribute ${name}`, attributeAt)
      if (element.attrOrder.length >= limits.maxAttributes) fail(`More than ${limits.maxAttributes} attributes`, attributeAt)
      element.attrs[name] = decode(raw, index + 1)
      element.attrOrder.push(name)
      index = end + 1
    }
    if (stack.length > limits.maxDepth) fail(`Nesting deeper than ${limits.maxDepth} levels`, start)
    const parent = stack.at(stack.at(-1) === element ? -2 : -1)
    if (parent) parent.children.push(element)
    else root = element
  }
  if (stack.length) fail(`Unclosed tag <${stack.at(-1).name}>`)
  if (!root) fail('Configuration has no root element', 0)
  return { root, elements }
}

/** Depth-first element walk: visit(element, parent, depth). */
export function walk(element, visit, parent = null, depth = 0) {
  visit(element, parent, depth)
  for (const child of element.children) if (child.type === 'element') walk(child, visit, element, depth + 1)
}

export function textContent(element) {
  return element.children.map(child => child.type === 'text' ? child.text : textContent(child)).join('')
}

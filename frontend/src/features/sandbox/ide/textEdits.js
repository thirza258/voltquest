/**
 * Line-based edits for IDE toolbar commands. Each returns the new text plus the selection that
 * covers the changed lines, so callers can apply it through the textarea's own undo stack.
 */
export function selectedLineRange(text, start, end) {
  const from = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  // A selection that ends at the start of a line does not include that line.
  const stop = end > start && text[end - 1] === '\n' ? end - 1 : end
  const to = text.indexOf('\n', stop)
  return { from: start === 0 ? 0 : from, to: to < 0 ? text.length : to }
}

export function transformLines(text, start, end, transform) {
  const { from, to } = selectedLineRange(text, start, end)
  const replacement = text.slice(from, to).split('\n').map(transform).join('\n')
  return { text: text.slice(0, from) + replacement + text.slice(to), from, to, replacement }
}

export const commentLine = prefix => line => line.trim() ? `${prefix} ${line}` : line
export const uncommentLine = prefix => line => {
  const match = line.match(new RegExp(`^(\\s*)${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ?`))
  return match ? match[1] + line.slice(match[0].length) : line
}
export const indentLine = width => line => line ? ' '.repeat(width) + line : line
export const outdentLine = width => line => line.replace(new RegExp(`^ {1,${width}}|^\\t`), '')

/** Applies a transform to the textarea's selected lines, keeping native undo where supported. */
export function applyLineEdit(textarea, transform) {
  if (!textarea || textarea.readOnly) return false
  const { from, to, replacement } = transformLines(textarea.value, textarea.selectionStart, textarea.selectionEnd, transform)
  textarea.focus()
  textarea.setSelectionRange(from, to)
  let inserted = false
  try { inserted = typeof document.execCommand === 'function' && document.execCommand('insertText', false, replacement) } catch { inserted = false }
  if (!inserted) {
    textarea.setRangeText(replacement, from, to, 'select')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  }
  textarea.setSelectionRange(from, from + replacement.length)
  return true
}

/** 1-based line and column for a caret offset. */
export function caretPosition(text, offset) {
  const before = text.slice(0, offset)
  const line = before.split('\n').length
  return { line, column: offset - before.lastIndexOf('\n') }
}

/** Offset of the first character of a 1-based line, clamped to the text. */
export function lineOffset(text, line) {
  let offset = 0
  for (let current = 1; current < line; current++) {
    const next = text.indexOf('\n', offset)
    if (next < 0) return text.length
    offset = next + 1
  }
  return offset
}

import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { caretPosition, lineOffset } from './textEdits.js'
import './ide.css'

const LINE_HEIGHT = 20
const PADDING = 8

/**
 * Source editor for sandbox IDEs: a native, labelled textarea over a highlighted copy of the same
 * text, with a line-number gutter and current-line band. The textarea stays the only input, so
 * selection, undo, IME, spellcheck-off and screen readers behave as in any form field.
 * Themes come from CSS variables (see ide.css); `tokenize(source)` returns [{ text, type }].
 */
const CodeEditor = forwardRef(function CodeEditor({ value, onChange, label, tokenize, readOnly = false, onCursor, onKeyDown, markers = [], className = '', describedBy }, ref) {
  const input = useRef(null), layer = useRef(null), gutter = useRef(null), band = useRef(null)
  const [line, setLine] = useState(1)
  const count = useMemo(() => value.split('\n').length, [value])
  const runs = useMemo(() => tokenize ? tokenize(value) : [{ text: value, type: '' }], [tokenize, value])
  const marked = useMemo(() => new Map(markers.filter(marker => marker.line).map(marker => [marker.line, marker.severity])), [markers])
  const sync = useCallback(() => {
    const element = input.current
    if (!element) return
    const x = element.scrollLeft, y = element.scrollTop
    if (layer.current) layer.current.style.transform = `translate(${-x}px, ${-y}px)`
    if (gutter.current) gutter.current.style.transform = `translateY(${-y}px)`
    if (band.current) band.current.style.transform = `translateY(${(line - 1) * LINE_HEIGHT - y}px)`
  }, [line])
  useLayoutEffect(sync)
  const report = useCallback(() => {
    const element = input.current
    if (!element) return
    const position = caretPosition(element.value, element.selectionStart)
    setLine(position.line)
    onCursor?.({ ...position, selected: Math.abs(element.selectionEnd - element.selectionStart) })
  }, [onCursor])
  useImperativeHandle(ref, () => ({
    element: () => input.current,
    focus: () => input.current?.focus(),
    /** Moves the caret to the start of a 1-based line and scrolls it into view. */
    goToLine(target) {
      const element = input.current
      if (!element) return
      const offset = lineOffset(element.value, target)
      element.focus()
      element.setSelectionRange(offset, offset)
      element.scrollTop = Math.max(0, (target - 3) * LINE_HEIGHT)
      report(); sync()
    },
  }), [report, sync])
  return <div className={`vq-code ${className}`} data-readonly={readOnly || undefined}>
    <div className="vq-code-gutter" aria-hidden="true">
      <div ref={gutter} style={{ paddingTop: PADDING }}>
        {Array.from({ length: count }, (_, index) => <div key={index} className={[index + 1 === line ? 'is-current' : '', marked.has(index + 1) ? `is-${marked.get(index + 1)}` : ''].join(' ').trim() || undefined}>{index + 1}</div>)}
      </div>
    </div>
    <div className="vq-code-body">
      <div ref={band} className="vq-code-band" aria-hidden="true" />
      <pre ref={layer} className="vq-code-layer" aria-hidden="true">{runs.map((run, index) => run.type ? <span key={index} className={`tok-${run.type}`}>{run.text}</span> : run.text)}{'\n'}</pre>
      <textarea
        ref={input}
        aria-label={label}
        aria-describedby={describedBy}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        wrap="off"
        onChange={event => onChange?.(event.target.value)}
        onScroll={sync}
        onSelect={report}
        onKeyUp={report}
        onClick={report}
        onFocus={report}
        onKeyDown={onKeyDown}
      />
    </div>
  </div>
})

export default CodeEditor

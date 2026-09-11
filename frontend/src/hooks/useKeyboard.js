/**
 * Global keyboard layer (DESIGN.md "Keyboard").
 *
 * Only the *global* bindings live here — the canvas owns its own keys (`V`, `W`, `R`, `Delete`,
 * `1–5`, `Esc`, `+ − 0`, `F`) and handles them when focus is inside it. Every binding below is
 * suppressed while the user is typing, which includes Monaco (a contenteditable `<textarea>` inside
 * `.monaco-editor`) and Blockly's field editors.
 */
import { useEffect, useRef } from 'react'

/** Shortcut reference, also rendered by the Shortcuts modal. */
export const KEYBOARD_SHORTCUTS = [
  {
    group: 'Global',
    items: [
      { keys: ['Ctrl', 'Enter'], label: 'Run or stop the sketch' },
      { keys: ['Ctrl', 'Z'], label: 'Undo a circuit edit' },
      { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo a circuit edit' },
      { keys: ['Ctrl', 'S'], label: 'Save the project (sandbox)' },
      { keys: ['H'], label: 'Next hint' },
      { keys: ['?'], label: 'Show this list' },
    ],
  },
  {
    group: 'Canvas',
    items: [
      { keys: ['V'], label: 'Select tool' },
      { keys: ['W'], label: 'Wire tool' },
      { keys: ['R'], label: 'Rotate the selected part' },
      { keys: ['Delete'], label: 'Remove the selection' },
      { keys: ['1', '–', '5'], label: 'Wire colour: red, black, yellow, green, blue' },
      { keys: ['+', '−', '0'], label: 'Zoom in, out, reset' },
      { keys: ['F'], label: 'Fit the circuit to the view' },
      { keys: ['Esc'], label: 'Cancel the current action' },
    ],
  },
]

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * True when a key event originated inside a text-entry surface and must not trigger a shortcut.
 * @param {EventTarget|null} target
 */
export function isTypingTarget(target) {
  const el = target && typeof target === 'object' && 'nodeType' in target ? target : null
  if (!el || el.nodeType !== 1) return false
  if (TYPING_TAGS.has(el.tagName)) return true
  if (el.isContentEditable) return true
  if (typeof el.closest === 'function') {
    // Monaco and Blockly both render their own editing surfaces; never steal keys from them.
    if (el.closest('.monaco-editor, .blocklyWidgetDiv, .blocklyHtmlInput, [data-keyboard-passthrough]')) return true
  }
  return false
}

/** Cmd on Apple platforms, Ctrl everywhere else — accept either so the map works on both. */
const isAccel = (event) => event.metaKey || event.ctrlKey

/**
 * Bind the global shortcut map.
 *
 * @param {{
 *   onRunStop?: () => void, onUndo?: () => void, onRedo?: () => void,
 *   onSave?: () => void, onHint?: () => void, onShortcuts?: () => void,
 * }} handlers
 * @param {{ enabled?: boolean, target?: EventTarget }} [options]
 */
export function useKeyboard(handlers, { enabled = true, target } = {}) {
  // Keep the latest handlers in a ref so re-renders never re-bind the listener.
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!enabled) return undefined
    const node = target ?? (typeof window !== 'undefined' ? window : null)
    if (!node?.addEventListener) return undefined

    function onKeyDown(event) {
      if (event.defaultPrevented || isTypingTarget(event.target)) return
      const h = ref.current ?? {}
      const key = event.key

      if (isAccel(event)) {
        if (key === 'Enter') return fire(event, h.onRunStop)
        if (key === 's' || key === 'S') return fire(event, h.onSave)
        if (key === 'z' || key === 'Z') return fire(event, event.shiftKey ? h.onRedo : h.onUndo)
        if (key === 'y' || key === 'Y') return fire(event, h.onRedo)
        return
      }
      if (event.altKey) return
      if (key === '?') return fire(event, h.onShortcuts)
      if ((key === 'h' || key === 'H') && !event.shiftKey) return fire(event, h.onHint)
    }

    node.addEventListener('keydown', onKeyDown)
    return () => node.removeEventListener('keydown', onKeyDown)
  }, [enabled, target])
}

function fire(event, handler) {
  if (typeof handler !== 'function') return
  event.preventDefault()
  handler(event)
}

export default useKeyboard

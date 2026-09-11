// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { isTypingTarget, useKeyboard } from './useKeyboard.js'

afterEach(cleanup)

function Harness({ handlers }) {
  useKeyboard(handlers)
  return (
    <div>
      <input aria-label="name" />
      <textarea aria-label="notes" />
      <div className="monaco-editor">
        <div aria-label="code" tabIndex={-1} data-monaco />
      </div>
      <button type="button">plain</button>
    </div>
  )
}

describe('useKeyboard', () => {
  it('fires the global map from a non-typing target', () => {
    const handlers = {
      onRunStop: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      onSave: vi.fn(),
      onHint: vi.fn(),
      onShortcuts: vi.fn(),
    }
    render(<Harness handlers={handlers} />)
    const button = screen.getByRole('button', { name: 'plain' })

    fireEvent.keyDown(button, { key: 'Enter', ctrlKey: true })
    fireEvent.keyDown(button, { key: 'z', metaKey: true })
    fireEvent.keyDown(button, { key: 'z', metaKey: true, shiftKey: true })
    fireEvent.keyDown(button, { key: 's', ctrlKey: true })
    fireEvent.keyDown(button, { key: 'h' })
    fireEvent.keyDown(button, { key: '?' })

    expect(handlers.onRunStop).toHaveBeenCalledTimes(1)
    expect(handlers.onUndo).toHaveBeenCalledTimes(1)
    expect(handlers.onRedo).toHaveBeenCalledTimes(1)
    expect(handlers.onSave).toHaveBeenCalledTimes(1)
    expect(handlers.onHint).toHaveBeenCalledTimes(1)
    expect(handlers.onShortcuts).toHaveBeenCalledTimes(1)
  })

  it('ignores events coming from inputs, textareas and Monaco', () => {
    const handlers = { onHint: vi.fn(), onShortcuts: vi.fn(), onRunStop: vi.fn() }
    render(<Harness handlers={handlers} />)

    fireEvent.keyDown(screen.getByLabelText('name'), { key: 'h' })
    fireEvent.keyDown(screen.getByLabelText('notes'), { key: '?' })
    fireEvent.keyDown(screen.getByLabelText('code'), { key: 'Enter', ctrlKey: true })

    expect(handlers.onHint).not.toHaveBeenCalled()
    expect(handlers.onShortcuts).not.toHaveBeenCalled()
    expect(handlers.onRunStop).not.toHaveBeenCalled()
  })

  it('treats contenteditable nodes as typing targets', () => {
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    document.body.appendChild(div)
    // jsdom does not implement isContentEditable, so assert on the property the helper reads.
    Object.defineProperty(div, 'isContentEditable', { value: true })
    expect(isTypingTarget(div)).toBe(true)
    expect(isTypingTarget(document.body)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
    div.remove()
  })
})

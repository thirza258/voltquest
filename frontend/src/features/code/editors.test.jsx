// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CodePanel from './CodePanel.jsx'
import SerialMonitor from './SerialMonitor.jsx'
import { codeFromXml } from './BlocklyEditor.jsx'

vi.mock('./MonacoEditor.jsx', () => ({ default: ({ value, readOnly, onChange }) => <textarea aria-label="Test source" readOnly={readOnly} value={value} onChange={e => onChange?.(e.target.value)} /> }))
afterEach(cleanup)
describe('program editors', () => {
  it('generates a real sketch from saved blocks and rejects invalid XML', () => {
    expect(codeFromXml(null)).toContain('void setup()')
    expect(() => codeFromXml('<xml><block type="missing_block"></block></xml>')).toThrow()
  })
  it('requires confirmation before a block program replaces hand-written code', async () => {
    const onMode = vi.fn()
    render(<CodePanel code="void setup() { pinMode(13, OUTPUT); }" editorMode="text" xml={null} board={{ family: 'avr' }} onMode={onMode} />)
    fireEvent.click(screen.getByRole('button', { name: 'Blocks' }))
    await screen.findByRole('dialog')
    expect(onMode).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep text' }))
    expect(onMode).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Blocks' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Use blocks' }))
    expect(onMode).toHaveBeenCalledWith('blocks')
  })
  it('keeps shared code read-only and Pi in text mode', async () => {
    render(<CodePanel code="print(42)" editorMode="blocks" board={{ family: 'raspberrypi' }} readOnly />)
    expect(screen.queryByRole('button', { name: 'Blocks' })).toBeNull()
    await waitFor(() => expect(screen.getByLabelText('Test source').readOnly).toBe(true))
  })
})
describe('serial monitor', () => {
  it('clears displayed output and shows only subsequent chunks without altering runtime state', () => {
    const first = { runId: 1, status: 'running', serialBaud: 9600, serialSeq: 1, serial: [{ t: 0, text: 'first\n' }] }
    const { rerender } = render(<SerialMonitor state={first} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByLabelText('Program output').textContent).not.toContain('first')
    rerender(<SerialMonitor state={{ ...first, serialSeq: 2, serial: [...first.serial, { t: 1000, text: 'second\n' }] }} />)
    expect(screen.getByLabelText('Program output').textContent).toBe('second\n')
    rerender(<SerialMonitor state={{ ...first, runId: 2 }} />)
    expect(screen.getByLabelText('Program output').textContent).toBe('first\n')
  })
  it('explains baud mismatch and sends newline-terminated input', () => {
    const onBaud = vi.fn(), onSend = vi.fn()
    render(<SerialMonitor state={{ status: 'running', runId: 1, serialBaud: 115200, serial: [{ text: 'OK\n', t: 0 }] }} onBaud={onBaud} onSend={onSend} />)
    expect(screen.getByLabelText('Program output').textContent).toContain('⸮⸮')
    fireEvent.click(screen.getByRole('button', { name: 'Match baud' }))
    expect(onBaud).toHaveBeenCalledWith(115200)
    fireEvent.change(screen.getByLabelText('Serial input'), { target: { value: 'on' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSend).toHaveBeenCalledWith('on\n')
  })
})

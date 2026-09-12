// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VirtualPhone from './VirtualPhone.jsx'

afterEach(cleanup)
const running = { runId: 1, status: 'running', http: { started: true }, wifi: { status: 'connected' } }
it('loads the simulated page and clears it when the server resets', async () => {
  const request = vi.fn(async () => ({ status: 200, contentType: 'text/html', body: '<a href="/on">On</a>' }))
  const { rerender } = render(<VirtualPhone state={running} onRequest={request} />)
  fireEvent.click(screen.getByRole('button', { name: 'Go' }))
  await screen.findByTitle('Virtual server page')
  expect(request).toHaveBeenCalledWith({ method: 'GET', path: '/' })
  rerender(<VirtualPhone state={{ ...running, status: 'idle', http: { started: false } }} onRequest={request} />)
  expect(screen.queryByTitle('Virtual server page')).toBeNull()
  expect(screen.getByRole('button', { name: 'Go' }).disabled).toBe(true)
})
it('ignores an obsolete response and messages from unrelated windows', async () => {
  let resolve
  const request = vi.fn(() => new Promise(done => { resolve = done }))
  const { rerender } = render(<VirtualPhone state={running} onRequest={request} />)
  fireEvent.click(screen.getByRole('button', { name: 'Go' }))
  rerender(<VirtualPhone state={{ ...running, runId: 2 }} onRequest={request} />)
  await act(async () => { resolve({ status: 200, contentType: 'text/plain', body: 'old run' }) })
  expect(screen.queryByTitle('Virtual server page')).toBeNull()
  fireEvent(window, new MessageEvent('message', { data: { type: 'voltquest-phone', channel: 'forged', request: { method: 'GET', path: '/on' } }, source: window }))
  expect(request).toHaveBeenCalledTimes(1)
})
it('rejects external addresses without sending a virtual request', async () => {
  const request = vi.fn()
  render(<VirtualPhone state={running} onRequest={request} />)
  fireEvent.change(screen.getByLabelText('Virtual address'), { target: { value: 'https://example.com/' } })
  fireEvent.click(screen.getByRole('button', { name: 'Go' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('virtual server'))
  expect(request).not.toHaveBeenCalled()
})

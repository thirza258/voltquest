// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AssistantPanel from './AssistantPanel.jsx'
import { agentConfigs } from './AgentConnections.jsx'
import { api } from '../../api/client.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { TUTORIALS } from '../../content/index.js'
import { tutorialCircuit } from '../tutorials/circuits.js'
import { LocaleProvider, LanguageSelect } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'

beforeEach(() => {
  installMemoryStorage()
  usePlayerStore.setState({ token: 'test', player: { id: 'test-player' } })
  vi.spyOn(api.assistant, 'status').mockResolvedValue({ enabled: true })
  vi.spyOn(api.assistant, 'mcpAccess').mockResolvedValue({ enabled: false })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const lesson = TUTORIALS.find(t => t.id === 'uno-blink')
const doc = tutorialCircuit(lesson, 'uno')
const base = { mode: 'tutorial', lesson, doc, code: '// initial' }

it('sends the latest edited project, selection and language with prior conversation', async () => {
  const chat = vi.spyOn(api.assistant, 'chat').mockResolvedValue({ answer: 'Check the resistor.' })
  const view = render(<LocaleProvider><LanguageSelect /><AssistantPanel {...base} /></LocaleProvider>)
  await waitFor(() => expect(api.assistant.status).toHaveBeenCalled())
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Why?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  await screen.findByText('Check the resistor.')
  const selected = doc.components.find(c => c.type === 'led').id
  view.rerender(<LocaleProvider><LanguageSelect /><AssistantPanel {...base} code="// edited now" selectedIds={[selected]} /></LocaleProvider>)
  fireEvent.change(screen.getByLabelText('Language / Bahasa'), { target: { value: 'id' } })
  fireEvent.change(screen.getByLabelText('Pertanyaan Anda'), { target: { value: 'Lalu?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tanya AI' }))
  await waitFor(() => expect(chat).toHaveBeenCalledTimes(2))
  const body = chat.mock.calls[1][0]
  expect(body.locale).toBe('id')
  expect(body.context.code).toBe('// edited now')
  expect(body.context.selection[0].id).toBe(selected)
  expect(body.history).toEqual([{ role: 'user', content: 'Why?' }, { role: 'assistant', content: 'Check the resistor.' }])
})

it('retains a failed question for retry, then clears and cancels late responses', async () => {
  let resolve
  const chat = vi.spyOn(api.assistant, 'chat').mockRejectedValueOnce({ status: 502 }).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  render(<AssistantPanel {...base} />)
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Help' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Your question').value).toBe('Help')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(chat).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }))
  expect(chat.mock.calls[1][1].signal.aborted).toBe(true)
  await act(async () => resolve({ answer: 'stale response' }))
  expect(screen.queryByText('stale response')).toBeNull()
})

it('does not send a request when unconfigured, but still exposes coding-agent configuration', async () => {
  api.assistant.status.mockResolvedValue({ enabled: false })
  const chat = vi.spyOn(api.assistant, 'chat')
  render(<AssistantPanel {...base} />)
  await screen.findByText(/AI help is not configured yet/)
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'hello' } })
  expect(screen.getByRole('button', { name: 'Ask AI' }).disabled).toBe(true)
  expect(screen.getByText('Connect Claude Code / Codex')).toBeTruthy()
  expect(chat).not.toHaveBeenCalled()
})

it('escapes provider HTML and displays code as text', async () => {
  vi.spyOn(api.assistant, 'chat').mockResolvedValue({ answer: '<script>alert(1)</script>\n```cpp\ndigitalWrite(9, HIGH);\n```' })
  const view = render(<AssistantPanel {...base} />)
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Show code' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  await screen.findByText('digitalWrite(9, HIGH);')
  expect(view.container.querySelector('script')).toBeNull()
})

it('generates env-based configurations without embedding access tokens', () => {
  const configs = agentConfigs('https://pcb.nevatal.id/api/mcp/')
  expect(JSON.parse(configs.claude).mcpServers.voltquest.headers.Authorization).toBe('Bearer ${VOLTQUEST_MCP_TOKEN}')
  expect(configs.codex).toContain('bearer_token_env_var = "VOLTQUEST_MCP_TOKEN"')
})

it('cancels pending answers and clears conversation when the player changes', async () => {
  let resolve
  const chat = vi.spyOn(api.assistant, 'chat').mockImplementation(() => new Promise(r => { resolve = r }))
  render(<AssistantPanel {...base} />)
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Private question' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  await waitFor(() => expect(chat).toHaveBeenCalledOnce())
  act(() => usePlayerStore.setState({ token: 'new', player: { id: 'another-player' } }))
  expect(chat.mock.calls[0][1].signal.aborted).toBe(true)
  await act(async () => resolve({ answer: 'Old private answer' }))
  expect(screen.queryByText('Old private answer')).toBeNull()
  expect(screen.getByLabelText('Your question').value).toBe('')
})

import { useEffect, useId, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { api, ApiError } from '../../api/client.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { useI18n } from '../../i18n/index.jsx'
import { Button } from '../../ui/index.js'
import { buildAssistantContext } from './context.js'
import AgentConnections from './AgentConnections.jsx'

const ERRORS = {
  assistant_not_configured: 'AI help is not configured yet. Ask the site owner to enable it.',
  assistant_rate_limited: 'The assistant is busy. Please wait a minute and try again.',
  assistant_timeout: 'The assistant took too long. Your question is ready to retry.',
}

/** Text is always escaped by React. Code fences are readable, never executable. */
function Answer({ text }) {
  return text.split(/```[^\n]*\n([\s\S]*?)```/g).map((part, i) => i % 2
    ? <pre key={i} className="my-2 max-w-full overflow-x-auto rounded border border-line bg-white p-2 text-xs"><code>{part}</code></pre>
    : <span key={i} className="whitespace-pre-wrap break-words">{part}</span>)
}

export default function AssistantPanel(props) {
  const { t, locale } = useI18n()
  const questionId = useId()
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [enabled, setEnabled] = useState(null)
  const active = useRef(null)
  const latest = useRef(props)
  latest.current = props
  useEffect(() => usePlayerStore.subscribe((state, previous) => {
    if ((previous.player?.id && state.player?.id !== previous.player.id) || (previous.token && !state.token)) {
      active.current?.abort(); active.current = null
      setPending(false); setMessages([]); setQuestion(''); setError('')
    }
  }), [])
  useEffect(() => {
    let mounted = true
    api.assistant.status().then(result => { if (mounted) setEnabled(result.enabled) }).catch(() => {})
    return () => { mounted = false; active.current?.abort(); active.current = null }
  }, [])

  function clear() {
    active.current?.abort(); active.current = null
    setPending(false); setMessages([]); setError('')
  }

  async function send(event) {
    event.preventDefault()
    const text = question.trim()
    if (!text || active.current || enabled === false) return
    const controller = new AbortController()
    active.current = controller
    const context = buildAssistantContext(latest.current)
    const history = messages.slice(-8).map(({ role, content }) => ({ role, content }))
    setPending(true); setError('')
    try {
      if (!usePlayerStore.getState().token) await usePlayerStore.getState().ensureGuest()
      if (active.current !== controller) return
      if (!usePlayerStore.getState().token) throw new ApiError(0, 'Network error')
      const result = await api.assistant.chat({ question: text, locale, history, context }, { signal: controller.signal })
      if (active.current !== controller) return
      if (typeof result?.answer !== 'string' || !result.answer.trim()) throw new Error('Invalid answer')
      setMessages(previous => [...previous, { role: 'user', content: text }, { role: 'assistant', content: result.answer }].slice(-20))
      setQuestion(''); setEnabled(true)
    } catch (failure) {
      if (active.current !== controller) return
      setError(failure.status === 0 ? 'Connect to the internet to ask the assistant.' : failure.status === 401 ? 'Your session expired. Log in and try again.' : ERRORS[failure.detail] ?? 'AI help is unavailable right now. Your question is ready to retry.')
    } finally {
      if (active.current === controller) { active.current = null; setPending(false) }
    }
  }

  const selection = (props.selectedIds ?? []).map(id => props.doc?.components.find(c => c.id === id)?.type ?? id).join(', ')
  return <section aria-label={t('AI circuit assistant')} className="min-w-0 space-y-3 p-3 text-sm">
    <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold text-brand-700"><Sparkles size={16} />{t('AI guide')}</h2>{(messages.length > 0 || pending) && <button type="button" onClick={clear} className="text-xs text-slate-600 underline">{t('Clear chat')}</button>}</div>
    <p className="text-xs leading-relaxed text-slate-600">{t('Ask about your wiring, code, or next step. I use your current project and the part you inspect.')}</p>
    <div className="rounded-md border border-line bg-surface-sunken p-2 text-xs text-slate-600"><p className="break-words">{t('Context')}: {props.title ?? props.lesson?.title ?? t('Current project')}</p><p className="mt-1 break-words">{t('Selected')}: {selection || t('Whole circuit')}</p></div>
    {enabled === false && <p role="status" className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{t(ERRORS.assistant_not_configured)} <button type="button" className="underline" onClick={() => { setEnabled(null); api.assistant.status().then(result => setEnabled(result.enabled)).catch(() => setError('Connect to the internet to ask the assistant.')) }}>{t('Check again')}</button></p>}
    {!messages.length && <div className="flex flex-wrap gap-2">{['What should I try next?', 'Why is my circuit not working?', 'Explain the selected part.'].map(prompt => <button key={prompt} type="button" disabled={pending} onClick={() => setQuestion(t(prompt))} className="rounded border border-line px-2 py-1 text-left text-xs text-brand-700 hover:bg-brand-50">{t(prompt)}</button>)}</div>}
    <div role="log" aria-label={t('Assistant conversation')} aria-live="polite" className="max-h-[440px] space-y-3 overflow-y-auto [overflow-wrap:anywhere]">{messages.map((message, index) => <div key={index} className={`min-w-0 rounded-md p-2.5 ${message.role === 'user' ? 'bg-surface-sunken' : 'border border-brand-200 bg-brand-50'}`}><p className="mb-1 text-xs font-semibold text-slate-600">{t(message.role === 'user' ? 'You' : 'AI guide')}</p><Answer text={message.content} /></div>)}</div>
    {pending && <p role="status" className="text-xs text-brand-700">{t('Reviewing your circuit and code…')}</p>}
    {error && <p role="alert" className="text-xs text-rose-700">{t(error)}</p>}
    <form onSubmit={send} className="space-y-2"><label htmlFor={questionId} className="block text-xs font-medium text-slate-600">{t('Your question')}</label><textarea id={questionId} value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={3} disabled={pending} placeholder={t('For example: why does this LED stay off?')} className="block w-full resize-y rounded-md border border-line-strong bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" /><div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{question.length}/2000</span><Button type="submit" size="sm" disabled={!question.trim() || pending || enabled === false}>{t(pending ? 'Thinking…' : error ? 'Retry' : 'Ask AI')}</Button></div></form>
    <p className="text-xs leading-relaxed text-slate-500">{t('Sending shares this question, recent chat, current code, wiring and simulation output with the AI provider. Answers may be inaccurate; check suggestions in the simulator.')}</p>
    <AgentConnections getContext={() => buildAssistantContext(latest.current)} />
  </section>
}

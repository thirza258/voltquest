import { useEffect, useId, useRef, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'

/**
 * A console: a scrolling transcript and one input line after the prompt. Up/Down recall earlier
 * lines. Output is plain text in a `log` region so screen readers announce new lines politely.
 */
export default function Terminal({ label, prompt, lines, onSubmit, placeholder = '' }) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [history, setHistory] = useState([])
  const [cursor, setCursor] = useState(-1)
  const output = useRef(null)
  const inputId = useId()
  useEffect(() => { if (output.current) output.current.scrollTop = output.current.scrollHeight }, [lines])
  function submit(event) {
    event.preventDefault()
    onSubmit(value)
    if (value.trim()) setHistory(previous => [...previous.slice(-49), value])
    setValue(''); setCursor(-1)
  }
  function recall(event) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    if (!history.length) return
    const next = event.key === 'ArrowUp' ? (cursor < 0 ? history.length - 1 : Math.max(0, cursor - 1)) : cursor < 0 ? -1 : cursor + 1
    if (next < 0 || next >= history.length) { setCursor(-1); setValue(''); return }
    setCursor(next); setValue(history[next])
  }
  return <form onSubmit={submit} className="min-w-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-slate-100">
    <pre ref={output} role="log" aria-live="polite" aria-label={label} tabIndex={0} className="h-72 max-h-[55vh] min-h-48 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400">{lines.join('\n')}</pre>
    <div className="flex items-center gap-1 border-t border-slate-700 px-3 py-2 font-mono text-xs">
      <label htmlFor={inputId} className="shrink-0 text-teal-300">{prompt}</label>
      <input id={inputId} value={value} onChange={event => setValue(event.target.value)} onKeyDown={recall} autoComplete="off" autoCapitalize="off" spellCheck={false}
        aria-label={t('Command for {label}', { label })} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none" />
      <button type="submit" className="shrink-0 rounded border border-slate-600 px-2 py-0.5 font-sans text-[11px] font-semibold text-slate-200 hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400">{t('Run')}</button>
    </div>
  </form>
}

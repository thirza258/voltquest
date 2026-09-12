import { useEffect, useRef, useState } from 'react'
import { Button, Select } from '../../ui/index.js'

export const MONITOR_BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200]
export function serialText(entries, { timestamps = false, mismatch = false } = {}) {
  return entries.map((entry) => `${timestamps ? `[${(entry.t / 1000000).toFixed(3)}] ` : ''}${mismatch ? entry.text.replace(/[^\r\n]/g, '⸮') : entry.text}`).join('')
}

export default function SerialMonitor({ state, baud = 9600, onBaud, onSend, open = true, onToggle, python = false }) {
  const [input, setInput] = useState('')
  const [timestamps, setTimestamps] = useState(false)
  const [autoscroll, setAutoscroll] = useState(true)
  const [cleared, setCleared] = useState({ runId: -1, seq: 0 })
  const [notice, setNotice] = useState('')
  const output = useRef(null)
  const entries = state?.serial ?? []
  const count = cleared.runId === state?.runId ? Math.max(0, (state?.serialSeq ?? 0) - cleared.seq) : entries.length
  const visible = count ? entries.slice(-count) : []
  const mismatch = !python && state?.serialBaud != null && state.serialBaud !== Number(baud)
  const text = serialText(visible, { timestamps, mismatch })
  useEffect(() => { if (autoscroll && output.current) output.current.scrollTop = output.current.scrollHeight }, [text, autoscroll, open])
  async function copy() {
    try { await navigator.clipboard.writeText(text); setNotice('Copied output') }
    catch { setNotice('Copy unavailable. Select and copy the output below.') }
  }
  return <section className="shrink-0 border-t border-line bg-surface-sunken" aria-label={python ? 'Python output' : 'Serial monitor'}>
    <div className="flex flex-wrap items-center justify-between gap-2 p-2"><button className="text-xs font-semibold text-slate-600" onClick={() => onToggle?.(!open)} aria-expanded={open}>{open ? '▾' : '▸'} {python ? 'Python output' : 'Serial monitor'}</button>{!python && <Select size="sm" aria-label="Monitor baud rate" value={baud} onChange={(v) => onBaud?.(Number(v))} options={MONITOR_BAUD_RATES.map(value => ({ value, label: `${value} baud` }))} />}</div>
    {open && <div className="space-y-2 px-2 pb-2">
      {mismatch && <p className="text-xs text-amber-800">Baud mismatch — sketch uses {state.serialBaud}. <button className="underline" onClick={() => onBaud?.(state.serialBaud)}>Match baud</button></p>}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600"><label><input type="checkbox" checked={timestamps} onChange={e => setTimestamps(e.target.checked)} /> Timestamps</label><label><input type="checkbox" checked={autoscroll} onChange={e => setAutoscroll(e.target.checked)} /> Autoscroll</label><button className="underline" onClick={() => setCleared({ runId: state?.runId, seq: state?.serialSeq ?? 0 })}>Clear</button><button className="underline" onClick={copy}>Copy</button></div>
      <pre ref={output} aria-label="Program output" tabIndex={0} className="h-28 overflow-auto whitespace-pre-wrap break-words rounded border border-line bg-white p-2 font-mono text-xs text-ink">{text || 'Waiting for output…'}</pre>
      {notice && <p role="status" className="text-xs text-slate-600">{notice}</p>}
      {!python && <form className="flex gap-2" onSubmit={event => { event.preventDefault(); onSend?.(`${input}\n`); setInput('') }}><input aria-label="Serial input" value={input} onChange={event => setInput(event.target.value)} className="min-w-0 flex-1 rounded border border-line-strong px-2 text-xs" /><Button type="submit" size="sm" disabled={state?.status !== 'running'}>Send</Button></form>}
    </div>}
  </section>
}

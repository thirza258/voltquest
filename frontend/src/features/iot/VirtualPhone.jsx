import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '../../ui/index.js'
import { phoneDocument, virtualRequest } from './phoneDocument.js'

export default function VirtualPhone({ state, onRequest }) {
  const [path, setPath] = useState('/')
  const [loadedPath, setLoadedPath] = useState('/')
  const [response, setResponse] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const frame = useRef(null)
  const generation = useRef(0)
  const channel = useId()
  const available = state?.status === 'running' && state?.http?.started
  const invalidate = useCallback(() => { generation.current++ }, [])
  useEffect(() => {
    generation.current++
    setResponse(null); setError(''); setBusy(false)
    return invalidate
  }, [state?.runId, available, invalidate])
  const navigate = useCallback(async (request) => {
    if (!available) return
    const id = ++generation.current
    setBusy(true); setError('')
    try {
      const target = virtualRequest(request.path, loadedPath)
      const result = await onRequest({ ...request, path: target })
      if (id !== generation.current) return
      setPath(target); setLoadedPath(target); setResponse(result)
    } catch (e) { if (id === generation.current) setError(e.error ?? e.message ?? 'Virtual request failed') }
    finally { if (id === generation.current) setBusy(false) }
  }, [available, loadedPath, onRequest])
  useEffect(() => {
    const listener = event => {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== 'voltquest-phone' || event.data?.channel !== channel) return
      const request = event.data.request
      if (!request || !['GET', 'POST'].includes(request.method) || typeof request.path !== 'string') return
      void navigate(request)
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [channel, navigate])
  const html = useMemo(() => response ? phoneDocument(response.body, response.contentType, channel) : '', [response, channel])
  return <section className="flex h-full flex-col gap-3 overflow-auto p-3" aria-label="Virtual phone">
    <p className="text-xs text-slate-600">{state?.wifi?.status ?? 'idle'} · {state?.wifi?.ip || '192.168.4.1'}</p>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void navigate({ method: 'GET', path }) }}><input aria-label="Virtual address" value={path} onChange={event => setPath(event.target.value)} className="min-w-0 flex-1 rounded border border-line-strong px-2 text-sm" /><Button size="sm" type="submit" disabled={!available || busy}>Go</Button></form>
    {!available && <p className="text-sm text-slate-600">Run a sketch that starts a WebServer to load its page here.</p>}
    {busy && <p role="status" className="text-xs text-slate-600">Waiting for the virtual server…</p>}
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    {response && <><p role="status" className="text-xs text-slate-600">HTTP {response.status} · {response.contentType}</p><iframe ref={frame} title="Virtual server page" sandbox="allow-scripts" srcDoc={html} className="min-h-[350px] w-full flex-1 rounded-xl border-4 border-slate-300 bg-white" /></>}
    <p className="text-xs text-slate-600">Links and forms reach the simulated ESP32. Server HTML is displayed with scripts disabled.</p>
  </section>
}

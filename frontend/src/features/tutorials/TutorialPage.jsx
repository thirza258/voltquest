import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Play, RotateCcw, Square } from 'lucide-react'
import { TUTORIALS } from '../../content/index.js'
import { getBoard } from '../../engine/boards/index.js'
import { createSimulation } from '../../engine/sim/index.js'
import { BreadboardCanvas } from '../../canvas/BreadboardCanvas.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { Badge, Button, Callout } from '../../ui/index.js'
import { tutorialCircuit, tutorialCode } from './circuits.js'
import { WiringGuide } from './WiringGuide.jsx'

function TutorialLab({ tutorial, boardId }) {
  const doc = useMemo(() => tutorialCircuit(tutorial, boardId), [tutorial, boardId])
  const [code, setCode] = useState(() => tutorialCode(tutorial, boardId))
  const [state, setState] = useState(null)
  const [input, setInput] = useState('')
  const [path, setPath] = useState('/on')
  const [response, setResponse] = useState('')
  const [completed, setCompleted] = useState([])
  const [selectedWire, setSelectedWire] = useState(null)
  const highlightedWire = doc.wires.find((wire) => wire.id === selectedWire)
  const simulation = useRef(null)
  const running = state?.status === 'running' || state?.status === 'compiling'
  useEffect(() => {
    const createWorker = typeof Worker === 'undefined' ? null : () => new Worker(new URL('../../engine/sim/sim.worker.js', import.meta.url), { type: 'module' })
    const sim = createSimulation({ createWorker })
    simulation.current = sim
    const unsubscribe = sim.subscribe(setState)
    sim.setDocument(doc)
    setState(sim.getState())
    const timer = createWorker ? null : setInterval(() => { if (sim.getState().status === 'running') sim.advance(50) }, 50)
    return () => { if (timer) clearInterval(timer); unsubscribe(); sim.dispose(); simulation.current = null }
  }, [doc])

  async function run() {
    if (running) { simulation.current?.stop(); return }
    simulation.current?.setCode(code)
    await simulation.current?.run()
  }
  async function request(event) {
    event.preventDefault()
    try {
      const result = await simulation.current.httpRequest({ method: 'GET', path })
      setResponse(`${result.status} · ${result.body}`)
    } catch (error) { setResponse(error.error ?? error.message ?? 'Request failed') }
  }
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{tutorial.difficulty}</Badge><Badge tone={running ? 'success' : state?.status === 'error' ? 'danger' : 'neutral'}>{state?.status ?? 'idle'}</Badge><span className="text-sm text-slate-500">{((state?.millis ?? 0) / 1000).toFixed(1)} s · {getBoard(boardId).vcc} V logic</span></div>
        <div className="flex gap-2"><Button variant="secondary" icon={<RotateCcw size={14} />} onClick={() => { simulation.current?.reset(); setResponse('') }}>Reset sim</Button><Button variant={running ? 'danger' : 'primary'} icon={running ? <Square size={14} /> : <Play size={14} />} onClick={run}>{running ? 'Stop' : 'Run example'}</Button></div>
      </div>
      {state?.diagnostics?.length > 0 && <div className="mb-4" role="alert"><Callout tone="danger" title="Check your code">{state.diagnostics.map((diagnostic, index) => <p key={index}>Line {diagnostic.line}: {diagnostic.message}</p>)}</Callout></div>}
      {state?.runtimeError && <div className="mb-4" role="alert"><Callout tone="danger" title={`Error on line ${state.runtimeError.line}`}>{state.runtimeError.message}</Callout></div>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.6fr)_minmax(280px,1fr)]">
        <section aria-label="Tutorial steps" className="rounded-lg border border-line bg-white p-5">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Learn, try, understand</h2>
          <ol className="space-y-6">{tutorial.steps.map((step, index) => <li key={step.title}><div className="mb-2 flex items-start gap-2"><button aria-label={`Mark step ${index + 1} complete`} aria-pressed={completed.includes(index)} onClick={() => setCompleted((previous) => previous.includes(index) ? previous.filter((item) => item !== index) : [...previous, index])} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${completed.includes(index) ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong text-brand-700'}`}>{completed.includes(index) ? <Check size={14} /> : index + 1}</button><h3 className="pt-1 text-sm font-semibold">{step.title}</h3></div><p className="text-sm leading-relaxed text-ink-secondary">{step.text}</p></li>)}</ol>
          <div className="mt-6 border-t border-line pt-5"><h3 className="mb-2 text-sm font-semibold text-brand-700">Try it yourself</h3><p className="text-sm leading-relaxed text-ink-secondary">{tutorial.challenge}</p></div>
        </section>
        <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-white" aria-label="Tutorial circuit">
          <div className="border-b border-line px-4 py-3"><h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Your circuit</h2><p className="mt-1 text-xs text-slate-500">Ready to run · buttons and sensor controls stay interactive</p></div>
          <div id="tutorial-circuit" className="h-[440px]"><BreadboardCanvas doc={doc} simState={state} readOnly highlights={highlightedWire ? { terminals: [highlightedWire.from, highlightedWire.to] } : null} onControl={(id, patch) => simulation.current?.setControl(id, patch)} /></div>
          {!!state?.warnings?.length && <div className="border-t border-line p-3 text-xs text-amber-800">{state.warnings.slice(0, 4).map((warning, index) => <p key={index} className="mb-2">{warning.message} {warning.hint}</p>)}</div>}
          {tutorial.id === 'esp32-web' && <form onSubmit={request} className="border-t border-line p-4"><label className="mb-2 block text-sm font-medium" htmlFor="http-path">Virtual HTTP request</label><div className="flex gap-2"><input id="http-path" value={path} onChange={(event) => setPath(event.target.value)} className="min-w-0 flex-1 rounded border border-line-strong px-2 font-mono text-sm" /><Button size="sm" type="submit" disabled={!running}>GET</Button></div><p role="status" className="mt-2 break-words text-xs text-slate-600">{response}</p></form>}
          {state?.wifi?.status !== 'idle' && state?.wifi?.status && <p className="border-t border-line p-3 text-xs text-slate-600">WiFi: {state.wifi.status} · {state.wifi.ip ?? 'Waiting for an address'}</p>}
          {state?.mqtt?.log?.length > 0 && <pre aria-label="MQTT messages" className="max-h-40 overflow-auto border-t border-line p-3 text-xs">{state.mqtt.log.slice(-10).map((entry) => `${entry.dir} ${entry.topic ?? ''} ${entry.payload ?? ''}`).join('\n')}</pre>}
        </section>
        <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-white" aria-label="Example code and output">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><label htmlFor="example-code" className="text-xs font-semibold uppercase tracking-wider text-slate-500">{tutorial.language === 'python' ? 'Python' : 'Arduino C++'}</label><button className="text-xs font-medium text-brand-700 underline" onClick={() => { simulation.current?.reset(); setCode(tutorialCode(tutorial, boardId)) }}>Restore example</button></div>
          <textarea id="example-code" aria-label="Example code" value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} wrap="off" className="block min-h-[360px] w-full resize-y bg-white p-4 font-mono text-xs leading-6 text-ink focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500" />
          <div className="border-t border-line bg-surface-sunken p-4"><h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{tutorial.language === 'python' ? 'Python output' : 'Serial monitor'}</h2><pre aria-label="Program output" aria-live="off" className="max-h-40 min-h-16 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-ink-secondary">{state?.serial?.map((entry) => entry.text).join('') || 'Output appears here when the example prints.'}</pre><form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); simulation.current?.serialWrite(input); setInput('') }}><input aria-label="Serial input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Send a character…" className="min-w-0 flex-1 rounded border border-line-strong bg-white px-2 py-1 text-xs" /><Button type="submit" size="sm" disabled={!running || tutorial.language === 'python'}>Send</Button></form></div>
        </section>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">{[['Hardware concepts', tutorial.hardwareConcepts], ['Program concepts', tutorial.programConcepts]].map(([title, concepts]) => <section key={title} className="rounded-lg border border-line bg-white p-5"><h2 className="mb-4 text-lg font-semibold">{title}</h2><div className="space-y-5">{concepts?.map((concept) => <div key={concept.title}><h3 className="mb-2 text-sm font-semibold text-brand-700">{concept.title}</h3><p className="text-sm leading-relaxed text-ink-secondary">{concept.text}</p></div>)}</div></section>)}</div>
      <WiringGuide doc={doc} selectedWire={selectedWire} onSelectWire={(id) => { setSelectedWire(id); document.getElementById('tutorial-circuit')?.scrollIntoView?.({ behavior: 'auto', block: 'center' }) }} />
      {tutorial.language === 'python' && <div className="mt-5"><Callout tone="info" title="Raspberry Pi GPIO learning environment">Supports the Python and GPIO calls used in these tutorials. Linux, external Python packages, arbitrary functions, and camera or network emulation are not available.</Callout></div>}
    </>
  )
}

export default function TutorialPage() {
  const { tutorialId } = useParams()
  const [params, setParams] = useSearchParams()
  const tutorial = TUTORIALS.find((entry) => entry.id === tutorialId)
  const boardId = tutorial?.boards.includes(params.get('board')) ? params.get('board') : tutorial?.boards[0]
  if (!tutorial) return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="p-8"><h1 className="text-xl font-semibold">Tutorial not found</h1><Link to="/tutorials" className="mt-4 inline-block text-brand-700 underline">Browse tutorials</Link></main></div>
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6"><Link to={`/tutorials?board=${boardId}`} className="mb-5 inline-flex items-center gap-1 text-sm text-brand-700"><ArrowLeft size={15} /> All tutorials</Link><div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight text-ink">{tutorial.title}</h1><p className="mt-2 max-w-3xl text-sm text-ink-secondary">{tutorial.summary}</p></div><label className="flex items-center gap-2 text-sm text-slate-600">Board<select aria-label="Tutorial board" value={boardId} onChange={(event) => setParams({ board: event.target.value })} className="rounded-md border border-line-strong bg-white p-2">{tutorial.boards.map((id) => <option key={id} value={id}>{getBoard(id).name}</option>)}</select></label></div><TutorialLab key={`${tutorialId}:${boardId}`} tutorial={tutorial} boardId={boardId} /></main></div>
}

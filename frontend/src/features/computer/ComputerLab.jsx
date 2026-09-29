import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { Button, Modal } from '../../ui/index.js'
import { downloadJson, downloadText } from '../../lib/download.js'
import { readJson, writeJson } from '../../lib/storage.js'
import { clockCircuit, evaluateCircuit, GATES, parseCircuit, settleLatch, truthTable } from '../../engine/computer/logic.js'
import { assemble, createCpu, ISA, MAX_CLOCKS, runCpu, stepCpu } from '../../engine/computer/cpu.js'
import { PRESETS } from '../../engine/computer/presets.js'
import { COMPUTER_COURSES, createProject, validateProject, parseProject, MAX_NOTEBOOK_BYTES, STORAGE_PREFIX, panelClass, fieldClass, codeClass } from './project.js'
import LogicDiagram from './LogicDiagram.jsx'
import CpuView from './CpuView.jsx'
import { useUnsavedBenchWork } from '../sandbox/benchGuard.js'

export default function ComputerLab({ initialLesson, free = false }) {
  const { t } = useI18n()
  const [project, setProject] = useState(() => createProject(initialLesson)), [run, setRun] = useState(null)
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [pending, setPending] = useState(null), [dirty, setDirty] = useState(false)
  const generation = useRef(0), fileInput = useRef(null)
  useUnsavedBenchWork(dirty, 'Computer notebook')
  useEffect(() => () => { generation.current++ }, [])
  const mode = PRESETS[project.lesson].mode
  const course = COMPUTER_COURSES.find(item => item.id === project.lesson)
  const parsed = useMemo(() => { try { return mode === 'gates' ? parseCircuit(project.source) : null } catch { return null } }, [mode, project.source])
  const inputs = mode === 'latch' ? ['S', 'R'] : parsed?.inputs ?? []
  const storage = parsed?.nodes.some(node => node.type === 'DFF')
  function attempt(work) { try { work(); setError(''); setMessage('') } catch (failure) { setError(failure.message) } }
  function edit(values, execution = false) {
    generation.current++; setPending(null); setProject(previous => ({ ...previous, ...values })); setDirty(true); setError(''); setMessage('')
    if (execution) setRun(null)
  }
  function toggle(id) {
    const values = Object.fromEntries(inputs.map(name => [name, name === id ? (project.inputs[id] ? 0 : 1) : project.inputs[name] ?? 0]))
    edit({ inputs: values })
    if (run?.mode === 'gates') setRun({ ...run, inputs: values, result: evaluateCircuit(run.circuit, values, run.memory) })
    // Latch controls are pending until Apply is selected; never present old results as new inputs.
    if (run?.mode === 'latch') setRun({ ...run, pending: true })
  }
  function evaluate(kind = 'evaluate') {
    attempt(() => {
      if (mode === 'cpu') {
        const state = run?.mode === 'cpu' && kind !== 'assemble' ? run.state : createCpu(assemble(project.source))
        setRun({ mode, state: kind === 'step' ? stepCpu(state) : kind === 'run' ? runCpu(state) : state })
      } else if (mode === 'latch') {
        const state = settleLatch(run?.mode === 'latch' ? run.state.q : 0, project.inputs.S ?? 0, project.inputs.R ?? 0)
        setRun({ mode, state, inputs: { ...project.inputs }, pending: false })
      } else {
        const circuit = parseCircuit(project.source), memory = run?.mode === 'gates' ? run.memory : {}
        const edges = run?.mode === 'gates' ? run.edges : 0
        if (kind === 'clock' && edges >= 256) throw new Error('The circuit reached 256 edges. Reset the run to start again.')
        const result = kind === 'clock' ? clockCircuit(circuit, project.inputs, memory) : evaluateCircuit(circuit, project.inputs, memory)
        setRun({ mode, circuit, inputs: { ...project.inputs }, memory: result.memory ?? memory, result, edges: edges + Number(kind === 'clock'),
          table: kind === 'table' ? truthTable(circuit) : run?.table ?? null })
      }
    })
  }
  function replace(value) {
    generation.current++; setProject(value); setRun(null); setPending(null); setError(''); setMessage('Notebook opened. Run to produce fresh evidence.'); setDirty(false)
  }
  function save() {
    try {
      if (!writeJson(STORAGE_PREFIX + project.lesson, validateProject(project))) throw new Error('Browser storage is unavailable. Export your notebook to keep it.')
      setDirty(false); setError(''); setMessage('Computer notebook saved in this browser.')
    } catch (failure) { setError(failure.message) }
  }
  function load() { attempt(() => {
    generation.current++
    const value = readJson(STORAGE_PREFIX + project.lesson)
    if (!value) throw new Error('No saved notebook was found for this preset.')
    setPending(validateProject(value, free ? undefined : initialLesson))
  }) }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    const id = ++generation.current
    try {
      if (file.size > MAX_NOTEBOOK_BYTES) throw new Error('Computer notebooks must fit within 96 KiB.')
      const value = parseProject(await file.text(), free ? undefined : initialLesson)
      if (id === generation.current) { setPending(value); setError('') }
    } catch (failure) { if (id === generation.current) setError(failure.message) }
  }
  const ended = run?.mode === 'cpu' && (run.state.halted || run.state.clocks >= MAX_CLOCKS)
  return <div className="space-y-5" data-computer-lesson={project.lesson}>
    <section className={panelClass} aria-label={t('Computer experiment')}>
      <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">{t(mode === 'cpu' ? 'Assembly workbench · VQ4' : mode === 'latch' ? 'SR latch experiment' : 'Logic circuit workbench')}</h2><span className="text-xs text-slate-600">{t(dirty ? 'Unsaved changes' : 'Current notebook')}</span></div>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">{t(mode === 'cpu' ? 'Edit and assemble VQ4 programs. Step fetch, decode and execute; inspect actual registers, memory and output. This is a four-bit teaching ISA, not native x86, ARM, AVR or RISC-V assembly.' : mode === 'latch' ? 'Explore a fixed active-high NOR latch. Apply set/reset levels and inspect settled state. Forbidden inputs mark the stored bit unknown until a valid set or reset.' : 'Edit named gates and connections, toggle inputs and inspect live signal values. DFF storage updates only on Clock one edge. The model computes ideal Boolean behavior, not voltage, propagation delay or Minecraft ticks.')}</p>
      {free && <label className="mt-4 block text-sm">{t('Choose a computer experiment')}<select className={`${fieldClass} mt-1`} value={project.lesson} onChange={event => { generation.current++; setPending(createProject(event.target.value)) }}>{COMPUTER_COURSES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
      {mode !== 'latch' ? <label className="mt-4 block text-sm font-medium">{t(mode === 'cpu' ? 'Assembly source' : 'Circuit source')}<textarea className={`${fieldClass} mt-2 whitespace-pre font-mono text-xs leading-6`} rows={mode === 'cpu' ? 15 : 12} wrap="off" spellCheck={false} value={project.source} onChange={event => edit({ source: event.target.value }, true)} /></label> : <pre className={`${codeClass} mt-4`}>Q = NOT(R OR Qbar){'\n'}Qbar = NOT(S OR Q)</pre>}
      {inputs.length > 0 && <fieldset className="mt-4"><legend className="text-sm font-semibold">{t('Input bits')}</legend><div className="mt-2 flex flex-wrap gap-2">{inputs.map(id => <button key={id} aria-label={`${id}: ${project.inputs[id] ?? 0}`} aria-pressed={Boolean(project.inputs[id])} className={`min-h-10 rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${project.inputs[id] ? 'border-brand-600 bg-teal-50 text-brand-800' : 'border-slate-300 bg-white'}`} onClick={() => toggle(id)}>{id} = {project.inputs[id] ?? 0}</button>)}</div><p className="mt-2 text-xs text-slate-600">{t('Bit 0 is the least significant bit. Read buses in descending index order, such as B3 B2 B1 B0.')}</p></fieldset>}
      <div className="mt-4 flex flex-wrap gap-2">{mode === 'cpu' ? <><Button onClick={() => evaluate('assemble')}>{t('Assemble')}</Button><Button variant="secondary" disabled={ended} onClick={() => evaluate('step')}>{t('Step clock')}</Button><Button variant="secondary" disabled={ended} onClick={() => evaluate('run')}>{t('Run to halt')}</Button></> : mode === 'latch' ? <Button onClick={() => evaluate()}>{t('Apply latch inputs')}</Button> : <><Button onClick={() => evaluate()}>{t('Evaluate circuit')}</Button>{storage && <Button variant="secondary" onClick={() => evaluate('clock')}>{t('Clock one edge')}</Button>}<Button variant="secondary" disabled={Boolean(storage)} onClick={() => evaluate('table')}>{t('Generate truth table')}</Button></>}
        <Button variant="secondary" onClick={() => { setRun(null); setError(''); setMessage('Ready for a fresh run.') }}>{t('Reset run')}</Button>{mode !== 'latch' && <Button variant="ghost" onClick={() => downloadText(project.source, `${project.lesson}.${mode === 'cpu' ? 'asm' : 'logic'}`)}>{t('Download source')}</Button>}<Button variant="ghost" onClick={() => { generation.current++; setPending(createProject(project.lesson)) }}>{t('Restore example')}</Button>
      </div>
      {mode === 'gates' && <details className="mt-4 text-sm leading-6"><summary className="cursor-pointer font-semibold text-brand-700">{t('Circuit language reference')}</summary><pre className={`${codeClass} mt-3`}>{'INPUT A B\nx = XOR A B\nOUTPUT Y=x\n\n; Selector is last: MUX data0 data1 select\n; DFF data enable synchronous-reset\n; Constants: 0 and 1. Comments: ; or #\n; Signal names are case-sensitive.'}</pre><p className="mt-3 text-slate-600">{Object.keys(GATES).join(', ')}</p><p className="mt-2 text-xs text-slate-600">{t('Limits: 16 inputs, 256 gates, 16 outputs and 256 clock edges. Truth tables allow up to six inputs (64 rows), with no DFF. Combinational cycles are rejected. Reset starts DFFs at zero; at an edge, reset has priority over enable.')}</p></details>}
      {mode === 'cpu' && <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-brand-700">{t('VQ4 instruction reference')}</summary><p className="mt-3 text-xs leading-6 text-slate-600">{t('Program ROM: 16 eight-bit words. Data RAM: 16 four-bit words. High nibble is opcode; low nibble is a value or address. Labels are allowed for jumps. Semicolon starts a comment. Arithmetic wraps modulo 16. C after subtraction means no borrow. Run stops at 768 total clocks.')}</p><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['Opcode', 'Instruction', 'Effect'].map(label => <th key={label} scope="col" className="p-2">{t(label)}</th>)}</tr></thead><tbody>{ISA.map(item => <tr className="border-t border-line" key={item.name}><td className="p-2 font-mono">{item.opcode.toString(16).toUpperCase()}</td><th scope="row" className="whitespace-nowrap p-2 font-mono">{item.name}{item.operand ? ' n' : ''}</th><td className="min-w-48 p-2">{item.effect}</td></tr>)}</tbody></table></div></details>}
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium text-brand-700">{t('Expected result for the original example')}</summary><p className="mt-2 leading-6 text-slate-600">{course.expected}</p></details>
      <p role="status" className="mt-3 text-sm text-brand-700">{t(message)}</p>{error && <p role="alert" className="mt-3 break-words rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{t(error)}</p>}
    </section>
    {run?.mode === 'gates' && <section className={panelClass} aria-label={t('Circuit results')}><h3 className="text-lg font-semibold">{t('Circuit results')}</h3><div className="my-4 flex flex-wrap gap-2">{Object.entries(run.result.outputs).map(([id, value]) => <span className={`rounded border px-3 py-2 font-mono text-sm ${value ? 'border-teal-300 bg-teal-50' : 'border-line'}`} key={id}>{id} = {value}</span>)}</div><p className="mb-4 text-xs text-slate-600">{t('Clock edges')}: {run.edges} · {t('Combinational depth')}: {run.result.depth} · {t('Depth counts ideal gate stages, not seconds or game ticks.')}</p><LogicDiagram circuit={run.circuit} result={run.result} />{run.table && <div className="mt-5 max-h-96 overflow-auto"><table className="w-full text-left text-xs"><caption className="mb-2 text-left font-semibold">{t('Truth table')} · {run.table.length} {t('rows')}</caption><thead><tr>{[...run.circuit.inputs, ...run.circuit.outputs.map(item => item.name)].map((id, index) => <th key={`${id}-${index}`} scope="col" className="p-2">{id}</th>)}</tr></thead><tbody>{run.table.map((row, index) => <tr key={index} className="border-t border-line font-mono">{[...run.circuit.inputs.map(id => row.inputs[id]), ...run.circuit.outputs.map(item => row.outputs[item.name])].map((value, i) => <td key={i} className="p-2">{value}</td>)}</tr>)}</tbody></table></div>}</section>}
    {run?.mode === 'latch' && <section className={panelClass} aria-label={t('Latch result')}><h3 className="text-lg font-semibold">{t('Latch result')}</h3><p className="mt-3 font-mono">S={run.inputs.S ?? 0}, R={run.inputs.R ?? 0} → Q={run.state.q ?? '?'}, Qbar={run.state.nq ?? '?'}</p><p className="mt-3 text-sm leading-6 text-slate-600">{t(run.state.invalid ? 'Stored state is unknown. Apply set alone or reset alone to recover a known bit.' : 'The output is a known settled state. Hold inputs preserve this state.')}</p>{run.state.physicalOutputs && <p className="mt-2 text-xs text-slate-600">{t('Settled NOR outputs')}: {run.state.physicalOutputs.join(', ')}</p>}{run.pending && <p className="mt-3 text-sm text-amber-800">{t('Inputs changed. Apply them to update the latch observation.')}</p>}</section>}
    {run?.mode === 'cpu' && <CpuView state={run.state} />}
    {run && <Button variant="secondary" onClick={() => downloadJson({ format: 'voltquest-computer-observation', version: 1, lesson: project.lesson, source: project.source, observation: run }, `${project.lesson}-observation.json`)}>{t('Export observation')}</Button>}
    <section className={panelClass}><h2 className="text-lg font-semibold">{t('Computer notebook')}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t('Save exact source drafts, input settings and notes for each experiment. Imports and loads start with fresh results. Notebook storage is separate from circuit projects and course scores.')}</p><label className="mt-4 block text-sm">{t('Experiment notes')}<textarea className={`${fieldClass} mt-1`} rows={4} value={project.notes} onChange={event => edit({ notes: event.target.value })} /></label><div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={save}>{t('Save notebook')}</Button><Button variant="secondary" onClick={load}>{t('Load saved notebook')}</Button><Button variant="secondary" onClick={() => attempt(() => downloadJson(validateProject(project), `${project.lesson}.json`))}>{t('Export notebook')}</Button><Button variant="secondary" onClick={() => fileInput.current?.click()}>{t('Import notebook')}</Button></div><input className="sr-only" type="file" ref={fileInput} accept=".json,application/json" aria-label={t('Import computer notebook file')} onChange={importFile} /></section>
    <Modal open={Boolean(pending)} onClose={() => setPending(null)} title={t('Replace computer notebook?')} description={t('This replaces source, inputs and notes and clears observed results. Save or export first to keep your current work.')} footer={<><Button variant="secondary" onClick={() => setPending(null)}>{t('Cancel')}</Button><Button onClick={() => replace(pending)}>{t('Replace notebook')}</Button></>}><p className="text-sm">{COMPUTER_COURSES.find(item => item.id === pending?.lesson)?.title}</p></Modal>
  </div>
}

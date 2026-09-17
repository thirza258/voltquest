import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { Button, Modal } from '../../ui/index.js'
import { downloadJson, downloadText } from '../../lib/download.js'
import { readJson, writeJson } from '../../lib/storage.js'
import { formatNumber } from '../../engine/matlab/model.js'
import { MATLAB_COURSES, MATLAB_STORAGE_PREFIX, MAX_PROJECT_BYTES, createMatlabProject, validateMatlabProject, parseMatlabProject } from './project.js'
import { startMatlab } from './runner.js'
import MatlabPlot from './MatlabPlot.jsx'
import { fieldClass, linkClass, panelClass } from './styles.js'

export default function MatlabLab({ initialLesson = MATLAB_COURSES[0].id, free = false }) {
  const { t } = useI18n()
  const [project, setProject] = useState(() => createMatlabProject(initialLesson))
  const [result, setResult] = useState(null), [running, setRunning] = useState(false)
  const [message, setMessage] = useState(''), [error, setError] = useState('')
  const [pending, setPending] = useState(null), [dirty, setDirty] = useState(false)
  const request = useRef(null), generation = useRef(0), importGeneration = useRef(0), fileRef = useRef(null)
  const course = MATLAB_COURSES.find(course => course.id === project.lesson)
  useEffect(() => () => { generation.current++; importGeneration.current++; request.current?.cancel() }, [])
  function invalidate() {
    generation.current++; request.current?.cancel(); request.current = null
    setRunning(false); setResult(null); setError(''); setMessage('')
  }
  function edit(patch, codeChanged = false) {
    if (codeChanged) invalidate()
    setProject(previous => ({ ...previous, ...patch })); setDirty(true); setMessage('')
  }
  function replace(next) { invalidate(); importGeneration.current++; setProject(next); setDirty(false); setPending(null) }
  async function run() {
    invalidate(); const current = generation.current
    setRunning(true); const task = startMatlab(project.code); request.current = task
    try {
      const value = await task.promise
      if (generation.current === current) { setResult(value); setMessage('Script complete. Inspect the output, variables and plot.') }
    } catch (failure) { if (generation.current === current) setError(failure.message) }
    finally { if (generation.current === current) { setRunning(false); request.current = null } }
  }
  function save() {
    try {
      const value = validateMatlabProject(project)
      if (!writeJson(MATLAB_STORAGE_PREFIX + project.lesson, value)) throw new Error('Browser storage is unavailable. Export your notebook to keep it.')
      setDirty(false); setError(''); setMessage('MATLAB notebook saved in this browser.')
    } catch (failure) { setError(failure.message) }
  }
  function load() {
    try {
      const value = readJson(MATLAB_STORAGE_PREFIX + project.lesson)
      if (!value) throw new Error('No saved notebook was found for this preset.')
      setPending(validateMatlabProject(value, project.lesson))
    } catch (failure) { setError(failure.message) }
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    const id = ++importGeneration.current
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error('MATLAB notebook files must fit within 64 KiB.')
      const value = parseMatlabProject(await file.text(), free ? undefined : initialLesson)
      if (id === importGeneration.current) setPending(value)
    } catch (failure) { if (id === importGeneration.current) setError(failure.message) }
  }
  function exportNotebook() {
    try { downloadJson(validateMatlabProject(project), `${project.lesson}.json`); setError('') }
    catch (failure) { setError(failure.message) }
  }
  return <div className="space-y-5" data-matlab-lesson={project.lesson}>
    <section className={panelClass} aria-label={t('MATLAB script editor')}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{t('MATLAB script editor')}</h2><span className="text-xs text-slate-600">{t(dirty ? 'Unsaved changes' : 'Current notebook')}</span></div>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">{t('Edit the script and Run to compute with your changes. Each run starts a fresh workspace. This is a finite, real-number MATLAB-style subset, not the MATLAB or Simulink runtime.')}</p>
      <Link className={`${linkClass} mt-2 inline-block text-sm`} to="/matlab#function-reference" target="_blank" rel="noopener noreferrer">{t('Supported functions and desktop reference')}</Link>
      {free && <label className="mt-4 block text-sm">{t('Choose a MATLAB experiment')}<select className={`${fieldClass} mt-1`} value={project.lesson} onChange={event => setPending(createMatlabProject(event.target.value))}>{MATLAB_COURSES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
      <label className="mt-4 block text-sm font-medium">{t('Editable MATLAB script')}<textarea className={`${fieldClass} mt-2 min-h-80 resize-y whitespace-pre font-mono text-xs leading-6`} rows={17} wrap="off" spellCheck={false} value={project.code} onChange={event => edit({ code: event.target.value }, true)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void run() } }} /></label>
      <div className="mt-4 flex flex-wrap gap-2"><Button onClick={run} disabled={running}>{t('Run script')}</Button><Button variant="secondary" disabled={!running} onClick={() => { invalidate(); setMessage('Script stopped.') }}>{t('Stop script')}</Button><Button variant="secondary" onClick={() => downloadText(project.code, `${project.lesson}.m`)}>{t('Download .m script')}</Button><Button variant="ghost" onClick={() => setPending(createMatlabProject(project.lesson))}>{t('Reset notebook')}</Button></div>
      <details className="mt-4 text-sm leading-6 text-slate-600"><summary className="cursor-pointer font-medium">{t('Syntax and limits')}</summary><p className="mt-2">{t('Use assignments, arrays, one-based indexing, ranges, for/while/if blocks and anonymous functions. End blocks on a new line. Use .* ./ .^ for element-wise arithmetic. Text is supported for labels and display. Preallocate before indexed assignment.')}</p><p className="mt-2">{t('Scripts: 32 KiB. Arrays: 16,384 elements. Runs: bounded operations and five seconds. Real finite values only; no complex numbers, file access, classes, toolbox, GPU or parallel execution. rng is repeatable here but uses a different generator from MATLAB.')}</p></details>
      <details className="mt-4 text-sm leading-6"><summary className="cursor-pointer font-medium text-brand-700">{t('Expected result for the original example')}</summary><p className="mt-2 text-ink-secondary">{course.expected}</p></details>
      <p role="status" className="mt-3 text-sm text-brand-700">{t(running ? 'Running script…' : message)}</p>
      {error && <p role="alert" className="mt-3 whitespace-pre-wrap break-words rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{t(error)}</p>}
    </section>
    {result && <section className={`${panelClass} space-y-5`} aria-label={t('MATLAB results')}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{t('MATLAB results')}</h2><Button size="sm" variant="secondary" onClick={() => downloadJson({ format: 'voltquest-matlab-results', version: 1, lesson: project.lesson, result }, `${project.lesson}-results.json`)}>{t('Export computed results')}</Button></div>
      <div><h3 className="mb-2 font-semibold">{t('Command output')}</h3><pre className="max-h-80 overflow-auto rounded bg-slate-900 p-4 font-mono text-xs leading-6 text-slate-100" tabIndex={0}>{result.output.join('\n\n') || t('No printed output. Inspect the workspace or use disp(value).')}</pre>{result.outputTruncated && <p className="mt-2 text-sm text-amber-800">{t('Output truncated after 200 entries.')}</p>}</div>
      {result.plots.length > 0 && <MatlabPlot result={result} />}
      <div><h3 className="mb-3 font-semibold">{t('Workspace variables')}</h3><p className="mb-3 text-xs text-slate-600">{t('Numeric previews show up to 256 values in column-major order. Dimensions describe the complete array.')}</p><div className="max-h-80 overflow-auto rounded border border-line" tabIndex={0} role="region" aria-label={t('Workspace variables')}><table className="w-full text-left text-xs"><thead className="bg-slate-50"><tr>{['Name', 'Type', 'Size', 'Value'].map(label => <th scope="col" key={label} className="p-3">{t(label)}</th>)}</tr></thead><tbody>{result.workspace.map(value => <tr className="border-t border-line" key={value.name}><th scope="row" className="p-3 font-mono font-medium">{value.name}</th><td className="p-3">{value.type}</td><td className="whitespace-nowrap p-3">{value.rows === undefined ? '—' : `${value.rows} × ${value.cols}`}</td><td className="min-w-40 max-w-lg break-words p-3 font-mono">{value.values?.map(formatNumber).join(', ') ?? value.text}{value.truncated ? ' …' : ''}</td></tr>)}</tbody></table></div></div>
    </section>}
    <section className={panelClass}><h2 className="text-lg font-semibold">{t('MATLAB notebook')}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t('Save scripts and notes separately for each preset in this browser. Downloads can move your work between devices. Results are recomputed after loading.')}</p><label className="mt-4 block text-sm">{t('Experiment notes')}<textarea rows={4} className={`${fieldClass} mt-1`} value={project.notes} onChange={event => edit({ notes: event.target.value })} /></label><div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={save}>{t('Save notebook')}</Button><Button variant="secondary" onClick={load}>{t('Load saved notebook')}</Button><Button variant="secondary" onClick={exportNotebook}>{t('Export notebook')}</Button><Button variant="secondary" onClick={() => fileRef.current?.click()}>{t('Import notebook')}</Button></div><input className="sr-only" ref={fileRef} type="file" accept=".json,application/json" aria-label={t('Import MATLAB notebook file')} onChange={importFile} /></section>
    <Modal open={Boolean(pending)} onClose={() => setPending(null)} title={t('Replace MATLAB notebook?')} description={t('This replaces the current script and notes and clears computed results. Export or save your work first if you need to keep it.')} footer={<><Button variant="secondary" onClick={() => setPending(null)}>{t('Cancel')}</Button><Button onClick={() => replace(pending)}>{t('Replace notebook')}</Button></>}><p className="text-sm text-ink-secondary">{MATLAB_COURSES.find(item => item.id === pending?.lesson)?.title}</p></Modal>
  </div>
}

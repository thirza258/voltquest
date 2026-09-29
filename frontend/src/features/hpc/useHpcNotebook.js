import { useEffect, useRef, useState } from 'react'
import { LABS } from '../../engine/hpc/model.js'
import { downloadJson, downloadText } from '../../lib/download.js'
import { readJson, writeJson } from '../../lib/storage.js'
import { createHpcProject, validateHpcProject, parseHpcProject, HPC_STORAGE_PREFIX, MAX_PROJECT_BYTES } from './project.js'
import { exampleCode, nativeInstructions } from './examples.js'
import { startExperiment } from './runner.js'

/**
 * One HPC experiment notebook: browser-model parameters, both native source drafts and notes.
 * Shared by the course lab and the sandbox IDE so runs, invalidation, confirmation and storage
 * behave identically. Browser Run evaluates the lab's bounded model; it never compiles the source.
 */
export function useHpcNotebook({ initialLab = 'correctness', free = false } = {}) {
  const [project, setProject] = useState(() => createHpcProject(initialLab))
  const [baseline, setBaseline] = useState(project)
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [runs, setRuns] = useState([])
  const requestRef = useRef(null)
  const generation = useRef(0)
  const importGeneration = useRef(0)
  const fileRef = useRef(null)
  const lab = LABS[project.lab]
  const instructions = nativeInstructions(project.lab, project.language)

  useEffect(() => () => { generation.current++; importGeneration.current++; requestRef.current?.cancel() }, [])
  function invalidate() {
    generation.current++; requestRef.current?.cancel(); requestRef.current = null
    setRunning(false); setResult(null); setError(''); setMessage('')
  }
  function edit(patch, computation = false) {
    if (computation) invalidate()
    setProject(previous => ({ ...previous, ...patch })); setDirty(true); setMessage('')
  }
  function replace(next) { invalidate(); setProject(next); setBaseline(next); setDirty(false); setPending(null) }
  function propose(next) { setPending(next) }
  async function run() {
    invalidate()
    const current = generation.current, parameters = project.parameters, labId = project.lab
    setRunning(true)
    const task = startExperiment(project.lab, project.parameters)
    requestRef.current = task
    try {
      const next = await task.promise
      if (current === generation.current) {
        setResult(next); setMessage('Experiment complete. Review the correctness checks.')
        setRuns(previous => [...previous, { id: previous.length + 1, lab: labId, parameters, passed: next.checks.filter(check => check.passed).length, checks: next.checks.length }].slice(-50))
      }
    } catch (failure) {
      if (current === generation.current) { setError(failure.message); setRuns(previous => [...previous, { id: previous.length + 1, lab: labId, parameters, error: failure.message }].slice(-50)) }
    } finally { if (current === generation.current) { setRunning(false); requestRef.current = null } }
  }
  function cancel() { invalidate(); setMessage('Experiment cancelled.') }
  function save() {
    try {
      const validated = validateHpcProject(project)
      if (!writeJson(HPC_STORAGE_PREFIX + project.lab, validated)) throw new Error('Browser storage is unavailable. Export your experiment to keep it.')
      setDirty(false); setBaseline(validated); setError(''); setMessage('Experiment saved in this browser.')
    } catch (failure) { setError(failure.message) }
  }
  function loadSaved() {
    try {
      const saved = readJson(HPC_STORAGE_PREFIX + project.lab)
      if (!saved) throw new Error('No saved version of this experiment was found.')
      propose(validateHpcProject(saved, project.lab))
    } catch (failure) { setError(failure.message) }
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    const request = ++importGeneration.current
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error('HPC experiment files must fit within 200 KiB.')
      const next = parseHpcProject(await file.text(), free ? undefined : initialLab)
      if (request === importGeneration.current) propose(next)
    } catch (failure) { if (request === importGeneration.current) setError(failure.message) }
  }
  function exportProject() {
    try { downloadJson(validateHpcProject(project), `hpc-${project.lab}.json`); setError('') }
    catch (failure) { setError(failure.message) }
  }
  function exportResults() { if (result) downloadJson({ format: 'voltquest-hpc-result', version: 1, result, notes: project.notes }, `hpc-${project.lab}-results.json`) }
  function selectLab(id) { const next = createHpcProject(id); dirty ? propose(next) : replace(next) }
  function restoreSource() { propose({ ...project, sources: { ...project.sources, [project.language]: exampleCode(project.lab, project.language) } }) }
  function downloadSource() { downloadText(project.sources[project.language], instructions.file) }
  return {
    project, baseline, lab, instructions, result, running, message, error, pending, dirty, runs, fileRef,
    setMessage, setError, setPending, edit, replace, propose, run, cancel, save, loadSaved, importFile, exportProject, exportResults,
    selectLab, restoreSource, downloadSource,
  }
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { downloadJson, downloadText } from '../../lib/download.js'
import { readJson, writeJson } from '../../lib/storage.js'
import { MATLAB_COURSES, MATLAB_STORAGE_PREFIX, MAX_PROJECT_BYTES, createMatlabProject, validateMatlabProject, parseMatlabProject } from './project.js'
import { startMatlab } from './runner.js'
import { clearsCommandWindow, scriptFileName, scriptName } from './matlabSyntax.js'

const EMPTY_SESSION = Object.freeze({ base: null, commands: [], outputCount: 0 })
export const MAX_TRANSCRIPT_ENTRIES = 400
export const MAX_SCRIPT_FILE_BYTES = 32768

/**
 * Removes the combined-source line number from a Command Window error when the error is in the
 * new command itself. Errors inside the replayed prefix keep their line and say so.
 */
export function commandError(message, prefixLines) {
  const match = /^Line (\d+): /.exec(message)
  if (!match) return message
  return Number(match[1]) > prefixLines ? message.slice(match[0].length) : `While replaying this session: ${message}`
}

/**
 * State and actions for one MATLAB notebook (script + notes for a preset). Shared by the course
 * lab and the sandbox desktop so saving, loading, imports, confirmation and result invalidation
 * behave identically. Every Run and every Command Window entry starts a fresh Worker; the
 * Command Window keeps a workspace by replaying the last-run script plus earlier successful
 * commands, then shows only the new output.
 */
export function useMatlabNotebook({ initialLesson = MATLAB_COURSES[0].id, free = false } = {}) {
  const [project, setProject] = useState(() => createMatlabProject(initialLesson))
  const [baseline, setBaseline] = useState(project)
  const [result, setResult] = useState(null), [running, setRunning] = useState(false)
  const [message, setMessage] = useState(''), [error, setError] = useState('')
  const [pending, setPending] = useState(null), [pendingReason, setPendingReason] = useState('replace'), [dirty, setDirty] = useState(false)
  const [transcript, setTranscript] = useState([]), [history, setHistory] = useState([])
  const [storedVersion, setStoredVersion] = useState(0)
  const request = useRef(null), generation = useRef(0), importGeneration = useRef(0), fileRef = useRef(null)
  const session = useRef(EMPTY_SESSION), entryId = useRef(0)
  const course = MATLAB_COURSES.find(course => course.id === project.lesson)
  useEffect(() => () => { generation.current++; importGeneration.current++; request.current?.cancel() }, [])

  const stored = useMemo(() => {
    try { const value = readJson(MATLAB_STORAGE_PREFIX + project.lesson); return value ? validateMatlabProject(value, project.lesson) : null } catch { return null }
    // storedVersion changes after saves so the comparison re-reads browser storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.lesson, storedVersion])
  const storedState = !stored ? 'none' : stored.code === project.code && stored.notes === project.notes ? 'same' : 'different'

  function write(entries) {
    setTranscript(previous => [...previous, ...entries.map(entry => ({ id: ++entryId.current, ...entry }))].slice(-MAX_TRANSCRIPT_ENTRIES))
  }
  function remember(text) { setHistory(previous => [...previous, { id: ++entryId.current, text, time: Date.now() }].slice(-100)) }
  function resetSession(note) {
    const active = session.current.base !== null || session.current.commands.length > 0
    session.current = EMPTY_SESSION
    if (active && note) write([{ kind: 'info', text: note }])
  }
  function outputs(entries, truncated) {
    return [...entries.map(text => ({ kind: 'output', text })), ...(truncated ? [{ kind: 'info', text: 'Output limit reached: a run keeps at most 200 printed entries. Use clc, fewer displays or semicolons.' }] : [])]
  }
  function invalidate() {
    generation.current++; request.current?.cancel(); request.current = null
    setRunning(false); setResult(null); setError(''); setMessage('')
  }
  function edit(patch, codeChanged = false) {
    if (codeChanged) {
      if (request.current) write([{ kind: 'info', text: 'Run cancelled: the script changed.' }])
      invalidate()
      resetSession('Workspace cleared: the script changed after the last run. Run it again to recompute the workspace.')
    }
    setProject(previous => ({ ...previous, ...patch })); setDirty(true); setMessage('')
  }
  function replace(next) {
    invalidate(); resetSession('Workspace cleared: a different notebook was opened.')
    importGeneration.current++; setProject(next); setBaseline(next); setDirty(false); setPending(null)
  }
  function propose(next, reason = 'replace') { setPendingReason(reason); setPending(next) }
  function cancelPending() { setPending(null) }
  async function run() {
    invalidate(); resetSession()
    const current = generation.current, code = project.code, name = scriptName(project.lesson)
    write([{ kind: 'input', text: name }]); remember(name)
    setRunning(true); const task = startMatlab(code); request.current = task
    try {
      const value = await task.promise
      if (generation.current === current) {
        session.current = { base: code, commands: [], outputCount: value.output.length }
        setResult(value); setMessage('Script complete. Inspect the output, variables and plot.')
        write(outputs(value.output, value.outputTruncated))
      }
    } catch (failure) { if (generation.current === current) { setError(failure.message); write([{ kind: 'error', text: failure.message }]) } }
    finally { if (generation.current === current) { setRunning(false); request.current = null } }
  }
  function stop() {
    if (request.current) write([{ kind: 'error', text: 'Operation terminated by user.' }])
    invalidate(); setMessage('Script stopped.')
  }
  async function runCommand(text) {
    const command = text.trim()
    if (!command || request.current) return false
    write([{ kind: 'input', text: command }]); remember(command)
    const { base, commands, outputCount } = session.current
    const prefix = [base ?? '', ...commands].filter(part => part !== '').join('\n')
    const prefixLines = prefix ? prefix.split('\n').length : 0
    generation.current++
    const current = generation.current
    setRunning(true); setError(''); setMessage('')
    const task = startMatlab(prefix ? `${prefix}\n${command}` : command); request.current = task
    try {
      const value = await task.promise
      if (generation.current !== current) return true
      const clears = clearsCommandWindow(command)
      session.current = { base, commands: [...commands, command], outputCount: value.output.length }
      if (clears) setTranscript([])
      write(outputs(clears ? value.output : value.output.slice(outputCount), value.outputTruncated && value.output.length <= outputCount))
      setResult(value)
    } catch (failure) {
      if (generation.current === current) write([{ kind: 'error', text: commandError(failure.message, prefixLines) }])
    } finally { if (generation.current === current) { setRunning(false); request.current = null } }
    return true
  }
  function clearCommands() { setTranscript([]) }
  function save() {
    try {
      const value = validateMatlabProject(project)
      if (!writeJson(MATLAB_STORAGE_PREFIX + project.lesson, value)) throw new Error('Browser storage is unavailable. Export your notebook to keep it.')
      setDirty(false); setBaseline(value); setError(''); setMessage('MATLAB notebook saved in this browser.'); setStoredVersion(version => version + 1)
    } catch (failure) { setError(failure.message) }
  }
  function load() {
    try {
      const value = readJson(MATLAB_STORAGE_PREFIX + project.lesson)
      if (!value) throw new Error('No saved notebook was found for this preset.')
      propose(validateMatlabProject(value, project.lesson), 'load')
    } catch (failure) { setError(failure.message) }
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    const id = ++importGeneration.current
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error('MATLAB notebook files must fit within 64 KiB.')
      const value = parseMatlabProject(await file.text(), free ? undefined : initialLesson)
      if (id === importGeneration.current) propose(value, 'import')
    } catch (failure) { if (id === importGeneration.current) setError(failure.message) }
  }
  /** Opens a local .m file as this notebook's script after confirmation; notes are kept. */
  async function openScriptFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    const id = ++importGeneration.current
    try {
      if (file.size > MAX_SCRIPT_FILE_BYTES) throw new Error('MATLAB scripts must fit within 32 KiB.')
      const text = await file.text()
      const value = validateMatlabProject({ ...project, code: text.replace(/\r\n?/g, '\n') }, project.lesson)
      if (id === importGeneration.current) propose(value, 'script')
    } catch (failure) { if (id === importGeneration.current) setError(failure.message) }
  }
  function exportNotebook() {
    try { downloadJson(validateMatlabProject(project), `${project.lesson}.json`); setError('') }
    catch (failure) { setError(failure.message) }
  }
  function downloadScript() { downloadText(project.code, scriptFileName(project.lesson)) }
  function exportResults() {
    if (result) downloadJson({ format: 'voltquest-matlab-results', version: 1, lesson: project.lesson, result }, `${project.lesson}-results.json`)
  }

  return {
    project, baseline, course, result, running, message, error, pending, pendingReason, dirty, stored, storedState, transcript, history, fileRef,
    setMessage, setError, edit, replace, propose, cancelPending, run, stop, runCommand, clearCommands, save, load, importFile, openScriptFile,
    exportNotebook, downloadScript, exportResults,
  }
}

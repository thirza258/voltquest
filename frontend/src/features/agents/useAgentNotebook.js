import { useEffect, useRef, useState } from 'react'
import { readJson, writeJson } from '../../lib/storage.js'
import { downloadJson } from '../../lib/download.js'
import { evaluateHarness, initialState, parseConfig, runUntilPause, stepAgent } from '../../engine/agents/model.js'
import { AGENT_COURSES, createProject, MAX_NOTEBOOK_BYTES, parseProject, STORAGE_PREFIX, validateProject } from './project.js'

/**
 * One AI agent notebook (harness JSON, SKILL.md, both CLI sources, notes) and its current run.
 * Shared by the course/tutorial lab and the sandbox IDE so execution, approvals, confirmation,
 * imports and evidence invalidation are identical in both views.
 */
export function useAgentNotebook({ initialLesson, free = false } = {}) {
  const [project, setProject] = useState(() => createProject(initialLesson))
  const [baseline, setBaseline] = useState(project)
  const [run, setRun] = useState(null), [checks, setChecks] = useState(null)
  const [pending, setPending] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [answer, setAnswer] = useState(''), [language, setLanguage] = useState('javascript'), [dirty, setDirty] = useState(false)
  const inputRef = useRef(null), generation = useRef(0)
  useEffect(() => () => { generation.current++ }, [])
  const course = AGENT_COURSES.find(course => course.id === project.lesson)
  function edit(values, execution = false) {
    generation.current++; setPending(null); setProject(previous => ({ ...previous, ...values })); setDirty(true); setMessage(''); setError('')
    if (execution) { setRun(null); setChecks(null); setAnswer('') }
  }
  function attempt(work) { try { work(); setError('') } catch (failure) { setError(failure.message) } }
  function execute(all = false) {
    attempt(() => {
      const state = run ?? initialState(parseConfig(project.source), project.skill)
      setRun(all ? runUntilPause(state) : stepAgent(state)); setMessage('')
    })
  }
  function decision(value) { attempt(() => { setRun(stepAgent(run, value)); setAnswer('') }) }
  function stopRun() { setRun({ ...run, status: 'stopped', pending: null, stopReason: 'Stopped by the learner.' }) }
  function newRun() { setRun(null); setAnswer(''); setMessage('Ready for a fresh run.'); setError('') }
  function replace(value) {
    generation.current++; setProject(value); setBaseline(value); setPending(null); setRun(null); setChecks(null); setAnswer(''); setError(''); setMessage('Notebook opened. Run to produce fresh evidence.'); setDirty(false)
  }
  function propose(value) { generation.current++; setPending(value) }
  function save() { attempt(() => {
    const value = validateProject(project)
    if (!writeJson(STORAGE_PREFIX + project.lesson, value)) throw new Error('Browser storage is unavailable. Export your notebook to keep it.')
    setDirty(false); setBaseline(value); setMessage('AI agent notebook saved in this browser.')
  }) }
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
      if (file.size > MAX_NOTEBOOK_BYTES) throw new Error('AI agent notebooks must fit within 192 KiB.')
      const value = parseProject(await file.text(), free ? undefined : initialLesson)
      if (generation.current === id) { setPending(value); setError('') }
    } catch (failure) { if (generation.current === id) setError(failure.message) }
  }
  function quickEdit(key, value) {
    attempt(() => {
      const config = parseConfig(project.source)
      if (key.startsWith('rates.')) config.rates[key.slice(6)] = Number(value)
      else config[key] = Number(value)
      const source = JSON.stringify(config, null, 2)
      parseConfig(source)
      edit({ source }, true)
    })
  }
  function exportNotebook() { attempt(() => downloadJson(validateProject(project), `${project.lesson}.json`)) }
  function exportTrace() {
    if (run) downloadJson({ format: 'voltquest-agent-trace', version: 1, lesson: project.lesson, config: run.config, skill: run.skill, trace: run.trace, ledger: run.ledger, status: run.status, stopReason: run.stopReason, files: run.files, issues: run.issues }, `${project.lesson}-trace.json`)
  }
  function runChecks() { attempt(() => setChecks(evaluateHarness(parseConfig(project.source), project.skill))) }
  let config = null, configError = ''
  try { config = parseConfig(project.source) } catch (failure) { configError = failure.message /* Incomplete drafts remain editable and saveable. */ }
  const active = run && !['completed', 'stopped'].includes(run.status)
  const waiting = run && ['approval', 'question'].includes(run.status)
  return {
    project, baseline, course, run, checks, pending, error, message, answer, language, dirty, config, configError, active, waiting, inputRef,
    setAnswer, setLanguage, setMessage, setError, setPending, edit, execute, decision, stopRun, newRun, replace, propose, save, load,
    importFile, quickEdit, exportNotebook, exportTrace, runChecks,
  }
}

import { useRef, useState } from 'react'
import { readJson, writeJson } from '../../lib/storage.js'
import { downloadJson } from '../../lib/download.js'
import { createState, executeRequest } from '../../engine/cybersecurity/model.js'
import { LABS, verifyLab } from '../../engine/cybersecurity/scenarios.js'
import { CYBER_STORAGE_PREFIX, MAX_PROJECT_BYTES, createCyberProject, parseCyberProject, parseRequestDraft, requestDraft, validateCyberProject } from './project.js'
import { parseCurl } from './curl.js'
import { useUnsavedBenchWork } from '../sandbox/benchGuard.js'

/**
 * One cybersecurity investigation (request draft, defenses, notes) plus the fixture shop state and
 * captured history. Shared by the course lab and the sandbox console so requests, defenses,
 * verification, confirmation, storage and reports behave identically. No network or code execution:
 * every request runs through the deterministic `executeRequest` model on in-memory fixtures.
 */
export function useCyberNotebook({ initialLab = 'http', free = false } = {}) {
  const [project, setProject] = useState(() => createCyberProject(initialLab))
  const [shop, setShop] = useState(createState)
  const [response, setResponse] = useState(null)
  const [history, setHistory] = useState([])
  const [sent, setSent] = useState(0)
  const [verification, setVerification] = useState(null)
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saved, setSaved] = useState('')
  const [opened, setOpened] = useState(() => JSON.stringify(project))
  const fileInput = useRef(null)
  const importGeneration = useRef(0)
  const lab = LABS[project.lab]
  const applicable = project.lab === 'capstone' ? ['debug', 'ownership', 'fields'] : [lab.control]
  const found = new Set(history.flatMap(item => item.findings.map(finding => finding.id)))
  const normalSeen = history.some(item => item.status === 200 && !item.findings.length && item.request.method === lab.baseline.method && item.request.path === lab.baseline.path)
  const dirty = saved !== JSON.stringify(project)
  useUnsavedBenchWork(JSON.stringify(project) !== (saved || opened), 'Cybersecurity notebook')

  function clearCurrent() { setResponse(null); setVerification(null); setError(''); setNotice('') }
  function editRequest(key, value) {
    setProject(current => ({ ...current, request: { ...current.request, [key]: value } })); setResponse(null); setError('')
  }
  function loadRequest(request) { setProject(current => ({ ...current, request: requestDraft(request) })); setResponse(null); setError('') }
  function changeControls(controls) {
    setProject(current => ({ ...current, controls })); setShop(createState()); clearCurrent()
    setNotice('Defenses changed. Shop accounts reset; captured history is kept. Run checks again.')
  }
  function toggleControl(key, value) { changeControls({ ...project.controls, [key]: value }) }
  /** Run a request draft against the fixture shop, returning `{ result }` or `{ error }`. */
  function execute(draft) {
    try {
      const result = executeRequest(parseRequestDraft(draft), project.controls, shop)
      setShop(result.state); setResponse(result); setHistory(current => [...current, { ...result, number: sent + 1 }].slice(-30)); setSent(count => count + 1)
      setError(''); setNotice('')
      return { result }
    } catch (failure) { setResponse(null); setError(failure.message); return { error: failure.message } }
  }
  /** Form entry point: run the editor draft (or an override). Returns the result or null. */
  function send(draftOverride) { return execute(draftOverride ?? project.request).result ?? null }
  /** Terminal entry point: parse a curl command and run it. The terminal is ephemeral scrollback and
   * does not change the saved notebook draft; the notebook keeps its lab, defenses and notes. */
  function runCommand(command) {
    let draft
    try { draft = parseCurl(command) } catch (failure) { setResponse(null); setError(failure.message); return { error: failure.message } }
    return execute(draft)
  }
  function verify() {
    try { setVerification(verifyLab(project.lab, project.controls)); setError(''); setNotice('') } catch (failure) { setError(failure.message) }
  }
  function save() {
    try {
      const valid = validateCyberProject(project)
      if (!writeJson(CYBER_STORAGE_PREFIX + project.lab, valid)) throw new Error('Browser storage is unavailable. Export your notebook to keep it.')
      setSaved(JSON.stringify(valid)); setNotice('Notebook saved in this browser.'); setError('')
    } catch (failure) { setError(failure.message) }
  }
  function load() {
    try {
      const value = readJson(CYBER_STORAGE_PREFIX + project.lab)
      if (!value) throw new Error('No saved notebook for this lab. Save one first.')
      setPending({ project: validateCyberProject(value, free ? undefined : initialLab), saved: true }); setError('')
    } catch (failure) { setError(failure.message) }
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    const generation = ++importGeneration.current
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error('Cybersecurity notebooks must fit within 64 KiB.')
      const parsed = parseCyberProject(await file.text(), free ? undefined : initialLab)
      if (generation !== importGeneration.current) return
      setPending({ project: parsed }); setError('')
    } catch (failure) { if (generation === importGeneration.current) setError(failure.message) }
  }
  function replace() {
    importGeneration.current++
    setProject(pending.project); setSaved(pending.saved ? JSON.stringify(pending.project) : ''); setOpened(JSON.stringify(pending.project)); setPending(null)
    setShop(createState()); setHistory([]); setSent(0); clearCurrent()
    setNotice('Notebook opened with fresh shop data. Send requests to collect new evidence.')
  }
  function cancelPending() { importGeneration.current++; setPending(null) }
  function selectLab(id) { if (id !== project.lab) setPending({ project: createCyberProject(id) }) }
  function resetLab() { setPending({ project: createCyberProject(project.lab) }) }
  function resetShop() { setShop(createState()); setResponse(null); setNotice('Shop accounts reset. Captured history is kept.') }
  function exportNotebook() {
    try { downloadJson(validateCyberProject(project), `cybersecurity-${project.lab}.json`); setError('') } catch (failure) { setError(failure.message) }
  }
  function exportReport() {
    downloadJson({ format: 'voltquest-cybersecurity-report', version: 1, lab: project.lab, scope: 'Local fictional VoltShop fixtures only. No network, host filesystem or script execution.', notes: project.notes, currentControls: project.controls, totalRequests: sent, historyTruncated: sent > history.length, history, verification }, `cybersecurity-${project.lab}-report.json`)
  }

  return {
    project, lab, shop, response, history, sent, verification, pending, error, notice, saved, opened, dirty, applicable, found, normalSeen, fileInput,
    setProject, setError, setNotice, setPending,
    clearCurrent, editRequest, loadRequest, changeControls, toggleControl, send, execute, runCommand, verify, save, load, importFile, replace, cancelPending, selectLab, resetLab, resetShop, exportNotebook, exportReport,
  }
}

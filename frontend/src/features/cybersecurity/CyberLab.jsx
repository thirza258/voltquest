import { useRef, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { Button, Modal } from '../../ui/index.js'
import { readJson, writeJson } from '../../lib/storage.js'
import { downloadJson } from '../../lib/download.js'
import { CONTROLS, createState, executeRequest, secureControls } from '../../engine/cybersecurity/model.js'
import { LABS, ROUTES, verifyLab } from '../../engine/cybersecurity/scenarios.js'
import { CYBER_STORAGE_PREFIX, MAX_PROJECT_BYTES, createCyberProject, parseCyberProject, parseRequestDraft, requestDraft, validateCyberProject } from './project.js'
import { fieldClass, panelClass } from './styles.js'

const pretty = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2)
function Source({ children, label }) { return <pre aria-label={label} tabIndex={0} className="mt-3 max-h-80 overflow-auto rounded-md bg-slate-900 p-3 font-mono text-xs leading-6 text-slate-100 focus:ring-2 focus:ring-brand-500"><code>{pretty(children)}</code></pre> }

export default function CyberLab({ initialLab = 'http', free = false }) {
  const { t } = useI18n()
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
  const fileInput = useRef(null)
  const importGeneration = useRef(0)
  const lab = LABS[project.lab]
  const applicable = project.lab === 'capstone' ? ['debug', 'ownership', 'fields'] : [lab.control]
  const found = new Set(history.flatMap(item => item.findings.map(finding => finding.id)))
  const normalSeen = history.some(item => item.status === 200 && !item.findings.length && item.request.method === lab.baseline.method && item.request.path === lab.baseline.path)
  const dirty = saved !== JSON.stringify(project)

  function clearCurrent() { setResponse(null); setVerification(null); setError(''); setNotice('') }
  function editRequest(key, value) {
    setProject(current => ({ ...current, request: { ...current.request, [key]: value } })); setResponse(null); setError('')
  }
  function loadRequest(request) { setProject(current => ({ ...current, request: requestDraft(request) })); setResponse(null); setError('') }
  function changeControls(controls) {
    setProject(current => ({ ...current, controls })); setShop(createState()); clearCurrent()
    setNotice('Defenses changed. Shop accounts reset; captured history is kept. Run checks again.')
  }
  function send(event) {
    event.preventDefault()
    try {
      const result = executeRequest(parseRequestDraft(project.request), project.controls, shop)
      setShop(result.state); setResponse(result); setHistory(current => [...current, { ...result, number: sent + 1 }].slice(-30)); setSent(count => count + 1)
      setError(''); setNotice('')
    } catch (failure) { setResponse(null); setError(failure.message) }
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
    setProject(pending.project); setSaved(pending.saved ? JSON.stringify(pending.project) : ''); setPending(null)
    setShop(createState()); setHistory([]); setSent(0); clearCurrent()
    setNotice('Notebook opened with fresh shop data. Send requests to collect new evidence.')
  }
  function exportNotebook() {
    try { downloadJson(validateCyberProject(project), `cybersecurity-${project.lab}.json`); setError('') } catch (failure) { setError(failure.message) }
  }

  return <section className="min-w-0 space-y-4" aria-label={t('Web vulnerability sandbox')}>
    <div className={`${panelClass} border-teal-200`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">VoltShop · {t('Local web lab')}</p><h2 className="mt-2 text-xl font-semibold">{t(lab.title)}</h2></div><span className="rounded bg-teal-50 px-3 py-1 text-xs font-medium text-teal-900">{t(dirty ? 'Unsaved notebook' : 'Notebook saved')}</span></div>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-ink-secondary">{t('Edit a request, inspect the response and test a defense. All accounts, files and destinations are fictional local fixtures. HTML is shown as inert source; requests never contact a website.')}</p>
      {free && <label className="mt-4 block max-w-xl text-sm font-medium">{t('Choose a cybersecurity lab')}<select className={`${fieldClass} mt-1`} value={project.lab} onChange={event => { if (event.target.value !== project.lab) setPending({ project: createCyberProject(event.target.value) }) }}>{Object.entries(LABS).map(([id, item]) => <option key={id} value={id}>{t(item.title)}</option>)}</select></label>}
      <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={save}>{t('Save notebook')}</Button><Button size="sm" variant="secondary" onClick={load}>{t('Load saved notebook')}</Button><Button size="sm" variant="secondary" onClick={exportNotebook}>{t('Export notebook')}</Button><Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>{t('Import notebook')}</Button><Button size="sm" variant="ghost" onClick={() => setPending({ project: createCyberProject(project.lab) })}>{t('Reset lab')}</Button></div>
      <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label={t('Import cybersecurity JSON file')} onChange={importFile} />
      <p className="mt-3 text-xs leading-5 text-slate-600">{t('Save keeps request drafts, defenses and notes on this device. Load/import starts fresh shop data. Export a report to keep captured evidence.')}</p>
      {notice && <p role="status" className="mt-3 text-sm text-brand-700">{t(notice)}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{t(error)}</p>}
    </div>
    <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('Investigation milestones')}>{[
      ['Observe normal behavior', normalSeen], ['Collect vulnerability evidence', applicable.every(key => found.has(key))], ['Verify defenses', Boolean(verification?.passed)], ['Write investigation notes', project.notes.trim().length >= 40],
    ].map(([label, done], index) => <li key={label} className={`rounded-md border p-3 text-sm ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-line bg-white text-slate-600'}`}>{index + 1}. {t(label)}<span className="mt-1 block text-xs font-semibold">{t(done ? 'Done' : 'To do')}</span></li>)}</ol>
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <form onSubmit={send} className={`${panelClass} space-y-4`} aria-label={t('Request editor')}>
        <h3 className="text-lg font-semibold">{t('Request editor')}</h3>
        <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => loadRequest(lab.baseline)}>{t('Load normal request')}</Button><Button type="button" size="sm" variant="secondary" onClick={() => loadRequest(lab.probe)}>{t('Load guided probe')}</Button></div>
        <div className="grid gap-3 sm:grid-cols-[100px_minmax(0,1fr)]"><label className="text-sm">{t('Method')}<select className={`${fieldClass} mt-1`} value={project.request.method} onChange={event => editRequest('method', event.target.value)}>{['GET', 'POST', 'PATCH'].map(method => <option key={method}>{method}</option>)}</select></label><label className="text-sm">{t('Request path')}<input className={`${fieldClass} mt-1 font-mono`} value={project.request.path} maxLength={2048} spellCheck={false} onChange={event => editRequest('path', event.target.value)} /></label></div>
        <label className="block text-sm">{t('Request headers (JSON)')}<textarea className={`${fieldClass} mt-1 font-mono leading-6`} rows={4} maxLength={12000} spellCheck={false} value={project.request.headers} onChange={event => editRequest('headers', event.target.value)} /></label>
        <label className="block text-sm">{t('Request body (JSON)')}<textarea className={`${fieldClass} mt-1 font-mono leading-6`} rows={4} maxLength={12000} spellCheck={false} value={project.request.body} onChange={event => editRequest('body', event.target.value)} /></label>
        <Button type="submit">{t('Send local request')}</Button>
        <details className="rounded border border-line p-3"><summary className="cursor-pointer text-sm font-semibold text-brand-700">{t('Demo sessions and request help')}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{t('Use a Cookie header with sid=alice-session, sid=bob-session or sid=admin-session. Omit it for anonymous requests. These are public teaching identities, not real login credentials.')}</p><p className="mt-2 text-sm leading-6 text-slate-600">{t('Headers and body use JSON objects. Query values must be URL-encoded. CSRF demo tokens are csrf-alice, csrf-bob and csrf-admin; the expected Origin is https://shop.vq.test. The lab does not emulate browser cookie or CORS behavior.')}</p></details>
        <details className="rounded border border-line p-3"><summary className="cursor-pointer text-sm font-semibold text-brand-700">{t('Show investigation hint')}</summary><p className="mt-3 text-sm leading-6 text-ink-secondary">{t(lab.hint)}</p></details>
      </form>
      <div className="min-w-0 space-y-4">
        <section className={panelClass} aria-label={t('Current response')}><h3 className="text-lg font-semibold">{t('Current response')}</h3>{response ? <><p role="status" className="mt-3 text-sm font-semibold">HTTP {response.status} · {response.findings.length ? t('Boundary violation observed') : t('No violation observed in this response')}</p><Source label={t('Response headers')}>{response.headers}</Source><Source label={t('Response body')}>{response.body}</Source><h4 className="mt-4 text-sm font-semibold">{t('Handler trace')}</h4><ol className="mt-2 list-decimal space-y-2 break-words pl-5 font-mono text-xs leading-6 text-slate-700">{response.trace.map((line, i) => <li key={i}>{line}</li>)}</ol>{response.findings.map(finding => <p key={finding.id} className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">{finding.evidence}</p>)}</> : <p className="mt-3 text-sm leading-6 text-slate-600">{t('Send a request to see its status, body and handler trace. Editing the request clears this response.')}</p>}</section>
        <details className={panelClass}><summary className="cursor-pointer font-semibold">{t('Current shop accounts')}</summary><p className="mt-3 text-xs leading-5 text-slate-600">{t('Lab instrumentation: inspect actual fixture mutations here. This view is not data returned to a web client.')}</p><Source label={t('Fixture account state')}>{shop.users}</Source><Button size="sm" variant="secondary" onClick={() => { setShop(createState()); setResponse(null); setNotice('Shop accounts reset. Captured history is kept.') }}>{t('Reset shop accounts')}</Button></details>
      </div>
    </div>
    <details className={panelClass}><summary className="cursor-pointer font-semibold">{t('VoltShop route map')}</summary><p className="mt-3 text-sm text-slate-600">{t('All routes below are available in every lab. Each preset enables its relevant weaknesses; the capstone combines three.')}</p><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">{t('Method')}</th><th className="p-2">{t('Path')}</th><th className="p-2">{t('Purpose')}</th></tr></thead><tbody>{ROUTES.map(([method, path, purpose]) => <tr className="border-t border-line" key={path}><td className="p-2 font-mono">{method}</td><td className="p-2 font-mono">{path}</td><td className="p-2">{t(purpose)}</td></tr>)}</tbody></table></div></details>
    <section className={panelClass} aria-label={t('Defenses and verification')}>
      <h3 className="text-lg font-semibold">{t('Defenses and verification')}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t('Checked defenses change the actual handler decisions. Changing a defense resets shop data and invalidates the last verification. Regression checks always use fresh fixtures and do not change your shop.')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(CONTROLS).map(([id, label]) => <label key={id} className={`flex min-h-12 cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${project.controls[id] ? 'border-teal-200 bg-teal-50' : 'border-amber-200 bg-amber-50'}`}><input type="checkbox" className="mt-1 accent-teal-700" checked={project.controls[id]} onChange={event => changeControls({ ...project.controls, [id]: event.target.checked })} /><span>{t(label)}</span></label>)}</div>
      <div className="mt-4 flex flex-wrap gap-2"><Button onClick={verify}>{t('Run regression checks')}</Button><Button variant="secondary" onClick={() => changeControls(secureControls())}>{t('Enable all defenses')}</Button></div>
      {verification && <div className="mt-4" aria-label={t('Verification results')}><p role="status" className={`font-semibold ${verification.passed ? 'text-emerald-800' : 'text-amber-900'}`}>{t(verification.passed ? 'All regression checks passed' : 'Some regression checks failed')} · {verification.checks.filter(check => check.passed).length}/{verification.checks.length}</p><ul className="mt-3 space-y-2 text-sm">{verification.checks.map((check, i) => <li key={i}><details className={`rounded border p-3 ${check.passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><summary className="cursor-pointer">{check.passed ? 'PASS' : 'FAIL'} · {t(LABS[check.lab].title)} · {t(check.name)}</summary><p className="mt-2">{t('Expected status')}: {check.expectedStatus} · {t('Observed status')}: {check.actualStatus}</p>{check.responses.map((item, j) => <Source key={j}>{ { request: item.request, status: item.status, body: item.body, findings: item.findings } }</Source>)}</details></li>)}</ul></div>}
      <details className="mt-4 rounded-md border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">{t('Compare handler logic')}</summary><p className="mt-3 text-xs leading-5 text-slate-600">{t('Illustrative pseudocode explains the implemented branch. Edit defenses above to change behavior; source text is not executed.')}</p><div className="mt-3 grid gap-3 md:grid-cols-2"><div><h4 className="text-sm font-semibold">{t('Vulnerable logic')}</h4><Source>{lab.vulnerable}</Source></div><div><h4 className="text-sm font-semibold">{t('Defended logic')}</h4><Source>{lab.fixed}</Source></div></div></details>
    </section>
    <section className={panelClass}><h3 className="text-lg font-semibold">{t('Investigation notebook')}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t('Describe the actor, affected route, expected rule, reproduction steps, observed impact, fix and retest. Explain what the evidence does and does not establish.')}</p><label className="mt-3 block text-sm">{t('Investigation notes')}<textarea className={`${fieldClass} mt-1 leading-6`} rows={6} maxLength={10000} value={project.notes} onChange={event => setProject(current => ({ ...current, notes: event.target.value }))} /></label>
      <div className="mt-4 flex flex-wrap items-center gap-3"><Button variant="secondary" disabled={!history.length && !verification} onClick={() => downloadJson({ format: 'voltquest-cybersecurity-report', version: 1, lab: project.lab, scope: 'Local fictional VoltShop fixtures only. No network, host filesystem or script execution.', notes: project.notes, currentControls: project.controls, totalRequests: sent, historyTruncated: sent > history.length, history, verification }, `cybersecurity-${project.lab}-report.json`)}>{t('Export investigation report')}</Button><span className="text-xs text-slate-600">{t('Captured requests: {count}. The latest 30 are retained.', { count: sent })}</span></div>
      {history.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">{t('Captured request history')}</summary><ol className="mt-3 space-y-2">{history.slice().reverse().map(item => <li key={item.number}><details className="rounded border border-line p-3"><summary className="cursor-pointer break-all font-mono text-xs leading-6">#{item.number} · {item.request.method} {item.request.path} · {item.status}</summary><Source>{ { request: item.request, defenses: item.controls, status: item.status, body: item.body, findings: item.findings } }</Source></details></li>)}</ol></details>}
    </section>
    <Modal open={Boolean(pending)} onClose={() => { importGeneration.current++; setPending(null) }} title={t('Replace the current notebook?')} description={t('This replaces request drafts, defenses and notes, and clears captured evidence. Save or export your current work first to keep it.')} footer={<><Button variant="secondary" onClick={() => { importGeneration.current++; setPending(null) }}>{t('Cancel')}</Button><Button onClick={replace}>{t('Replace notebook')}</Button></>} />
  </section>
}

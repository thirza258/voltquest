import { useEffect, useMemo, useRef, useState } from 'react'
import { Bug, Download, FolderOpen, ListChecks, Network, RotateCcw, Save, ShieldCheck, Upload } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { Button, Modal } from '../../ui/index.js'
import { CONTROLS, secureControls } from '../../engine/cybersecurity/model.js'
import { LABS, ROUTES } from '../../engine/cybersecurity/scenarios.js'
import { useElementWidth } from '../sandbox/ide/useElementWidth.js'
import { PanelTabs, ThemeToggle, useWorkbenchTheme } from '../sandbox/ide/Workbench.jsx'
import { useCyberNotebook } from './useCyberNotebook.js'
import { formatCurl } from './curl.js'
import { inspectSummary, isEventAttr, parseInertHtml } from './inspectHtml.js'
import CyberTopology from './CyberTopology.jsx'
import '../sandbox/ide/workbench.css'
import './cyber-console.css'

const pretty = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2)
const isHtml = item => /text\/html/.test(item?.headers?.['content-type'] ?? '')
const statusClass = status => status < 300 ? 'cy-status-ok' : status < 400 ? 'cy-status-warn' : 'cy-status-bad'

/** DevTools-style Elements tree for an inert HTML node list (never real DOM). */
function ElementsTree({ nodes }) {
  const { t } = useI18n()
  if (!nodes.length) return <p className="wb-note">{t('Empty document.')}</p>
  return <ul className="cy-tree">{nodes.map((node, i) => <TreeNode key={i} node={node} />)}</ul>
}
function TreeNode({ node }) {
  if (node.type === 'text') return node.value.trim() ? <li className="cy-tree-text">{`"${node.value.trim()}"`}</li> : null
  if (node.type === 'comment') return <li className="cy-tree-comment">&lt;!-- {node.value.trim()} --&gt;</li>
  return <li>
    <span className="cy-tag">&lt;{node.tag}</span>
    {node.attrs.map(([name, value], i) => <span key={i}> <span className={isEventAttr(name) ? 'cy-attr-event' : 'cy-attr-name'}>{name}</span>{value != null && <>=<span className="cy-attr-value">{`"${value}"`}</span></>}</span>)}
    <span className="cy-tag">&gt;</span>
    {node.children.length > 0 && <ul>{node.children.map((child, i) => <TreeNode key={i} node={child} />)}</ul>}
  </li>
}

/**
 * Security console for the cybersecurity sandbox: a Packet Tracer-style topology, a curl terminal and
 * a browser DevTools-style inspector, over the same fixtures and defenses as the course lab
 * (useCyberNotebook). Requests run through the deterministic local model; HTML is shown inert, no
 * script runs and no packet leaves the browser.
 */
export default function CyberConsole({ initialLab }) {
  const { t } = useI18n()
  const nb = useCyberNotebook({ initialLab, free: true })
  const { project, lab, response, history, sent, verification, pending, error, notice } = nb
  const root = useRef(null)
  const width = useElementWidth(root)
  const layout = width >= 1100 ? 'wide' : width >= 760 ? 'medium' : 'narrow'
  const [theme, toggleTheme] = useWorkbenchTheme()
  const [side, setSide] = useState('routes')
  const [pane, setPane] = useState('topology')
  const [detail, setDetail] = useState('response')
  const [selectedNumber, setSelectedNumber] = useState(0)
  const [command, setCommand] = useState('')
  const [term, setTerm] = useState([{ id: 0, kind: 'info', text: 'VoltShop security terminal. Type a curl command, e.g. curl /health. All fixtures are local; no request leaves the browser.' }])
  const [recall, setRecall] = useState(null)
  const termId = useRef(0), input = useRef(null), logRef = useRef(null)
  const commands = useMemo(() => term.filter(line => line.kind === 'input').map(line => line.text), [term])

  const selected = history.find(item => item.number === selectedNumber) ?? history[history.length - 1] ?? null
  const applicable = project.lab === 'capstone' ? ['debug', 'ownership', 'fields'] : [lab.control]
  useEffect(() => { setSelectedNumber(sent) }, [sent])
  useEffect(() => { const node = logRef.current; if (node) node.scrollTop = node.scrollHeight }, [term])
  useEffect(() => { setTerm([{ id: 0, kind: 'info', text: `Opened ${lab.title}. Type a curl command or load one from the routes.` }]); setCommand(''); setRecall(null) }, [project.lab, lab.title])

  function pushLines(lines) { setTerm(current => [...current, ...lines.map(line => ({ id: ++termId.current, ...line }))].slice(-200)) }
  function runTerminal(cmd) {
    const text = cmd.trim()
    if (!text) return
    if (layout === 'narrow') setPane('terminal')
    const { result, error: failure } = nb.runCommand(text)
    const lines = [{ kind: 'input', text }]
    if (failure) lines.push({ kind: 'error', text: failure })
    else {
      lines.push({ kind: 'status', text: `< HTTP ${result.status}  ${result.headers['content-type']}` })
      const body = pretty(result.body)
      lines.push({ kind: 'body', text: body.length > 800 ? `${body.slice(0, 800)}\n… (${body.length} chars — full body in the Network panel)` : body })
      if (result.findings.length) lines.push({ kind: 'finding', text: `! ${result.findings.length} security finding(s) — see the Security tab and topology.` })
    }
    pushLines(lines)
  }
  function submit(event) { event.preventDefault(); if (!command.trim()) return; runTerminal(command); setCommand(''); setRecall(null) }
  function fill(request) { setCommand(formatCurl(request)); if (layout === 'narrow') setPane('terminal'); input.current?.focus() }
  function promptKeys(event) {
    if (event.key === 'ArrowUp' && commands.length) { event.preventDefault(); const next = recall === null ? commands.length - 1 : Math.max(0, recall - 1); setRecall(next); setCommand(commands[next]) }
    else if (event.key === 'ArrowDown' && recall !== null) { event.preventDefault(); const next = recall + 1; if (next >= commands.length) { setRecall(null); setCommand('') } else { setRecall(next); setCommand(commands[next]) } }
  }
  function openDetail(number, tab) { setSelectedNumber(number); if (tab) setDetail(tab); if (layout === 'narrow') setPane('devtools') }

  const notebookActions = <span className="ml-auto flex">
    <button type="button" className="wb-icon-button" aria-label={t('Save notebook')} title={t('Save notebook')} onClick={nb.save}><Save size={14} /></button>
    <button type="button" className="wb-icon-button" aria-label={t('Load saved notebook')} title={t('Load saved notebook')} onClick={nb.load}><FolderOpen size={14} /></button>
    <button type="button" className="wb-icon-button" aria-label={t('Import notebook')} title={t('Import notebook')} onClick={() => nb.fileInput.current?.click()}><Upload size={14} /></button>
    <button type="button" className="wb-icon-button" aria-label={t('Export notebook')} title={t('Export notebook')} onClick={nb.exportNotebook}><Download size={14} /></button>
    <button type="button" className="wb-icon-button" aria-label={t('Reset lab')} title={t('Reset lab')} onClick={nb.resetLab}><RotateCcw size={14} /></button>
  </span>

  const routesSide = <div className="flex min-h-0 flex-1 flex-col" hidden={side !== 'routes'}>
    <div className="wb-side-title"><h2>{t('Routes')}</h2></div>
    <div className="wb-scroll">
      <p className="wb-note px-3 py-2">{t('Click a route to load a curl command into the terminal, then edit and run it.')}</p>
      {ROUTES.map(([method, path, purpose]) => <button key={path} type="button" className="wb-tree-row" style={{ paddingLeft: 12 }} onClick={() => fill({ method, path, headers: {}, body: {} })}><span className="wb-mono text-xs" style={{ color: 'var(--wb-accent)', width: 42 }}>{method}</span><span className="min-w-0 flex-1 whitespace-normal leading-snug"><span className="wb-mono text-xs">{path}</span><span className="block" style={{ color: 'var(--wb-muted)' }}>{t(purpose)}</span></span></button>)}
      <div className="wb-section-title mt-2">{t('Guided requests')}</div>
      <div className="flex flex-wrap gap-2 px-3 pb-2">
        <button type="button" className="wb-button" onClick={() => fill(lab.baseline)}>{t('Load normal request')}</button>
        <button type="button" className="wb-button" onClick={() => fill(lab.probe)}>{t('Load guided probe')}</button>
      </div>
      <details className="px-3 pb-3 text-xs"><summary className="cursor-pointer font-semibold" style={{ color: 'var(--wb-accent)' }}>{t('Demo sessions and request help')}</summary><p className="wb-note mt-2">{t('Use a Cookie header with sid=alice-session, sid=bob-session or sid=admin-session. Omit it for anonymous requests. These are public teaching identities, not real login credentials.')}</p><p className="wb-note mt-2">{t('Headers and body use JSON objects. Query values must be URL-encoded. CSRF demo tokens are csrf-alice, csrf-bob and csrf-admin; the expected Origin is https://shop.vq.test. The lab does not emulate browser cookie or CORS behavior.')}</p></details>
    </div>
  </div>
  const defensesSide = <div className="flex min-h-0 flex-1 flex-col" hidden={side !== 'defenses'}>
    <div className="wb-side-title"><h2>{t('Defenses')}</h2></div>
    <div className="wb-scroll space-y-3 p-3">
      <p className="wb-note">{t('Checked defenses change the actual handler decisions. Changing a defense resets shop data and invalidates the last verification. Regression checks always use fresh fixtures and do not change your shop.')}</p>
      <div className="space-y-2">{Object.entries(CONTROLS).map(([id, label]) => <label key={id} title={applicable.includes(id) ? t('Relevant to this lab') : undefined} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs" style={{ borderColor: project.controls[id] ? 'var(--wb-success-soft)' : 'var(--wb-warning-soft)', background: project.controls[id] ? 'var(--wb-success-soft)' : 'var(--wb-warning-soft)', color: 'var(--wb-text)', borderLeft: applicable.includes(id) ? '3px solid var(--wb-accent)' : undefined }}><input type="checkbox" className="mt-0.5" checked={project.controls[id]} onChange={event => nb.toggleControl(id, event.target.checked)} /><span>{t(label)}</span></label>)}</div>
      <div className="flex flex-wrap gap-2"><button type="button" className="wb-button is-primary" onClick={nb.verify}><ListChecks size={13} />{t('Run regression checks')}</button><button type="button" className="wb-button" onClick={() => nb.changeControls(secureControls())}>{t('Enable all defenses')}</button></div>
      {verification && <div aria-label={t('Verification results')}><p role="status" className="mb-2 text-sm font-semibold" style={{ color: verification.passed ? 'var(--wb-success)' : 'var(--wb-warning)' }}>{t(verification.passed ? 'All regression checks passed' : 'Some regression checks failed')} · {verification.checks.filter(check => check.passed).length}/{verification.checks.length}</p>{verification.checks.map((check, i) => <details key={i} className="wb-step mt-1"><summary><span className="wb-mono text-xs" style={{ color: check.passed ? 'var(--wb-success)' : 'var(--wb-danger)' }}>{check.passed ? 'PASS' : 'FAIL'}</span><span className="wb-step-title">{t(LABS[check.lab].title)} · {t(check.name)}</span></summary><div className="wb-step-body"><p className="wb-note">{t('Expected status')}: {check.expectedStatus} · {t('Observed status')}: {check.actualStatus}</p></div></details>)}</div>}
    </div>
  </div>
  const notebookSide = <div className="flex min-h-0 flex-1 flex-col" hidden={side !== 'notebook'}>
    <div className="wb-side-title"><h2>{t('Investigation notebook')}</h2>{notebookActions}</div>
    <div className="wb-scroll space-y-3 p-3">
      <ol className="grid grid-cols-2 gap-1.5" aria-label={t('Investigation milestones')}>{[['Observe normal behavior', nb.normalSeen], ['Collect vulnerability evidence', applicable.every(key => nb.found.has(key))], ['Verify defenses', Boolean(verification?.passed)], ['Write investigation notes', project.notes.trim().length >= 40]].map(([label, done], index) => <li key={label} className="rounded-md border p-2 text-xs" style={{ borderColor: done ? 'var(--wb-success-soft)' : 'var(--wb-border)', color: done ? 'var(--wb-success)' : 'var(--wb-muted)' }}>{index + 1}. {t(label)} · {t(done ? 'Done' : 'To do')}</li>)}</ol>
      <label className="wb-field">{t('Investigation notes')}<textarea className="min-h-40 rounded-md border p-2 text-sm" style={{ borderColor: 'var(--wb-border-strong)', background: 'var(--wb-window)', color: 'var(--wb-text)' }} maxLength={10000} value={project.notes} onChange={event => nb.setProject(current => ({ ...current, notes: event.target.value }))} /></label>
      <button type="button" className="wb-button" disabled={!history.length && !verification} onClick={nb.exportReport}><Download size={13} />{t('Export investigation report')}</button>
      <p className="wb-note">{t('Captured requests: {count}. The latest 30 are retained.', { count: sent })}</p>
      <p className="wb-note">{t('Save keeps request drafts, defenses and notes on this device. Load/import starts fresh shop data. Export a report to keep captured evidence.')}</p>
    </div>
  </div>

  const detailTabs = [['headers', 'Headers'], ['response', 'Response'], ['preview', 'Preview'], ['elements', 'Elements'], ['security', 'Security', selected?.findings.length || 0], ['trace', 'Trace']]
  const html = selected && isHtml(selected) ? parseInertHtml(selected.body) : null
  const devtools = <div className="wb-agent min-h-0" style={{ width: layout === 'wide' ? 380 : undefined, flexShrink: 0, borderLeft: layout === 'wide' ? '1px solid var(--wb-border)' : 0 }} hidden={layout === 'narrow' && pane !== 'devtools'}>
    <header className="wb-agent-head"><Network size={15} /><h2>{t('DevTools · Network')}</h2></header>
    <div className="max-h-40 overflow-auto border-b" style={{ borderColor: 'var(--wb-border)' }} role="list" aria-label={t('Captured requests')}>
      {history.length ? history.slice().reverse().map(item => <button key={item.number} type="button" className="cy-net-row" aria-current={item.number === selectedNumber ? 'true' : undefined} onClick={() => openDetail(item.number)}><span className="cy-method">{item.request.method}</span><span className="cy-path">{item.request.path}</span><span className={`cy-status ${statusClass(item.status)}`}>{item.status}</span>{item.findings.length ? <Bug size={12} style={{ color: 'var(--wb-warning)' }} /> : null}</button>) : <p className="wb-note p-3">{t('Run a request to capture it here.')}</p>}
    </div>
    {selected ? <>
      <PanelTabs tabs={detailTabs} active={detail} onSelect={setDetail} label="Request detail" prefix="cy-detail" />
      <div className="wb-panel-body" role="tabpanel" aria-labelledby={`cy-detail-${detail}`}>
        {detail === 'headers' && <div className="space-y-2 text-xs"><p className="wb-mono" style={{ color: 'var(--wb-accent)' }}>{selected.request.method} {selected.request.path}</p><p className="wb-note font-semibold">{t('Request headers')}</p><pre className="wb-pre">{pretty(selected.request.headers ?? {})}</pre><p className="wb-note font-semibold">{t('Response headers')}</p><pre className="wb-pre">{pretty(selected.headers)}</pre></div>}
        {detail === 'response' && <pre className="wb-pre" aria-label={t('Response body')} tabIndex={0} style={{ maxHeight: 'none' }}>{pretty(selected.body)}</pre>}
        {detail === 'preview' && (isHtml(selected) ? <p className="wb-note">{t('This is an HTML response. Use the Elements tab to inspect its structure.')}</p> : <pre className="wb-pre" style={{ maxHeight: 'none' }}>{pretty(selected.body)}</pre>)}
        {detail === 'elements' && <div aria-label={t('Current response')}>{html ? <><p className="wb-note mb-2">{t('Inert DOM: {elements} element node(s), {handlers} event handler(s). Nothing here runs.', inspectSummary(html))}</p><ElementsTree nodes={html} /></> : <p className="wb-note">{t('Not an HTML response. The Elements view renders text/html bodies only.')}</p>}</div>}
        {detail === 'security' && <div className="space-y-2">{selected.findings.length ? selected.findings.map(finding => <p key={finding.id} className="wb-banner">{finding.evidence}</p>) : <p className="wb-note">{t('No boundary violation was observed in this response.')}</p>}<p className="wb-note">{t('Findings are structural indicators from the local model, not proof of exploitation. No script runs and no request leaves the browser.')}</p></div>}
        {detail === 'trace' && <ol className="space-y-1 pl-5 text-xs" style={{ listStyle: 'decimal' }}>{selected.trace.map((line, i) => <li key={i} className="wb-mono" style={{ color: 'var(--wb-muted)' }}>{line}</li>)}</ol>}
      </div>
    </> : <p className="wb-note p-3">{t('Select a captured request to inspect its headers, body, DOM and trace.')}</p>}
    <details className="border-t p-2" style={{ borderColor: 'var(--wb-border)' }}><summary className="cursor-pointer text-xs font-semibold" style={{ color: 'var(--wb-muted)' }}>{t('Application · fixture account state')}</summary><pre className="wb-pre mt-2" aria-label={t('Fixture account state')} tabIndex={0}>{pretty(nb.shop.users)}</pre><button type="button" className="wb-button mt-2" onClick={nb.resetShop}>{t('Reset shop accounts')}</button></details>
  </div>

  const terminal = <div className="cy-term" hidden={layout === 'narrow' && pane !== 'terminal'}>
    <div className="cy-term-log" ref={logRef} role="log" aria-label={t('Security terminal output')} tabIndex={0}>{term.map(line => <p key={line.id} className={`cy-term-line is-${line.kind}`}>{line.text}</p>)}</div>
    <form className="cy-term-prompt" onSubmit={submit}><span aria-hidden="true">$</span><input ref={input} aria-label={t('Security terminal command')} value={command} spellCheck={false} autoCapitalize="off" autoComplete="off" placeholder={t('curl /health')} onChange={event => { setCommand(event.target.value); setRecall(null) }} onKeyDown={promptKeys} /><Button type="submit" size="sm">{t('Run command')}</Button></form>
  </div>

  const activity = [['routes', Network, 'Routes'], ['defenses', ShieldCheck, 'Defenses'], ['notebook', Bug, 'Investigation notebook']]
  const paneTabs = [['routes', 'Routes'], ['topology', 'Topology'], ['terminal', 'Terminal'], ['devtools', 'DevTools'], ['defenses', 'Defenses'], ['notebook', 'Notebook']]
  const selectPane = id => { setPane(id); if (['routes', 'defenses', 'notebook'].includes(id)) setSide(id) }

  return <div ref={root} className="wb-ide" data-theme={theme} data-layout={layout} data-cyber-lab={project.lab}>
    <div className="wb-titlebar">
      <span className="wb-brand"><span className="wb-brand-mark"><ShieldCheck size={13} /></span>{t('Security lab')}</span>
      <label className="flex min-w-0 items-center gap-2"><span className="sr-only">{t('Choose a cybersecurity lab')}</span><select className="wb-select" aria-label={t('Choose a cybersecurity lab')} value={project.lab} onChange={event => nb.selectLab(event.target.value)}>{Object.entries(LABS).map(([id, item]) => <option key={id} value={id}>{t(item.title)}</option>)}</select></label>
      <span className="ml-auto flex items-center gap-2"><span className="wb-chip is-accent" title={t('All accounts, files and destinations are fictional local fixtures.')}>{t('Local fixtures · no network')}</span><ThemeToggle theme={theme} onToggle={toggleTheme} /></span>
    </div>
    {layout === 'narrow' && <div className="wb-switch" role="tablist" aria-label={t('Console panels')}>{paneTabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={pane === id} onClick={() => selectPane(id)}>{t(label)}</button>)}</div>}
    <div className="wb-body">
      {layout !== 'narrow' && <nav className="wb-activity" aria-label={t('Activity bar')}>{activity.map(([id, Icon, label]) => <button key={id} type="button" aria-label={t(label)} title={t(label)} aria-pressed={side === id} onClick={() => setSide(id)}><Icon size={18} /></button>)}</nav>}
      <aside className="wb-side" style={{ width: layout === 'narrow' ? '100%' : 260 }} aria-label={t('Side bar')} hidden={layout === 'narrow' && !['routes', 'defenses', 'notebook'].includes(pane)}>
        {routesSide}{defensesSide}{notebookSide}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" hidden={layout === 'narrow' && !['topology', 'terminal'].includes(pane)}>
        <section className="flex min-h-0 flex-1 flex-col" aria-label={t('Network topology')} hidden={layout === 'narrow' && pane !== 'topology'} style={{ borderBottom: '1px solid var(--wb-border)' }}>
          <div className="wb-crumbs"><span style={{ color: 'var(--wb-text)' }}>{t('Network topology')}</span>{response && <span className="wb-note">· {response.request.method} {response.request.path} → {t('HTTP')} {response.status}</span>}</div>
          <CyberTopology response={response} />
        </section>
        {terminal}
      </div>
      {layout !== 'narrow' && devtools}
      {layout === 'narrow' && <div className="flex min-h-0 flex-1 flex-col" hidden={pane !== 'devtools'}>{devtools}</div>}
    </div>
    <footer className="wb-status">
      <span className={selected?.findings.length ? 'is-warn' : 'is-ok'}>{selected?.findings.length ? `⚠ ${t('{count} finding(s) in the selected response', { count: selected.findings.length })}` : `✓ ${t('No finding in the selected response')}`}</span>
      <span>{t(lab.title)}</span>
      {notice && <span className="is-ok" role="status">{t(notice)}</span>}
      {error && <span className="is-danger" role="alert">{t(error)}</span>}
      <div className="wb-status-right"><span>{t('Captured: {count}', { count: sent })}</span><span>{t('Local fixtures · no network')}</span></div>
    </footer>
    <input ref={nb.fileInput} type="file" className="sr-only" accept=".json,application/json" aria-label={t('Import cybersecurity JSON file')} onChange={nb.importFile} tabIndex={-1} />
    <Modal open={Boolean(pending)} onClose={nb.cancelPending} title={t('Replace the current notebook?')} description={t('This replaces request drafts, defenses and notes, and clears captured evidence. Save or export your current work first to keep it.')} footer={<><Button variant="secondary" onClick={nb.cancelPending}>{t('Cancel')}</Button><Button onClick={nb.replace}>{t('Replace notebook')}</Button></>} />
  </div>
}

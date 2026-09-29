import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, ChevronDown, Download, FileCode2, FileJson, FileText, Files, FolderOpen, GitCompare, Inbox, ListChecks, NotebookPen, Plus, RotateCcw, Save, SlidersHorizontal, Upload } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { Button, Modal } from '../../ui/index.js'
import { readJson } from '../../lib/storage.js'
import { downloadText } from '../../lib/download.js'
import { initialState, lintSkill, TOOLS } from '../../engine/agents/model.js'
import CodeEditor from '../sandbox/ide/CodeEditor.jsx'
import { changedFiles, lineDiff } from '../sandbox/ide/lineDiff.js'
import { useElementWidth } from '../sandbox/ide/useElementWidth.js'
import { EditorTabs, PanelTabs, tabPanelId, ThemeToggle, useWorkbenchTheme } from '../sandbox/ide/Workbench.jsx'
import { tokenizeJavascript, tokenizeJson, tokenizeMarkdown, tokenizePython } from '../sandbox/ide/tokenizers.js'
import { AGENT_COURSES, createProject, STORAGE_PREFIX, validateProject } from './project.js'
import { useAgentNotebook } from './useAgentNotebook.js'
import AgentThread, { contextRows, PlanList } from './AgentThread.jsx'
import { useUnsavedBenchWork } from '../sandbox/benchGuard.js'

const STAGES = [['01–05', 'Understand your agent', 1, 5], ['06–10', 'Control context and tools', 6, 10], ['11–15', 'Build reliable integrations', 11, 15], ['16–20', 'Build and evaluate', 16, 20]]
const SETTINGS = [['contextWindow', 'Context window', 64, 128000, 1], ['outputReserve', 'Output reserve', 16, 8000, 1], ['maxTurns', 'Maximum turns', 1, 32, 1], ['budgetUsd', 'Budget USD', 0, 100, 0.001], ['cachedTokens', 'Assumed cached tokens', 0, 128000, 1], ['rates.input', 'Input rate', 0, 1000, 0.1], ['rates.cached', 'Cached rate', 0, 1000, 0.1], ['rates.output', 'Output rate', 0, 1000, 0.1]]
const tokenizerFor = name => name.endsWith('.json') ? tokenizeJson : name.endsWith('.md') ? tokenizeMarkdown : null
const settingValue = (config, key) => key.startsWith('rates.') ? config.rates[key.slice(6)] : config[key]

function lint(skill) {
  try { return lintSkill(skill) } catch (failure) { return { valid: false, findings: [failure.message] } }
}

/**
 * Agent-first IDE for the AI agent sandbox: an Editor view and an Agent Manager view over one
 * useAgentNotebook. The "model" is the scripted fixture in harness.json and every tool acts on
 * in-memory fixtures, so the IDE shows real harness behaviour, not a real agent product.
 */
export default function AgentIde({ initialLesson }) {
  const { t } = useI18n()
  const nb = useAgentNotebook({ initialLesson, free: true })
  const { project, run, config, checks, language } = nb
  const root = useRef(null)
  const width = useElementWidth(root)
  const layout = width >= 1100 ? 'wide' : width >= 760 ? 'medium' : 'narrow'
  const [theme, toggleTheme] = useWorkbenchTheme()
  const [view, setView] = useState('editor')
  const [side, setSide] = useState('explorer')
  const [docs, setDocs] = useState(['harness', 'skill', 'cli', 'notes'])
  const [doc, setDoc] = useState('harness')
  const [panel, setPanel] = useState('problems')
  const [artifact, setArtifact] = useState('plan')
  const [pane, setPane] = useState('editor')
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const skillLint = useMemo(() => lint(project.skill), [project.skill])
  const problems = [...(nb.configError ? [{ file: 'harness.json', text: nb.configError, doc: 'harness' }] : []), ...skillLint.findings.map(text => ({ file: 'SKILL.md', text, doc: 'skill' }))]
  const fixture = useMemo(() => { try { return config ? initialState(config, project.skill) : null } catch { return null } }, [config, project.skill])
  const baseFiles = useMemo(() => { try { return run ? initialState(run.config, run.skill).files : null } catch { return null } }, [run])
  const files = run?.files ?? fixture?.files ?? {}
  const changes = run ? changedFiles(baseFiles, run.files) : []
  const newIssues = run ? run.issues.slice(fixture?.issues.length ?? 1) : []
  const stored = useMemo(() => {
    try { const value = readJson(STORAGE_PREFIX + project.lesson); return value ? validateProject(value, project.lesson) : null } catch { return null }
    // The baseline changes on save and replace, which is when the stored copy can change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.lesson, nb.baseline])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const savedLessons = useMemo(() => new Set(AGENT_COURSES.filter(course => readJson(STORAGE_PREFIX + course.id)).map(course => course.id)), [nb.baseline])
  const storedState = !stored ? 'none' : ['source', 'skill', 'javascript', 'python', 'notes'].every(key => stored[key] === project[key]) ? 'same' : 'different'
  const cliName = language === 'javascript' ? 'agent.mjs' : 'agent.py'
  const labels = { harness: 'harness.json', skill: 'SKILL.md', cli: cliName, notes: 'NOTES.md', issues: 'issues.json' }
  const docLabel = id => labels[id] ?? (id.startsWith('diff:') ? `${id.slice(5)} (${t('changes')})` : id.slice(6))
  useUnsavedBenchWork(['source', 'skill', 'javascript', 'python', 'notes'].some(key => project[key] !== nb.baseline[key]), 'AI agent notebook')
  const modified = { harness: project.source !== nb.baseline.source, skill: project.skill !== nb.baseline.skill, cli: project[language] !== nb.baseline[language], notes: project.notes !== nb.baseline.notes }

  // Medium widths start with the side bar closed so the editor keeps its width; wide always shows one.
  useEffect(() => { if (layout === 'medium') setSide(null); else setSide(value => value ?? 'explorer') }, [layout])
  useEffect(() => { setDocs(['harness', 'skill', 'cli', 'notes']); setDoc('harness') }, [project.lesson])
  // Read-only documents describe the current run; close them when that evidence is cleared.
  useEffect(() => { if (!run) { setDocs(previous => previous.filter(id => !id.startsWith('diff:') && id !== 'issues')); setDoc(previous => previous.startsWith('diff:') || previous === 'issues' ? 'harness' : previous) } }, [run])

  function open(id) { setDocs(previous => previous.includes(id) ? previous : [...previous, id]); setDoc(id); setView('editor'); if (layout === 'narrow') setPane('editor') }
  function close(id) { setDocs(previous => previous.filter(item => item !== id)); if (doc === id) setDoc('harness') }
  function keys(event) {
    const mod = event.ctrlKey || event.metaKey
    if (mod && event.key.toLowerCase() === 'e') { event.preventDefault(); setView(value => value === 'editor' ? 'manager' : 'editor') }
  }
  function editorKeys(event) {
    const mod = event.ctrlKey || event.metaKey
    if (mod && event.key === 'Enter') { event.preventDefault(); nb.execute(true) }
    else if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); nb.save() }
  }
  const toggleSide = id => { setSide(value => value === id && layout !== 'wide' ? null : id); if (layout === 'narrow') setPane('side') }

  const notebookActions = <span className="ml-auto flex">
    <button type="button" className="wb-icon-button" aria-label={t('Save notebook')} title={t('Save notebook')} onClick={nb.save}><Save size={14} /></button>
    <button type="button" className="wb-icon-button" aria-label={t('Load saved notebook')} title={t('Load saved notebook')} onClick={nb.load}><FolderOpen size={14} /></button>
    <button type="button" className="wb-icon-button" aria-label={t('Import notebook')} title={t('Import notebook')} onClick={() => nb.inputRef.current?.click()}><Upload size={14} /></button>
    <button type="button" className="wb-icon-button" aria-label={t('Export notebook')} title={t('Export notebook')} onClick={nb.exportNotebook}><Download size={14} /></button>
    <button type="button" className="wb-icon-button" aria-label={t('Reset notebook')} title={t('Reset notebook')} onClick={() => nb.propose(createProject(project.lesson))}><RotateCcw size={14} /></button>
  </span>
  const fileRow = (id, icon, name, meta) => <button key={id} type="button" className="wb-tree-row" aria-current={view === 'editor' && doc === id ? 'true' : undefined} onClick={() => open(id)}>{icon}<span className="truncate">{name}</span><span className="wb-meta">{meta}</span></button>
  const savedNote = <p className="wb-note px-3 py-2">{t('Saved copy in this browser')}: {t(storedState === 'none' ? 'None' : storedState === 'same' ? 'Matches the editors' : 'Differs from the editors')}</p>

  const explorer = <div className="flex min-h-0 flex-1 flex-col" hidden={side !== 'explorer'}>
    <div className="wb-side-title"><h2>{t('Explorer')}</h2></div>
    <div className="wb-scroll">
      <div className="wb-section-title"><ChevronDown size={13} />{t('Notebook')}{notebookActions}</div>
      {fileRow('harness', <FileJson size={14} style={{ color: 'var(--tok-literal)' }} />, 'harness.json', modified.harness ? 'M' : '')}
      {fileRow('skill', <FileText size={14} style={{ color: 'var(--tok-key)' }} />, 'SKILL.md', modified.skill ? 'M' : skillLint.valid ? '' : '!')}
      {['javascript', 'python'].map(value => <button key={value} type="button" className="wb-tree-row" aria-current={view === 'editor' && doc === 'cli' && language === value ? 'true' : undefined} onClick={() => { nb.setLanguage(value); open('cli') }}><FileCode2 size={14} style={{ color: value === 'javascript' ? 'var(--wb-warning)' : 'var(--tok-key)' }} /><span className="truncate">{value === 'javascript' ? 'agent.mjs' : 'agent.py'}</span><span className="wb-meta">{project[value] !== nb.baseline[value] ? 'M' : t('native')}</span></button>)}
      {fileRow('notes', <NotebookPen size={14} style={{ color: 'var(--wb-muted)' }} />, 'NOTES.md', modified.notes ? 'M' : '')}
      <div className="wb-section-title mt-2"><ChevronDown size={13} />{t('Virtual workspace')}<span className="ml-auto normal-case tracking-normal" style={{ color: 'var(--wb-muted)' }}>{t(run ? 'current run' : 'fixture')}</span></div>
      {Object.keys(files).length ? Object.keys(files).sort().map(name => { const change = changes.find(item => item.name === name); return fileRow(`vfile:${name}`, <FileText size={14} style={{ color: 'var(--wb-faint)' }} />, name, change ? change.status : t('read-only')) }) : <p className="wb-note px-5 py-1">{t('Finish valid harness JSON to load the fixture.')}</p>}
      <div className="wb-section-title mt-2"><ChevronDown size={13} />{t('Issue tracker')}</div>
      {fileRow('issues', <Inbox size={14} style={{ color: 'var(--wb-faint)' }} />, 'issues.json', `${(run ?? fixture)?.issues.length ?? 0}${newIssues.length ? ` · +${newIssues.length}` : ''}`)}
      {savedNote}
    </div>
  </div>
  const settings = <div className="flex min-h-0 flex-1 flex-col" hidden={side !== 'settings'}>
    <div className="wb-side-title"><h2>{t('Harness settings')}</h2></div>
    <div className="wb-scroll space-y-3 px-3 pb-3">
      <p className="wb-note">{t('Tokens use UTF-8 bytes / 4, rounded up. Rates are hypothetical USD per million tokens. Cached tokens still occupy context. Edit the JSON to change context, scopes and proposed turns.')}</p>
      <div className="grid grid-cols-2 gap-2">{SETTINGS.map(([key, label, min, max, step]) => <label key={key} className="wb-field">{t(label)}<input type="number" min={min} max={max} step={step} disabled={!config} key={`${key}:${config ? settingValue(config, key) : ''}`} defaultValue={config ? settingValue(config, key) : ''} onBlur={event => { if (event.target.value !== '') nb.quickEdit(key, event.target.value) }} /></label>)}</div>
      {!config && <p className="wb-note" style={{ color: 'var(--wb-warning)' }}>{t('Finish valid JSON to enable these controls.')}</p>}
      <details className="text-xs"><summary className="cursor-pointer font-semibold" style={{ color: 'var(--wb-accent)' }}>{t('Proposal syntax and tool directory')}</summary>
        <p className="wb-note mt-2">{t('Turn types: tool with name and args; ask, compact and finish with text. Compaction retains pinned context and your authored summary. Later proposals are scripted and do not adapt to answers. Limits: 32 turns, 64 KiB JSON, bounded text and results. A failed tool call returns an error to the trace; it does not grant more permissions.')}</p>
        <table className="wb-table mt-2"><thead><tr><th scope="col">{t('Tool')}</th><th scope="col">{t('Required scope')}</th></tr></thead><tbody>{TOOLS.map(tool => <tr key={tool.name}><td className="wb-mono">{tool.name}{tool.write ? ' ✎' : ''}<span className="block" style={{ color: 'var(--wb-muted)' }}>{tool.fields.join(', ') || '—'}</span></td><td className="wb-mono">{tool.scope}</td></tr>)}</tbody></table>
        <p className="wb-note mt-2">{t('✎ marks tools that pause for approval.')} {t('MCP fixture: in-memory subset pinned to 2025-11-25; initialize, notifications/initialized, tools/list, tools/call, resources/list, resources/read, prompts/list and prompts/get. No transport, authentication or asynchronous task implementation.')}</p>
      </details>
    </div>
  </div>
  const changesView = <div className="flex min-h-0 flex-1 flex-col" hidden={side !== 'changes'}>
    <div className="wb-side-title"><h2>{t('Changes')}</h2></div>
    <div className="wb-scroll">
      {!run ? <p className="wb-note px-3">{t('Run the agent to see what it changes in the fictional workspace and issue tracker.')}</p> : <>
        <div className="wb-section-title">{t('Virtual workspace')}</div>
        {changes.length ? changes.map(item => fileRow(`diff:${item.name}`, <GitCompare size={14} style={{ color: item.status === 'A' ? 'var(--wb-success)' : 'var(--wb-warning)' }} />, item.name, item.status)) : <p className="wb-note px-5">{t('No files changed.')}</p>}
        <div className="wb-section-title mt-2">{t('Issue tracker')}</div>
        {newIssues.length ? newIssues.map(issue => fileRow('issues', <Inbox size={14} style={{ color: 'var(--wb-success)' }} />, `#${issue.id} ${issue.title}`, 'A')) : <p className="wb-note px-5">{t('No issues created.')}</p>}
      </>}
    </div>
  </div>

  const editors = <div className="wb-main" hidden={layout === 'narrow' && pane !== 'editor'}>
    <EditorTabs docs={docs} active={doc} label={docLabel} modified={id => modified[id]} fixed={['harness', 'skill', 'cli', 'notes']} onSelect={setDoc} onClose={close} prefix="wb-doc" />
    <div className="wb-crumbs">
      <span>{t(doc.startsWith('vfile:') || doc.startsWith('diff:') ? 'virtual workspace' : doc === 'issues' ? 'issue tracker' : 'notebook')} › <span style={{ color: 'var(--wb-text)' }}>{docLabel(doc)}</span></span>
      {doc === 'skill' && <><span className={`wb-chip ${skillLint.valid ? 'is-success' : 'is-warning'}`}>{t(skillLint.valid ? 'Lint: valid teaching subset' : '{count} lint findings', { count: skillLint.findings.length })}</span><button type="button" className="wb-button" onClick={() => downloadText(project.skill, 'SKILL.md')}><Download size={13} />{t('Download SKILL.md')}</button></>}
      {doc === 'cli' && <><label className="flex items-center gap-2">{t('Companion language')}<select className="wb-select" value={language} onChange={event => nb.setLanguage(event.target.value)}><option value="javascript">JavaScript / Node.js — {t('main path')}</option><option value="python">Python — {t('companion')}</option></select></label><button type="button" className="wb-button" onClick={() => downloadText(project[language], cliName)}><Download size={13} />{t('Download CLI source')}</button><span className="wb-note">{t('Native source: run it in your terminal. Browser runs use harness.json.')}</span></>}
      {doc === 'harness' && <span className="wb-note">{t('Ctrl/Cmd+Enter runs until the next pause.')}</span>}
      {(doc.startsWith('vfile:') || doc === 'issues' || doc.startsWith('diff:')) && <span className="wb-chip">{t('read-only')}</span>}
    </div>
    <div className="wb-editor-body" role="tabpanel" aria-labelledby={tabPanelId('wb-doc', doc)}>
      <div className="h-full" hidden={doc !== 'harness'}><CodeEditor label={t('Harness JSON')} value={project.source} tokenize={tokenizeJson} onChange={value => nb.edit({ source: value }, true)} onCursor={setCursor} onKeyDown={editorKeys} /></div>
      <div className="h-full" hidden={doc !== 'skill'}><CodeEditor label={t('Editable SKILL.md')} value={project.skill} tokenize={tokenizeMarkdown} onChange={value => nb.edit({ skill: value }, true)} onCursor={setCursor} onKeyDown={editorKeys} /></div>
      <div className="h-full" hidden={doc !== 'cli'}><CodeEditor label={t('Editable CLI source')} value={project[language]} tokenize={language === 'javascript' ? tokenizeJavascript : tokenizePython} onChange={value => nb.edit({ [language]: value })} onCursor={setCursor} onKeyDown={editorKeys} /></div>
      <div className="h-full" hidden={doc !== 'notes'}><CodeEditor label={t('Experiment notes')} value={project.notes} tokenize={tokenizeMarkdown} onChange={value => nb.edit({ notes: value })} onCursor={setCursor} onKeyDown={editorKeys} /></div>
      {docs.filter(id => id.startsWith('vfile:')).map(id => <div key={id} className="h-full" hidden={doc !== id}><CodeEditor label={t('{name} (virtual workspace, read-only)', { name: id.slice(6) })} value={files[id.slice(6)] ?? ''} tokenize={tokenizerFor(id.slice(6))} readOnly onCursor={setCursor} /></div>)}
      {docs.includes('issues') && <div className="h-full" hidden={doc !== 'issues'}><CodeEditor label={t('Fictional app issues')} value={JSON.stringify((run ?? fixture)?.issues ?? [], null, 2)} tokenize={tokenizeJson} readOnly onCursor={setCursor} /></div>}
      {docs.filter(id => id.startsWith('diff:')).map(id => { const name = id.slice(5); return <div key={id} className="h-full overflow-auto p-3" hidden={doc !== id}>
        <pre className="wb-pre" style={{ maxHeight: 'none' }} tabIndex={0} aria-label={t('Changes to {name}', { name })}>{lineDiff(baseFiles?.[name], run?.files[name]).map((row, index) => <span key={index} className={row.type === '+' ? 'wb-diff-add' : row.type === '-' ? 'wb-diff-del' : undefined}>{`${row.type} ${row.text}\n`}</span>)}</pre>
      </div> })}
    </div>
  </div>

  const panelTabs = [['problems', 'Problems', problems.length], ['trace', 'Trace', run?.trace.length ?? 0], ['ledger', 'Ledger', run?.ledger.length ?? 0], ['checks', 'Checks', checks ? `${checks.filter(item => item.passed).length}/${checks.length}` : 0], ['local', 'Run locally', 0]]
  const bottom = <div className="wb-panel" style={{ height: layout === 'narrow' ? '100%' : '34%' }} hidden={layout === 'narrow' && pane !== 'panel'}>
    <PanelTabs tabs={panelTabs} active={panel} onSelect={setPanel} label="Panel" />
    <div className="wb-panel-body" role="tabpanel" aria-labelledby={`wb-panel-${panel}`}>
      {panel === 'problems' && (problems.length ? <ul className="space-y-1">{problems.map((problem, index) => <li key={index}><button type="button" className="wb-tree-row" style={{ paddingLeft: 4 }} onClick={() => open(problem.doc)}><span style={{ color: 'var(--wb-warning)' }}>⚠</span><span className="wb-mono text-xs" style={{ color: 'var(--wb-muted)' }}>{problem.file}</span><span className="min-w-0 whitespace-normal">{t(problem.text)}</span></button></li>)}</ul> : <p className="wb-note">{t('No problems in harness.json or SKILL.md.')}</p>)}
      {panel === 'trace' && (run ? <ol className="space-y-2">{run.trace.map(item => <li key={item.index}><details className="wb-step"><summary><span className="wb-mono text-xs" style={{ color: 'var(--wb-accent)' }}>{item.index}. {item.type}</span><span className="wb-step-meta">{t('Turn')} {item.turn}{item.detail.name ? ` · ${item.detail.name}` : ''}</span></summary><div className="wb-step-body"><pre className="wb-pre" tabIndex={0}>{JSON.stringify(item.detail, null, 2)}</pre></div></details></li>)}</ol> : <p className="wb-note">{t('Observed events appear here after a run starts.')}</p>)}
      {panel === 'ledger' && (run ? <div className="overflow-x-auto"><table className="wb-table"><caption className="mb-2 text-left font-semibold">{t('Modeled request ledger')}</caption><thead><tr>{['Turn', 'Input', 'Cached subset', 'Output', 'Reserved output', 'Cost USD'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{run.ledger.map(row => <tr key={row.turn} className="wb-mono"><td>{row.turn}</td><td>{row.input}</td><td>{row.cached}</td><td>{row.output}</td><td>{row.reserved}</td><td>{row.costUsd.toFixed(6)}</td></tr>)}</tbody></table><p className="wb-note mt-2">{t('Hypothetical cost')}: ${run.totalUsd.toFixed(6)} · {t('Rates are hypothetical USD per million tokens.')}</p></div> : <p className="wb-note">{t('Each scripted model request adds a ledger row with modeled tokens and hypothetical cost.')}</p>)}
      {panel === 'checks' && <div className="space-y-3">
        <p className="wb-note">{t('Run six independent positive and negative cases against the harness. These checks test local execution boundaries, not live model quality or every possible plan.')}</p>
        <button type="button" className="wb-button" onClick={nb.runChecks}><ListChecks size={13} />{t('Run regression checks')}</button>
        {checks && <div aria-label={t('Regression results')} role="region"><p role="status" className="mb-2 font-semibold">{checks.filter(item => item.passed).length}/{checks.length} {t('checks passed')}</p>{checks.map(item => <details key={item.name} className="wb-step mt-2"><summary><span style={{ color: item.passed ? 'var(--wb-success)' : 'var(--wb-danger)' }} className="wb-mono text-xs font-bold">{item.passed ? 'PASS' : 'FAIL'}</span><span className="wb-step-title">{t(item.name)}</span></summary><div className="wb-step-body"><pre className="wb-pre" tabIndex={0}>{JSON.stringify(item.trace, null, 2)}</pre></div></details>)}</div>}
      </div>}
      {panel === 'local' && <div className="space-y-3">
        <p className="wb-note">{t('Edit and download a working CLI. Run native source in your own terminal; browser Run uses the separate JSON fixture. Both companions include an offline demo, self-tests, virtual tools, human questions and approval. Live model calls and a read-only GitHub integration are opt-in.')}</p>
        <pre className="wb-pre" tabIndex={0}>{language === 'javascript' ? '# Node.js 22+; no packages required\nnode agent.mjs --self-test\nnode agent.mjs --demo' : '# Python 3.11+; standard library only\npython3 agent.py --self-test\npython3 agent.py --demo'}</pre>
        <p className="wb-note">{t('The demo asks for a title and requires typing yes before its virtual write. It does not save host files. The virtual tools are an application boundary, not an OS sandbox.')}</p>
        <details className="text-xs"><summary className="cursor-pointer font-semibold" style={{ color: 'var(--wb-accent)' }}>{t('Connect a real model and GitHub from your terminal')}</summary><p className="wb-note mt-2">{t('Set OPENAI_API_KEY and OPENAI_MODEL privately in your terminal environment. Choose a model available to your account using current official documentation. Never paste credentials into this notebook. Live mode can incur API charges: at most eight requests with 800 output tokens each, no automatic retries, and no hard dollar cap.')}</p><pre className="wb-pre mt-2" tabIndex={0}>{`${language === 'javascript' ? 'node agent.mjs' : 'python3 agent.py'} --live "Read report.txt and draft an issue; ask before writing."\n\n# Optional: configure GITHUB_REPOSITORY=owner/repo\n# and GITHUB_TOKEN if the repository requires it.\n${language === 'javascript' ? 'node agent.mjs' : 'python3 agent.py'} --live --github "Summarize repository issues; do not write."`}</pre></details>
        <a href="/ai-agents/agents-cli" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline" style={{ color: 'var(--wb-accent)' }}>{t('Read the CLI capstone')}</a>
      </div>}
    </div>
  </div>

  const artifacts = [['plan', 'Plan'], ['changes', 'Changes'], ['ledger', 'Ledger'], ['context', 'Context']]
  // Count only artifacts with content: the scripted plan, then outputs of the current run.
  const artifactCount = [config || run, changes.length + newIssues.length, run?.ledger.length, run].filter(Boolean).length
  const artifactPane = <section className="wb-agent min-h-0" style={{ width: layout === 'wide' ? 340 : layout === 'medium' ? 300 : undefined, flexShrink: 0, borderLeft: '1px solid var(--wb-border)' }} aria-labelledby="wb-artifacts-title" hidden={layout === 'narrow' && pane !== 'artifacts'}>
    <header className="wb-agent-head"><h2 id="wb-artifacts-title">{t('Artifacts')}</h2><span className="wb-chip">{t(artifactCount === 1 ? '1 artifact' : '{count} artifacts', { count: artifactCount })}</span></header>
    <PanelTabs tabs={artifacts.map(([id, label]) => [id, label, 0, !run && id !== 'plan'])} active={artifact} onSelect={setArtifact} label="Artifacts" prefix="wb-artifact" />
    <div className="wb-panel-body" role="tabpanel" aria-labelledby={`wb-artifact-${artifact}`}>
      {artifact === 'plan' && <><p className="wb-note mb-2">{t('The scripted turns in harness.json, with the state each reached in this run.')}</p><PlanList run={run} config={config} /><button type="button" className="wb-button mt-3" onClick={() => open('harness')}>{t('Open harness.json')}</button></>}
      {artifact === 'changes' && run && <div className="space-y-3">{changes.length ? changes.map(item => <div key={item.name}><p className="wb-mono mb-1 text-xs">{item.status} {item.name}</p><pre className="wb-pre" tabIndex={0}>{lineDiff(baseFiles?.[item.name], run.files[item.name]).map((row, index) => <span key={index} className={row.type === '+' ? 'wb-diff-add' : row.type === '-' ? 'wb-diff-del' : undefined}>{`${row.type} ${row.text}\n`}</span>)}</pre></div>) : <p className="wb-note">{t('No files changed.')}</p>}{newIssues.map(issue => <p key={issue.id} className="wb-note">+ #{issue.id} {issue.title}</p>)}</div>}
      {artifact === 'ledger' && run && <table className="wb-table"><thead><tr>{['Turn', 'Input', 'Output', 'Cost USD'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{run.ledger.map(row => <tr key={row.turn} className="wb-mono"><td>{row.turn}</td><td>{row.input}</td><td>{row.output}</td><td>{row.costUsd.toFixed(6)}</td></tr>)}</tbody></table>}
      {artifact === 'context' && run && <ul className="space-y-2">{contextRows(run).map(item => <li key={item.id} className="wb-step p-2"><p className="wb-mono text-xs"><span style={{ color: 'var(--wb-accent)' }}>{item.id}</span> · {item.tokens} {t('tokens')}{item.pinned ? ` · ${t('pinned')}` : ''}</p><p className="wb-note mt-1 break-words">{item.text.length > 240 ? `${item.text.slice(0, 239)}…` : item.text}</p></li>)}</ul>}
    </div>
  </section>

  const conversations = <aside className="wb-side min-h-0" style={{ width: layout === 'narrow' ? '100%' : 260 }} aria-label={t('Conversations')} hidden={layout === 'narrow' && pane !== 'conversations'}>
    <div className="wb-side-title"><h2>{t('Conversations')}</h2></div>
    <div className="px-3 pb-2"><button type="button" className="wb-button w-full" onClick={nb.newRun}><Plus size={14} />{t('Start conversation')}</button></div>
    <div className="wb-scroll">{STAGES.map(([range, title, from, to]) => <div key={range}>
      <p className="wb-section-title">{range} · {t(title)}</p>
      {AGENT_COURSES.filter(course => course.order >= from && course.order <= to).map(course => <button key={course.id} type="button" className="wb-tree-row" style={{ paddingLeft: 12 }} aria-current={course.id === project.lesson ? 'true' : undefined} onClick={() => course.id !== project.lesson && nb.propose(createProject(course.id))}><Bot size={14} style={{ color: course.id === project.lesson ? 'var(--wb-accent)' : 'var(--wb-faint)' }} /><span className="min-w-0 flex-1 whitespace-normal leading-snug">{course.title}</span>{savedLessons.has(course.id) && <span className="wb-meta" title={t('A saved notebook exists in this browser')}>{t('saved')}</span>}</button>)}
    </div>)}</div>
    <div className="border-t px-1 py-1" style={{ borderColor: 'var(--wb-border)' }}><div className="wb-section-title">{t('Notebook')}{notebookActions}</div>{savedNote}</div>
  </aside>

  const activity = [['explorer', Files, 'Explorer', 0], ['settings', SlidersHorizontal, 'Harness settings', 0], ['changes', GitCompare, 'Changes', changes.length + newIssues.length]]
  const status = run?.status ?? 'ready'
  return <div ref={root} className="wb-ide" data-theme={theme} data-view={view} data-layout={layout} data-agent-lesson={project.lesson} onKeyDown={keys}>
    <div className="wb-titlebar">
      <span className="wb-brand"><span className="wb-brand-mark"><Bot size={13} /></span>{t('Agent IDE')}</span>
      <div className="wb-views" role="tablist" aria-label={t('IDE view')}>{[['editor', 'Editor'], ['manager', 'Agent Manager']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={view === id} title={t('Ctrl/Cmd+E switches views')} onClick={() => { setView(id); setPane(id === 'editor' ? 'editor' : 'thread') }}>{t(label)}</button>)}</div>
      <label className="flex min-w-0 items-center gap-2"><span className="sr-only">{t('Choose an AI agent tutorial')}</span><select className="wb-select" aria-label={t('Choose an AI agent tutorial')} value={project.lesson} onChange={event => nb.propose(createProject(event.target.value))}>{AGENT_COURSES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <span className="ml-auto flex items-center gap-2">
        <span className="wb-chip is-accent" title={t('Proposals come from harness.json; no API key, paid inference or network is used.')}>{t('Model: scripted fixture')}</span>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </span>
    </div>
    {layout === 'narrow' && <div className="wb-switch" role="tablist" aria-label={t('IDE panels')}>{(view === 'editor' ? [['side', 'Files'], ['editor', 'Editor'], ['agent', 'Agent'], ['panel', 'Panel']] : [['conversations', 'Conversations'], ['thread', 'Thread'], ['artifacts', 'Artifacts']]).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={pane === id} onClick={() => setPane(id)}>{t(label)}</button>)}</div>}
    {view === 'editor' ? <div className="wb-body">
      {layout !== 'narrow' && <nav className="wb-activity" aria-label={t('Activity bar')}>{activity.map(([id, Icon, label, count]) => <button key={id} type="button" aria-label={t(label)} title={t(label)} aria-pressed={side === id} onClick={() => toggleSide(id)}><Icon size={18} />{count ? <span className="wb-count">{count}</span> : null}</button>)}</nav>}
      {(layout !== 'medium' || side) && <aside className="wb-side" style={{ width: layout === 'narrow' ? '100%' : 250 }} aria-label={t('Side bar')} hidden={layout === 'narrow' && pane !== 'side'}>
        {layout === 'narrow' && <div className="wb-switch">{activity.map(([id, , label]) => <button key={id} type="button" aria-selected={side === id} onClick={() => setSide(id)}>{t(label)}</button>)}</div>}
        {explorer}{settings}{changesView}
      </aside>}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" hidden={layout === 'narrow' && !['editor', 'panel'].includes(pane)}>{editors}{bottom}</div>
      <div className="flex min-h-0 flex-col" style={{ width: layout === 'wide' ? 380 : layout === 'medium' ? 320 : '100%', flexShrink: 0, borderLeft: layout === 'narrow' ? 0 : '1px solid var(--wb-border)' }} hidden={layout === 'narrow' && pane !== 'agent'}>
        <AgentThread nb={nb} title="Agent" onOpenPlan={() => open('harness')} />
      </div>
    </div> : <div className="wb-body">
      {conversations}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" hidden={layout === 'narrow' && pane !== 'thread'}><AgentThread nb={nb} title="Conversation" showPlan={false} /></div>
      {artifactPane}
    </div>}
    <footer className="wb-status">
      <button type="button" className={problems.length ? 'is-warn' : 'is-ok'} onClick={() => { setView('editor'); setPanel('problems'); if (layout === 'narrow') setPane('panel') }}>{problems.length ? `⚠ ${t(problems.length === 1 ? '1 problem' : '{count} problems', { count: problems.length })}` : `✓ ${t('No problems')}`}</button>
      <span className={status === 'stopped' ? 'is-danger' : ['approval', 'question'].includes(status) ? 'is-warn' : undefined}>{t('Agent')}: {t({ ready: run ? 'ready' : 'not started', approval: 'waiting for approval', question: 'waiting for your answer', completed: 'completed', stopped: 'stopped' }[status] ?? status)}</span>
      <div className="wb-status-right">
        {view === 'editor' && <span>{t('Ln {line}, Col {column}', cursor)}</span>}
        <span>{docLabel(doc)}</span>
        <span>{t('Scripted fixture · no network')}</span>
      </div>
    </footer>
    <input className="sr-only" ref={nb.inputRef} type="file" accept=".json,application/json" aria-label={t('Import AI agent notebook file')} onChange={nb.importFile} tabIndex={-1} />
    <Modal open={Boolean(nb.pending)} onClose={() => nb.setPending(null)} title={t('Replace AI agent notebook?')} description={t('This replaces the JSON, skill, both CLI sources and notes, and clears run evidence. Save or export first to keep your current work.')} footer={<><Button variant="secondary" onClick={() => nb.setPending(null)}>{t('Cancel')}</Button><Button onClick={() => nb.replace(nb.pending)}>{t('Replace notebook')}</Button></>}><p className="text-sm">{AGENT_COURSES.find(item => item.id === nb.pending?.lesson)?.title}</p></Modal>
  </div>
}

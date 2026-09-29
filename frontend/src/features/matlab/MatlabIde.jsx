import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChartLine, ChevronDown, ChevronRight, CircleHelp, Download, Eraser, FileCode, FilePlus, FileText, Folder, FolderOpen, History, IndentDecrease, IndentIncrease, Play, Save, Search, Square, Trash2 } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { Button, Modal } from '../../ui/index.js'
import { downloadText } from '../../lib/download.js'
import { formatNumber } from '../../engine/matlab/model.js'
import CodeEditor from '../sandbox/ide/CodeEditor.jsx'
import { applyLineEdit, commentLine, indentLine, outdentLine, uncommentLine } from '../sandbox/ide/textEdits.js'
import { useElementWidth } from '../sandbox/ide/useElementWidth.js'
import { MATLAB_COURSES, createMatlabProject } from './project.js'
import { useMatlabNotebook } from './useMatlabNotebook.js'
import { analyzeMatlab, desktopFileName, folderName, scriptFileName, tokenizeMatlab } from './matlabSyntax.js'
import MatlabFigure from './MatlabFigure.jsx'
import MatlabHelp from './MatlabHelp.jsx'
import { useUnsavedBenchWork } from '../sandbox/benchGuard.js'
import './matlab-ide.css'

const bytes = text => new TextEncoder().encode(text).length
const errorLine = message => { const match = /^Line (\d+):/.exec(message ?? ''); return match ? Number(match[1]) : null }
/** How the Command Window keeps a workspace; shown on its title bar and in README.txt. */
export const REPLAY_NOTE = 'Each command re-runs the last Run of the script plus the commands entered since, then shows only the new output. Commands that raise an error are not kept. The five-second, 200-output and operation limits apply to the whole session. Before the first Run, commands start from an empty workspace.'
const PANES = [['editor', 'Editor'], ['command', 'Command Window'], ['workspace', 'Workspace'], ['figures', 'Figures'], ['folder', 'Current Folder']]
const REASONS = {
  preset: ['This replaces the current script and notes and clears computed results. Export or save your work first if you need to keep it.', 'Replace notebook'],
  reset: ['This restores the original example script and clears your notes and computed results. Export or save your work first if you need to keep it.', 'Replace notebook'],
  load: ['This opens the notebook saved in this browser, replacing the current script and notes and clearing computed results.', 'Replace notebook'],
  import: ['This replaces the current script and notes with the imported notebook and clears computed results. Results stored in the file are ignored.', 'Replace notebook'],
  script: ['This replaces the editor script with the opened .m file and clears computed results. Notes are kept.', 'Replace script'],
  new: ['This replaces the editor script with an empty script and clears computed results. Notes are kept.', 'Replace script'],
}

/** Workspace Value column, following the desktop display for small arrays. */
function workspaceValue(value) {
  if (value.rows === undefined) return value.text
  const count = value.rows * value.cols
  if (!count) return '[]'
  if (count === 1) return formatNumber(value.values[0])
  const shown = value.values.map(formatNumber)
  if ((value.rows === 1 || value.cols === 1) && count <= 10) return `[${shown.join(value.rows === 1 ? ',' : ';')}]`
  if (value.rows <= 3 && value.cols <= 3) return `[${Array.from({ length: value.rows }, (_, r) => Array.from({ length: value.cols }, (_, c) => shown[c * value.rows + r]).join(',')).join(';')}]`
  return `${value.rows}×${value.cols} ${value.type}`
}
/** Command Window display of one printed entry: `name =` blocks get the desktop's blank line and indent. */
export function displayEntry(text) {
  const match = /^([A-Za-z]\w*) =\n/.exec(text)
  return match ? `${match[1]} =\n\n${text.slice(match[0].length).split('\n').map(line => `    ${line}`).join('\n')}` : text
}
const workspaceClass = value => value.type === 'function' ? 'function_handle' : value.type
const workspaceSize = value => value.rows === undefined ? (value.type === 'function' ? '1×1' : '—') : `${value.rows}×${value.cols}`

function readme(course) {
  const acceptance = course.challenge?.acceptance?.map(item => `- ${item}`).join('\n') ?? ''
  return [course.title, '', course.summary, '', 'Guided experiment', ...course.steps.map((step, i) => `${i + 1}. ${step}`), '',
    'Expected result for the original example', course.expected, '', 'Applied challenge', course.challenge?.task ?? '', acceptance, '',
    'Command Window', REPLAY_NOTE].join('\n').trim()
}

function Pane({ id, title, icon, actions, className = '', style, children, hidden }) {
  return <section className={`ml-pane ${className}`} style={style} aria-labelledby={`${id}-title`} hidden={hidden}>
    <header className="ml-pane-title">{icon}<h2 id={`${id}-title`}>{title}</h2>{actions}</header>
    {children}
  </section>
}
function Big({ icon, label, className = '', ...props }) {
  return <button type="button" className={`ml-big ${className}`} {...props}>{icon}<span>{label}</span></button>
}
function Small({ icon, label, ...props }) {
  return <button type="button" className="ml-small" {...props}>{icon}<span>{label}</span></button>
}
function Group({ label, children }) {
  return <div className="ml-group" role="group" aria-label={label}><div className="ml-group-body">{children}</div><div className="ml-group-label" aria-hidden="true">{label}</div></div>
}

/**
 * MATLAB-style desktop for the MATLAB sandbox bench. It is a view on useMatlabNotebook: the same
 * notebook format, confirmations and invalidation rules as the course lab, executed by the
 * browser MATLAB-style subset rather than MATLAB.
 */
export default function MatlabIde({ initialLesson }) {
  const { t } = useI18n()
  const nb = useMatlabNotebook({ initialLesson, free: true })
  const { project, course, result, running } = nb
  const root = useRef(null), editor = useRef(null), prompt = useRef(null), scriptFile = useRef(null), transcriptRef = useRef(null), sessionStart = useRef(new Date())
  const width = useElementWidth(root)
  const layout = width >= 1100 ? 'wide' : width >= 760 ? 'medium' : 'narrow'
  const [ribbon, setRibbon] = useState('editor')
  const [docs, setDocs] = useState(['script', 'notes'])
  const [doc, setDoc] = useState('script')
  const [file, setFile] = useState('script')
  const [lower, setLower] = useState('figures')
  const [pane, setPane] = useState('editor')
  const [drawer, setDrawer] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [selection, setSelection] = useState([])
  const [command, setCommand] = useState('')
  const [recall, setRecall] = useState(null)
  const [helpQuery, setHelpQuery] = useState('')
  const [figureKey, setFigureKey] = useState(0)
  const [replayInfo, setReplayInfo] = useState(false)
  const code = useDeferredValue(project.code)
  const issues = useMemo(() => analyzeMatlab(code), [code])
  const errors = issues.filter(issue => issue.severity === 'error'), warnings = issues.filter(issue => issue.severity === 'warning')
  const runLine = errorLine(nb.error)
  const markers = useMemo(() => [...issues, ...(runLine ? [{ line: runLine, severity: 'error' }] : [])], [issues, runLine])
  const fileName = scriptFileName(project.lesson), folder = folderName(course)
  const workspace = useMemo(() => [...(result?.workspace ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })), [result])
  const chosen = selection.map(name => workspace.find(value => value.name === name)).filter(Boolean)
  const vectors = chosen.every(value => value.rows !== undefined && (value.rows === 1 || value.cols === 1) && value.rows * value.cols > 0)
  const plotReady = !running && vectors && (chosen.length === 1 || (chosen.length === 2 && chosen[0].rows * chosen[0].cols === chosen[1].rows * chosen[1].cols))
  const plots = result?.plots ?? []

  useEffect(() => { const node = transcriptRef.current; if (node) node.scrollTop = node.scrollHeight }, [nb.transcript])
  useEffect(() => { setSelection(previous => previous.filter(name => result?.workspace.some(value => value.name === name))) }, [result])
  // Replayed Command Window results carry the same plots; only a changed figure brings Figures forward.
  const plotSignature = useMemo(() => result?.plots.length ? JSON.stringify([result.plots, result.labels]) : '', [result])
  const shownPlots = useRef('')
  useEffect(() => { if (plotSignature && plotSignature !== shownPlots.current) { setLower('figures'); setFigureKey(key => key + 1) } shownPlots.current = plotSignature }, [plotSignature])
  useEffect(() => { setDocs(['script', 'notes']); setDoc('script'); setFile('script'); setSelection([]) }, [project.lesson])

  function open(id) { setDocs(previous => previous.includes(id) ? previous : [...previous, id]); setDoc(id); setFile(id === 'help' ? file : id); if (layout === 'narrow') setPane('editor'); setDrawer(false) }
  function close(id) { setDocs(previous => previous.filter(item => item !== id)); if (doc === id) setDoc('script') }
  function run() { if (layout === 'narrow') setPane('command'); void nb.run() }
  function execute(text) { if (layout === 'narrow') setPane('command'); setRecall(null); void nb.runCommand(text) }
  function lineEdit(transform) { if (doc !== 'script') open('script'); applyLineEdit(editor.current?.element(), transform) }
  function editorKeys(event) {
    const mod = event.ctrlKey || event.metaKey
    if ((mod && event.key === 'Enter') || event.key === 'F5') { event.preventDefault(); run() }
    else if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); nb.save() }
    else if (event.ctrlKey && event.key === ']') { event.preventDefault(); lineEdit(indentLine(4)) }
    else if (event.ctrlKey && event.key === '[') { event.preventDefault(); lineEdit(outdentLine(4)) }
  }
  function promptKeys(event) {
    const history = nb.history
    if (event.key === 'ArrowUp' && history.length) {
      event.preventDefault()
      const next = recall === null ? history.length - 1 : Math.max(0, recall - 1)
      setRecall(next); setCommand(history[next].text)
    } else if (event.key === 'ArrowDown' && recall !== null) {
      event.preventDefault()
      const next = recall + 1
      if (next >= history.length) { setRecall(null); setCommand('') } else { setRecall(next); setCommand(history[next].text) }
    } else if (event.key === 'Escape') { setCommand(''); setRecall(null) }
  }
  function submit(event) {
    event.preventDefault()
    if (!command.trim() || running) return
    execute(command); setCommand('')
  }
  function toggle(name, additive) {
    setSelection(previous => previous.includes(name) ? previous.filter(item => item !== name) : additive ? [...previous, name].slice(-2) : [name])
  }
  function goTo(line) { open('script'); requestAnimationFrame(() => editor.current?.goToLine(line)) }

  const fileGroup = <Group label={t('File')}>
    <Big icon={<FilePlus size={22} className="text-[var(--ml-accent)]" />} label={t('New Script')} onClick={() => nb.propose({ ...project, code: '' }, 'new')} />
    <Big icon={<FolderOpen size={22} className="text-amber-600" />} label={t('Open')} aria-label={t('Open .m script')} onClick={() => scriptFile.current?.click()} />
    <Big icon={<Save size={22} className="text-[var(--ml-accent)]" />} label={t('Save')} aria-label={t('Save notebook')} onClick={nb.save} />
    <div className="ml-smalls">
      <Small icon={<FolderOpen size={14} />} label={t('Load saved notebook')} onClick={nb.load} />
      <Small icon={<FileText size={14} />} label={t('Import notebook')} onClick={() => nb.fileRef.current?.click()} />
      <Small icon={<Download size={14} />} label={t('Export notebook')} onClick={nb.exportNotebook} />
      <Small icon={<FileCode size={14} />} label={t('Download .m script')} onClick={nb.downloadScript} />
      <Small icon={<FilePlus size={14} />} label={t('Reset notebook')} onClick={() => nb.propose(createMatlabProject(project.lesson), 'reset')} />
    </div>
  </Group>
  const ribbons = {
    home: <>
      {fileGroup}
      <Group label={t('Variable')}><Big icon={<Eraser size={22} className="text-[var(--ml-accent)]" />} label={t('Clear Workspace')} disabled={running} onClick={() => execute('clear')} /></Group>
      <Group label={t('Code')}><Big icon={<Trash2 size={22} className="text-slate-600" />} label={t('Clear Commands')} onClick={nb.clearCommands} /></Group>
      <Group label={t('Resources')}>
        <Big icon={<CircleHelp size={22} className="text-[var(--ml-accent)]" />} label={t('Help')} onClick={() => open('help')} />
        <div className="ml-smalls">
          <a className="ml-small" href={`/matlab/${project.lesson}`} target="_blank" rel="noopener noreferrer"><BookOpen size={14} /><span>{t('Open the course')}</span></a>
          <a className="ml-small" href="/matlab#function-reference" target="_blank" rel="noopener noreferrer"><Search size={14} /><span>{t('Reference page')}</span></a>
        </div>
      </Group>
    </>,
    editor: <>
      {fileGroup}
      <Group label={t('Code')}>
        <div className="ml-smalls">
          <Small icon={<span className="ml-glyph">%</span>} label={t('Comment')} aria-label={t('Comment selected lines')} onClick={() => lineEdit(commentLine('%'))} />
          <Small icon={<span className="ml-glyph line-through">%</span>} label={t('Uncomment')} aria-label={t('Uncomment selected lines')} onClick={() => lineEdit(uncommentLine('%'))} />
          <Small icon={<IndentIncrease size={14} />} label={t('Indent')} aria-label={t('Indent selected lines')} onClick={() => lineEdit(indentLine(4))} />
          <Small icon={<IndentDecrease size={14} />} label={t('Outdent')} aria-label={t('Outdent selected lines')} onClick={() => lineEdit(outdentLine(4))} />
        </div>
      </Group>
      <Group label={t('Run')}>
        <Big icon={<Play size={22} className="ml-run" fill="currentColor" />} label={t('Run')} aria-label={t('Run script')} title={t('Run {file} (F5 or Ctrl+Enter)', { file: fileName })} disabled={running} onClick={run} />
        <Big icon={<Square size={20} className="ml-stop" fill="currentColor" />} label={t('Stop')} aria-label={t('Stop script')} disabled={!running} onClick={nb.stop} />
        <p className="ml-note">{t('Each Run starts a fresh workspace in a browser Worker, limited to five seconds.')}</p>
      </Group>
    </>,
    plots: <>
      <Group label={t('Selection')}><p className="ml-note" aria-live="polite">{chosen.length ? t('Selected: {names}', { names: chosen.map(value => value.name).join(', ') }) : t('Select one or two vectors in the Workspace.')}</p></Group>
      <Group label={t('Plots')}><Big icon={<ChartLine size={22} className="text-[var(--ml-accent)]" />} label="plot" aria-label={t('Plot selected variables')} disabled={!plotReady} onClick={() => execute(`plot(${chosen.map(value => value.name).join(',')})`)} /></Group>
      <Group label={t('About')}><p className="ml-note">{t('plot(y) uses sample indices; plot(x, y) needs two vectors with the same number of elements. The command runs in the Command Window. This subset draws line plots only.')}</p></Group>
    </>,
  }
  const tabs = [['home', 'Home'], ['plots', 'Plots'], ['editor', 'Editor']]
  function tabKeys(event) {
    const index = tabs.findIndex(([id]) => id === ribbon)
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length][0]
      setRibbon(next); root.current?.querySelector(`#ml-tab-${next}`)?.focus()
    }
  }

  const docLabel = { script: fileName, notes: 'notes.txt', readme: 'README.txt', desktop: desktopFileName(project.lesson), help: t('Help') }
  const scriptDirty = project.code !== nb.baseline.code, notesDirty = project.notes !== nb.baseline.notes
  useUnsavedBenchWork(scriptDirty || notesDirty, 'MATLAB notebook')
  const files = [
    ['script', fileName, <FileCode key="i" size={14} className="text-[var(--ml-accent)]" />, `${project.code.split('\n').length} ${t('lines')}`],
    ['notes', 'notes.txt', <FileText key="i" size={14} className="text-slate-500" />, `${project.notes.length} ${t('chars')}`],
    ['readme', 'README.txt', <FileText key="i" size={14} className="text-slate-500" />, t('read-only')],
    ['desktop', desktopFileName(project.lesson), <FileCode key="i" size={14} className="text-amber-700" />, t('desktop')],
  ]
  const details = {
    script: [[t('Type'), t('MATLAB script (browser subset)')], [t('Size'), `${project.code.split('\n').length} ${t('lines')} · ${bytes(project.code)} ${t('bytes')}`], [t('Saved copy in this browser'), t(nb.storedState === 'none' ? 'None' : nb.storedState === 'same' ? 'Matches the editor' : 'Differs from the editor')], [t('Code check'), errors.length ? t(errors.length === 1 ? '1 error' : '{count} errors', { count: errors.length }) : warnings.length ? t(warnings.length === 1 ? '1 warning' : '{count} warnings', { count: warnings.length }) : t('No issues found')]],
    notes: [[t('Type'), t('Notebook notes')], [t('Size'), `${project.notes.length} ${t('chars')}`], [t('Saved with'), t('Save notebook')]],
    readme: [[t('Type'), t('Preset guide (read-only)')], [t('Source'), course.title]],
    desktop: [[t('Type'), t('Desktop MATLAB companion (read-only)')], [t('Requires'), course.desktop.products], [t('Browser Run'), t('Not executed in this sandbox')]],
  }[file] ?? []

  const folderPane = <Pane id="ml-folder" title={t('Current Folder')} icon={<Folder size={14} className="text-amber-600" />} className="h-full" actions={layout === 'medium' ? <button type="button" className="ml-pane-action" onClick={() => setDrawer(false)}>{t('Close')}</button> : null}>
    <div className="ml-pane-body">
      <ul className="ml-tree" aria-label={t('MATLAB preset folders')}>
        {MATLAB_COURSES.map(item => item.id === project.lesson ? <li key={item.id}>
          <div className="ml-tree-row font-semibold" aria-current="true"><ChevronDown size={13} /><FolderOpen size={14} className="text-amber-600" /><span className="truncate">{folderName(item)}</span></div>
          <ul>{files.map(([id, name, icon, meta]) => <li key={id}><button type="button" className="ml-tree-row pl-8" aria-pressed={file === id} onClick={() => setFile(id)} onDoubleClick={() => open(id)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); open(id) } }} title={t('Enter or double-click to open')}>{icon}<span className="truncate">{name}</span><span className="ml-tree-meta">{meta}</span></button></li>)}</ul>
        </li> : <li key={item.id}><button type="button" className="ml-tree-row" title={item.title} onClick={() => nb.propose(createMatlabProject(item.id), 'preset')}><ChevronRight size={13} /><Folder size={14} className="text-amber-600" /><span className="truncate">{folderName(item)}</span></button></li>)}
      </ul>
    </div>
    <dl className="ml-details" aria-label={t('Details')}>
      <p className="mb-1 font-semibold">{docLabel[file] ?? fileName}</p>
      {details.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
      <button type="button" className="ml-address-button mt-1" onClick={() => open(file)}>{t('Open')}</button>
    </dl>
  </Pane>

  const docTabs = <div className="ml-doc-tabs" role="tablist" aria-label={t('Open documents')}>
    {docs.map(id => <span key={id} className="inline-flex">
      <button type="button" role="tab" id={`ml-doc-${id}`} aria-selected={doc === id} className="ml-doc-tab" onClick={() => setDoc(id)}>{docLabel[id]}{(id === 'script' && scriptDirty) || (id === 'notes' && notesDirty) ? <span aria-label={t('modified')}>*</span> : null}</button>
      {!['script', 'notes'].includes(id) && <button type="button" className="ml-pane-action" aria-label={t('Close {name}', { name: docLabel[id] })} onClick={() => close(id)}>×</button>}
    </span>)}
  </div>
  const infobar = nb.error
    ? <div role="alert" className="ml-infobar is-error"><span className="whitespace-pre-wrap break-words">{t(nb.error)}</span>{runLine && <button type="button" onClick={() => goTo(runLine)}>{t('Go to line {line}', { line: runLine })}</button>}</div>
    : <div role="status" className="ml-infobar is-status">{running ? t('Running script…') : nb.message ? t(nb.message) : null}</div>
  const editorPane = <Pane id="ml-editor" title={`${t('Editor')} – ${doc === 'help' ? docLabel.help : `${folder}/${docLabel[doc]}`}`} icon={<FileCode size={14} className="text-[var(--ml-accent)]" />} style={{ flex: '1.35 1 0%' }} hidden={layout === 'narrow' && pane !== 'editor'}>
    {docTabs}
    {infobar}
    <div className="ml-pane-body" role="tabpanel" aria-labelledby={`ml-doc-${doc}`}>
      <div className="h-full" hidden={doc !== 'script'}><CodeEditor ref={editor} label={t('Editable MATLAB script')} value={project.code} tokenize={tokenizeMatlab} markers={markers} onChange={value => nb.edit({ code: value }, true)} onCursor={setCursor} onKeyDown={editorKeys} /></div>
      <div className="h-full" hidden={doc !== 'notes'}><textarea aria-label={t('Experiment notes')} className="ml-plain" value={project.notes} spellCheck onChange={event => nb.edit({ notes: event.target.value })} placeholder={t('Record your prediction, observations and conclusion. Notes are saved with the notebook.')} /></div>
      {docs.includes('readme') && <div className="h-full" hidden={doc !== 'readme'}><textarea aria-label="README.txt" className="ml-plain" readOnly value={readme(course)} /></div>}
      {docs.includes('desktop') && <div className="flex h-full flex-col" hidden={doc !== 'desktop'}>
        <div className="ml-infobar"><span>{t('Desktop MATLAB companion (read-only). Requires: {products}.', { products: course.desktop.products })} {course.desktop.explanation}</span><button type="button" onClick={() => downloadText(course.desktop.code, desktopFileName(project.lesson))}>{t('Download desktop example')}</button></div>
        <div className="min-h-0 flex-1"><CodeEditor label={t('Desktop MATLAB companion source')} value={course.desktop.code} tokenize={tokenizeMatlab} readOnly /></div>
      </div>}
      {docs.includes('help') && <div className="h-full" hidden={doc !== 'help'}><MatlabHelp query={helpQuery} onQuery={setHelpQuery} busy={running} onTry={execute} /></div>}
    </div>
  </Pane>

  const commandPane = <Pane id="ml-command" title={t('Command Window')} icon={<span className="ml-fx" aria-hidden="true">&gt;&gt;</span>} style={{ flex: '1 1 0%' }} hidden={layout === 'narrow' && pane !== 'command'} actions={<><button type="button" className="ml-pane-action" aria-expanded={replayInfo} aria-controls="ml-replay-note" onClick={() => setReplayInfo(value => !value)}>{t('Session replay')} ⓘ</button><button type="button" className="ml-pane-action" onClick={nb.clearCommands} title={t('Clear Commands')}>{t('clc')}</button></>}>
    {replayInfo && <p id="ml-replay-note" className="ml-infobar is-status">{t(REPLAY_NOTE)}</p>}
    <div className="ml-command">
      <div className="ml-transcript" role="log" aria-label={t('Command Window output')} tabIndex={0} ref={transcriptRef}>
        {!nb.transcript.length && !nb.history.length && <p className="ml-entry is-info">{t('Commands run against the workspace of the last Run. Type a statement, press Enter; ↑ and ↓ recall earlier commands.')}</p>}
        {nb.transcript.map(entry => <p key={entry.id} className={`ml-entry is-${entry.kind}`}>{entry.kind === 'input' ? `>> ${entry.text}` : entry.kind === 'output' ? displayEntry(entry.text) : entry.text}</p>)}
      </div>
      <form className="ml-prompt" onSubmit={submit}>
        <button type="button" className="ml-fx" aria-label={t('Browse functions')} title={t('Browse functions')} onClick={() => open('help')}>fx</button>
        <label><span aria-hidden="true">&gt;&gt;</span><input ref={prompt} aria-label={t('MATLAB command')} value={command} disabled={running} spellCheck={false} autoCapitalize="off" autoComplete="off" onChange={event => { setCommand(event.target.value); setRecall(null) }} onKeyDown={promptKeys} placeholder={running ? t('Busy…') : ''} /></label>
      </form>
    </div>
  </Pane>

  const workspacePane = <Pane id="ml-workspace" title={t('Workspace')} icon={<span className="ml-glyph text-[var(--ml-accent)]">x</span>} style={{ flex: '0.85 1 0%' }} hidden={layout === 'narrow' && pane !== 'workspace'} actions={<button type="button" className="ml-pane-action" aria-label={t('Export computed results')} title={t('Export computed results')} disabled={!result} onClick={nb.exportResults}><Download size={13} /></button>}>
    <div className="ml-pane-body" tabIndex={0} role="region" aria-label={t('Workspace variables')}>
      {running && !result ? <p className="ml-empty">{t('Busy…')}</p> : !workspace.length ? <p className="ml-empty">{t(result ? 'The workspace is empty.' : 'Run the script or enter a command to create variables.')}</p> : <table className="ml-table">
        <thead><tr><th scope="col"><span className="sr-only">{t('Select')}</span></th>{['Name', 'Value', 'Size', 'Class'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead>
        <tbody>{workspace.map(value => <tr key={value.name} aria-selected={selection.includes(value.name)} onClick={event => { if (event.target.type !== 'checkbox') toggle(value.name, event.ctrlKey || event.metaKey || event.shiftKey) }}>
          <td><input type="checkbox" aria-label={t('Select {name}', { name: value.name })} checked={selection.includes(value.name)} onChange={() => toggle(value.name, true)} /></td>
          <td className="ml-mono font-semibold">{value.name}</td><td className="ml-mono break-all">{workspaceValue(value)}{value.truncated ? ' …' : ''}</td><td className="whitespace-nowrap">{workspaceSize(value)}</td><td>{workspaceClass(value)}</td>
        </tr>)}</tbody>
      </table>}
      {workspace.some(value => value.truncated) && <p className="ml-empty">{t('Numeric previews show up to 256 values in column-major order. Dimensions describe the complete array.')}</p>}
    </div>
  </Pane>

  const lowerPane = <section className="ml-pane" style={{ flex: '1.25 1 0%' }} aria-label={t('Figures and command history')} hidden={layout === 'narrow' && pane !== 'figures'}>
    <div className="ml-lower-tabs" role="tablist" aria-label={t('Figures and command history')}>
      <button type="button" role="tab" id="ml-lower-figures" className="ml-lower-tab" aria-selected={lower === 'figures'} onClick={() => setLower('figures')}><ChartLine size={13} />{plots.length ? t('Figure 1') : t('Figures')}</button>
      <button type="button" role="tab" id="ml-lower-history" className="ml-lower-tab" aria-selected={lower === 'history'} onClick={() => setLower('history')}><History size={13} />{t('Command History')}</button>
    </div>
    <div className="ml-pane-body flex flex-col" role="tabpanel" aria-labelledby={`ml-lower-${lower}`}>
      {lower === 'figures' ? (plots.length ? <MatlabFigure key={figureKey} result={result} /> : <p className="ml-empty">{t(running ? 'Busy…' : 'No figure is open. A script or command opens Figure 1 when it calls plot.')}</p>)
        : <ol className="ml-tree font-mono" aria-label={t('Command History')}>
          <li className="px-2 py-1" style={{ color: 'var(--tok-comment)' }}>{`%-- ${sessionStart.current.toLocaleString()} --%`}</li>
          {nb.history.map(item => <li key={item.id}><button type="button" className="ml-tree-row" title={t('Click to edit at the prompt; double-click to run')} onClick={() => { setCommand(item.text); prompt.current?.focus() }} onDoubleClick={() => execute(item.text)}>{item.text}</button></li>)}
        </ol>}
    </div>
  </section>

  const codeCheck = errors.length ? { tone: 'is-error', text: t(errors.length === 1 ? '1 error' : '{count} errors', { count: errors.length }) } : warnings.length ? { tone: 'is-warning', text: t(warnings.length === 1 ? '1 warning' : '{count} warnings', { count: warnings.length }) } : { tone: '', text: t('No issues found') }
  const firstIssue = issues.find(issue => issue.line)
  const rightWidth = layout === 'wide' ? Math.min(460, Math.max(360, Math.round(width * 0.3))) : 300

  return <div ref={root} className="ml-ide" data-matlab-lesson={project.lesson} data-layout={layout}>
    <div className="ml-band">
      <div className="ml-tabs" role="tablist" aria-label={t('Toolstrip')} onKeyDown={tabKeys}>
        {/* MATLAB's own tab names, kept as the product shows them in every locale. */}
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" id={`ml-tab-${id}`} aria-selected={ribbon === id} aria-controls="ml-ribbon" tabIndex={ribbon === id ? 0 : -1} className="ml-tab" onClick={() => setRibbon(id)}>{label}</button>)}
      </div>
      <div className="ml-qat">
        <label className="ml-search"><Search size={13} /><span className="sr-only">{t('Search function reference')}</span><input type="search" placeholder={t('Search function reference')} value={helpQuery} onChange={event => { setHelpQuery(event.target.value); if (event.target.value) open('help') }} /></label>
        <button type="button" className="ml-qat-button" aria-label={t('Help')} title={t('Help')} onClick={() => open('help')}><CircleHelp size={15} /></button>
      </div>
    </div>
    <div className="ml-ribbon" id="ml-ribbon" role="tabpanel" aria-labelledby={`ml-tab-${ribbon}`}>{ribbons[ribbon]}</div>
    <div className="ml-address">
      {layout !== 'wide' && <button type="button" className="ml-address-button" aria-expanded={layout === 'medium' ? drawer : pane === 'folder'} onClick={() => layout === 'medium' ? setDrawer(value => !value) : setPane('folder')}><Folder size={13} className="text-amber-600" />{t('Current Folder')}</button>}
      <span className="ml-crumb">VoltQuest ▸ MATLAB ▸</span>
      <label className="flex min-w-0 items-center gap-2"><span className="sr-only">{t('Choose a MATLAB experiment')}</span>
        <select aria-label={t('Choose a MATLAB experiment')} value={project.lesson} onChange={event => nb.propose(createMatlabProject(event.target.value), 'preset')}>{MATLAB_COURSES.map(item => <option key={item.id} value={item.id}>{folderName(item)} — {item.title}</option>)}</select>
      </label>
      <span className="ml-crumb">▸ {fileName}</span>
    </div>
    {layout === 'narrow' && <div className="ml-pane-switch" role="tablist" aria-label={t('MATLAB panels')}>{PANES.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={pane === id} onClick={() => setPane(id)}>{t(label)}</button>)}</div>}
    <div className="ml-desktop">
      {layout === 'wide' && <div className="ml-column" style={{ width: 232, flexShrink: 0 }}>{folderPane}</div>}
      {layout === 'medium' && drawer && <div className="ml-drawer">{folderPane}</div>}
      {layout === 'narrow' ? <div className="ml-column flex-1">
        {pane === 'folder' && folderPane}
        {editorPane}{commandPane}{workspacePane}{lowerPane}
      </div> : <>
        <div className="ml-column flex-1">{editorPane}{commandPane}</div>
        <div className="ml-column" style={{ width: rightWidth, flexShrink: 0 }}>{workspacePane}{lowerPane}</div>
      </>}
    </div>
    <footer className="ml-status">
      <span className="ml-status-state"><span className={`ml-status-dot ${running ? 'is-busy' : ''}`} aria-hidden="true" />{t(running ? 'Busy' : 'Ready')}</span>
      <span>{t('MATLAB-style browser subset · not MATLAB')}</span>
      <div className="ml-status-right">
        {firstIssue ? <button type="button" className={`ml-code-check ${codeCheck.tone}`} title={`${t('Line')} ${firstIssue.line}: ${firstIssue.message}`} onClick={() => goTo(firstIssue.line)}>{t('Code check')}: {codeCheck.text}</button> : <span className={`ml-code-check ${codeCheck.tone}`}>{t('Code check')}: {codeCheck.text}</span>}
        {result && <span>{t('{count} operations', { count: result.operations.toLocaleString() })}</span>}
        <span>{doc === 'script' ? t('script') : docLabel[doc]}</span>
        <span>{t('Ln {line}, Col {column}', cursor)}</span>
      </div>
    </footer>
    <input ref={nb.fileRef} className="sr-only" type="file" accept=".json,application/json" aria-label={t('Import MATLAB notebook file')} onChange={nb.importFile} tabIndex={-1} />
    <input ref={scriptFile} className="sr-only" type="file" accept=".m,text/plain" aria-label={t('Open MATLAB script file')} onChange={nb.openScriptFile} tabIndex={-1} />
    <Modal open={Boolean(nb.pending)} onClose={nb.cancelPending} title={t('Replace MATLAB notebook?')} description={t(REASONS[nb.pendingReason]?.[0] ?? REASONS.preset[0])} footer={<><Button variant="secondary" onClick={nb.cancelPending}>{t('Cancel')}</Button><Button onClick={() => nb.replace(nb.pending)}>{t(REASONS[nb.pendingReason]?.[1] ?? 'Replace notebook')}</Button></>}>
      <p className="text-sm text-ink-secondary">{nb.pending && `${folderName(MATLAB_COURSES.find(item => item.id === nb.pending.lesson))} — ${MATLAB_COURSES.find(item => item.id === nb.pending.lesson)?.title}`}</p>
    </Modal>
  </div>
}

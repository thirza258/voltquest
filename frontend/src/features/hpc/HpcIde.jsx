import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Copy, Cpu, Download, FileCode2, FileJson, FileText, Files, FlaskConical, FolderOpen, GitCompare, NotebookPen, Play, RotateCcw, Save, Square, Upload } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { Button, Modal } from '../../ui/index.js'
import { readJson } from '../../lib/storage.js'
import { downloadBlob, downloadText } from '../../lib/download.js'
import { sourcePack } from '../../lib/sourcePack.js'
import { LABS } from '../../engine/hpc/model.js'
import CodeEditor from '../sandbox/ide/CodeEditor.jsx'
import { lineDiff } from '../sandbox/ide/lineDiff.js'
import { useElementWidth } from '../sandbox/ide/useElementWidth.js'
import { tokenizeC, tokenizeJson, tokenizeMarkdown } from '../sandbox/ide/tokenizers.js'
import { EditorTabs, PanelTabs, tabPanelId, ThemeToggle, useWorkbenchTheme } from '../sandbox/ide/Workbench.jsx'
import { createHpcProject, HPC_STORAGE_PREFIX, validateHpcProject } from './project.js'
import { exampleCode, MPI_LABS, nativeInstructions, OPENMP_LABS } from './examples.js'
import { useHpcNotebook } from './useHpcNotebook.js'
import { useUnsavedBenchWork } from '../sandbox/benchGuard.js'

const numberText = value => typeof value === 'number' ? Number.isInteger(value) ? String(value) : Number(value.toPrecision(7)).toString() : value
const LANGUAGE = { c: 'C17', cpp: 'C++17' }
/** Field-by-field equality, independent of key order (validateHpcProject may reorder keys). */
export const sameExperiment = (a, b) => Boolean(a && b) && a.lab === b.lab && a.language === b.language && a.notes === b.notes && a.sources.c === b.sources.c && a.sources.cpp === b.sources.cpp && Object.keys(a.parameters).length === Object.keys(b.parameters).length && Object.entries(a.parameters).every(([key, value]) => Object.is(value, b.parameters[key]))

/** BUILD.md: requirements and exact commands from the same generator the course and native checks use. */
export function buildGuide(labId, notes = '') {
  const c = nativeInstructions(labId, 'c'), cpp = nativeInstructions(labId, 'cpp')
  return [`# ${LABS[labId].title}`, '', cpp.requirements, '', '## Build and run on Linux or WSL', '', 'C++17:', '', `    ${cpp.build}`, `    ${cpp.run}`, '', 'C17:', '', `    ${c.build}`, `    ${c.run}`,
    ...(cpp.macBuild ? ['', '## macOS with Apple Clang and Homebrew libomp', '', `    ${cpp.macBuild}`, `    ${cpp.run}`] : []),
    '', '## Debug and performance reports', '', 'Debug check: replace -O3 with -O1 -g -fsanitize=address,undefined -fno-omit-frame-pointer and rerun the test cases.',
    'Clang vectorization: -Rpass=loop-vectorize -Rpass-missed=loop-vectorize. GCC: -fopt-info-vec-optimized -fopt-info-vec-missed.',
    '', '## Scope', '', 'The browser sandbox evaluates a bounded model or algorithm with the saved settings. It does not compile or time this source; collect native timings on your own system.',
    ...(notes.trim() ? ['', '## Notes', '', notes.trim()] : []), ''].join('\n')
}
export function buildScript(labId, language) {
  const commands = nativeInstructions(labId, language)
  return ['#!/usr/bin/env sh', `# ${LABS[labId].title}: ${LANGUAGE[language]} build from the VoltQuest HPC sandbox (Linux/WSL toolchain; see README.md for macOS).`, `# ${commands.requirements}`, 'set -eu', commands.build, commands.run, ''].join('\n')
}

function Results({ result }) {
  const { t } = useI18n()
  const barMax = Math.max(1, ...(result.bars ?? []).map(bar => bar.value))
  return <div className="space-y-3" aria-label={t('Experiment results')}>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{result.metrics.map(item => <div key={item.label} className="wb-card p-3"><p className="wb-note">{t(item.label)}</p><p className="wb-mono mt-1 text-lg tabular-nums" style={{ color: 'var(--wb-text)' }}>{numberText(item.value)} <span className="text-xs" style={{ color: 'var(--wb-muted)' }}>{item.unit}</span></p></div>)}</div>
    <ul className="space-y-1.5">{result.checks.map(item => <li key={item.label} className="wb-step p-2" style={{ borderColor: item.passed ? 'var(--wb-success-soft)' : 'var(--wb-danger-soft)' }}><strong style={{ color: item.passed ? 'var(--wb-success)' : 'var(--wb-danger)' }}>{t(item.passed ? 'PASS' : 'FAIL')}: {t(item.label)}</strong><p className="wb-note mt-1">{t(item.detail)}</p></li>)}</ul>
    {result.bars && <div className="flex h-28 items-end gap-1 overflow-hidden border-b px-1" style={{ borderColor: 'var(--wb-border)' }} role="img" aria-label={t('Relative values; exact values appear in the results table.')}>
      {result.bars.map((bar, i) => <div key={bar.label} title={`${bar.label}: ${numberText(bar.value)}`} className="min-w-0 flex-1" style={{ height: `${100 * bar.value / barMax}%`, minHeight: '1px', background: 'var(--wb-accent-fill)', opacity: i % 2 ? 0.7 : 1 }} />)}
    </div>}
    <div className="max-h-72 overflow-auto rounded-lg border" style={{ borderColor: 'var(--wb-border)' }} tabIndex={0} role="region" aria-label={t('Experiment data table')}><table className="wb-table"><caption className="sr-only">{t('Experiment data')}</caption><thead><tr>{result.columns.map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={index}>{row.map((value, i) => <td key={i} className="wb-mono tabular-nums">{typeof value === 'string' ? t(value) : numberText(value)}</td>)}</tr>)}</tbody></table></div>
    <p className="wb-note">{t(result.note)}</p>
  </div>
}

function Command({ label, text }) {
  const { t } = useI18n()
  return <div>
    <div className="mb-1 flex items-center gap-2"><p className="wb-note flex-1 font-semibold">{t(label)}</p><button type="button" className="wb-icon-button" aria-label={t('Copy {name}', { name: t(label) })} title={t('Copy')} onClick={() => navigator.clipboard?.writeText(text)}><Copy size={13} /></button></div>
    <pre className="wb-pre" tabIndex={0}>{text}</pre>
  </div>
}

/**
 * VS Code-style C/C++ workbench for the HPC sandbox. Browser Run evaluates the selected lab's
 * bounded model in a Worker; the editable C17/C++17 sources are built and timed on the learner's
 * own machine with the generated commands. The IDE never presents model output as hardware timing.
 */
export default function HpcIde({ initialLab }) {
  const { t } = useI18n()
  const nb = useHpcNotebook({ initialLab, free: true })
  const { project, lab, instructions, result, running } = nb
  const root = useRef(null)
  const width = useElementWidth(root)
  const layout = width >= 1100 ? 'wide' : width >= 760 ? 'medium' : 'narrow'
  const [theme, toggleTheme] = useWorkbenchTheme()
  const [side, setSide] = useState('explorer')
  const [docs, setDocs] = useState(['source', 'notes'])
  const [doc, setDoc] = useState('source')
  const [panel, setPanel] = useState('results')
  const [pane, setPane] = useState('editor')
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const example = exampleCode(project.lab, project.language)
  const sourceChanged = project.sources[project.language] !== example
  const stored = useMemo(() => {
    try { const value = readJson(HPC_STORAGE_PREFIX + project.lab); return value ? validateHpcProject(value, project.lab) : null } catch { return null }
    // The baseline changes on save and replace, which is when the stored copy can change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.lab, nb.baseline])
  const storedState = !stored ? 'none' : sameExperiment(stored, project) ? 'same' : 'different'
  const passed = result ? result.checks.filter(check => check.passed).length : 0
  const modified = { source: project.sources[project.language] !== nb.baseline.sources[project.language], notes: project.notes !== nb.baseline.notes }
  useUnsavedBenchWork(!sameExperiment(project, nb.baseline), 'HPC experiment')
  const labels = { source: instructions.file, notes: 'NOTES.md', build: 'BUILD.md', config: 'run-configuration.json', diff: `${instructions.file} ↔ ${t('example')}` }
  const parallel = OPENMP_LABS.includes(project.lab) ? 'OpenMP' : MPI_LABS.includes(project.lab) ? 'MPI' : null

  useEffect(() => { if (layout === 'medium') setSide(null); else setSide(value => value ?? 'explorer') }, [layout])
  useEffect(() => { setDocs(['source', 'notes']); setDoc('source') }, [project.lab])
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  // A new result or error brings Results forward; resizing the window does not.
  useEffect(() => { if (result || nb.error) { setPanel('results'); if (layoutRef.current === 'narrow') setPane('panel') } }, [result, nb.error])

  function open(id) { setDocs(previous => previous.includes(id) ? previous : [...previous, id]); setDoc(id); if (layout === 'narrow') setPane('editor') }
  function close(id) { setDocs(previous => previous.filter(item => item !== id)); if (doc === id) setDoc('source') }
  function openSource(language) { if (language !== project.language) nb.edit({ language }); open('source') }
  function editorKeys(event) {
    const mod = event.ctrlKey || event.metaKey
    if ((mod && event.key === 'Enter') || event.key === 'F5') { event.preventDefault(); if (!running) void nb.run() }
    else if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); nb.save() }
  }
  function downloadProject() {
    const files = { [`${project.lab}.c`]: project.sources.c, [`${project.lab}.cpp`]: project.sources.cpp, 'build.sh': buildScript(project.lab, project.language), 'README.md': buildGuide(project.lab, project.notes) }
    downloadBlob(sourcePack(files), `hpc-${project.lab}.zip`)
  }
  const toggleSide = id => { setSide(value => value === id && layout !== 'wide' ? null : id); if (layout === 'narrow') setPane('side') }

  const row = (key, icon, name, meta, onClick, current) => <button key={key} type="button" className="wb-tree-row" aria-current={current ? 'true' : undefined} onClick={onClick}>{icon}<span className="truncate">{name}</span><span className="wb-meta">{meta}</span></button>
  const explorer = <div className="flex min-h-0 flex-1 flex-col" hidden={side !== 'explorer'}>
    <div className="wb-side-title"><h2>{t('Explorer')}</h2></div>
    <div className="wb-scroll">
      <div className="wb-section-title"><ChevronDown size={13} />{project.lab}<span className="ml-auto flex">
        <button type="button" className="wb-icon-button" aria-label={t('Save experiment')} title={t('Save experiment')} onClick={nb.save}><Save size={14} /></button>
        <button type="button" className="wb-icon-button" aria-label={t('Load saved experiment')} title={t('Load saved experiment')} onClick={nb.loadSaved}><FolderOpen size={14} /></button>
        <button type="button" className="wb-icon-button" aria-label={t('Import experiment')} title={t('Import experiment')} onClick={() => nb.fileRef.current?.click()}><Upload size={14} /></button>
        <button type="button" className="wb-icon-button" aria-label={t('Export experiment')} title={t('Export experiment')} onClick={nb.exportProject}><Download size={14} /></button>
        <button type="button" className="wb-icon-button" aria-label={t('Reset experiment')} title={t('Reset experiment')} onClick={() => nb.propose(createHpcProject(project.lab))}><RotateCcw size={14} /></button>
      </span></div>
      {['cpp', 'c'].map(language => row(language, <FileCode2 size={14} style={{ color: language === 'cpp' ? 'var(--tok-keyword)' : 'var(--tok-literal)' }} />, nativeInstructions(project.lab, language).file, `${LANGUAGE[language]}${project.sources[language] !== exampleCode(project.lab, language) ? ' · M' : ''}`, () => openSource(language), doc === 'source' && project.language === language))}
      {row('notes', <NotebookPen size={14} style={{ color: 'var(--wb-muted)' }} />, 'NOTES.md', modified.notes ? 'M' : '', () => open('notes'), doc === 'notes')}
      {row('build', <FileText size={14} style={{ color: 'var(--wb-faint)' }} />, 'BUILD.md', t('generated'), () => open('build'), doc === 'build')}
      {row('config', <FileJson size={14} style={{ color: 'var(--wb-faint)' }} />, 'run-configuration.json', t('read-only'), () => open('config'), doc === 'config')}
      <div className="px-3 py-2"><button type="button" className="wb-button w-full" onClick={downloadProject}><Download size={13} />{t('Download project (.zip)')}</button></div>
      <p className="wb-note px-3">{t('Saved copy in this browser')}: {t(storedState === 'none' ? 'None' : storedState === 'same' ? 'Matches the editors' : 'Differs from the editors')}</p>
    </div>
  </div>
  const experiments = <div className="flex min-h-0 flex-1 flex-col" hidden={side !== 'experiments'}>
    <div className="wb-side-title"><h2>{t('Experiments')}</h2></div>
    <div className="wb-scroll">{Object.entries(LABS).map(([id, item], index) => row(id, <FlaskConical size={14} style={{ color: id === project.lab ? 'var(--wb-accent)' : 'var(--wb-faint)' }} />, `${index + 1}. ${t(item.title)}`, OPENMP_LABS.includes(id) ? 'OpenMP' : MPI_LABS.includes(id) ? 'MPI' : '', () => id !== project.lab && nb.selectLab(id), id === project.lab))}</div>
  </div>

  const editors = <div className="wb-main" hidden={layout === 'narrow' && pane !== 'editor'}>
    <EditorTabs docs={docs} active={doc} label={id => labels[id]} modified={id => modified[id]} fixed={['source', 'notes']} onSelect={setDoc} onClose={close} prefix="hpc-doc" />
    <div className="wb-crumbs">
      <span>{project.lab} › <span style={{ color: 'var(--wb-text)' }}>{labels[doc]}</span></span>
      {doc === 'source' && <>
        <label className="flex items-center gap-2" title={t('Native source: browser Run does not compile or time it.')}>{t('Source language')}<select className="wb-select" value={project.language} onChange={event => nb.edit({ language: event.target.value })}><option value="c">C17</option><option value="cpp">C++17</option></select></label>
        <span className="ml-auto flex flex-wrap gap-1">
          <button type="button" className="wb-icon-button" aria-label={t('Compare with example')} title={t('Compare with example')} disabled={!sourceChanged} onClick={() => open('diff')}><GitCompare size={14} /></button>
          <button type="button" className="wb-icon-button" aria-label={t('Restore source example')} title={t('Restore source example')} onClick={nb.restoreSource}><RotateCcw size={14} /></button>
          <button type="button" className="wb-button" onClick={nb.downloadSource}><Download size={13} />{t('Download source')}</button>
        </span>
      </>}
      {['build', 'config', 'diff'].includes(doc) && <span className="wb-chip">{t('read-only')}</span>}
    </div>
    <div className="wb-editor-body" role="tabpanel" aria-labelledby={tabPanelId('hpc-doc', doc)}>
      <div className="h-full" hidden={doc !== 'source'}><CodeEditor label={t('Editable native source')} value={project.sources[project.language]} tokenize={tokenizeC} onChange={value => nb.edit({ sources: { ...project.sources, [project.language]: value } })} onCursor={setCursor} onKeyDown={editorKeys} /></div>
      <div className="h-full" hidden={doc !== 'notes'}><CodeEditor label={t('Experiment notes')} value={project.notes} tokenize={tokenizeMarkdown} onChange={value => nb.edit({ notes: value })} onCursor={setCursor} onKeyDown={editorKeys} /></div>
      {docs.includes('build') && <div className="h-full" hidden={doc !== 'build'}><CodeEditor label="BUILD.md" value={buildGuide(project.lab, project.notes)} tokenize={tokenizeMarkdown} readOnly onCursor={setCursor} /></div>}
      {docs.includes('config') && <div className="h-full" hidden={doc !== 'config'}><CodeEditor label="run-configuration.json" value={JSON.stringify({ lab: project.lab, title: lab.title, parameters: project.parameters }, null, 2)} tokenize={tokenizeJson} readOnly onCursor={setCursor} /></div>}
      {docs.includes('diff') && <div className="h-full overflow-auto p-3" hidden={doc !== 'diff'}><pre className="wb-pre" style={{ maxHeight: 'none' }} tabIndex={0} aria-label={t('Changes to {name}', { name: instructions.file })}>{lineDiff(example, project.sources[project.language]).map((line, index) => <span key={index} className={line.type === '+' ? 'wb-diff-add' : line.type === '-' ? 'wb-diff-del' : undefined}>{`${line.type} ${line.text}\n`}</span>)}</pre></div>}
    </div>
  </div>

  const panelTabs = [['results', 'Results', result ? `${passed}/${result.checks.length}` : 0], ['output', 'Output', nb.runs.length], ['build', 'Build', 0]]
  const bottom = <div className="wb-panel" style={{ height: layout === 'narrow' ? '100%' : '42%' }} hidden={layout === 'narrow' && pane !== 'panel'}>
    <PanelTabs tabs={panelTabs} active={panel} onSelect={setPanel} label="Panel" prefix="hpc-panel" />
    <div className="wb-panel-body" role="tabpanel" aria-labelledby={`hpc-panel-${panel}`}>
      {panel === 'results' && <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2"><p className="wb-note flex-1">{t(result ? 'Model results for the settings shown in Run configuration.' : running ? 'Running experiment…' : 'Run the experiment to see metrics, correctness checks and data.')}</p><button type="button" className="wb-button" disabled={!result || running} onClick={nb.exportResults}><Download size={13} />{t('Export results')}</button></div>
        {result && <Results result={result} />}
      </div>}
      {panel === 'output' && (nb.runs.length ? <ol className="wb-pre space-y-1" style={{ maxHeight: 'none', whiteSpace: 'pre-wrap' }} aria-label={t('Run log')}>{nb.runs.map(entry => <li key={entry.id}><span style={{ color: entry.error ? 'var(--wb-danger)' : entry.passed === entry.checks ? 'var(--wb-success)' : 'var(--wb-warning)' }}>{entry.error ? '✖' : entry.passed === entry.checks ? '✔' : '▲'}</span> {t('Run')} #{entry.id} · {entry.lab} · {Object.entries(entry.parameters).map(([key, value]) => `${key}=${value}`).join(', ')}{'\n  '}{entry.error ? `${t('error')}: ${t(entry.error)}` : `${entry.passed}/${entry.checks} ${t('checks passed')}`}</li>)}</ol> : <p className="wb-note">{t('Each browser run is listed here with its settings and check results.')}</p>)}
      {panel === 'build' && <div className="space-y-3">
        <p className="wb-note">{t(instructions.requirements)}</p>
        <Command label="Build (Linux / WSL)" text={instructions.build} />
        <Command label="Run" text={instructions.run} />
        {instructions.macBuild && <Command label="Build (macOS, Apple Clang + libomp)" text={instructions.macBuild} />}
        <Command label="Install a toolchain" text={'# Ubuntu / Debian / WSL\nsudo apt install build-essential openmpi-bin libopenmpi-dev\n\n# macOS, with Homebrew already installed\nxcode-select --install\nbrew install libomp open-mpi'} />
        <p className="wb-note">{t('For a debug check, replace -O3 with -O1 -g -fsanitize=address,undefined -fno-omit-frame-pointer. Run the test cases again. Collect release performance separately. Sanitizer support varies by toolchain and parallel runtime.')}</p>
        <div className="flex flex-wrap gap-2"><button type="button" className="wb-button" onClick={() => downloadText(buildScript(project.lab, project.language), 'build.sh')}><Download size={13} />{t('Download build.sh')}</button><button type="button" className="wb-button" onClick={downloadProject}><Download size={13} />{t('Download project (.zip)')}</button></div>
      </div>}
    </div>
  </div>

  const configPane = <section className="wb-agent min-h-0" style={{ width: layout === 'wide' ? 320 : layout === 'medium' ? 290 : '100%', flexShrink: 0, borderLeft: layout === 'narrow' ? 0 : '1px solid var(--wb-border)' }} aria-labelledby="hpc-config-title" hidden={layout === 'narrow' && pane !== 'config'}>
    <header className="wb-agent-head"><h2 id="hpc-config-title">{t('Run configuration')}</h2>{parallel && <span className="wb-chip">{parallel} {t('model')}</span>}</header>
    <div className="wb-scroll space-y-3 p-3">
      <p className="text-sm font-semibold">{t(lab.title)}</p>
      <div className="grid gap-2">{Object.entries(lab.fields).map(([key, field]) => <label key={key} className="wb-field">{t(field.label)}{field.type === 'select'
        ? <select value={project.parameters[key]} onChange={event => nb.edit({ parameters: { ...project.parameters, [key]: event.target.value } }, true)}>{field.options.map(option => <option key={option} value={option}>{t(option)}</option>)}</select>
        : <input type={field.type} min={field.min} max={field.max} step={field.step} maxLength={field.type === 'text' ? 2000 : undefined} value={Number.isNaN(project.parameters[key]) ? '' : project.parameters[key]} onChange={event => nb.edit({ parameters: { ...project.parameters, [key]: field.type === 'number' ? event.target.value === '' ? NaN : Number(event.target.value) : event.target.value } }, true)} />}</label>)}</div>
      <p className="wb-note" role="status">{running ? t('Running experiment…') : t(nb.message || 'Change the settings, make a prediction, then run the experiment.')}</p>
      {nb.error && <p role="alert" className="wb-banner is-danger whitespace-pre-wrap break-words">{t(nb.error)}</p>}
      <p className="wb-note">{t('Browser Run evaluates this lab’s bounded algorithm or labelled performance model in a Worker. It does not compile or time your C/C++ source; measure native CPU, GPU and cluster performance on your own system.')}</p>
    </div>
  </section>

  const activity = [['explorer', Files, 'Explorer'], ['experiments', FlaskConical, 'Experiments']]
  return <div ref={root} className="wb-ide" data-theme={theme} data-layout={layout} data-hpc-lab={project.lab}>
    <div className="wb-titlebar">
      <span className="wb-brand"><span className="wb-brand-mark"><Cpu size={13} /></span>{t('HPC IDE')}</span>
      <label className="flex min-w-0 items-center gap-2"><span className="sr-only">{t('Choose an HPC experiment')}</span><select className="wb-select" aria-label={t('Choose an HPC experiment')} value={project.lab} onChange={event => nb.selectLab(event.target.value)}>{Object.entries(LABS).map(([id, item]) => <option key={id} value={id}>{t(item.title)}</option>)}</select></label>
      <button type="button" className="wb-button is-primary" disabled={running} onClick={() => void nb.run()} title={t('Run the browser experiment (F5 or Ctrl/Cmd+Enter in an editor)')}><Play size={13} />{t('Run experiment')}</button>
      {running && <button type="button" className="wb-button is-danger" onClick={nb.cancel}><Square size={12} />{t('Cancel run')}</button>}
      <span className="ml-auto flex items-center gap-2"><span className="wb-chip is-accent" title={t('Counts and costs are teaching models, never CPU timings.')}>{t('Browser model · no hardware timings')}</span><ThemeToggle theme={theme} onToggle={toggleTheme} /></span>
    </div>
    {layout === 'narrow' && <div className="wb-switch" role="tablist" aria-label={t('IDE panels')}>{[['side', 'Files'], ['editor', 'Editor'], ['config', 'Run configuration'], ['panel', 'Results']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={pane === id} onClick={() => setPane(id)}>{t(label)}</button>)}</div>}
    <div className="wb-body">
      {layout !== 'narrow' && <nav className="wb-activity" aria-label={t('Activity bar')}>{activity.map(([id, Icon, label]) => <button key={id} type="button" aria-label={t(label)} title={t(label)} aria-pressed={side === id} onClick={() => toggleSide(id)}><Icon size={18} /></button>)}</nav>}
      {(layout !== 'medium' || side) && <aside className="wb-side" style={{ width: layout === 'narrow' ? '100%' : 250 }} aria-label={t('Side bar')} hidden={layout === 'narrow' && pane !== 'side'}>
        {layout === 'narrow' && <div className="wb-switch">{activity.map(([id, , label]) => <button key={id} type="button" aria-selected={side === id} onClick={() => setSide(id)}>{t(label)}</button>)}</div>}
        {explorer}{experiments}
      </aside>}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" hidden={layout === 'narrow' && !['editor', 'panel'].includes(pane)}>{editors}{bottom}</div>
      {configPane}
    </div>
    <footer className="wb-status">
      <span className={result ? passed === result.checks.length ? 'is-ok' : 'is-danger' : undefined}>{result ? `${passed === result.checks.length ? '✓' : '✖'} ${t('{passed}/{total} checks pass', { passed, total: result.checks.length })}` : t(running ? 'Running experiment…' : 'Not run')}</span>
      <span>{t(lab.title)}</span>
      <div className="wb-status-right">
        <span>{t('Ln {line}, Col {column}', cursor)}</span>
        <span>{LANGUAGE[project.language]}</span>
        <span>{t('Browser model · compile natively for timings')}</span>
      </div>
    </footer>
    <input ref={nb.fileRef} type="file" className="sr-only" accept=".json,application/json" aria-label={t('Import HPC JSON file')} onChange={nb.importFile} tabIndex={-1} />
    <Modal open={Boolean(nb.pending)} onClose={() => nb.setPending(null)} title={t('Replace the current HPC experiment?')} description={t('This replaces the displayed settings, source drafts and notes with the selected version. Export or save current work first if you want to keep it.')} footer={<><Button variant="secondary" onClick={() => nb.setPending(null)}>{t('Cancel')}</Button><Button onClick={() => nb.replace(nb.pending)}>{t('Replace experiment')}</Button></>}><p className="text-sm">{nb.pending && t(LABS[nb.pending.lab].title)}</p></Modal>
  </div>
}

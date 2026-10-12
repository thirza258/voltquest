import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Cpu, Download, FolderOpen, Play, Save, SkipForward, Square, Upload } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { Button, Modal } from '../../ui/index.js'
import { readJson, writeJson } from '../../lib/storage.js'
import { downloadJson, downloadText } from '../../lib/download.js'
import { assemble } from '../../engine/avr/assembler.js'
import { createMachine, flags, FLAG_NAMES, indexProgram, run, SRAM_START, step } from '../../engine/avr/cpu.js'
import { listing, REFERENCE } from '../../engine/avr/model.js'
import CodeEditor from '../sandbox/ide/CodeEditor.jsx'
import { tokenizeAvr } from '../sandbox/ide/tokenizers.js'
import { PanelTabs, ThemeToggle, useWorkbenchTheme } from '../sandbox/ide/Workbench.jsx'
import { useElementWidth } from '../sandbox/ide/useElementWidth.js'
import { useUnsavedBenchWork } from '../sandbox/benchGuard.js'
import { AVR_COURSES, AVR_STORAGE_PREFIX, MAX_AVR_BYTES, createAvrProject, parseAvrProject, validateAvrProject } from './avrProject.js'

const hx = (value, width = 2) => value.toString(16).toUpperCase().padStart(width, '0')
const errorLine = message => { const m = /^Line (\d+):/.exec(message ?? ''); return m ? Number(m[1]) : null }

/**
 * AVR assembler IDE (Microchip/Atmel-Studio style) for the Computer Architecture bench's assembly
 * stage. It assembles the editor's AVR subset with engine/avr, shows the opcode listing, and
 * steps/runs the simulator with live registers, SREG flags, data memory and PORTB output. It is a
 * documented teaching subset, not a full toolchain, and runs entirely in the browser.
 */
export default function AvrIde({ initialLesson, free = false }) {
  const { t } = useI18n()
  const [project, setProject] = useState(() => createAvrProject(initialLesson ?? AVR_COURSES[0].id))
  const [baseline, setBaseline] = useState(project)
  const [machine, setMachine] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)
  const [pane, setPane] = useState('registers')
  const [bottom, setBottom] = useState('listing')
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [view, setView] = useState('editor') // narrow: editor | state
  const root = useRef(null), fileRef = useRef(null)
  const width = useElementWidth(root)
  const layout = width >= 1100 ? 'wide' : width >= 760 ? 'medium' : 'narrow'
  const [theme, toggleTheme] = useWorkbenchTheme()
  const course = AVR_COURSES.find(item => item.id === project.lesson)

  const assembled = useMemo(() => { try { return { ...assemble(project.source), error: null } } catch (failure) { return { program: [], symbols: {}, error: failure.message } } }, [project.source])
  const markers = assembled.error && errorLine(assembled.error) ? [{ line: errorLine(assembled.error), severity: 'error' }] : []
  const rows = useMemo(() => assembled.error ? [] : listing(assembled.program), [assembled])
  const index = useMemo(() => indexProgram(assembled.program), [assembled])
  const activeRow = machine && !machine.halted ? assembled.program.findIndex(ins => ins.address === machine.pc) : -1

  const dirty = project.source !== baseline.source || project.notes !== baseline.notes
  useUnsavedBenchWork(dirty, 'AVR program')

  useEffect(() => { setProject(createAvrProject(initialLesson ?? AVR_COURSES[0].id)); setMachine(null); setStatus('') }, [initialLesson])
  function edit(source) { setProject(p => ({ ...p, source })); setMachine(null); setError(''); setStatus('') }
  function build() { if (assembled.error) { setError(assembled.error); setBottom('problems'); return null } setError(''); return assembled.program }
  function doRun() { const program = build(); if (!program) return; const m = createMachine(); run(m, program); setMachine(m); setStatus(m.error ? '' : `Run complete · ${m.cycles} cycles · ${m.steps} instructions`); if (m.error) setError(m.error); if (layout === 'narrow') setView('state') }
  function doStep() { const program = build(); if (!program) return; const m = machine && !machine.halted ? machine : createMachine(); step(m, program, index); setMachine({ ...m }); setStatus(m.halted ? 'Halted.' : `Stepped to word ${hx(m.pc, 4)} · ${m.cycles} cycles`); if (layout === 'narrow') setView('state') }
  function reset() { setMachine(null); setStatus('Machine reset.'); setError('') }
  function propose(next) { setPending(next) }
  function replace() { setProject(pending); setBaseline(pending); setMachine(null); setPending(null); setStatus('Notebook opened.'); setError('') }
  function save() { try { const v = validateAvrProject(project); if (!writeJson(AVR_STORAGE_PREFIX + project.lesson, v)) throw new Error('Browser storage is unavailable. Export your program to keep it.'); setBaseline(v); setStatus('AVR notebook saved in this browser.'); setError('') } catch (f) { setError(f.message) } }
  function load() { try { const v = readJson(AVR_STORAGE_PREFIX + project.lesson); if (!v) throw new Error('No saved notebook for this lesson.'); propose(validateAvrProject(v, project.lesson)) } catch (f) { setError(f.message) } }
  async function importFile(event) { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { if (file.size > MAX_AVR_BYTES) throw new Error('AVR notebooks must fit within 40 KB.'); propose(parseAvrProject(await file.text(), free ? undefined : initialLesson)) } catch (f) { setError(f.message) } }

  const flagMap = machine ? flags(machine) : null
  const changed = machine ? machine.regs : null
  const registers = <div className="wb-panel-body" role="region" aria-label={t('AVR registers')}>
    <div className="grid grid-cols-4 gap-1 font-mono text-xs sm:grid-cols-8">{[...Array(32)].map((_, i) => <div key={i} className="rounded px-1 py-0.5" style={{ background: 'var(--wb-window)', color: 'var(--wb-text)' }} title={`R${i}`}><span style={{ color: 'var(--wb-muted)' }}>r{i}</span> {machine ? hx(changed[i]) : '··'}</div>)}</div>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">{FLAG_NAMES.map(name => <span key={name} className="rounded px-2 py-1 font-mono" style={{ background: flagMap?.[name] ? 'var(--wb-accent-soft)' : 'var(--wb-window)', color: flagMap?.[name] ? 'var(--wb-accent)' : 'var(--wb-muted)' }}>{name}={machine ? flagMap[name] : '·'}</span>)}</div>
    <p className="wb-note mt-2">{t('SP')}={machine ? hx(machine.sp, 4) : '····'} · {t('PC word')}={machine ? hx(machine.pc, 4) : '····'} · {t('Cycles')}={machine?.cycles ?? 0}</p>
  </div>
  const memWindow = machine ? [...Array(32)].map((_, i) => SRAM_START + i) : []
  const memory = <div className="wb-panel-body" role="region" aria-label={t('AVR data memory')}>
    {machine ? <table className="wb-table font-mono"><tbody>{[0, 8, 16, 24].map(rowStart => <tr key={rowStart}><th scope="row" style={{ color: 'var(--wb-muted)' }}>{hx(SRAM_START + rowStart, 4)}</th>{memWindow.slice(rowStart, rowStart + 8).map(addr => <td key={addr} style={{ color: machine.data[addr] ? 'var(--wb-text)' : 'var(--wb-faint)' }}>{hx(machine.data[addr] ?? 0)}</td>)}</tr>)}</tbody></table> : <p className="wb-note">{t('Run or step to populate data memory (SRAM from 0x60).')}</p>}
  </div>
  const output = <div className="wb-panel-body" role="region" aria-label={t('PORTB output')}>{machine?.output.length ? <div className="flex flex-wrap gap-2 font-mono text-sm">{machine.output.map((b, i) => <span key={i} className="rounded px-2 py-1" style={{ background: 'var(--wb-window)' }}>0x{hx(b)}<span className="ml-1" style={{ color: 'var(--wb-muted)' }}>({b})</span></span>)}</div> : <p className="wb-note">{t('Nothing written to PORTB yet. Use OUT PORTB, Rr.')}</p>}</div>
  const reference = <div className="wb-panel-body" role="region" aria-label={t('AVR instruction reference')}><table className="wb-table"><tbody>{REFERENCE.map(([sig, desc]) => <tr key={sig}><td className="wb-mono" style={{ whiteSpace: 'nowrap', color: 'var(--wb-accent)' }}>{sig}</td><td>{t(desc)}</td></tr>)}</tbody></table></div>

  const statePanes = { registers, memory, output, reference }
  const stateTabs = [['registers', 'Registers & flags'], ['memory', 'Data memory'], ['output', 'PORTB output'], ['reference', 'Reference']]
  const statePane = <section className="wb-agent min-h-0" style={{ width: layout === 'wide' ? 360 : undefined, flexShrink: 0, borderLeft: layout === 'wide' ? '1px solid var(--wb-border)' : 0 }} aria-label={t('Machine state')} hidden={layout === 'narrow' && view !== 'state'}>
    <header className="wb-agent-head"><Cpu size={15} /><h2>{t('ATmega simulator')}</h2><span className="ml-auto wb-chip">{machine?.halted ? t('halted') : machine ? t('running') : t('idle')}</span></header>
    <PanelTabs tabs={stateTabs} active={pane} onSelect={setPane} label="Machine state" prefix="avr-state" />
    <div className="min-h-0 flex-1 overflow-auto" role="tabpanel" aria-labelledby={`avr-state-${pane}`}>{statePanes[pane]}</div>
  </section>

  const bottomTabs = [['listing', 'Listing'], ['problems', 'Problems', assembled.error ? 1 : 0]]
  return <div ref={root} className="wb-ide" data-theme={theme} data-layout={layout} data-avr-lesson={project.lesson}>
    <div className="wb-titlebar">
      <span className="wb-brand"><span className="wb-brand-mark"><Cpu size={13} /></span>{t('AVR assembler')}</span>
      {free && <label className="flex min-w-0 items-center gap-2"><span className="sr-only">{t('Choose an AVR lesson')}</span><select className="wb-select" aria-label={t('Choose an AVR lesson')} value={project.lesson} onChange={event => propose(createAvrProject(event.target.value))}>{AVR_COURSES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
      <button type="button" className="wb-button is-primary" onClick={doRun}><Play size={13} />{t('Assemble & run')}</button>
      <button type="button" className="wb-button" onClick={doStep}><SkipForward size={13} />{t('Step')}</button>
      <button type="button" className="wb-button" onClick={reset}><Square size={12} />{t('Reset')}</button>
      <span className="ml-auto flex items-center gap-2">
        <button type="button" className="wb-icon-button" aria-label={t('Save notebook')} title={t('Save notebook')} onClick={save}><Save size={14} /></button>
        <button type="button" className="wb-icon-button" aria-label={t('Load saved notebook')} title={t('Load saved notebook')} onClick={load}><FolderOpen size={14} /></button>
        <button type="button" className="wb-icon-button" aria-label={t('Import notebook')} title={t('Import notebook')} onClick={() => fileRef.current?.click()}><Upload size={14} /></button>
        <button type="button" className="wb-icon-button" aria-label={t('Export notebook')} title={t('Export notebook')} onClick={() => { try { downloadJson(validateAvrProject(project), `${project.lesson}.json`) } catch (f) { setError(f.message) } }}><Download size={14} /></button>
        <button type="button" className="wb-icon-button" aria-label={t('Download .asm')} title={t('Download .asm')} onClick={() => downloadText(project.source, `${project.lesson}.asm`)}><BookOpen size={14} /></button>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </span>
    </div>
    {layout === 'narrow' && <div className="wb-switch" role="tablist" aria-label={t('AVR panels')}>{[['editor', 'Editor'], ['state', 'Machine']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}>{t(label)}</button>)}</div>}
    <div className="wb-body">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" hidden={layout === 'narrow' && view !== 'editor'}>
        <div className="wb-crumbs"><span style={{ color: 'var(--wb-text)' }}>{project.lesson}.asm</span><span className="wb-note">· {t('AVR assembly (teaching subset)')}</span>{error && <span className="wb-chip is-danger">{t('Line')} {errorLine(error) ?? '?'}</span>}</div>
        <div className="min-h-0 flex-[1.4]"><CodeEditor label={t('Editable AVR source')} value={project.source} tokenize={tokenizeAvr} markers={markers} onChange={edit} onCursor={setCursor} onKeyDown={event => { const mod = event.ctrlKey || event.metaKey; if ((mod && event.key === 'Enter') || event.key === 'F5') { event.preventDefault(); doRun() } else if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); save() } }} /></div>
        <div className="wb-panel" style={{ height: layout === 'narrow' ? '40%' : '38%' }}>
          <PanelTabs tabs={bottomTabs} active={bottom} onSelect={setBottom} label="Build output" prefix="avr-bottom" />
          <div className="wb-panel-body" role="tabpanel" aria-labelledby={`avr-bottom-${bottom}`}>
            {bottom === 'listing' ? (rows.length ? <table className="wb-table font-mono" aria-label={t('Assembler listing')}><thead><tr><th>{t('Addr')}</th><th>{t('Opcode')}</th><th>{t('Source')}</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i} aria-current={i === activeRow ? 'true' : undefined} style={i === activeRow ? { background: 'var(--wb-accent-soft)' } : undefined}><td style={{ color: 'var(--wb-muted)' }}>{r.address}</td><td style={{ color: 'var(--wb-accent)' }}>{r.word}</td><td>{r.source}</td></tr>)}</tbody></table> : <p className="wb-note">{assembled.error ? t('Fix the error in the Problems tab to see the listing.') : t('Type AVR instructions to see their addresses and opcodes.')}</p>)
              : (assembled.error ? <p role="alert" className="wb-banner is-danger">{t(assembled.error)}</p> : <p className="wb-note">{t('No assembly problems. Assemble & run to execute.')}</p>)}
          </div>
        </div>
      </div>
      {statePane}
    </div>
    <footer className="wb-status">
      <span className={error ? 'is-danger' : 'is-ok'} role={error ? 'alert' : undefined}>{error ? t(error) : status ? t(status) : t('Ready')}</span>
      <span>{course ? course.title : t('AVR assembly')}</span>
      <div className="wb-status-right"><span>{t('Ln {line}, Col {column}', cursor)}</span><span>{t('Teaching subset · in-browser')}</span></div>
    </footer>
    <input ref={fileRef} type="file" className="sr-only" accept=".json,application/json" aria-label={t('Import AVR notebook file')} onChange={importFile} tabIndex={-1} />
    <Modal open={Boolean(pending)} onClose={() => setPending(null)} title={t('Replace the current program?')} description={t('This replaces the editor source and notes and clears the machine. Save or export your work first to keep it.')} footer={<><Button variant="secondary" onClick={() => setPending(null)}>{t('Cancel')}</Button><Button onClick={replace}>{t('Replace program')}</Button></>}><p className="text-sm">{AVR_COURSES.find(item => item.id === pending?.lesson)?.title}</p></Modal>
  </div>
}

import { useCallback, useRef, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { Button, Modal } from '../../ui/index.js'
import { readJson, writeJson } from '../../lib/storage.js'
import { downloadJson } from '../../lib/download.js'
import { useUnsavedBenchWork } from '../sandbox/benchGuard.js'
import { DEVICE_TYPES, addDevice, connect, disconnect, freePorts, isHost, moveDevice, parseProject, removeDevice, updateDevice, validateProject } from '../../engine/network/model.js'
import { createSession, execute, promptFor } from '../../engine/network/cli.js'
import { browse, runDesktop } from '../../engine/network/desktop.js'
import { dhcpRenew, emptyState } from '../../engine/network/sim.js'
import { checkGoals } from '../../engine/network/checks.js'
import TopologyCanvas from './TopologyCanvas.jsx'
import Terminal from './Terminal.jsx'
import SimulationPanel from './SimulationPanel.jsx'
import GoalsPanel from './GoalsPanel.jsx'
import { IpConfiguration, ServerServices, WebBrowser } from './HostPanels.jsx'

export const NETWORK_STORAGE_KEY = 'vq.network.project.v1'
const fieldClass = 'mt-1 block w-full min-w-0 rounded-md border border-line-strong bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const segmentClass = active => `rounded-md border px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-white text-ink hover:border-brand-500'}`
const welcome = device => isHost(device) ? ['Command Prompt', 'Type help to list the commands this desktop supports.', ''] : [`${device.config.hostname} con0 is now available`, '', 'Press RETURN to get started.', '']

/**
 * The network simulator: a cabled topology, a command line for every router and switch, a desktop
 * for every PC and server, and a step-by-step replay of the frames each command sent. Course labs
 * pass `lab` (goals and a reference solution); the sandbox bench passes `editable` to add devices,
 * cable them and save projects in this browser.
 */
export default function NetworkLab({ initialProject, lab = null, editable = false }) {
  const { t } = useI18n()
  const [project, setProject] = useState(initialProject)
  const runtime = useRef(emptyState())
  const [selectedId, setSelectedId] = useState(initialProject.devices[0]?.id ?? null)
  const [sessions, setSessions] = useState({})
  const [logs, setLogs] = useState({})
  const [hostView, setHostView] = useState('prompt')
  const [mode, setMode] = useState('realtime')
  const [events, setEvents] = useState({ list: [], limited: false })
  const [eventIndex, setEventIndex] = useState(0)
  const [results, setResults] = useState(null)
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialProject))
  const [pending, setPending] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const fileInput = useRef(null)
  useUnsavedBenchWork(editable && JSON.stringify(project) !== baseline, 'Network project')

  const device = project.devices.find(item => item.id === selectedId) ?? null
  const log = id => logs[id] ?? welcome(project.devices.find(item => item.id === id))
  const append = (id, lines) => setLogs(previous => ({ ...previous, [id]: [...(previous[id] ?? welcome(project.devices.find(item => item.id === id))), ...lines].slice(-400) }))
  const record = useCallback((list, limited = false) => { if (list?.length) { setEvents({ list, limited }); setEventIndex(0) } }, [])
  function change(next) { setProject(next); setResults(null) }

  function replace(next, message) {
    setProject(next); runtime.current = emptyState(); setSessions({}); setLogs({}); setEvents({ list: [], limited: false }); setResults(null)
    setSelectedId(previous => next.devices.some(item => item.id === previous) ? previous : next.devices[0]?.id ?? null); setNotice(message); setError('')
  }
  function runCli(line) {
    const session = sessions[device.id] ?? createSession(device.id)
    const prompt = promptFor(device, session)
    const result = execute(project, runtime.current, session, line)
    change(result.project)
    setSessions(previous => ({ ...previous, [device.id]: result.session }))
    append(device.id, [`${prompt}${line}`, ...(result.output ? result.output.split('\n') : [])])
    record(result.events)
  }
  function runPrompt(line) {
    const result = runDesktop(project, runtime.current, device.id, line)
    change(result.project)
    append(device.id, [`C:\\>${line}`, ...result.lines, ''])
    record(result.events)
  }
  function requestDhcp() {
    const withMode = updateDevice(project, device.id, item => ({ ...item, config: { ...item.config, ipMode: 'dhcp' } }))
    const result = dhcpRenew(withMode, runtime.current, device.id)
    change(result.project); record(result.events, result.limited)
    setNotice(result.lease ? t('{device} leased {ip}.', { device: device.name, ip: result.lease.ip }) : t('{device} got no DHCP answer.', { device: device.name }))
  }
  function addOne(type) {
    try {
      const count = project.devices.length
      const { project: next, device: added } = addDevice(project, type, 80 + (count % 8) * 85, 70 + Math.floor(count / 8) * 120)
      change(next); setSelectedId(added.id); setError('')
    } catch (problem) { setError(problem.message) }
  }

  const prompt = device && !isHost(device) ? promptFor(device, sessions[device.id] ?? createSession(device.id)) : 'C:\\>'
  const current = mode === 'simulation' ? events.list[eventIndex] : null

  return <section className="min-w-0 space-y-4" aria-label={t('Network simulator')}>
    <p className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm leading-relaxed text-teal-950">{t('A teaching model of switches, routers and hosts that runs in this browser. Commands follow the widely used router/switch command-line style. It has no Spanning Tree, IPv6 or real timers, and nothing leaves your computer.')}</p>
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label={t('Simulation mode')} className="flex gap-1">
        <button type="button" className={segmentClass(mode === 'realtime')} aria-pressed={mode === 'realtime'} onClick={() => setMode('realtime')}>{t('Realtime')}</button>
        <button type="button" className={segmentClass(mode === 'simulation')} aria-pressed={mode === 'simulation'} onClick={() => setMode('simulation')}>{t('Simulation')}</button>
      </div>
      {editable && <div role="group" aria-label={t('Add a device')} className="flex flex-wrap gap-1">
        {Object.keys(DEVICE_TYPES).map(type => <button key={type} type="button" className={segmentClass(false)} onClick={() => addOne(type)}>{t('Add {device}', { device: t(DEVICE_TYPES[type].label) })}</button>)}
      </div>}
    </div>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,1fr)]">
      <div className="min-w-0 space-y-3">
        <TopologyCanvas project={project} state={runtime.current} selectedId={selectedId} onSelect={setSelectedId} onMove={editable ? (id, x, y) => change(moveDevice(project, id, x, y)) : undefined}
          highlight={current ? { fromId: current.fromId, toId: current.toId } : null} label={t('Network topology')} />
        <label className="block max-w-xs text-sm">{t('Selected device')}<select className={fieldClass} value={selectedId ?? ''} onChange={event => setSelectedId(event.target.value)}>
          {project.devices.map(item => <option key={item.id} value={item.id}>{item.name} · {t(DEVICE_TYPES[item.type].label)}</option>)}</select></label>
        {editable && <CablePanel project={project} onConnect={(a, b) => { try { change(connect(project, a, b)); setError('') } catch (problem) { setError(problem.message) } }} onRemove={id => change(disconnect(project, id))} />}
      </div>
      <div className="min-w-0 space-y-3">
        {!device ? <p className="rounded-lg border border-line bg-white p-4 text-sm text-slate-600">{t(editable ? 'Add a device to start building a network.' : 'Select a device.')}</p> : <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-ink">{device.name} <span className="text-sm font-normal text-slate-600">· {t(DEVICE_TYPES[device.type].label)}</span></h3>
            {editable && <button type="button" className="text-sm font-semibold text-rose-700 underline focus:outline-none focus:ring-2 focus:ring-rose-500" onClick={() => { change(removeDevice(project, device.id)); setSelectedId(null) }}>{t('Remove {device}', { device: device.name })}</button>}
          </div>
          {isHost(device) ? <>
            <div role="group" aria-label={t('Desktop applications')} className="flex flex-wrap gap-1">
              {[['prompt', 'Command Prompt'], ['ip', 'IP Configuration'], ['web', 'Web Browser'], ...(device.type === 'server' ? [['services', 'Services']] : [])].map(([id, label]) =>
                <button key={id} type="button" className={segmentClass(hostView === id)} aria-pressed={hostView === id} onClick={() => setHostView(id)}>{t(label)}</button>)}
            </div>
            {hostView === 'prompt' && <Terminal key={device.id} label={t('{device} command prompt', { device: device.name })} prompt="C:\>" lines={log(device.id)} onSubmit={runPrompt} placeholder="ping 192.168.1.1" />}
            {hostView === 'ip' && <IpConfiguration key={`${device.id}-${device.config.ipMode}`} device={device} onApply={patch => { change(updateDevice(project, device.id, item => ({ ...item, config: { ...item.config, ...patch, lease: (patch.ipMode ?? item.config.ipMode) === 'dhcp' ? item.config.lease : null } }))); setNotice(t('{device} settings applied.', { device: device.name })) }} onDhcp={requestDhcp} />}
            {hostView === 'web' && <WebBrowser key={device.id} onBrowse={url => { const result = browse(project, runtime.current, device.id, url); record(result.events); return result }} />}
            {hostView === 'services' && device.type === 'server' && <ServerServices device={device} onChange={services => change(updateDevice(project, device.id, item => ({ ...item, config: { ...item.config, services } })))} />}
          </> : <Terminal key={device.id} label={t('{device} command line', { device: device.name })} prompt={prompt} lines={log(device.id)} onSubmit={runCli} placeholder="enable" />}
        </>}
      </div>
    </div>
    {mode === 'simulation' && <SimulationPanel events={events.list} index={eventIndex} onIndex={setEventIndex} limited={events.limited} onClear={() => setEvents({ list: [], limited: false })} />}
    {lab && <GoalsPanel goals={lab.goals} results={results} solution={lab.solution} onCheck={() => setResults(checkGoals(project, lab.goals))} onReset={() => replace(initialProject, t('The lab is back at its starting point.'))} />}
    {editable && <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => { if (!writeJson(NETWORK_STORAGE_KEY, project)) { setError(t('Browser storage is unavailable. Export the project to keep it.')); return } setBaseline(JSON.stringify(project)); setNotice(t('Network saved in this browser.')) }}>{t('Save network')}</Button>
      <Button size="sm" variant="secondary" onClick={() => { try { setPending(validateProject(readJson(NETWORK_STORAGE_KEY))) } catch { setError(t('No saved network in this browser.')) } }}>{t('Load network')}</Button>
      <Button size="sm" variant="secondary" onClick={() => downloadJson(project, 'voltquest-network.json')}>{t('Export network')}</Button>
      <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>{t('Import network')}</Button>
      <input ref={fileInput} className="hidden" type="file" accept="application/json,.json" aria-label={t('Import network file')} onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''
        if (!file) return
        try { setPending(parseProject(await file.text())); setError('') } catch (problem) { setError(t(problem.message)) }
      }} />
    </div>}
    {error && <p role="alert" className="rounded bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <p role="status" className="text-sm text-teal-800">{notice}</p>
    <Modal open={Boolean(pending)} onClose={() => setPending(null)} title={t('Replace this network?')} description={t('The current devices, cables and terminal history will be replaced. Save or export first to keep them.')}
      footer={<><Button variant="secondary" onClick={() => setPending(null)}>{t('Cancel')}</Button><Button onClick={() => { const next = pending; setPending(null); setBaseline(JSON.stringify(next)); replace(next, t('Network loaded.')) }}>{t('Replace network')}</Button></>} />
  </section>
}

/** Cables as a form: pick a free port on each device. Works the same with keyboard, mouse or touch. */
function CablePanel({ project, onConnect, onRemove }) {
  const { t } = useI18n()
  const [a, setA] = useState({ device: '', port: '' })
  const [b, setB] = useState({ device: '', port: '' })
  const name = id => project.devices.find(item => item.id === id)?.name ?? id
  const ports = id => { const found = project.devices.find(item => item.id === id); return found ? freePorts(project, found) : [] }
  const end = (value, set, label) => <div className="grid min-w-0 grid-cols-2 gap-2">
    <label className="text-xs">{t(label)}<select className={fieldClass} value={value.device} onChange={event => set({ device: event.target.value, port: ports(event.target.value)[0] ?? '' })}>
      <option value="">{t('Choose')}</option>{project.devices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="text-xs">{t('Port')}<select className={fieldClass} value={value.port} onChange={event => set({ ...value, port: event.target.value })}>
      {ports(value.device).map(port => <option key={port} value={port}>{port}</option>)}</select></label>
  </div>
  return <details className="rounded-lg border border-line bg-white p-3" open={project.links.length < 2}>
    <summary className="cursor-pointer text-sm font-semibold text-ink">{t('Cables ({count})', { count: project.links.length })}</summary>
    <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={event => { event.preventDefault(); if (a.device && b.device && a.port && b.port) onConnect(a, b) }}>
      {end(a, setA, 'First device')}{end(b, setB, 'Second device')}
      <button type="submit" className="self-end rounded-md bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand-500">{t('Connect')}</button>
    </form>
    <ul className="mt-3 space-y-1 text-xs">{project.links.map(link => <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-surface-sunken px-2 py-1 font-mono">
      {name(link.a.device)} {link.a.port} — {name(link.b.device)} {link.b.port}
      <button type="button" className="font-sans font-semibold text-rose-700 underline" onClick={() => onRemove(link.id)}>{t('Remove cable')}</button></li>)}</ul>
  </details>
}

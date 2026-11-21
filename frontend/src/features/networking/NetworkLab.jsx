import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Clock,
  Download,
  FolderOpen,
  Globe,
  Layers,
  Monitor,
  MousePointer,
  Network,
  Play,
  Plus,
  Power,
  RotateCcw,
  Save,
  Search,
  Server,
  Settings,
  Terminal as TerminalIcon,
  Trash2,
  Upload,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { Button, Modal } from '../../ui/index.js'
import { readJson, writeJson } from '../../lib/storage.js'
import { downloadJson } from '../../lib/download.js'
import { useUnsavedBenchWork } from '../sandbox/benchGuard.js'
import {
  DEVICE_TYPES,
  addDevice,
  connect,
  disconnect,
  freePorts,
  isHost,
  moveDevice,
  parseProject,
  removeDevice,
  updateDevice,
  validateProject,
} from '../../engine/network/model.js'
import { createSession, execute, promptFor } from '../../engine/network/cli.js'
import { browse, runDesktop } from '../../engine/network/desktop.js'
import { dhcpRenew, emptyState } from '../../engine/network/sim.js'
import { checkGoals } from '../../engine/network/checks.js'
import TopologyCanvas from './TopologyCanvas.jsx'
import Terminal from './Terminal.jsx'
import SimulationPanel from './SimulationPanel.jsx'
import GoalsPanel from './GoalsPanel.jsx'
import DeviceModal from './DeviceModal.jsx'
import { IpConfiguration, ServerServices, WebBrowser } from './HostPanels.jsx'

export const NETWORK_STORAGE_KEY = 'vq.network.project.v1'
const fieldClass = 'mt-1 block w-full min-w-0 rounded-md border border-line-strong bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const segmentClass = active => `rounded-md border px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-white text-ink hover:border-brand-500'}`
const welcome = device => isHost(device) ? ['Command Prompt', 'Type help to list the commands this desktop supports.', ''] : [`${device.config.hostname} con0 is now available`, '', 'Press RETURN to get started.', '']

/**
 * Cisco Packet Tracer Network Simulator:
 * - Authentic Packet Tracer logical workspace with blueprint grid
 * - Interactive cabling tool: click Device A port, click Device B port, draw lines
 * - Two-tier bottom shelf: Network Devices (Routers, Switches), End Devices (PC, Server), Connections (Auto, Straight-Through)
 * - Device Configuration Window (Modal) with Physical, Config, CLI, Desktop, Services tabs
 * - Realtime clock & Simulation step-by-step frame replay
 * - Lab goals & reference solution for course lessons
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

  // Cisco Packet Tracer Tool State
  const [activeTool, setActiveTool] = useState('select') // 'select' | 'inspect' | 'delete' | 'cable' | 'auto-cable' | 'place'
  const [placingType, setPlacingType] = useState(null)
  const [shelfCategory, setShelfCategory] = useState('devices') // 'devices' | 'end_devices' | 'connections'
  const [shelfSubcategory, setShelfSubcategory] = useState('routers') // 'routers' | 'switches'
  const [deviceModalOpen, setDeviceModalOpen] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useUnsavedBenchWork(editable && JSON.stringify(project) !== baseline, 'Network project')

  // Realtime mode stopwatch counter
  useEffect(() => {
    if (mode !== 'realtime') return undefined
    const timer = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(timer)
  }, [mode])

  const formatClock = sec => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `00:${m}:${s}`
  }

  const device = project.devices.find(item => item.id === selectedId) ?? null
  const log = id => logs[id] ?? welcome(project.devices.find(item => item.id === id))
  const append = (id, lines) => setLogs(previous => ({ ...previous, [id]: [...(previous[id] ?? welcome(project.devices.find(item => item.id === id))), ...lines].slice(-400) }))
  const record = useCallback((list, limited = false) => { if (list?.length) { setEvents({ list, limited }); setEventIndex(0) } }, [])
  function change(next) { setProject(next); setResults(null) }

  function replace(next, message) {
    setProject(next); runtime.current = emptyState(); setSessions({}); setLogs({}); setEvents({ list: [], limited: false }); setResults(null)
    setSelectedId(previous => next.devices.some(item => item.id === previous) ? previous : next.devices[0]?.id ?? null)
    setNotice(message); setError('')
  }

  function runCli(line) {
    if (!device) return
    const session = sessions[device.id] ?? createSession(device.id)
    const prompt = promptFor(device, session)
    const result = execute(project, runtime.current, session, line)
    change(result.project)
    setSessions(previous => ({ ...previous, [device.id]: result.session }))
    append(device.id, [`${prompt}${line}`, ...(result.output ? result.output.split('\n') : [])])
    record(result.events)
  }

  function runCliCommands(lines, targetDeviceId = selectedId) {
    const target = project.devices.find(d => d.id === targetDeviceId)
    if (!target || isHost(target)) return
    let proj = project
    let sess = sessions[target.id] ?? createSession(target.id)

    // Ensure session is in config mode before executing config commands
    const allLines = []
    if (sess.mode === 'user') allLines.push('enable', 'configure terminal')
    else if (sess.mode === 'priv') allLines.push('configure terminal')
    allLines.push(...lines)

    const logEntries = []
    for (const line of allLines) {
      const p = promptFor(proj.devices.find(d => d.id === target.id), sess)
      const result = execute(proj, runtime.current, sess, line)
      proj = result.project
      sess = result.session
      logEntries.push(`${p}${line}`)
      if (result.output) logEntries.push(...result.output.split('\n'))
      if (result.events?.length) record(result.events)
    }
    change(proj)
    setSessions(previous => ({ ...previous, [target.id]: sess }))
    append(target.id, logEntries)
  }

  function runPrompt(line) {
    if (!device) return
    const result = runDesktop(project, runtime.current, device.id, line)
    change(result.project)
    append(device.id, [`C:\\>${line}`, ...result.lines, ''])
    record(result.events)
  }

  function requestDhcp() {
    if (!device) return
    const withMode = updateDevice(project, device.id, item => ({ ...item, config: { ...item.config, ipMode: 'dhcp' } }))
    const result = dhcpRenew(withMode, runtime.current, device.id)
    change(result.project); record(result.events, result.limited)
    setNotice(result.lease ? t('{device} leased {ip}.', { device: device.name, ip: result.lease.ip }) : t('{device} got no DHCP answer.', { device: device.name }))
  }

  function addOne(type, x, y) {
    try {
      const count = project.devices.length
      const posX = x ?? (80 + (count % 8) * 85)
      const posY = y ?? (70 + Math.floor(count / 8) * 120)
      const { project: next, device: added } = addDevice(project, type, posX, posY)
      change(next)
      setSelectedId(added.id)
      setError('')
      setActiveTool('select')
      setPlacingType(null)
      setNotice(t('Added {device} ({type}).', { device: added.name, type: DEVICE_TYPES[type].label }))
    } catch (problem) {
      setError(problem.message)
    }
  }

  function handleConnect(a, b) {
    try {
      const next = connect(project, a, b)
      change(next)
      setError('')
      const devA = project.devices.find(d => d.id === a.device)?.name ?? a.device
      const devB = project.devices.find(d => d.id === b.device)?.name ?? b.device
      setNotice(t('Connected cable between {devA} {portA} and {devB} {portB}.', { devA, portA: a.port, devB, portB: b.port }))
    } catch (problem) {
      setError(problem.message)
    }
  }

  function handleDisconnect(linkId) {
    change(disconnect(project, linkId))
    setNotice(t('Cable removed.'))
  }

  function handleRemoveDevice(deviceId) {
    const dev = project.devices.find(d => d.id === deviceId)
    change(removeDevice(project, deviceId))
    if (selectedId === deviceId) {
      setSelectedId(null)
      setDeviceModalOpen(false)
    }
    setNotice(t('Removed {device}.', { device: dev?.name ?? deviceId }))
  }

  const prompt = device && !isHost(device) ? promptFor(device, sessions[device.id] ?? createSession(device.id)) : 'C:\\>'
  const current = mode === 'simulation' ? events.list[eventIndex] : null

  return (
    <section className="min-w-0 space-y-4 font-sans" aria-label={t('Network simulator')}>
      {/* Top Packet Tracer Application Bar */}
      <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-md text-slate-100">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-700 bg-slate-950 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-sky-400" />
            <span className="font-bold tracking-wide text-white">VoltQuest Packet Tracer</span>
            <span className="rounded bg-sky-950 px-1.5 py-0.5 text-[10px] font-mono text-sky-300 border border-sky-800">
              v1.0 Logical Sim
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-[11px] font-mono">
            <span>Devices: <strong className="text-white">{project.devices.length}</strong>/24</span>
            <span>Cables: <strong className="text-white">{project.links.length}</strong>/48</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-bold">{formatClock(elapsedSeconds)}</span>
            </span>
          </div>
        </div>

        {/* Cisco Packet Tracer Main Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-3 py-2 text-xs">
          {/* Main Tool Selection Palette */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                activeTool === 'select' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              onClick={() => { setActiveTool('select'); setPlacingType(null) }}
              title="Select tool (pointer)"
            >
              <MousePointer className="h-3.5 w-3.5" />
              <span>{t('Select')}</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                activeTool === 'cable' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              onClick={() => { setActiveTool('cable'); setPlacingType(null) }}
              title="Copper Straight-Through Cable tool"
            >
              <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
              <span>{t('Cable')}</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                activeTool === 'auto-cable' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              onClick={() => { setActiveTool('auto-cable'); setPlacingType(null) }}
              title="Automatically Choose Connection Type (Auto Cable)"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>{t('Auto Connect')}</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                activeTool === 'inspect' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              onClick={() => { setActiveTool('inspect'); setPlacingType(null) }}
              title="Inspect table tool"
            >
              <Search className="h-3.5 w-3.5 text-sky-400" />
              <span>{t('Inspect')}</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                activeTool === 'delete' ? 'bg-rose-700 text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-rose-950 hover:text-rose-300'
              }`}
              onClick={() => { setActiveTool('delete'); setPlacingType(null) }}
              title="Delete tool (remove device or cable)"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              <span>{t('Delete')}</span>
            </button>
          </div>

          {/* Realtime / Simulation Mode Toggle */}
          <div className="flex items-center gap-1" role="group" aria-label={t('Simulation mode')}>
            <button
              type="button"
              className={`rounded px-3 py-1 font-semibold text-xs transition-colors ${
                mode === 'realtime' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              aria-pressed={mode === 'realtime'}
              onClick={() => setMode('realtime')}
            >
              {t('Realtime')}
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 font-semibold text-xs transition-colors ${
                mode === 'simulation' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              aria-pressed={mode === 'simulation'}
              onClick={() => setMode('simulation')}
            >
              {t('Simulation')}
            </button>
          </div>
        </div>

        {/* Workspace Active Tool Notification Banner */}
        <div className="bg-slate-950 px-3 py-1 text-[11px] text-slate-300 border-b border-slate-800 flex items-center justify-between">
          <span>
            {activeTool === 'select' && t('Select Mode: Click a device to select it, drag to reposition, or double-click to open its Packet Tracer Config window.')}
            {activeTool === 'cable' && t('Cable Mode: Click on Device A to choose its port, then click Device B to connect.')}
            {activeTool === 'auto-cable' && t('Auto-Connect Mode: Click Device A, then click Device B to connect automatically.')}
            {activeTool === 'place' && t('Place Device: Click anywhere on the logical workspace to drop your {type}.', { type: DEVICE_TYPES[placingType]?.label || placingType })}
            {activeTool === 'inspect' && t('Inspect Mode: Click any device to inspect its active ARP, MAC, and Routing tables.')}
            {activeTool === 'delete' && t('Delete Mode: Click any device or cable to remove it.')}
          </span>
          {activeTool !== 'select' && (
            <button
              type="button"
              onClick={() => { setActiveTool('select'); setPlacingType(null) }}
              className="font-semibold text-sky-400 hover:underline"
            >
              Done (Esc)
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Grid: Topology Canvas & Device Config Panel */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
        {/* Left Column: Canvas & Controls */}
        <div className="min-w-0 space-y-3">
          {/* Logical Workspace View Tabs */}
          <div className="flex items-center justify-between border-b border-slate-300 pb-1">
            <div className="flex gap-1 text-xs">
              <span className="rounded-t border-t-2 border-sky-600 bg-white px-3 py-1 font-bold text-sky-800 shadow-xs">
                [ {t('Logical')} ]
              </span>
              <span className="rounded-t bg-slate-100 px-3 py-1 font-medium text-slate-500">
                [ {t('Physical')} ]
              </span>
            </div>
            {device && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                onClick={() => setDeviceModalOpen(true)}
              >
                <Settings className="h-3.5 w-3.5" />
                {t('Open {name} Config Window', { name: device.name })} →
              </button>
            )}
          </div>

          {/* The Packet Tracer Topology Canvas */}
          <TopologyCanvas
            project={project}
            state={runtime.current}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={(id, x, y) => change(moveDevice(project, id, x, y))}
            highlight={current ? { fromId: current.fromId, toId: current.toId } : null}
            label={t('Network topology')}
            activeTool={activeTool}
            placingType={placingType}
            onAddDevice={addOne}
            onConnect={handleConnect}
            onRemoveCable={handleDisconnect}
            onRemoveDevice={handleRemoveDevice}
            onOpenDeviceModal={id => { setSelectedId(id); setDeviceModalOpen(true) }}
          />

          {/* Quick Device Selector Dropdown for Fast Access & Accessibility */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <label className="block max-w-xs text-xs font-medium text-slate-700">
              {t('Selected device')}
              <select
                className={fieldClass}
                value={selectedId ?? ''}
                onChange={event => setSelectedId(event.target.value)}
              >
                {project.devices.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {t(DEVICE_TYPES[item.type].label)}
                  </option>
                ))}
              </select>
            </label>
            {device && (
              <button
                type="button"
                className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-800"
                onClick={() => setDeviceModalOpen(true)}
              >
                {t('Configure {device}', { device: device.name })}
              </button>
            )}
          </div>

          {/* Bottom Two-Tier Cisco Packet Tracer Component Box */}
          <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-slate-100 shadow-md">
            {/* Tier 1: Category Bar */}
            <div className="flex border-b border-slate-800 bg-slate-950 px-2 py-1 text-xs">
              <span className="font-bold text-slate-400 mr-3 self-center uppercase text-[10px] tracking-wider">
                {t('Device Shelf')}:
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    shelfCategory === 'devices' ? 'bg-sky-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  onClick={() => { setShelfCategory('devices'); setShelfSubcategory('routers') }}
                >
                  <Network className="h-3.5 w-3.5" />
                  <span>{t('Network Devices')}</span>
                </button>
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    shelfCategory === 'end_devices' ? 'bg-sky-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  onClick={() => setShelfCategory('end_devices')}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  <span>{t('End Devices')}</span>
                </button>
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    shelfCategory === 'connections' ? 'bg-sky-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  onClick={() => setShelfCategory('connections')}
                >
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>{t('Connections')}</span>
                </button>
              </div>
            </div>

            {/* Tier 2: Specific Device Models Palette */}
            <div className="p-3 bg-slate-900 flex flex-wrap items-center gap-2">
              {/* Category: Network Devices */}
              {shelfCategory === 'devices' && (
                <div className="flex flex-wrap items-center gap-3 w-full">
                  <div className="flex gap-1 border-r border-slate-700 pr-3">
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        shelfSubcategory === 'routers' ? 'bg-sky-800 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                      onClick={() => setShelfSubcategory('routers')}
                    >
                      Routers
                    </button>
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        shelfSubcategory === 'switches' ? 'bg-sky-800 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                      onClick={() => setShelfSubcategory('switches')}
                    >
                      Switches
                    </button>
                  </div>

                  {shelfSubcategory === 'routers' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setActiveTool('place'); setPlacingType('router') }}
                        className="flex flex-col items-center rounded border border-slate-700 bg-slate-800 p-2 hover:border-sky-500 hover:bg-slate-750 transition-all cursor-pointer group"
                      >
                        <div className="h-7 w-7 rounded-full bg-sky-700 border border-sky-500 flex items-center justify-center text-white text-[10px] font-bold">
                          1941
                        </div>
                        <span className="mt-1 text-[11px] font-mono text-slate-300 group-hover:text-white">Router 1941</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setActiveTool('place'); setPlacingType('router') }}
                        className="flex flex-col items-center rounded border border-slate-700 bg-slate-800 p-2 hover:border-sky-500 hover:bg-slate-750 transition-all cursor-pointer group"
                      >
                        <div className="h-7 w-7 rounded-full bg-sky-800 border border-sky-600 flex items-center justify-center text-white text-[10px] font-bold">
                          2901
                        </div>
                        <span className="mt-1 text-[11px] font-mono text-slate-300 group-hover:text-white">Router 2901</span>
                      </button>
                      <button
                        type="button"
                        className={segmentClass(false)}
                        onClick={() => addOne('router')}
                      >
                        {t('Add Router')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setActiveTool('place'); setPlacingType('switch') }}
                        className="flex flex-col items-center rounded border border-slate-700 bg-slate-800 p-2 hover:border-sky-500 hover:bg-slate-750 transition-all cursor-pointer group"
                      >
                        <div className="h-7 w-9 rounded bg-sky-700 border border-sky-500 flex items-center justify-center text-white text-[9px] font-bold">
                          2960
                        </div>
                        <span className="mt-1 text-[11px] font-mono text-slate-300 group-hover:text-white">Switch 2960</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setActiveTool('place'); setPlacingType('switch') }}
                        className="flex flex-col items-center rounded border border-slate-700 bg-slate-800 p-2 hover:border-sky-500 hover:bg-slate-750 transition-all cursor-pointer group"
                      >
                        <div className="h-7 w-9 rounded bg-sky-800 border border-sky-600 flex items-center justify-center text-white text-[9px] font-bold">
                          3560
                        </div>
                        <span className="mt-1 text-[11px] font-mono text-slate-300 group-hover:text-white">Switch 3560</span>
                      </button>
                      <button
                        type="button"
                        className={segmentClass(false)}
                        onClick={() => addOne('switch')}
                      >
                        {t('Add Switch')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Category: End Devices */}
              {shelfCategory === 'end_devices' && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setActiveTool('place'); setPlacingType('pc') }}
                    className="flex flex-col items-center rounded border border-slate-700 bg-slate-800 p-2 hover:border-sky-500 hover:bg-slate-750 transition-all cursor-pointer group"
                  >
                    <Monitor className="h-7 w-7 text-sky-400" />
                    <span className="mt-1 text-[11px] font-mono text-slate-300 group-hover:text-white">PC-PT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTool('place'); setPlacingType('server') }}
                    className="flex flex-col items-center rounded border border-slate-700 bg-slate-800 p-2 hover:border-sky-500 hover:bg-slate-750 transition-all cursor-pointer group"
                  >
                    <Server className="h-7 w-7 text-amber-400" />
                    <span className="mt-1 text-[11px] font-mono text-slate-300 group-hover:text-white">Server-PT</span>
                  </button>
                  <button
                    type="button"
                    className={segmentClass(false)}
                    onClick={() => addOne('pc')}
                  >
                    {t('Add PC')}
                  </button>
                  <button
                    type="button"
                    className={segmentClass(false)}
                    onClick={() => addOne('server')}
                  >
                    {t('Add Server')}
                  </button>
                </div>
              )}

              {/* Category: Connections */}
              {shelfCategory === 'connections' && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setActiveTool('auto-cable'); setPlacingType(null) }}
                    className="flex flex-col items-center rounded border border-slate-700 bg-slate-800 p-2 hover:border-amber-400 hover:bg-slate-750 transition-all cursor-pointer group"
                  >
                    <div className="h-7 w-7 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-amber-400" />
                    </div>
                    <span className="mt-1 text-[11px] font-mono text-slate-300 group-hover:text-white">Auto Connect</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTool('cable'); setPlacingType(null) }}
                    className="flex flex-col items-center rounded border border-slate-700 bg-slate-800 p-2 hover:border-sky-400 hover:bg-slate-750 transition-all cursor-pointer group"
                  >
                    <div className="h-7 w-7 rounded bg-slate-950 border border-slate-600 flex items-center justify-center">
                      <div className="h-1 w-5 bg-slate-300" />
                    </div>
                    <span className="mt-1 text-[11px] font-mono text-slate-300 group-hover:text-white">Copper Straight-Through</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTool('cable'); setPlacingType(null) }}
                    className="flex flex-col items-center rounded border border-slate-700 bg-slate-800 p-2 hover:border-sky-400 hover:bg-slate-750 transition-all cursor-pointer group"
                  >
                    <div className="h-7 w-7 rounded bg-slate-950 border border-slate-600 flex items-center justify-center">
                      <div className="h-1 w-5 border-t border-dashed border-slate-300" />
                    </div>
                    <span className="mt-1 text-[11px] font-mono text-slate-300 group-hover:text-white">Copper Cross-Over</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Form-Based Cable Panel for Full Accessibility & Test Compatibility */}
          <CablePanel
            project={project}
            onConnect={(a, b) => {
              try {
                change(connect(project, a, b))
                setError('')
              } catch (problem) {
                setError(problem.message)
              }
            }}
            onRemove={id => change(disconnect(project, id))}
          />
        </div>

        {/* Right Column: Active Device Inspector & Applications */}
        <div className="min-w-0 space-y-3">
          {!device ? (
            <p className="rounded-lg border border-line bg-white p-4 text-sm text-slate-600">
              {t('Select a device on the canvas to configure it.')}
            </p>
          ) : (
            <div className="rounded-lg border border-line bg-white p-3 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                <div>
                  <h3 className="font-semibold text-ink text-base">
                    {device.name}{' '}
                    <span className="text-sm font-normal text-slate-600">
                      · {t(DEVICE_TYPES[device.type].label)}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {device.type === 'router'
                      ? 'Cisco 1941 ISR'
                      : device.type === 'switch'
                      ? 'Cisco Catalyst 2960'
                      : device.type === 'server'
                      ? 'Server-PT'
                      : 'PC-PT'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded bg-sky-700 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-sky-800"
                    onClick={() => setDeviceModalOpen(true)}
                  >
                    {t('Open Window')} ⤢
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-700 hover:underline"
                    onClick={() => handleRemoveDevice(device.id)}
                  >
                    {t('Remove {device}', { device: device.name })}
                  </button>
                </div>
              </div>

              {/* Host Apps (PC & Server) or CLI Terminal (Router & Switch) */}
              {isHost(device) ? (
                <>
                  <div role="group" aria-label={t('Desktop applications')} className="flex flex-wrap gap-1">
                    {[
                      ['prompt', 'Command Prompt'],
                      ['ip', 'IP Configuration'],
                      ['web', 'Web Browser'],
                      ...(device.type === 'server' ? [['services', 'Services']] : []),
                    ].map(([id, lbl]) => (
                      <button
                        key={id}
                        type="button"
                        className={segmentClass(hostView === id)}
                        aria-pressed={hostView === id}
                        onClick={() => setHostView(id)}
                      >
                        {t(lbl)}
                      </button>
                    ))}
                  </div>

                  {hostView === 'prompt' && (
                    <Terminal
                      key={device.id}
                      label={t('{device} command prompt', { device: device.name })}
                      prompt="C:\>"
                      lines={log(device.id)}
                      onSubmit={runPrompt}
                      placeholder="ping 192.168.1.1"
                    />
                  )}

                  {hostView === 'ip' && (
                    <IpConfiguration
                      key={`${device.id}-${device.config.ipMode}`}
                      device={device}
                      onApply={patch => {
                        change(
                          updateDevice(project, device.id, item => ({
                            ...item,
                            config: {
                              ...item.config,
                              ...patch,
                              lease: (patch.ipMode ?? item.config.ipMode) === 'dhcp' ? item.config.lease : null,
                            },
                          }))
                        )
                        setNotice(t('{device} settings applied.', { device: device.name }))
                      }}
                      onDhcp={requestDhcp}
                    />
                  )}

                  {hostView === 'web' && (
                    <WebBrowser
                      key={device.id}
                      onBrowse={url => {
                        const result = browse(project, runtime.current, device.id, url)
                        record(result.events)
                        return result
                      }}
                    />
                  )}

                  {hostView === 'services' && device.type === 'server' && (
                    <ServerServices
                      device={device}
                      onChange={services =>
                        change(
                          updateDevice(project, device.id, item => ({
                            ...item,
                            config: { ...item.config, services },
                          }))
                        )
                      }
                    />
                  )}
                </>
              ) : (
                <Terminal
                  key={device.id}
                  label={t('{device} command line', { device: device.name })}
                  prompt={prompt}
                  lines={log(device.id)}
                  onSubmit={runCli}
                  placeholder="enable"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Packet Tracer Device Configuration Window (Modal) */}
      <DeviceModal
        device={device}
        project={project}
        session={device ? sessions[device.id] : null}
        log={device ? log(device.id) : []}
        isOpen={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        onCliSubmit={runCli}
        onPromptSubmit={runPrompt}
        onCliCommands={runCliCommands}
        onUpdateDevice={patch => {
          change(updateDevice(project, device.id, item => ({ ...item, ...patch })))
        }}
        onRequestDhcp={requestDhcp}
        onBrowse={url => {
          const result = browse(project, runtime.current, device.id, url)
          record(result.events)
          return result
        }}
        onServicesChange={services => {
          change(updateDevice(project, device.id, item => ({ ...item, config: { ...item.config, services } })))
        }}
        onRemoveDevice={handleRemoveDevice}
        editable={editable}
        prompt={prompt}
      />

      {/* Simulation Replay Frame-by-Frame Panel */}
      {mode === 'simulation' && (
        <SimulationPanel
          events={events.list}
          index={eventIndex}
          onIndex={setEventIndex}
          limited={events.limited}
          onClear={() => setEvents({ list: [], limited: false })}
        />
      )}

      {/* Lab Goals & Reference Solution Panel for Courses */}
      {lab && (
        <GoalsPanel
          goals={lab.goals}
          results={results}
          solution={lab.solution}
          onCheck={() => setResults(checkGoals(project, lab.goals))}
          onReset={() => replace(initialProject, t('The lab is back at its starting point.'))}
        />
      )}

      {/* Project Persistence & Export/Import Controls */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
        <Button
          size="sm"
          onClick={() => {
            if (!writeJson(NETWORK_STORAGE_KEY, project)) {
              setError(t('Browser storage is unavailable. Export the project to keep it.'))
              return
            }
            setBaseline(JSON.stringify(project))
            setNotice(t('Network saved in this browser.'))
          }}
        >
          {t('Save network')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            try {
              setPending(validateProject(readJson(NETWORK_STORAGE_KEY)))
            } catch {
              setError(t('No saved network in this browser.'))
            }
          }}
        >
          {t('Load network')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => downloadJson(project, 'voltquest-network.json')}
        >
          {t('Export network')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => fileInput.current?.click()}
        >
          {t('Import network')}
        </Button>
        <input
          ref={fileInput}
          className="hidden"
          type="file"
          accept="application/json,.json"
          aria-label={t('Import network file')}
          onChange={async event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            try {
              setPending(parseProject(await file.text()))
              setError('')
            } catch (problem) {
              setError(t(problem.message))
            }
          }}
        />
      </div>

      {error && <p role="alert" className="rounded bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="text-sm text-teal-800">{notice}</p>}

      {/* Replace Network Confirmation Modal */}
      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={t('Replace this network?')}
        description={t('The current devices, cables and terminal history will be replaced. Save or export first to keep them.')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={() => {
                const next = pending
                setPending(null)
                setBaseline(JSON.stringify(next))
                replace(next, t('Network loaded.'))
              }}
            >
              {t('Replace network')}
            </Button>
          </>
        }
      />
    </section>
  )
}

/** Cables as an accessible form: pick a free port on each device. Works with keyboard, mouse, or screen reader. */
function CablePanel({ project, onConnect, onRemove }) {
  const { t } = useI18n()
  const [a, setA] = useState({ device: '', port: '' })
  const [b, setB] = useState({ device: '', port: '' })
  const name = id => project.devices.find(item => item.id === id)?.name ?? id
  const ports = id => {
    const found = project.devices.find(item => item.id === id)
    return found ? freePorts(project, found) : []
  }
  const end = (value, set, label) => (
    <div className="grid min-w-0 grid-cols-2 gap-2">
      <label className="text-xs">
        {t(label)}
        <select
          className={fieldClass}
          value={value.device}
          onChange={event => set({ device: event.target.value, port: ports(event.target.value)[0] ?? '' })}
        >
          <option value="">{t('Choose')}</option>
          {project.devices.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        {t('Port')}
        <select
          className={fieldClass}
          value={value.port}
          onChange={event => set({ ...value, port: event.target.value })}
        >
          {ports(value.device).map(port => (
            <option key={port} value={port}>
              {port}
            </option>
          ))}
        </select>
      </label>
    </div>
  )

  return (
    <details className="rounded-lg border border-line bg-white p-3" open={project.links.length < 2}>
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        {t('Cables ({count})', { count: project.links.length })}
      </summary>
      <form
        className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={event => {
          event.preventDefault()
          if (a.device && b.device && a.port && b.port) onConnect(a, b)
        }}
      >
        {end(a, setA, 'First device')}
        {end(b, setB, 'Second device')}
        <button
          type="submit"
          className="self-end rounded-md bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {t('Connect')}
        </button>
      </form>
      <ul className="mt-3 space-y-1 text-xs">
        {project.links.map(link => (
          <li
            key={link.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded bg-surface-sunken px-2 py-1 font-mono"
          >
            {name(link.a.device)} {link.a.port} — {name(link.b.device)} {link.b.port}
            <button
              type="button"
              className="font-sans font-semibold text-rose-700 underline"
              onClick={() => onRemove(link.id)}
            >
              {t('Remove cable')}
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}

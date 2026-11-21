import { useState } from 'react'
import {
  Globe,
  Maximize2,
  Minimize2,
  Monitor,
  Network,
  Power,
  Server,
  Settings,
  Terminal as TerminalIcon,
  Trash2,
  Wifi,
  X,
} from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { isIp, isMask, isWildcard } from '../../engine/network/addr.js'
import { DEVICE_TYPES, deviceMac, isHost } from '../../engine/network/model.js'
import { IpConfiguration, ServerServices, WebBrowser } from './HostPanels.jsx'
import Terminal from './Terminal.jsx'

const fieldClass = 'block w-full min-w-0 rounded border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-400'
const btnClass = 'rounded bg-sky-700 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500'
const btnSecClass = 'rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500'

export default function DeviceModal({
  device,
  project,
  session,
  log,
  isOpen,
  onClose,
  onCliSubmit,
  onPromptSubmit,
  onCliCommands,
  onUpdateDevice,
  onRequestDhcp,
  onBrowse,
  onServicesChange,
  onRemoveDevice,
  editable = false,
  prompt = 'Router#',
}) {
  const { t } = useI18n()
  const [tab, setTab] = useState(() => isHost(device) ? 'desktop' : 'cli')
  const [desktopApp, setDesktopApp] = useState(() => isHost(device) ? 'prompt' : null)
  const [configSection, setConfigSection] = useState('settings')
  const [selectedPort, setSelectedPort] = useState(() => DEVICE_TYPES[device.type].ports[0] ?? '')
  const [staticNet, setStaticNet] = useState({ network: '', mask: '255.255.255.0', nextHop: '' })
  const [ospfNet, setOspfNet] = useState({ network: '', wildcard: '0.0.0.255', area: '0' })
  const [portIpDraft, setPortIpDraft] = useState({ ip: '', mask: '255.255.255.0' })
  const [vlanDraft, setVlanDraft] = useState('1')
  const [powerOn, setPowerOn] = useState(true)
  const [maximized, setMaximized] = useState(false)

  if (!isOpen || !device) return null

  const isServer = device.type === 'server'
  const isRouter = device.type === 'router'
  const isSwitch = device.type === 'switch'
  const host = isHost(device)

  // Hardware model name
  const modelName = isRouter ? 'Cisco 1941 ISR Router' : isSwitch ? 'Cisco Catalyst 2960-24TT Switch' : isServer ? 'Server-PT' : 'PC-PT'

  // Sync draft state when selected port changes
  function selectPort(port) {
    setSelectedPort(port)
    if (isRouter) {
      const iface = device.config.interfaces?.[port] || {}
      setPortIpDraft({ ip: iface.ip || '', mask: iface.mask || '255.255.255.0' })
    } else if (isSwitch) {
      const p = device.config.ports?.[port] || {}
      setVlanDraft(String(p.vlan || 1))
    }
  }

  // Handle port status On/Off checkbox in Config tab
  function togglePortStatus(port, currentShutdown) {
    if (isRouter) {
      onCliCommands([`interface ${port}`, currentShutdown ? 'no shutdown' : 'shutdown', 'end'])
    } else if (isSwitch) {
      onCliCommands([`interface ${port}`, currentShutdown ? 'no shutdown' : 'shutdown', 'end'])
    }
  }

  // Handle IP assignment in Config tab
  function applyInterfaceIp(event) {
    event?.preventDefault()
    if (!isIp(portIpDraft.ip) || !isMask(portIpDraft.mask)) return
    onCliCommands([`interface ${selectedPort}`, `ip address ${portIpDraft.ip} ${portIpDraft.mask}`, 'end'])
  }

  // Handle switchport settings in Config tab
  function applySwitchport(mode, vlan) {
    if (mode === 'access') {
      onCliCommands([`interface ${selectedPort}`, 'switchport mode access', `switchport access vlan ${vlan || 1}`, 'end'])
    } else {
      onCliCommands([`interface ${selectedPort}`, 'switchport mode trunk', `switchport trunk native vlan ${vlan || 1}`, 'end'])
    }
  }

  // Handle static route add/remove
  function addStaticRoute(event) {
    event?.preventDefault()
    if (!isIp(staticNet.network) || !isMask(staticNet.mask) || !isIp(staticNet.nextHop)) return
    onCliCommands([`ip route ${staticNet.network} ${staticNet.mask} ${staticNet.nextHop}`, 'end'])
    setStaticNet({ network: '', mask: '255.255.255.0', nextHop: '' })
  }
  function removeStaticRoute(route) {
    onCliCommands([`no ip route ${route.network} ${route.mask} ${route.nextHop || route.iface}`, 'end'])
  }

  // Handle OSPF add/remove
  function addOspfNet(event) {
    event?.preventDefault()
    if (!isIp(ospfNet.network) || !isWildcard(ospfNet.wildcard)) return
    const pid = device.config.ospf?.pid || 1
    onCliCommands([`router ospf ${pid}`, `network ${ospfNet.network} ${ospfNet.wildcard} area ${ospfNet.area || 0}`, 'end'])
    setOspfNet({ network: '', wildcard: '0.0.0.255', area: '0' })
  }
  function removeOspfNet(item) {
    const pid = device.config.ospf?.pid || 1
    onCliCommands([`router ospf ${pid}`, `no network ${item.network} ${item.wildcard} area ${item.area}`, 'end'])
  }

  const iface = isRouter ? (device.config.interfaces?.[selectedPort] || {}) : null
  const swPort = isSwitch ? (device.config.ports?.[selectedPort] || {}) : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${device.name} - ${modelName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs"
    >
      <div
        className={`flex flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-100 shadow-2xl transition-all ${
          maximized ? 'h-[96vh] w-[98vw]' : 'h-[640px] max-h-[92vh] w-[860px] max-w-full'
        }`}
      >
        {/* Packet Tracer Window Title Bar */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-3 text-slate-200 select-none">
          <div className="flex items-center gap-2">
            {isRouter ? <Network className="h-4 w-4 text-sky-400" /> : isSwitch ? <Layers className="h-4 w-4 text-emerald-400" /> : isServer ? <Server className="h-4 w-4 text-amber-400" /> : <Monitor className="h-4 w-4 text-sky-300" />}
            <span className="font-mono text-xs font-semibold text-white tracking-wide">
              {device.name} ({modelName})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
              onClick={() => setMaximized(!maximized)}
              title={maximized ? 'Restore' : 'Maximize'}
            >
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              className="rounded p-1 text-slate-400 hover:bg-rose-600 hover:text-white"
              onClick={onClose}
              title="Close"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Packet Tracer Window Tab Bar */}
        <div className="flex shrink-0 border-b border-slate-300 bg-slate-200 px-3 pt-1.5 gap-1 select-none">
          <button
            type="button"
            className={`rounded-t px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'physical' ? 'bg-white text-sky-800 shadow-xs border-t-2 border-sky-600' : 'bg-slate-300/60 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
            onClick={() => setTab('physical')}
          >
            {t('Physical')}
          </button>
          <button
            type="button"
            className={`rounded-t px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'config' ? 'bg-white text-sky-800 shadow-xs border-t-2 border-sky-600' : 'bg-slate-300/60 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
            onClick={() => setTab('config')}
          >
            {t('Config')}
          </button>
          {!host && (
            <button
              type="button"
              className={`rounded-t px-4 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'cli' ? 'bg-white text-sky-800 shadow-xs border-t-2 border-sky-600' : 'bg-slate-300/60 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
              onClick={() => setTab('cli')}
            >
              {t('CLI')}
            </button>
          )}
          {isServer && (
            <button
              type="button"
              className={`rounded-t px-4 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'services' ? 'bg-white text-sky-800 shadow-xs border-t-2 border-sky-600' : 'bg-slate-300/60 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
              onClick={() => setTab('services')}
            >
              {t('Services')}
            </button>
          )}
          {host && (
            <button
              type="button"
              className={`rounded-t px-4 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'desktop' ? 'bg-white text-sky-800 shadow-xs border-t-2 border-sky-600' : 'bg-slate-300/60 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
              onClick={() => setTab('desktop')}
            >
              {t('Desktop')}
            </button>
          )}
        </div>

        {/* Window Content */}
        <div className="flex-1 min-h-0 overflow-auto bg-white p-3 sm:p-4">
          {/* TAB 1: PHYSICAL */}
          {tab === 'physical' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 p-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{modelName}</h4>
                  <p className="text-xs text-slate-500">{t('Physical hardware view and interface indicators')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${powerOn ? 'bg-emerald-500 shadow-xs shadow-emerald-400' : 'bg-rose-500'}`} />
                    <span className="font-semibold text-slate-700">{powerOn ? 'PWR ON' : 'PWR OFF'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPowerOn(!powerOn)}
                    className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100"
                  >
                    <Power className={`h-3.5 w-3.5 ${powerOn ? 'text-emerald-600' : 'text-slate-400'}`} />
                    {powerOn ? 'Turn Off' : 'Turn On'}
                  </button>
                </div>
              </div>

              {/* Hardware Faceplate Graphic */}
              <div className="overflow-hidden rounded-md border-2 border-slate-800 bg-slate-900 p-4 text-slate-200 shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <span className="font-mono text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                    VoltQuest Network Systems · {modelName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="font-mono text-[10px] text-slate-400">SYS OK</span>
                  </div>
                </div>

                {/* Ports layout */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                  {DEVICE_TYPES[device.type].ports.map(port => {
                    const isConnected = project.links.some(l => (l.a.device === device.id && l.a.port === port) || (l.b.device === device.id && l.b.port === port))
                    const isUp = isRouter
                      ? (!device.config.interfaces?.[port]?.shutdown && isConnected)
                      : isSwitch
                      ? (!device.config.ports?.[port]?.shutdown && isConnected)
                      : isConnected
                    return (
                      <div key={port} className="flex flex-col items-center rounded border border-slate-700 bg-slate-800/80 p-2 text-center">
                        <div className="flex items-center gap-1 mb-1">
                          <span className={`h-2 w-2 rounded-full ${isUp ? 'bg-emerald-400 shadow-xs shadow-emerald-300' : isConnected ? 'bg-amber-500' : 'bg-slate-600'}`} />
                          <span className="font-mono text-[10px] text-slate-300">{port}</span>
                        </div>
                        {/* RJ45 socket visual */}
                        <div className="h-6 w-7 rounded bg-slate-950 border border-slate-600 flex items-center justify-center">
                          <div className="h-3 w-4 rounded-xs bg-slate-800 border-t border-slate-500" />
                        </div>
                        <span className="mt-1 font-mono text-[9px] text-slate-400">
                          {isUp ? 'UP' : isConnected ? 'DOWN' : 'EMPTY'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Hardware specifications */}
              <div className="rounded border border-slate-200 p-3 text-xs">
                <h5 className="font-semibold text-slate-700 mb-2">{t('Hardware details')}</h5>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4 font-mono">
                  <div><dt className="text-slate-500 font-sans">Host Name:</dt><dd className="font-bold text-slate-800">{device.config.hostname || device.name}</dd></div>
                  <div><dt className="text-slate-500 font-sans">Device Type:</dt><dd className="font-bold text-slate-800">{DEVICE_TYPES[device.type].label}</dd></div>
                  <div><dt className="text-slate-500 font-sans">Port Count:</dt><dd className="font-bold text-slate-800">{DEVICE_TYPES[device.type].ports.length} ports</dd></div>
                  <div><dt className="text-slate-500 font-sans">Base MAC:</dt><dd className="font-bold text-slate-800">{deviceMac(device, DEVICE_TYPES[device.type].ports[0])}</dd></div>
                </dl>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIG */}
          {tab === 'config' && (
            <div className="grid h-full gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
              {/* Config Navigation Sidebar */}
              <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-2.5 text-xs">
                <div>
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">GLOBAL</span>
                  <div className="mt-1 space-y-0.5">
                    <button
                      type="button"
                      className={`w-full text-left rounded px-2 py-1 font-semibold transition-colors ${
                        configSection === 'settings' ? 'bg-sky-700 text-white' : 'text-slate-700 hover:bg-slate-200'
                      }`}
                      onClick={() => setConfigSection('settings')}
                    >
                      Settings
                    </button>
                  </div>
                </div>

                {isRouter && (
                  <div>
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">ROUTING</span>
                    <div className="mt-1 space-y-0.5">
                      <button
                        type="button"
                        className={`w-full text-left rounded px-2 py-1 font-semibold transition-colors ${
                          configSection === 'static' ? 'bg-sky-700 text-white' : 'text-slate-700 hover:bg-slate-200'
                        }`}
                        onClick={() => setConfigSection('static')}
                      >
                        Static
                      </button>
                      <button
                        type="button"
                        className={`w-full text-left rounded px-2 py-1 font-semibold transition-colors ${
                          configSection === 'ospf' ? 'bg-sky-700 text-white' : 'text-slate-700 hover:bg-slate-200'
                        }`}
                        onClick={() => setConfigSection('ospf')}
                      >
                        OSPF
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">INTERFACE</span>
                  <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                    {DEVICE_TYPES[device.type].ports.map(port => (
                      <button
                        key={port}
                        type="button"
                        className={`w-full text-left rounded px-2 py-1 font-mono transition-colors ${
                          configSection === 'interface' && selectedPort === port ? 'bg-sky-700 text-white' : 'text-slate-700 hover:bg-slate-200'
                        }`}
                        onClick={() => {
                          setConfigSection('interface')
                          selectPort(port)
                        }}
                      >
                        {port}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Config Main Panel */}
              <div className="min-w-0 space-y-4 rounded border border-slate-200 p-3 text-xs">
                {configSection === 'settings' && (
                  <div className="space-y-3">
                    <h5 className="font-semibold text-slate-800 border-b pb-1 text-sm">{t('Global Settings')}</h5>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-slate-600 font-medium">Display Name</span>
                        <input
                          value={device.name}
                          onChange={e => onUpdateDevice({ name: e.target.value.trim() })}
                          className={fieldClass}
                        />
                      </label>
                      <label className="block">
                        <span className="text-slate-600 font-medium">Hostname</span>
                        <input
                          value={device.config.hostname || device.name}
                          onChange={e => {
                            const val = e.target.value.trim()
                            if (val && !host) onCliCommands([`hostname ${val}`, 'end'])
                          }}
                          className={fieldClass}
                          disabled={host}
                        />
                      </label>
                    </div>
                    {editable && (
                      <div className="pt-4 border-t">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 rounded text-xs font-semibold text-rose-700 hover:text-rose-800"
                          onClick={() => { onRemoveDevice(device.id); onClose() }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('Delete device')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {configSection === 'static' && isRouter && (
                  <div className="space-y-3">
                    <h5 className="font-semibold text-slate-800 border-b pb-1 text-sm">{t('Static Routes')}</h5>
                    <form onSubmit={addStaticRoute} className="grid gap-2 sm:grid-cols-4 items-end bg-slate-50 p-2.5 rounded border border-slate-200">
                      <label className="block">
                        <span className="text-slate-600">Network</span>
                        <input value={staticNet.network} onChange={e => setStaticNet({ ...staticNet, network: e.target.value.trim() })} placeholder="192.168.2.0" className={fieldClass} />
                      </label>
                      <label className="block">
                        <span className="text-slate-600">Mask</span>
                        <input value={staticNet.mask} onChange={e => setStaticNet({ ...staticNet, mask: e.target.value.trim() })} placeholder="255.255.255.0" className={fieldClass} />
                      </label>
                      <label className="block">
                        <span className="text-slate-600">Next Hop</span>
                        <input value={staticNet.nextHop} onChange={e => setStaticNet({ ...staticNet, nextHop: e.target.value.trim() })} placeholder="10.0.0.2" className={fieldClass} />
                      </label>
                      <button type="submit" className={btnClass}>{t('Add')}</button>
                    </form>
                    <div className="max-h-48 overflow-y-auto rounded border border-slate-200">
                      <table className="w-full text-left font-mono">
                        <thead className="bg-slate-100 text-slate-600 sticky top-0"><tr><th className="p-1.5">Network</th><th className="p-1.5">Mask</th><th className="p-1.5">Next Hop</th><th className="p-1.5">Action</th></tr></thead>
                        <tbody>
                          {(device.config.routes || []).map((r, i) => (
                            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="p-1.5">{r.network}</td>
                              <td className="p-1.5">{r.mask}</td>
                              <td className="p-1.5">{r.nextHop || r.iface}</td>
                              <td className="p-1.5"><button type="button" className="text-rose-600 hover:underline" onClick={() => removeStaticRoute(r)}>Remove</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {configSection === 'ospf' && isRouter && (
                  <div className="space-y-3">
                    <h5 className="font-semibold text-slate-800 border-b pb-1 text-sm">{t('OSPF Routing')}</h5>
                    <form onSubmit={addOspfNet} className="grid gap-2 sm:grid-cols-4 items-end bg-slate-50 p-2.5 rounded border border-slate-200">
                      <label className="block">
                        <span className="text-slate-600">Network</span>
                        <input value={ospfNet.network} onChange={e => setOspfNet({ ...ospfNet, network: e.target.value.trim() })} placeholder="192.168.1.0" className={fieldClass} />
                      </label>
                      <label className="block">
                        <span className="text-slate-600">Wildcard</span>
                        <input value={ospfNet.wildcard} onChange={e => setOspfNet({ ...ospfNet, wildcard: e.target.value.trim() })} placeholder="0.0.0.255" className={fieldClass} />
                      </label>
                      <label className="block">
                        <span className="text-slate-600">Area</span>
                        <input value={ospfNet.area} onChange={e => setOspfNet({ ...ospfNet, area: e.target.value.trim() })} placeholder="0" className={fieldClass} />
                      </label>
                      <button type="submit" className={btnClass}>{t('Add')}</button>
                    </form>
                    <div className="max-h-48 overflow-y-auto rounded border border-slate-200">
                      <table className="w-full text-left font-mono">
                        <thead className="bg-slate-100 text-slate-600 sticky top-0"><tr><th className="p-1.5">Network</th><th className="p-1.5">Wildcard</th><th className="p-1.5">Area</th><th className="p-1.5">Action</th></tr></thead>
                        <tbody>
                          {(device.config.ospf?.networks || []).map((item, i) => (
                            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="p-1.5">{item.network}</td>
                              <td className="p-1.5">{item.wildcard}</td>
                              <td className="p-1.5">{item.area}</td>
                              <td className="p-1.5"><button type="button" className="text-rose-600 hover:underline" onClick={() => removeOspfNet(item)}>Remove</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {configSection === 'interface' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-1">
                      <h5 className="font-semibold text-slate-800 text-sm font-mono">{selectedPort}</h5>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-sky-600 rounded"
                          checked={isRouter ? !iface?.shutdown : isSwitch ? !swPort?.shutdown : true}
                          onChange={() => {
                            if (isRouter) togglePortStatus(selectedPort, iface?.shutdown)
                            if (isSwitch) togglePortStatus(selectedPort, swPort?.shutdown)
                          }}
                        />
                        <span className="font-bold text-slate-700">Port Status: [On]</span>
                      </label>
                    </div>

                    <div className="font-mono text-[11px] text-slate-500">
                      MAC Address: <span className="font-semibold text-slate-700">{deviceMac(device, selectedPort)}</span>
                    </div>

                    {/* Router Interface IP */}
                    {isRouter && (
                      <form onSubmit={applyInterfaceIp} className="space-y-3 pt-2">
                        <h6 className="font-semibold text-slate-700 text-xs uppercase tracking-wide">IP Configuration</h6>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-slate-600">IPv4 Address</span>
                            <input
                              value={portIpDraft.ip}
                              onChange={e => setPortIpDraft({ ...portIpDraft, ip: e.target.value.trim() })}
                              placeholder="192.168.1.1"
                              className={fieldClass}
                            />
                          </label>
                          <label className="block">
                            <span className="text-slate-600">Subnet Mask</span>
                            <input
                              value={portIpDraft.mask}
                              onChange={e => setPortIpDraft({ ...portIpDraft, mask: e.target.value.trim() })}
                              placeholder="255.255.255.0"
                              className={fieldClass}
                            />
                          </label>
                        </div>
                        <button type="submit" className={btnClass}>Apply IP Address</button>
                      </form>
                    )}

                    {/* Switch Interface Switchport */}
                    {isSwitch && (
                      <div className="space-y-3 pt-2">
                        <h6 className="font-semibold text-slate-700 text-xs uppercase tracking-wide">Switchport Settings</h6>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="sw-mode"
                              checked={swPort?.mode === 'access'}
                              onChange={() => applySwitchport('access', vlanDraft)}
                              className="accent-sky-600"
                            />
                            <span>Access</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="sw-mode"
                              checked={swPort?.mode === 'trunk'}
                              onChange={() => applySwitchport('trunk', vlanDraft)}
                              className="accent-sky-600"
                            />
                            <span>Trunk</span>
                          </label>
                        </div>
                        <div className="max-w-xs">
                          <label className="block">
                            <span className="text-slate-600">{swPort?.mode === 'trunk' ? 'Native VLAN' : 'Access VLAN'}</span>
                            <div className="flex gap-2 mt-1">
                              <input
                                value={vlanDraft}
                                onChange={e => setVlanDraft(e.target.value.trim())}
                                className={fieldClass}
                              />
                              <button
                                type="button"
                                className={btnClass}
                                onClick={() => applySwitchport(swPort?.mode || 'access', vlanDraft)}
                              >
                                Apply
                              </button>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Host Interface */}
                    {host && (
                      <div className="pt-2">
                        <IpConfiguration
                          device={device}
                          onApply={onUpdateDevice}
                          onDhcp={onRequestDhcp}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CLI (for Router / Switch) */}
          {tab === 'cli' && !host && (
            <div className="h-full flex flex-col space-y-2">
              <div className="flex items-center justify-between border-b pb-1 text-xs">
                <span className="font-mono text-slate-500">Console port: con0 (9600-8-N-1)</span>
                <div className="flex gap-1.5">
                  {['enable', 'configure terminal', 'show ip route', 'show ip int brief'].map(cmd => (
                    <button
                      key={cmd}
                      type="button"
                      className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-700 hover:bg-slate-100"
                      onClick={() => onCliSubmit(cmd)}
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <Terminal
                  label={t('{device} command line', { device: device.name })}
                  prompt={prompt}
                  lines={log}
                  onSubmit={onCliSubmit}
                  placeholder="enable"
                />
              </div>
            </div>
          )}

          {/* TAB 4: SERVICES (for Server) */}
          {tab === 'services' && isServer && (
            <ServerServices
              device={device}
              onChange={services => onServicesChange(services)}
            />
          )}

          {/* TAB 5: DESKTOP (for PC and Server) */}
          {tab === 'desktop' && host && (
            <div className="h-full flex flex-col">
              {desktopApp ? (
                <div className="h-full flex flex-col space-y-2">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <button
                      type="button"
                      onClick={() => setDesktopApp(null)}
                      className="text-xs font-semibold text-sky-700 hover:underline flex items-center gap-1"
                    >
                      ← {t('Back to Desktop')}
                    </button>
                    <span className="font-bold text-xs text-slate-700 capitalize">
                      {desktopApp === 'prompt' ? 'Command Prompt' : desktopApp === 'ip' ? 'IP Configuration' : desktopApp === 'web' ? 'Web Browser' : 'Terminal'}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0">
                    {desktopApp === 'prompt' && (
                      <Terminal
                        label={t('{device} command prompt', { device: device.name })}
                        prompt="C:\>"
                        lines={log}
                        onSubmit={onPromptSubmit}
                        placeholder="ping 192.168.1.1"
                      />
                    )}
                    {desktopApp === 'ip' && (
                      <IpConfiguration
                        device={device}
                        onApply={patch => { onUpdateDevice({ config: { ...device.config, ...patch, lease: (patch.ipMode ?? device.config.ipMode) === 'dhcp' ? device.config.lease : null } }) }}
                        onDhcp={onRequestDhcp}
                      />
                    )}
                    {desktopApp === 'web' && (
                      <WebBrowser onBrowse={onBrowse} />
                    )}
                  </div>
                </div>
              ) : (
                /* Cisco Packet Tracer Desktop Icon Grid */
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 p-4">
                  <button
                    type="button"
                    onClick={() => setDesktopApp('ip')}
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50/80 p-4 shadow-xs transition-all hover:border-sky-500 hover:bg-sky-50/50 hover:shadow-md cursor-pointer group"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-700 text-white shadow-xs group-hover:bg-sky-800">
                      <Settings className="h-6 w-6" />
                    </div>
                    <span className="mt-2 text-xs font-semibold text-slate-800">{t('IP Configuration')}</span>
                    <span className="text-[10px] text-slate-500">Static / DHCP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDesktopApp('prompt')}
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50/80 p-4 shadow-xs transition-all hover:border-sky-500 hover:bg-sky-50/50 hover:shadow-md cursor-pointer group"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs group-hover:bg-slate-950">
                      <TerminalIcon className="h-6 w-6 text-emerald-400" />
                    </div>
                    <span className="mt-2 text-xs font-semibold text-slate-800">{t('Command Prompt')}</span>
                    <span className="text-[10px] text-slate-500">ping, tracert, ipconfig</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDesktopApp('web')}
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50/80 p-4 shadow-xs transition-all hover:border-sky-500 hover:bg-sky-50/50 hover:shadow-md cursor-pointer group"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs group-hover:bg-teal-700">
                      <Globe className="h-6 w-6" />
                    </div>
                    <span className="mt-2 text-xs font-semibold text-slate-800">{t('Web Browser')}</span>
                    <span className="text-[10px] text-slate-500">HTTP Client</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDesktopApp('prompt')}
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50/80 p-4 shadow-xs transition-all hover:border-sky-500 hover:bg-sky-50/50 hover:shadow-md cursor-pointer group"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs group-hover:bg-indigo-700">
                      <Network className="h-6 w-6" />
                    </div>
                    <span className="mt-2 text-xs font-semibold text-slate-800">{t('Terminal')}</span>
                    <span className="text-[10px] text-slate-500">Console Serial</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

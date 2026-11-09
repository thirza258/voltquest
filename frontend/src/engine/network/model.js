import { isIp, isMask, isWildcard, macFor, parseIp } from './addr.js'

/**
 * The network lab's project format (`kind: 'network', version: 1`). Devices keep structured
 * configuration; the CLI edits that structure and `show running-config` prints it back. Runtime
 * tables (ARP, MAC, NAT, counters) live in a separate state object and are not saved.
 */
export const NETWORK_LIMITS = { devices: 24, links: 48, nameLength: 20, fileBytes: 200000 }

const fast = count => Array.from({ length: count }, (_v, i) => `Fa0/${i + 1}`)
export const DEVICE_TYPES = {
  pc: { label: 'PC', prefix: 'PC', ports: ['Fa0'], host: true },
  server: { label: 'Server', prefix: 'Server', ports: ['Fa0'], host: true },
  switch: { label: 'Switch', prefix: 'S', ports: [...fast(8), 'Gi0/1', 'Gi0/2'] },
  router: { label: 'Router', prefix: 'R', ports: ['Gi0/0', 'Gi0/1', 'Gi0/2'] },
}
export const isHost = device => Boolean(DEVICE_TYPES[device?.type]?.host)

const FULL = { Fa: 'FastEthernet', Gi: 'GigabitEthernet' }
/** `Gi0/0.10` → `GigabitEthernet0/0.10`, the spelling `show` commands use. */
export const fullPortName = port => port.replace(/^(Fa|Gi)/, prefix => FULL[prefix])

/**
 * Accept the abbreviations the router/switch CLI accepts — `g0/0`, `gig0/0`, `GigabitEthernet 0/0`,
 * `f0/1`, `fa0/1` — and return the short canonical name if that port (or subinterface) exists.
 */
export function normalizePort(text, type, { allowSub = false } = {}) {
  const match = String(text ?? '').trim().replace(/\s+/g, '').match(/^([a-z]+)(\d+\/\d+)(\.(\d{1,4}))?$/i)
  if (!match) return null
  const word = match[1].toLowerCase()
  const kind = 'gigabitethernet'.startsWith(word) && word.startsWith('g') ? 'Gi' : 'fastethernet'.startsWith(word) && word.startsWith('f') ? 'Fa' : null
  if (!kind) return null
  const base = `${kind}${match[2]}`
  if (!DEVICE_TYPES[type]?.ports.includes(base)) return null
  if (!match[3]) return base
  const sub = Number(match[4])
  return allowSub && type === 'router' && sub >= 1 && sub <= 4094 ? `${base}.${sub}` : null
}
export const physicalPort = port => port.split('.')[0]
export const portIndex = (type, port) => DEVICE_TYPES[type].ports.indexOf(physicalPort(port))
export const deviceMac = (device, port) => macFor(device.id, Math.max(0, portIndex(device.type, port)))

export function defaultConfig(type, name) {
  if (type === 'pc' || type === 'server') {
    const config = { ipMode: 'static', ip: '', mask: '', gateway: '', dns: '', lease: null }
    if (type === 'server') config.services = { http: { enabled: true, page: `Welcome to ${name}.` }, dns: { enabled: false, records: [] } }
    return config
  }
  if (type === 'switch') {
    return { hostname: name, vlans: { 1: 'default' },
      ports: Object.fromEntries(DEVICE_TYPES.switch.ports.map(port => [port, { mode: 'access', vlan: 1, allowed: 'all', native: 1, shutdown: false, description: '' }])) }
  }
  return { hostname: name,
    // Router interfaces start administratively down, as on real routers.
    interfaces: Object.fromEntries(DEVICE_TYPES.router.ports.map(port => [port, blankInterface()])),
    routes: [], ospf: null, dhcp: { excluded: [], pools: {} }, acls: {}, nat: { statics: [], overload: null } }
}
export const blankInterface = (extra = {}) => ({ ip: '', mask: '', shutdown: true, description: '', aclIn: '', aclOut: '', nat: '', ...extra })

export function emptyProject(name = 'Untitled network') {
  return { kind: 'network', version: 1, name, devices: [], links: [] }
}

const ID = /^[a-z][a-z0-9-]{0,31}$/
const NAME = /^[A-Za-z][A-Za-z0-9_-]{0,19}$/
const text = (value, max) => typeof value === 'string' && value.length <= max
const optionalIp = value => value === '' || isIp(value)
const optionalMask = value => value === '' || isMask(value)

function checkHost(config, type) {
  if (!['static', 'dhcp'].includes(config.ipMode) || !optionalIp(config.ip) || !optionalMask(config.mask) || !optionalIp(config.gateway) || !optionalIp(config.dns)) return false
  if (config.lease !== null && (typeof config.lease !== 'object' || !isIp(config.lease.ip) || !isMask(config.lease.mask) || !optionalIp(config.lease.gateway ?? '') || !optionalIp(config.lease.dns ?? ''))) return false
  if (type !== 'server') return config.services === undefined
  const { http, dns } = config.services ?? {}
  return Boolean(http && dns) && typeof http.enabled === 'boolean' && text(http.page, 2000) && typeof dns.enabled === 'boolean' && Array.isArray(dns.records) && dns.records.length <= 32
    && dns.records.every(record => /^[a-z0-9]([a-z0-9.-]{0,62})$/i.test(record.name ?? '') && isIp(record.ip))
}
function checkSwitch(config) {
  if (!text(config.hostname, 20) || typeof config.vlans !== 'object' || !config.vlans[1]) return false
  if (!Object.entries(config.vlans).every(([id, name]) => Number(id) >= 1 && Number(id) <= 4094 && text(name, 32))) return false
  return DEVICE_TYPES.switch.ports.every(port => {
    const value = config.ports?.[port]
    return value && ['access', 'trunk'].includes(value.mode) && Number.isInteger(value.vlan) && value.vlan >= 1 && value.vlan <= 4094 && Number.isInteger(value.native) && value.native >= 1 && value.native <= 4094
      && (value.allowed === 'all' || (Array.isArray(value.allowed) && value.allowed.every(v => Number.isInteger(v) && v >= 1 && v <= 4094))) && typeof value.shutdown === 'boolean' && text(value.description, 80)
  }) && Object.keys(config.ports).length === DEVICE_TYPES.switch.ports.length
}
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const routerPort = name => typeof name === 'string' && normalizePort(name, 'router', { allowSub: true }) === name
const spec = value => Array.isArray(value) && value.length === 2 && isIp(value[0]) && isWildcard(value[1])
function checkAcl(acl) {
  if (!isObject(acl) || !['standard', 'extended'].includes(acl.type) || !Array.isArray(acl.entries) || acl.entries.length > 64) return false
  return acl.entries.every(entry => entry?.action === 'remark' ? text(entry.text, 100)
    : ['permit', 'deny'].includes(entry?.action) && ['ip', 'icmp', 'tcp', 'udp'].includes(entry.proto) && spec(entry.src)
      && (acl.type === 'standard' ? !entry.dst : spec(entry.dst))
      && (entry.port === null || entry.port === undefined || (Number.isInteger(entry.port) && entry.port >= 0 && entry.port <= 65535))
      && (entry.icmpType === null || entry.icmpType === undefined || [0, 8].includes(entry.icmpType)))
}
function checkRouterServices(config) {
  const { ospf, dhcp, nat } = config
  const ospfOk = ospf === null || (isObject(ospf) && Number.isInteger(ospf.pid) && ospf.pid >= 1 && ospf.pid <= 65535 && (ospf.routerId === '' || isIp(ospf.routerId))
    && Array.isArray(ospf.networks) && ospf.networks.length <= 32 && ospf.networks.every(item => isIp(item?.network) && isWildcard(item.wildcard) && Number.isInteger(item.area) && item.area >= 0)
    && Array.isArray(ospf.passive) && ospf.passive.every(routerPort) && typeof ospf.defaultOriginate === 'boolean')
  const dhcpOk = isObject(dhcp) && Array.isArray(dhcp.excluded) && dhcp.excluded.length <= 32 && dhcp.excluded.every(item => isIp(item?.start) && isIp(item.end))
    && isObject(dhcp.pools) && Object.keys(dhcp.pools).length <= 16 && Object.entries(dhcp.pools).every(([name, pool]) => text(name, 32) && isObject(pool)
      && optionalIp(pool.network ?? '') && optionalMask(pool.mask ?? '') && optionalIp(pool.router ?? '') && optionalIp(pool.dns ?? ''))
  const natOk = isObject(nat) && Array.isArray(nat.statics) && nat.statics.length <= 32 && nat.statics.every(item => isIp(item?.inside) && isIp(item.outside))
    && (nat.overload === null || (isObject(nat.overload) && text(nat.overload.acl, 32) && routerPort(nat.overload.iface)))
  return ospfOk && dhcpOk && natOk && isObject(config.acls) && Object.keys(config.acls).length <= 32 && Object.entries(config.acls).every(([name, acl]) => text(name, 32) && checkAcl(acl))
}
function checkRouter(config) {
  if (!text(config.hostname, 20) || !isObject(config.interfaces) || !Array.isArray(config.routes) || config.routes.length > 64 || !checkRouterServices(config)) return false
  const names = Object.keys(config.interfaces)
  if (!DEVICE_TYPES.router.ports.every(port => names.includes(port)) || names.length > 24) return false
  return names.every(name => {
    const value = config.interfaces[name]
    const sub = name.includes('.')
    return normalizePort(name, 'router', { allowSub: true }) === name && optionalIp(value.ip) && optionalMask(value.mask) && typeof value.shutdown === 'boolean' && text(value.description, 80)
      && ['', 'inside', 'outside'].includes(value.nat) && text(value.aclIn, 32) && text(value.aclOut, 32)
      && (!sub || value.vlan === undefined || (Number.isInteger(value.vlan) && value.vlan >= 1 && value.vlan <= 4094))
  }) && config.routes.every(route => isIp(route.network) && isMask(route.mask) && (isIp(route.nextHop ?? '') || routerPort(route.iface)))
}
/** A saved startup configuration must itself be a valid configuration (one level deep). */
const checkSaved = (config, check) => config.saved === undefined || (isObject(config.saved) && config.saved.saved === undefined && check(config.saved))

/** Validate an imported project atomically; returns a cleaned deep copy or throws a readable error. */
export function validateProject(input) {
  if (!input || input.kind !== 'network' || input.version !== 1 || !Array.isArray(input.devices) || !Array.isArray(input.links)) throw new Error('Expected a VoltQuest network project, version 1.')
  if (input.devices.length > NETWORK_LIMITS.devices || input.links.length > NETWORK_LIMITS.links) throw new Error(`Network projects are limited to ${NETWORK_LIMITS.devices} devices and ${NETWORK_LIMITS.links} cables.`)
  const ids = new Set(), names = new Set()
  for (const device of input.devices) {
    if (!ID.test(device?.id ?? '') || !NAME.test(device?.name ?? '') || !DEVICE_TYPES[device.type] || !Number.isFinite(device.x) || !Number.isFinite(device.y)) throw new Error('Each device needs a valid id, name, type and position.')
    if (ids.has(device.id) || names.has(device.name.toLowerCase())) throw new Error(`Device ${device.name} is duplicated.`)
    ids.add(device.id); names.add(device.name.toLowerCase())
    const config = device.config
    const valid = isObject(config) && (isHost(device) ? checkHost(config, device.type) : device.type === 'switch' ? checkSwitch(config) && checkSaved(config, checkSwitch) : checkRouter(config) && checkSaved(config, checkRouter))
    if (!valid) throw new Error(`The configuration of ${device.name} is not valid.`)
  }
  const used = new Set()
  for (const link of input.links) {
    const ends = [link?.a, link?.b]
    if (!ID.test(link?.id ?? '') || ends.some(end => !ids.has(end?.device))) throw new Error('Each cable must join two devices in the project.')
    for (const end of ends) {
      const device = input.devices.find(item => item.id === end.device)
      if (!DEVICE_TYPES[device.type].ports.includes(end.port)) throw new Error(`${device.name} has no port ${end.port}.`)
      const key = `${end.device}|${end.port}`
      if (used.has(key)) throw new Error(`${device.name} ${end.port} has two cables.`)
      used.add(key)
    }
    if (link.a.device === link.b.device) throw new Error('A cable cannot join a device to itself.')
  }
  const copy = JSON.parse(JSON.stringify(input))
  return { kind: 'network', version: 1, name: text(copy.name, 60) ? copy.name : 'Untitled network', devices: copy.devices, links: copy.links }
}
export function parseProject(textValue) {
  if (typeof textValue !== 'string' || textValue.length > NETWORK_LIMITS.fileBytes) throw new Error('Network project files must be smaller than 200 KB.')
  let value
  try { value = JSON.parse(textValue) } catch { throw new Error('The network project is not valid JSON.') }
  return validateProject(value)
}

const nextName = (project, type) => {
  const prefix = DEVICE_TYPES[type].prefix
  for (let n = 1; ; n++) if (!project.devices.some(device => device.name.toLowerCase() === `${prefix}${n}`.toLowerCase())) return `${prefix}${n}`
}
const nextId = (project, base) => {
  for (let n = 1; ; n++) if (!project.devices.some(device => device.id === `${base}${n}`) && !project.links.some(link => link.id === `${base}${n}`)) return `${base}${n}`
}

export function addDevice(project, type, x = 100, y = 100) {
  if (!DEVICE_TYPES[type]) throw new Error('Unknown device type.')
  if (project.devices.length >= NETWORK_LIMITS.devices) throw new Error(`A network can hold at most ${NETWORK_LIMITS.devices} devices.`)
  const name = nextName(project, type)
  const device = { id: nextId(project, type), type, name, x: Math.round(x), y: Math.round(y), config: defaultConfig(type, name) }
  return { project: { ...project, devices: [...project.devices, device] }, device }
}
export function removeDevice(project, id) {
  return { ...project, devices: project.devices.filter(device => device.id !== id), links: project.links.filter(link => link.a.device !== id && link.b.device !== id) }
}
export function moveDevice(project, id, x, y) {
  return { ...project, devices: project.devices.map(device => device.id === id ? { ...device, x: Math.round(x), y: Math.round(y) } : device) }
}
export const linkAt = (project, device, port) => project.links.find(link => (link.a.device === device && link.a.port === port) || (link.b.device === device && link.b.port === port)) ?? null
export const freePorts = (project, device) => DEVICE_TYPES[device.type].ports.filter(port => !linkAt(project, device.id, port))

export function connect(project, a, b) {
  if (project.links.length >= NETWORK_LIMITS.links) throw new Error(`A network can hold at most ${NETWORK_LIMITS.links} cables.`)
  if (a.device === b.device) throw new Error('A cable cannot join a device to itself.')
  for (const end of [a, b]) {
    const device = project.devices.find(item => item.id === end.device)
    if (!device || !DEVICE_TYPES[device.type].ports.includes(end.port)) throw new Error('Choose an existing port on each device.')
    if (linkAt(project, end.device, end.port)) throw new Error(`${device.name} ${end.port} is already connected.`)
  }
  const link = { id: nextId(project, 'link'), a: { ...a }, b: { ...b } }
  return { ...project, links: [...project.links, link] }
}
export const disconnect = (project, linkId) => ({ ...project, links: project.links.filter(link => link.id !== linkId) })

export function updateDevice(project, id, update) {
  return { ...project, devices: project.devices.map(device => device.id === id ? update(device) : device) }
}
export const findDevice = (project, key) => project.devices.find(device => device.id === key || device.name.toLowerCase() === String(key).toLowerCase()) ?? null

/** Host addressing in effect: a DHCP lease when the host uses DHCP, otherwise its static settings. */
export function hostAddressing(device) {
  const config = device.config
  const source = config.ipMode === 'dhcp' ? (config.lease ?? { ip: '', mask: '', gateway: '', dns: '' }) : config
  const ip = parseIp(source.ip ?? ''), mask = parseIp(source.mask ?? '')
  return { ip, mask: isMask(source.mask ?? '') ? mask : null, gateway: parseIp(source.gateway ?? ''), dns: parseIp(source.dns ?? '') }
}

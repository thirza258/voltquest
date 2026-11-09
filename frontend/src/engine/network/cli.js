import { classfulMask, formatIp, isIp, isMask, isWildcard, maskToPrefix, networkOf, parseIp, sameSubnet, isHostAddress } from './addr.js'
import { DEVICE_TYPES, blankInterface, deviceMac, findDevice, fullPortName, normalizePort, updateDevice } from './model.js'
import { buildNetwork, ifaceUp, lineUp, ospfNeighbors, ping, routerInterfaces, routingTable, traceroute } from './sim.js'

/**
 * A teaching model of the router/switch command line: user EXEC, privileged EXEC and the
 * configuration modes, keyword abbreviation by unique prefix, `do`, and the usual error replies.
 * Commands edit the device's structured configuration; `show` commands print it and the runtime
 * tables back. Unsupported commands answer with the invalid-input marker, never silently.
 */
export const MODE_PROMPTS = { user: '>', priv: '#', config: '(config)#', if: '(config-if)#', subif: '(config-subif)#', range: '(config-if-range)#', router: '(config-router)#', dhcp: '(dhcp-config)#', vlan: '(config-vlan)#', 'std-nacl': '(config-std-nacl)#', 'ext-nacl': '(config-ext-nacl)#' }
const CONFIG_MODES = new Set(['config', 'if', 'subif', 'range', 'router', 'dhcp', 'vlan', 'std-nacl', 'ext-nacl'])
export const createSession = deviceId => ({ deviceId, mode: 'user', iface: null, ports: [], pool: null, vlan: null, acl: null })
export const promptFor = (device, session) => `${device.config.hostname}${MODE_PROMPTS[session.mode]}`

const PORT_NAMES = { 21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'domain', 67: 'bootps', 68: 'bootpc', 80: 'www', 110: 'pop3' }
const NAMED_PORTS = { ftp: 21, ssh: 22, telnet: 23, smtp: 25, domain: 53, bootps: 67, bootpc: 68, www: 80, http: 80, pop3: 110 }
const ANY = ['0.0.0.0', '255.255.255.255']

// ---------------------------------------------------------------- tokens and matching

function tokenize(line) {
  const tokens = []
  const pattern = /\S+/g
  let match
  while ((match = pattern.exec(line))) tokens.push({ text: match[0], start: match.index })
  // `interface gigabitEthernet 0/1` is one interface name written with a space.
  for (let i = 0; i < tokens.length - 1; i++) {
    const word = tokens[i].text.toLowerCase(), next = tokens[i + 1].text
    if (/^[a-z]+$/.test(word) && /^\d+\/\d+/.test(next) && (('gigabitethernet'.startsWith(word) && word.startsWith('g')) || ('fastethernet'.startsWith(word) && word.startsWith('f')))) {
      tokens.splice(i, 2, { text: tokens[i].text + next, start: tokens[i].start })
    }
  }
  return tokens
}
const range = (low, high) => text => /^\d+$/.test(text) && Number(text) >= low && Number(text) <= high
const VALIDATE = {
  ip: isIp, mask: isMask, wildcard: isWildcard,
  word: text => /^[A-Za-z0-9_.:/-]{1,32}$/.test(text),
  vlan: range(1, 4094), pid: range(1, 65535), area: range(0, 4294967295),
  aclnum: text => range(1, 99)(text) || range(100, 199)(text),
  target: text => text.length <= 64,
  any: () => true,
}
const keywordOf = token => token.startsWith('<') ? null : token

/** Command table entries: `when` lists modes, `types` device types; patterns are space separated. */
const COMMANDS = []
function command(when, types, pattern, run) { COMMANDS.push({ when, types, tokens: pattern.split(' '), run }) }

/**
 * Match a line against the commands of one mode. Keywords may be abbreviated to any unique prefix;
 * an exact keyword beats a longer one. Placeholders validate by type; `<iface>` checks the device's
 * ports and `<line>` takes the rest of the line.
 */
function match(line, mode, device) {
  const tokens = tokenize(line)
  let candidates = COMMANDS.filter(item => item.when.includes(mode) && item.types.includes(device.type))
  const args = new Map(candidates.map(item => [item, []]))
  for (let i = 0; i < tokens.length; i++) {
    const text = tokens[i].text, lower = text.toLowerCase()
    const rest = candidates.filter(item => item.tokens[i] === '<line>')
    if (rest.length && candidates.every(item => item.tokens[i] === '<line>' || !item.tokens[i])) {
      const chosen = rest[0]
      return { command: chosen, args: [...args.get(chosen), line.slice(tokens[i].start).trim()], tokens }
    }
    const keywords = candidates.filter(item => keywordOf(item.tokens[i] ?? '<none>'))
    const exact = keywords.filter(item => item.tokens[i].toLowerCase() === lower)
    const prefixed = keywords.filter(item => item.tokens[i].toLowerCase().startsWith(lower))
    const distinct = new Set(prefixed.map(item => item.tokens[i].toLowerCase()))
    let next
    if (exact.length) next = exact
    else if (distinct.size > 1) return { error: 'ambiguous', token: text, tokens }
    else if (prefixed.length) next = prefixed
    else {
      next = candidates.filter(item => {
        const slot = item.tokens[i]
        if (!slot || !slot.startsWith('<')) return false
        if (slot === '<line>') return true
        if (slot === '<iface>') return normalizePort(text, device.type, { allowSub: true }) !== null
        if (slot === '<port>') return normalizePort(text, device.type) !== null
        return VALIDATE[slot.slice(1, -1)]?.(text)
      })
      for (const item of next) args.set(item, [...args.get(item), item.tokens[i] === '<iface>' ? normalizePort(text, device.type, { allowSub: true }) : item.tokens[i] === '<port>' ? normalizePort(text, device.type) : text])
    }
    if (!next.length) return { error: 'invalid', index: i, tokens }
    if (next[0].tokens[i] === '<line>') return { command: next[0], args: [...args.get(next[0]), line.slice(tokens[i].start).trim()], tokens }
    candidates = next
  }
  const complete = candidates.filter(item => item.tokens.length === tokens.length)
  if (complete.length) return { command: complete[0], args: args.get(complete[0]), tokens }
  return { error: candidates.length ? 'incomplete' : 'invalid', index: tokens.length - 1, tokens }
}

// ---------------------------------------------------------------- execution

/**
 * Run one line on a device. Returns the next project and session plus the text the terminal prints.
 * `state` (ARP, MAC, NAT tables) is updated in place by pings and read by `show` commands.
 */
export function execute(project, state, session, line) {
  const device = findDevice(project, session.deviceId)
  const ctx = { project, state, session: { ...session }, device, out: [], events: [] }
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('!')) return { project, session, output: '', events: [] }
  const prompt = promptFor(device, session)
  let input = trimmed, mode = session.mode
  if (CONFIG_MODES.has(mode) && /^do\s+/i.test(input)) { input = input.replace(/^do\s+/i, ''); mode = 'priv' }
  const found = match(input, mode, device)
  if (found.error) {
    const offset = trimmed.length - input.length
    if (found.error === 'ambiguous') ctx.out.push(`% Ambiguous command:  "${input}"`)
    else if (found.error === 'incomplete') ctx.out.push('% Incomplete command.')
    else if (mode === 'user' || mode === 'priv') {
      if (found.tokens.length === 1 && found.index === 0) ctx.out.push('% Unknown command or computer name, or unable to find computer address')
      else ctx.out.push(`${' '.repeat(prompt.length + offset + found.tokens[found.index].start)}^`, "% Invalid input detected at '^' marker.")
    } else ctx.out.push(`${' '.repeat(prompt.length + offset + found.tokens[found.index].start)}^`, "% Invalid input detected at '^' marker.")
    return { project, session, output: ctx.out.join('\n'), events: [] }
  }
  ctx.tokens = found.tokens
  ctx.mode = mode
  found.command.run(ctx, found.args)
  // `do` runs in privileged EXEC but leaves you in the configuration mode you were in.
  const nextSession = mode !== session.mode ? { ...session } : ctx.session
  return { project: ctx.project, session: nextSession, output: ctx.out.join('\n'), events: ctx.events }
}

/** Replace the device's configuration with an edited deep copy. */
function edit(ctx, mutate) {
  const config = structuredClone(ctx.device.config)
  const result = mutate(config)
  ctx.project = updateDevice(ctx.project, ctx.device.id, device => ({ ...device, config }))
  ctx.device = findDevice(ctx.project, ctx.device.id)
  return result
}
const enter = (ctx, mode, extra = {}) => { ctx.session = { ...ctx.session, mode, ...extra } }
const ROUTERS = ['router'], SWITCHES = ['switch'], BOTH = ['router', 'switch']
const EXEC = ['user', 'priv'], PRIV = ['priv']

// ---------------------------------------------------------------- EXEC commands

command(['user'], BOTH, 'enable', ctx => enter(ctx, 'priv'))
command(PRIV, BOTH, 'disable', ctx => enter(ctx, 'user'))
command(EXEC, BOTH, 'exit', ctx => { enter(ctx, 'user'); ctx.out.push('', `${ctx.device.config.hostname} con0 is now available`, '', 'Press RETURN to get started.') })
command(EXEC, BOTH, 'logout', ctx => { enter(ctx, 'user'); ctx.out.push('', `${ctx.device.config.hostname} con0 is now available`, '', 'Press RETURN to get started.') })
command(PRIV, BOTH, 'configure terminal', ctx => { enter(ctx, 'config'); ctx.out.push('Enter configuration commands, one per line.  End with CNTL/Z.') })
command(PRIV, BOTH, 'show running-config', ctx => ctx.out.push(...runningConfig(ctx.device)))
command(PRIV, BOTH, 'show startup-config', ctx => ctx.out.push(...(ctx.device.config.saved ? runningConfig({ ...ctx.device, config: ctx.device.config.saved }).slice(2) : ['startup-config is not present'])))
command(PRIV, BOTH, 'copy running-config startup-config', ctx => { saveConfig(ctx); ctx.out.push('Destination filename [startup-config]? ', 'Building configuration...', '[OK]') })
command(PRIV, BOTH, 'write memory', ctx => { saveConfig(ctx); ctx.out.push('Building configuration...', '[OK]') })
command(PRIV, BOTH, 'write', ctx => { saveConfig(ctx); ctx.out.push('Building configuration...', '[OK]') })
command(EXEC, BOTH, 'show ip interface brief', ctx => ctx.out.push(...interfaceBrief(ctx)))
command(EXEC, ROUTERS, 'show ip route', ctx => ctx.out.push(...routeTable(ctx)))
command(EXEC, ROUTERS, 'show ip arp', ctx => ctx.out.push(...arpTable(ctx)))
command(EXEC, ROUTERS, 'show arp', ctx => ctx.out.push(...arpTable(ctx)))
command(EXEC, ROUTERS, 'show access-lists', ctx => ctx.out.push(...accessLists(ctx)))
command(EXEC, ROUTERS, 'show ip access-lists', ctx => ctx.out.push(...accessLists(ctx)))
command(EXEC, ROUTERS, 'show ip nat translations', ctx => ctx.out.push(...natTable(ctx)))
command(EXEC, ROUTERS, 'show ip ospf neighbor', ctx => ctx.out.push(...ospfTable(ctx)))
command(EXEC, ROUTERS, 'show ip dhcp binding', ctx => ctx.out.push(...dhcpBindings(ctx)))
command(EXEC, SWITCHES, 'show vlan brief', ctx => ctx.out.push(...vlanBrief(ctx)))
command(EXEC, SWITCHES, 'show vlan', ctx => ctx.out.push(...vlanBrief(ctx)))
command(EXEC, SWITCHES, 'show mac address-table', ctx => ctx.out.push(...macTable(ctx)))
command(EXEC, SWITCHES, 'show mac-address-table', ctx => ctx.out.push(...macTable(ctx)))
command(EXEC, SWITCHES, 'show interfaces trunk', ctx => ctx.out.push(...trunkTable(ctx)))
command(EXEC, ROUTERS, 'ping <target>', (ctx, [target]) => ctx.out.push(...routerPing(ctx, target)))
command(EXEC, ROUTERS, 'traceroute <target>', (ctx, [target]) => ctx.out.push(...routerTrace(ctx, target)))
command(PRIV, ROUTERS, 'clear arp-cache', ctx => { ctx.state.arp[ctx.device.id] = {} })
command(PRIV, SWITCHES, 'clear mac address-table dynamic', ctx => { ctx.state.mac[ctx.device.id] = {} })
command(PRIV, ROUTERS, 'clear ip nat translation <line>', (ctx, [rest]) => {
  if (rest !== '*') { ctx.out.push("% Invalid input detected at '^' marker."); return }
  ctx.state.nat[ctx.device.id] = []
})
command(PRIV, ROUTERS, 'clear access-list counters', ctx => { ctx.state.hits[ctx.device.id] = {} })
// Router-id changes already apply at once in this model; the command is accepted so the usual workflow runs.
command(PRIV, ROUTERS, 'clear ip ospf process', ctx => { ctx.out.push('Reset ALL OSPF processes? [no]: yes', '% OSPF processes reset (this lab confirms automatically).') })

function saveConfig(ctx) { edit(ctx, config => { const copy = structuredClone(config); delete copy.saved; config.saved = copy }) }

// ---------------------------------------------------------------- global configuration

const LEAVE = ['config', 'if', 'subif', 'range', 'router', 'dhcp', 'vlan', 'std-nacl', 'ext-nacl']
command(LEAVE, BOTH, 'end', ctx => enter(ctx, 'priv', { iface: null, ports: [], pool: null, vlan: null, acl: null }))
command(['config'], BOTH, 'exit', ctx => enter(ctx, 'priv'))
command(['if', 'subif', 'range', 'router', 'dhcp', 'vlan', 'std-nacl', 'ext-nacl'], BOTH, 'exit', ctx => enter(ctx, 'config', { iface: null, ports: [], pool: null, vlan: null, acl: null }))
command(['config'], BOTH, 'hostname <word>', (ctx, [name]) => edit(ctx, config => { config.hostname = name }))

const INTERFACE_MODES = ['config', 'if', 'subif', 'range']
command(INTERFACE_MODES, BOTH, 'interface <iface>', (ctx, [name]) => {
  if (name.includes('.')) {
    edit(ctx, config => { config.interfaces[name] ??= blankInterface({ shutdown: false }) })
    enter(ctx, 'subif', { iface: name, ports: [] })
  } else enter(ctx, 'if', { iface: name, ports: [] })
})
command(INTERFACE_MODES, SWITCHES, 'interface range <line>', (ctx, [text]) => {
  const ports = parseRange(text)
  if (!ports) { ctx.out.push("% Invalid input detected at '^' marker."); return }
  enter(ctx, 'range', { iface: null, ports })
})
/** `fa0/1 - 4`, `fa0/1-4`, `fa0/1 - fa0/4`, and comma-separated groups of those. */
function parseRange(text) {
  const ports = []
  for (const group of text.split(',')) {
    const m = group.replace(/\s+/g, '').match(/^([a-z]+)(\d+)\/(\d+)(?:-(?:[a-z]+\d+\/)?(\d+))?$/i)
    if (!m) return null
    const first = Number(m[3]), last = m[4] ? Number(m[4]) : first
    if (last < first) return null
    for (let n = first; n <= last; n++) {
      const port = normalizePort(`${m[1]}${m[2]}/${n}`, 'switch')
      if (!port) return null
      if (!ports.includes(port)) ports.push(port)
    }
  }
  return ports.length ? ports : null
}

function addRoute(ctx, network, mask, hop) {
  if (networkOf(parseIp(network), parseIp(mask)) !== parseIp(network)) { ctx.out.push('%Inconsistent address and mask'); return }
  const iface = isIp(hop) ? null : hop
  edit(ctx, config => {
    const route = iface ? { network, mask, iface } : { network, mask, nextHop: hop }
    if (!config.routes.some(item => item.network === network && item.mask === mask && (item.nextHop ?? item.iface) === hop)) config.routes.push(route)
  })
}
command(['config'], ROUTERS, 'ip route <ip> <mask> <ip>', (ctx, [network, mask, hop]) => addRoute(ctx, network, mask, hop))
command(['config'], ROUTERS, 'ip route <ip> <mask> <iface>', (ctx, [network, mask, hop]) => addRoute(ctx, network, mask, hop))
command(['config'], ROUTERS, 'no ip route <ip> <mask> <ip>', (ctx, [network, mask, hop]) => edit(ctx, config => { config.routes = config.routes.filter(item => !(item.network === network && item.mask === mask && item.nextHop === hop)) }))
command(['config'], ROUTERS, 'no ip route <ip> <mask> <iface>', (ctx, [network, mask, hop]) => edit(ctx, config => { config.routes = config.routes.filter(item => !(item.network === network && item.mask === mask && item.iface === hop)) }))
command(['config'], ROUTERS, 'no ip route <ip> <mask>', (ctx, [network, mask]) => edit(ctx, config => { config.routes = config.routes.filter(item => !(item.network === network && item.mask === mask)) }))

command(['config', 'router'], ROUTERS, 'router ospf <pid>', (ctx, [pid]) => {
  const current = ctx.device.config.ospf
  if (current && current.pid !== Number(pid)) { ctx.out.push(`% Only one OSPF process is supported in this lab (process ${current.pid} is running).`); return }
  edit(ctx, config => { config.ospf ??= { pid: Number(pid), routerId: '', networks: [], passive: [], defaultOriginate: false } })
  enter(ctx, 'router')
})
command(['config'], ROUTERS, 'no router ospf <pid>', (ctx, [pid]) => edit(ctx, config => { if (config.ospf?.pid === Number(pid)) config.ospf = null }))

const excluded = (ctx, start, end, remove) => {
  if (parseIp(end) < parseIp(start)) { ctx.out.push('% Invalid address range'); return }
  edit(ctx, config => {
    const list = config.dhcp.excluded.filter(item => !(item.start === start && item.end === end))
    if (!remove) list.push({ start, end })
    config.dhcp.excluded = list
  })
}
command(['config'], ROUTERS, 'ip dhcp excluded-address <ip>', (ctx, [start]) => excluded(ctx, start, start, false))
command(['config'], ROUTERS, 'ip dhcp excluded-address <ip> <ip>', (ctx, [start, end]) => excluded(ctx, start, end, false))
command(['config'], ROUTERS, 'no ip dhcp excluded-address <ip>', (ctx, [start]) => excluded(ctx, start, start, true))
command(['config'], ROUTERS, 'no ip dhcp excluded-address <ip> <ip>', (ctx, [start, end]) => excluded(ctx, start, end, true))
command(['config', 'dhcp'], ROUTERS, 'ip dhcp pool <word>', (ctx, [name]) => {
  edit(ctx, config => { config.dhcp.pools[name] ??= { network: '', mask: '', router: '', dns: '' } })
  enter(ctx, 'dhcp', { pool: name })
})
command(['config'], ROUTERS, 'no ip dhcp pool <word>', (ctx, [name]) => edit(ctx, config => { delete config.dhcp.pools[name] }))
command(['dhcp'], ROUTERS, 'network <ip> <mask>', (ctx, [network, mask]) => edit(ctx, config => { Object.assign(config.dhcp.pools[ctx.session.pool], { network: formatIp(networkOf(parseIp(network), parseIp(mask))), mask }) }))
command(['dhcp'], ROUTERS, 'default-router <ip>', (ctx, [ip]) => edit(ctx, config => { config.dhcp.pools[ctx.session.pool].router = ip }))
command(['dhcp'], ROUTERS, 'dns-server <ip>', (ctx, [ip]) => edit(ctx, config => { config.dhcp.pools[ctx.session.pool].dns = ip }))

// Numbered access lists: 1–99 standard, 100–199 extended.
command(['config'], ROUTERS, 'access-list <aclnum> <line>', (ctx, [number, rest]) => {
  const type = Number(number) < 100 ? 'standard' : 'extended'
  const existing = ctx.device.config.acls[number]
  if (existing && existing.type !== type) { ctx.out.push('% Access list type mismatch.'); return }
  aclLine(ctx, number, type, rest, ctx.tokens.findIndex(token => token.text === number) + 1)
})
command(['config'], ROUTERS, 'no access-list <aclnum>', (ctx, [number]) => edit(ctx, config => { delete config.acls[number] }))
command(['config', 'std-nacl', 'ext-nacl'], ROUTERS, 'ip access-list standard <word>', (ctx, [name]) => namedAcl(ctx, name, 'standard'))
command(['config', 'std-nacl', 'ext-nacl'], ROUTERS, 'ip access-list extended <word>', (ctx, [name]) => namedAcl(ctx, name, 'extended'))
command(['config'], ROUTERS, 'no ip access-list standard <word>', (ctx, [name]) => edit(ctx, config => { delete config.acls[name] }))
command(['config'], ROUTERS, 'no ip access-list extended <word>', (ctx, [name]) => edit(ctx, config => { delete config.acls[name] }))
function namedAcl(ctx, name, type) {
  if (/^\d+$/.test(name)) { ctx.out.push('% Use the access-list command for numbered lists.'); return }
  const existing = ctx.device.config.acls[name]
  if (existing && existing.type !== type) { ctx.out.push(`% A named ${existing.type} IP access list with this name already exists`); return }
  edit(ctx, config => { config.acls[name] ??= { type, entries: [] } })
  enter(ctx, type === 'standard' ? 'std-nacl' : 'ext-nacl', { acl: name })
}
for (const action of ['permit', 'deny']) {
  command(['std-nacl'], ROUTERS, `${action} <line>`, (ctx, [rest]) => aclLine(ctx, ctx.session.acl, 'standard', `${action} ${rest}`, 0))
  command(['ext-nacl'], ROUTERS, `${action} <line>`, (ctx, [rest]) => aclLine(ctx, ctx.session.acl, 'extended', `${action} ${rest}`, 0))
}
command(['std-nacl', 'ext-nacl'], ROUTERS, 'remark <line>', (ctx, [text]) => edit(ctx, config => { config.acls[ctx.session.acl].entries.push({ action: 'remark', text }) }))

/** Parse `permit|deny …` (or `remark …`) for a standard or extended list and append the entry. */
function aclLine(ctx, name, type, text, tokenOffset) {
  const words = text.trim().split(/\s+/)
  const fail = index => {
    const token = ctx.tokens[Math.min(ctx.tokens.length - 1, tokenOffset + index)]
    ctx.out.push(`${' '.repeat(promptFor(ctx.device, ctx.session).length + (token?.start ?? 0))}^`, "% Invalid input detected at '^' marker.")
  }
  const keyword = (word, options) => options.filter(option => option.startsWith((word ?? '').toLowerCase()) && word)
  const [first] = keyword(words[0], ['permit', 'deny', 'remark'])
  if (!first || keyword(words[0], ['permit', 'deny', 'remark']).length > 1) { fail(0); return }
  if (first === 'remark') { edit(ctx, config => { (config.acls[name] ??= { type, entries: [] }).entries.push({ action: 'remark', text: words.slice(1).join(' ') }) }); return }
  let i = 1
  const address = (standard) => {
    const word = (words[i] ?? '').toLowerCase()
    if (!word) return null
    if ('any'.startsWith(word)) { i++; return ANY }
    if ('host'.startsWith(word)) { const ip = words[i + 1]; if (!isIp(ip)) { i++; return null } i += 2; return [ip, '0.0.0.0'] }
    if (!isIp(words[i])) return null
    const ip = words[i]
    if (isWildcard(words[i + 1] ?? '')) { const wildcard = words[i + 1]; i += 2; return [formatIp((parseIp(ip) & ~parseIp(wildcard)) >>> 0), wildcard] }
    if (standard) { i++; return [ip, '0.0.0.0'] }
    return null
  }
  const entry = { action: first, proto: 'ip', src: null, dst: null, port: null, icmpType: null }
  if (type === 'standard') {
    entry.src = address(true)
    if (!entry.src || i !== words.length) { fail(i); return }
  } else {
    const [proto] = keyword(words[1], ['ip', 'icmp', 'tcp', 'udp'])
    if (!proto || keyword(words[1], ['ip', 'icmp', 'tcp', 'udp']).length > 1) { fail(1); return }
    entry.proto = proto; i = 2
    entry.src = address(false); if (!entry.src) { fail(i); return }
    entry.dst = address(false); if (!entry.dst) { fail(i); return }
    if (i < words.length) {
      const word = words[i].toLowerCase()
      if ((proto === 'tcp' || proto === 'udp') && word === 'eq') {
        const portWord = (words[i + 1] ?? '').toLowerCase()
        const port = /^\d+$/.test(portWord) && Number(portWord) <= 65535 ? Number(portWord) : NAMED_PORTS[portWord]
        if (port === undefined) { fail(i + 1); return }
        entry.port = port; i += 2
      } else if (proto === 'icmp' && ['echo', 'echo-reply'].includes(word)) { entry.icmpType = word === 'echo' ? 8 : 0; i++ }
      if (i !== words.length) { fail(i); return }
    }
  }
  edit(ctx, config => { (config.acls[name] ??= { type, entries: [] }).entries.push(entry) })
}

command(['config'], ROUTERS, 'ip nat inside source static <ip> <ip>', (ctx, [inside, outside]) => edit(ctx, config => {
  config.nat.statics = [...config.nat.statics.filter(item => item.inside !== inside), { inside, outside }]
}))
command(['config'], ROUTERS, 'no ip nat inside source static <ip> <ip>', (ctx, [inside, outside]) => edit(ctx, config => { config.nat.statics = config.nat.statics.filter(item => !(item.inside === inside && item.outside === outside)) }))
command(['config'], ROUTERS, 'ip nat inside source list <word> interface <iface> overload', (ctx, [acl, iface]) => edit(ctx, config => { config.nat.overload = { acl, iface } }))
command(['config'], ROUTERS, 'no ip nat inside source list <word> interface <iface> overload', ctx => edit(ctx, config => { config.nat.overload = null }))

command(['config', 'vlan'], SWITCHES, 'vlan <vlan>', (ctx, [id]) => {
  edit(ctx, config => { config.vlans[id] ??= `VLAN${String(id).padStart(4, '0')}` })
  enter(ctx, 'vlan', { vlan: Number(id) })
})
command(['config'], SWITCHES, 'no vlan <vlan>', (ctx, [id]) => {
  if (Number(id) === 1) { ctx.out.push('%Default VLAN 1 may not be deleted.'); return }
  edit(ctx, config => { delete config.vlans[id] })
})
command(['vlan'], SWITCHES, 'name <word>', (ctx, [name]) => edit(ctx, config => { config.vlans[ctx.session.vlan] = name }))

// ---------------------------------------------------------------- interface configuration

const ROUTER_IF = ['if', 'subif']
function routerIface(ctx) { return ctx.device.config.interfaces[ctx.session.iface] }
function stateChange(ctx, name, up) {
  const full = fullPortName(name)
  if (!up) { ctx.out.push('', `%LINK-5-CHANGED: Interface ${full}, changed state to administratively down`, '', `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${full}, changed state to down`); return }
  const net = buildNetwork(ctx.project, ctx.state)
  const live = ctx.device.type === 'router' ? ifaceUp(net, ctx.device, name) : lineUp(net, ctx.device, name)
  ctx.out.push('', `%LINK-5-CHANGED: Interface ${full}, changed state to ${live ? 'up' : 'down'}`)
  if (live) ctx.out.push('', `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${full}, changed state to up`)
}
command(ROUTER_IF, ROUTERS, 'ip address <ip> <mask>', (ctx, [ip, mask]) => {
  const name = ctx.session.iface, address = parseIp(ip), netmask = parseIp(mask)
  if (ctx.session.mode === 'subif' && !routerIface(ctx).vlan) { ctx.out.push('', '% Configuring IP routing on a LAN subinterface is only allowed if that subinterface is already configured as part of an IEEE 802.10, IEEE 802.1Q, or ISL vLAN.'); return }
  if (!isHostAddress(address, netmask)) { ctx.out.push(`Bad mask /${maskToPrefix(mask)} for address ${ip}`); return }
  const clash = Object.entries(ctx.device.config.interfaces).find(([other, config]) => other !== name && config.ip && config.mask && (sameSubnet(address, parseIp(config.ip), netmask) || sameSubnet(address, parseIp(config.ip), parseIp(config.mask))))
  if (clash) { ctx.out.push(`% ${formatIp(networkOf(address, netmask))} overlaps with ${fullPortName(clash[0])}`); return }
  edit(ctx, config => { Object.assign(config.interfaces[name], { ip, mask }) })
})
command(ROUTER_IF, ROUTERS, 'no ip address', ctx => edit(ctx, config => { Object.assign(config.interfaces[ctx.session.iface], { ip: '', mask: '' }) }))
command(['subif'], ROUTERS, 'encapsulation dot1Q <vlan>', (ctx, [vlan]) => edit(ctx, config => { config.interfaces[ctx.session.iface].vlan = Number(vlan) }))
command(ROUTER_IF, ROUTERS, 'ip access-group <word> in', (ctx, [acl]) => edit(ctx, config => { config.interfaces[ctx.session.iface].aclIn = acl }))
command(ROUTER_IF, ROUTERS, 'ip access-group <word> out', (ctx, [acl]) => edit(ctx, config => { config.interfaces[ctx.session.iface].aclOut = acl }))
command(ROUTER_IF, ROUTERS, 'no ip access-group <word> in', ctx => edit(ctx, config => { config.interfaces[ctx.session.iface].aclIn = '' }))
command(ROUTER_IF, ROUTERS, 'no ip access-group <word> out', ctx => edit(ctx, config => { config.interfaces[ctx.session.iface].aclOut = '' }))
command(ROUTER_IF, ROUTERS, 'ip nat inside', ctx => edit(ctx, config => { config.interfaces[ctx.session.iface].nat = 'inside' }))
command(ROUTER_IF, ROUTERS, 'ip nat outside', ctx => edit(ctx, config => { config.interfaces[ctx.session.iface].nat = 'outside' }))
command(ROUTER_IF, ROUTERS, 'no ip nat inside', ctx => edit(ctx, config => { config.interfaces[ctx.session.iface].nat = '' }))
command(ROUTER_IF, ROUTERS, 'no ip nat outside', ctx => edit(ctx, config => { config.interfaces[ctx.session.iface].nat = '' }))
command(ROUTER_IF, ROUTERS, 'shutdown', ctx => { const was = routerIface(ctx).shutdown; edit(ctx, config => { config.interfaces[ctx.session.iface].shutdown = true }); if (!was) stateChange(ctx, ctx.session.iface, false) })
command(ROUTER_IF, ROUTERS, 'no shutdown', ctx => { const was = routerIface(ctx).shutdown; edit(ctx, config => { config.interfaces[ctx.session.iface].shutdown = false }); if (was) stateChange(ctx, ctx.session.iface, true) })
command(ROUTER_IF, ROUTERS, 'description <line>', (ctx, [text]) => edit(ctx, config => { config.interfaces[ctx.session.iface].description = text.slice(0, 80) }))
command(ROUTER_IF, ROUTERS, 'no description', ctx => edit(ctx, config => { config.interfaces[ctx.session.iface].description = '' }))

const SWITCH_IF = ['if', 'range']
const targetPorts = ctx => ctx.session.mode === 'range' ? ctx.session.ports : [ctx.session.iface]
const eachPort = (ctx, mutate) => edit(ctx, config => { for (const port of targetPorts(ctx)) mutate(config.ports[port], config) })
command(SWITCH_IF, SWITCHES, 'switchport mode access', ctx => eachPort(ctx, port => { port.mode = 'access' }))
command(SWITCH_IF, SWITCHES, 'switchport mode trunk', ctx => eachPort(ctx, port => { port.mode = 'trunk' }))
command(SWITCH_IF, SWITCHES, 'switchport access vlan <vlan>', (ctx, [id]) => {
  if (!ctx.device.config.vlans[id]) ctx.out.push('% Access VLAN does not exist. Creating vlan ' + id)
  eachPort(ctx, (port, config) => { port.vlan = Number(id); config.vlans[id] ??= `VLAN${String(id).padStart(4, '0')}` })
})
command(SWITCH_IF, SWITCHES, 'no switchport access vlan', ctx => eachPort(ctx, port => { port.vlan = 1 }))
command(SWITCH_IF, SWITCHES, 'switchport trunk native vlan <vlan>', (ctx, [id]) => eachPort(ctx, port => { port.native = Number(id) }))
command(SWITCH_IF, SWITCHES, 'no switchport trunk native vlan', ctx => eachPort(ctx, port => { port.native = 1 }))
command(SWITCH_IF, SWITCHES, 'switchport trunk allowed vlan <line>', (ctx, [text]) => {
  const words = text.toLowerCase().split(/\s+/)
  const apply = (fn) => eachPort(ctx, port => { port.allowed = fn(port.allowed === 'all' ? null : port.allowed) })
  if (words[0] === 'all' && words.length === 1) { apply(() => 'all'); return }
  const listText = ['add', 'remove', 'except'].includes(words[0]) ? words[1] : words[0]
  const list = parseVlanList(listText)
  if (!list || words.length > (listText === words[0] ? 1 : 2)) { ctx.out.push("% Invalid input detected at '^' marker."); return }
  if (words[0] === 'add') apply(current => current === null ? 'all' : [...new Set([...current, ...list])].sort((a, b) => a - b))
  else if (words[0] === 'remove') apply(current => (current ?? range4094()).filter(v => !list.includes(v)))
  else if (words[0] === 'except') apply(() => range4094().filter(v => !list.includes(v)))
  else apply(() => list)
})
const range4094 = () => Array.from({ length: 4094 }, (_v, i) => i + 1)
export function parseVlanList(text) {
  if (!text) return null
  const values = []
  for (const part of text.split(',')) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/)
    if (!m) return null
    const low = Number(m[1]), high = Number(m[2] ?? m[1])
    if (low < 1 || high > 4094 || high < low) return null
    for (let v = low; v <= high; v++) values.push(v)
  }
  return [...new Set(values)].sort((a, b) => a - b)
}
command(SWITCH_IF, SWITCHES, 'shutdown', ctx => { const changed = targetPorts(ctx).filter(port => !ctx.device.config.ports[port].shutdown); eachPort(ctx, port => { port.shutdown = true }); changed.forEach(port => stateChange(ctx, port, false)) })
command(SWITCH_IF, SWITCHES, 'no shutdown', ctx => { const changed = targetPorts(ctx).filter(port => ctx.device.config.ports[port].shutdown); eachPort(ctx, port => { port.shutdown = false }); changed.forEach(port => stateChange(ctx, port, true)) })
command(SWITCH_IF, SWITCHES, 'description <line>', (ctx, [text]) => eachPort(ctx, port => { port.description = text.slice(0, 80) }))
command(SWITCH_IF, SWITCHES, 'no description', ctx => eachPort(ctx, port => { port.description = '' }))

// ---------------------------------------------------------------- OSPF

const ospf = (ctx, mutate) => edit(ctx, config => mutate(config.ospf))
command(['router'], ROUTERS, 'network <ip> <wildcard> area <area>', (ctx, [network, wildcard, area]) => {
  const existing = ctx.device.config.ospf.networks.find(item => item.network === network && item.wildcard === wildcard)
  if (existing && existing.area !== Number(area)) { ctx.out.push(`% OSPF: network ${network} ${wildcard} is already in area ${existing.area}; remove it with "no network" first`); return }
  ospf(ctx, process => { if (!existing) process.networks.push({ network, wildcard, area: Number(area) }) })
})
command(['router'], ROUTERS, 'no network <ip> <wildcard> area <area>', (ctx, [network, wildcard]) => ospf(ctx, process => { process.networks = process.networks.filter(item => !(item.network === network && item.wildcard === wildcard)) }))
command(['router'], ROUTERS, 'router-id <ip>', (ctx, [id]) => { ospf(ctx, process => { process.routerId = id }); ctx.out.push('% OSPF: Reload or use "clear ip ospf process" command, for this to take effect') })
command(['router'], ROUTERS, 'no router-id', ctx => ospf(ctx, process => { process.routerId = '' }))
command(['router'], ROUTERS, 'passive-interface <iface>', (ctx, [iface]) => ospf(ctx, process => { if (!process.passive.includes(iface)) process.passive.push(iface) }))
command(['router'], ROUTERS, 'no passive-interface <iface>', (ctx, [iface]) => ospf(ctx, process => { process.passive = process.passive.filter(item => item !== iface) }))
command(['router'], ROUTERS, 'default-information originate', ctx => ospf(ctx, process => { process.defaultOriginate = true }))
command(['router'], ROUTERS, 'no default-information originate', ctx => ospf(ctx, process => { process.defaultOriginate = false }))

// ---------------------------------------------------------------- show output

const pad = (text, width) => String(text).padEnd(width)
function interfaceStatus(net, device, name) {
  if (device.type === 'switch') {
    const port = device.config.ports[name]
    return port.shutdown ? ['administratively down', 'down'] : lineUp(net, device, name) ? ['up', 'up'] : ['down', 'down']
  }
  const config = device.config.interfaces[name]
  if (config.shutdown) return ['administratively down', 'down']
  return ifaceUp(net, device, name) ? ['up', 'up'] : ['down', 'down']
}
function interfaceBrief(ctx) {
  const net = buildNetwork(ctx.project, ctx.state), device = ctx.device
  const names = device.type === 'switch' ? DEVICE_TYPES.switch.ports : Object.keys(device.config.interfaces).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const lines = [`${pad('Interface', 23)}${pad('IP-Address', 16)}OK? Method Status                Protocol `]
  for (const name of names) {
    const config = device.type === 'switch' ? {} : device.config.interfaces[name]
    const [status, protocol] = interfaceStatus(net, device, name)
    lines.push(`${pad(fullPortName(name), 23)}${pad(config.ip || 'unassigned', 16)}YES ${pad(config.ip ? 'manual' : 'unset', 7)}${pad(status, 22)}${protocol} `)
  }
  return lines
}
function routeText(entry) {
  const dest = `${formatIp(entry.network)}/${maskToPrefix(entry.mask)}`
  if (entry.code === 'C' || entry.code === 'L' || (entry.code === 'S' && !entry.nextHop)) return `${dest} is directly connected, ${fullPortName(entry.iface)}`
  if (entry.code === 'S') return `${dest} [1/0] via ${formatIp(entry.nextHop)}`
  return `${dest} [110/${entry.metric}] via ${formatIp(entry.nextHop)}, ${fullPortName(entry.iface)}`
}
const routeCode = entry => entry.code === 'O' && entry.external ? 'O*E2' : entry.mask === 0 ? `${entry.code}*` : entry.code
function routeTable(ctx) {
  const net = buildNetwork(ctx.project, ctx.state), table = routingTable(net, ctx.device)
  const lines = ['Codes: L - local, C - connected, S - static, O - OSPF', '       * - candidate default, E2 - OSPF external type 2', '']
  const fallback = table.find(entry => entry.mask === 0)
  lines.push(fallback ? `Gateway of last resort is ${fallback.nextHop ? formatIp(fallback.nextHop) : '0.0.0.0'} to network 0.0.0.0` : 'Gateway of last resort is not set', '')
  // Group by classful major network as the router CLI prints it; supernets stand alone.
  const groups = new Map(), loose = []
  for (const entry of table) {
    const major = classfulMask(entry.network)
    if (entry.mask < major) { loose.push(entry); continue }
    const key = networkOf(entry.network, major)
    if (!groups.has(key)) groups.set(key, { major, entries: [] })
    groups.get(key).entries.push(entry)
  }
  for (const entry of loose) lines.push(`${pad(routeCode(entry), 6)}${routeText(entry)}`)
  for (const [network, group] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    const { entries, major } = group
    if (entries.length === 1 && entries[0].mask === major) { lines.push(`${pad(routeCode(entries[0]), 6)}${routeText(entries[0])}`); continue }
    const masks = new Set(entries.map(entry => entry.mask))
    lines.push(masks.size === 1
      ? `      ${formatIp(network)}/${maskToPrefix([...masks][0])} is subnetted, ${entries.length} subnets`
      : `      ${formatIp(network)}/${maskToPrefix(major)} is variably subnetted, ${entries.length} subnets, ${masks.size} masks`)
    for (const entry of entries) lines.push(`${pad(routeCode(entry), 9)}${routeText(entry)}`)
  }
  return lines
}
function arpTable(ctx) {
  const net = buildNetwork(ctx.project, ctx.state)
  const lines = ['Protocol  Address          Age (min)  Hardware Addr   Type   Interface']
  const rows = []
  for (const iface of routerInterfaces(ctx.device).filter(item => ifaceUp(net, ctx.device, item.name))) rows.push([iface.ip, '-', deviceMac(ctx.device, iface.name), iface.name])
  for (const [ip, entry] of Object.entries(ctx.state.arp[ctx.device.id] ?? {})) rows.push([parseIp(ip), '0', entry.mac, entry.iface])
  rows.sort((a, b) => a[0] - b[0])
  for (const [ip, age, mac, iface] of rows) lines.push(`Internet  ${pad(formatIp(ip), 17)}${age.padStart(9)}   ${pad(mac, 16)}ARPA   ${fullPortName(iface)}`)
  return lines
}
function aclEntryText(acl, entry) {
  const spec = ([ip, wildcard], standard) => wildcard === '255.255.255.255' ? 'any' : wildcard === '0.0.0.0' ? (standard ? ip : `host ${ip}`) : standard ? `${ip}, wildcard bits ${wildcard}` : `${ip} ${wildcard}`
  if (acl.type === 'standard') return `${entry.action} ${spec(entry.src, true)}`
  const port = entry.port !== null && entry.port !== undefined ? ` eq ${PORT_NAMES[entry.port] ?? entry.port}` : ''
  const icmp = entry.icmpType === 8 ? ' echo' : entry.icmpType === 0 ? ' echo-reply' : ''
  return `${entry.action} ${entry.proto} ${spec(entry.src)} ${spec(entry.dst)}${port}${icmp}`
}
function accessLists(ctx) {
  const lines = []
  const names = Object.keys(ctx.device.config.acls).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  for (const name of names) {
    const acl = ctx.device.config.acls[name], hits = ctx.state.hits[ctx.device.id]?.[name] ?? {}
    lines.push(`${acl.type === 'standard' ? 'Standard' : 'Extended'} IP access list ${name}`)
    let seq = 0
    acl.entries.forEach((entry, index) => {
      if (entry.action === 'remark') return
      seq += 10
      lines.push(`    ${seq} ${aclEntryText(acl, entry)}${hits[index] ? ` (${hits[index]} match${hits[index] === 1 ? '' : 'es'})` : ''}`)
    })
  }
  return lines
}
function natTable(ctx) {
  const lines = [`${pad('Pro', 5)}${pad('Inside global', 22)}${pad('Inside local', 22)}${pad('Outside local', 22)}Outside global`]
  for (const entry of ctx.state.nat[ctx.device.id] ?? []) {
    const global = `${formatIp(entry.insideGlobal)}:${entry.globalPort}`, local = `${formatIp(entry.insideLocal)}:${entry.localPort}`, outside = `${formatIp(entry.outside)}:${entry.outsidePort}`
    lines.push(`${pad(entry.proto, 5)}${pad(global, 22)}${pad(local, 22)}${pad(outside, 22)}${outside}`)
  }
  for (const item of ctx.device.config.nat.statics) lines.push(`${pad('---', 5)}${pad(item.outside, 22)}${pad(item.inside, 22)}${pad('---', 22)}---`)
  return lines
}
function ospfTable(ctx) {
  if (!ctx.device.config.ospf) return []
  const net = buildNetwork(ctx.project, ctx.state)
  const lines = ['', 'Neighbor ID     Pri   State           Dead Time   Address         Interface']
  for (const neighbor of ospfNeighbors(net, ctx.device)) lines.push(`${pad(formatIp(neighbor.neighborId), 16)}${pad('1', 6)}${pad('FULL/  -', 16)}${pad('--', 12)}${pad(formatIp(neighbor.address), 16)}${fullPortName(neighbor.iface)}`)
  return lines
}
function dhcpBindings(ctx) {
  const lines = ['IP address       Client-ID/              Lease expiration        Type', '                 Hardware address']
  const bindings = Object.entries(ctx.state.bindings[ctx.device.id] ?? {}).sort((a, b) => parseIp(a[0]) - parseIp(b[0]))
  for (const [ip, binding] of bindings) lines.push(`${pad(ip, 17)}${pad(binding.mac.toUpperCase(), 24)}${pad('--', 24)}Automatic`)
  return lines
}
function vlanBrief(ctx) {
  const config = ctx.device.config
  const lines = ['', `${pad('VLAN', 5)}${pad('Name', 33)}${pad('Status', 10)}Ports`, `${'-'.repeat(4)} ${'-'.repeat(32)} ${'-'.repeat(9)} ${'-'.repeat(31)}`]
  for (const id of Object.keys(config.vlans).map(Number).sort((a, b) => a - b)) {
    const ports = DEVICE_TYPES.switch.ports.filter(port => config.ports[port].mode === 'access' && config.ports[port].vlan === id)
    const chunks = []
    for (let i = 0; i < ports.length; i += 4) chunks.push(ports.slice(i, i + 4).join(', '))
    lines.push(`${pad(id, 5)}${pad(config.vlans[id], 33)}${pad('active', 10)}${chunks[0] ?? ''}`)
    for (const chunk of chunks.slice(1)) lines.push(`${' '.repeat(48)}${chunk}`)
  }
  return lines
}
function macTable(ctx) {
  const lines = ['          Mac Address Table', '-------------------------------------------', '', 'Vlan    Mac Address       Type        Ports', '----    -----------       --------    -----', '']
  const rows = Object.entries(ctx.state.mac[ctx.device.id] ?? {}).map(([key, port]) => { const [vlan, mac] = key.split('|'); return [Number(vlan), mac, port] })
  rows.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]))
  for (const [vlan, mac, port] of rows) lines.push(`${String(vlan).padStart(4)}    ${pad(mac, 18)}${pad('DYNAMIC', 12)}${port}`)
  return lines
}
export function vlanListText(list) {
  if (list === 'all') return '1-4094'
  const parts = []
  for (let i = 0; i < list.length; i++) {
    let j = i
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++
    parts.push(j > i ? `${list[i]}-${list[j]}` : String(list[i]))
    i = j
  }
  return parts.join(',') || 'none'
}
function trunkTable(ctx) {
  const net = buildNetwork(ctx.project, ctx.state), config = ctx.device.config
  const trunks = DEVICE_TYPES.switch.ports.filter(port => config.ports[port].mode === 'trunk' && lineUp(net, ctx.device, port))
  if (!trunks.length) return []
  const lines = [`${pad('Port', 12)}${pad('Mode', 13)}${pad('Encapsulation', 15)}${pad('Status', 14)}Native vlan`]
  for (const port of trunks) lines.push(`${pad(port, 12)}${pad('on', 13)}${pad('802.1q', 15)}${pad('trunking', 14)}${config.ports[port].native}`)
  lines.push('', `${pad('Port', 12)}Vlans allowed on trunk`)
  for (const port of trunks) lines.push(`${pad(port, 12)}${vlanListText(config.ports[port].allowed)}`)
  lines.push('', `${pad('Port', 12)}Vlans allowed and active in management domain`)
  for (const port of trunks) {
    const active = Object.keys(config.vlans).map(Number).filter(vlan => config.ports[port].allowed === 'all' || config.ports[port].allowed.includes(vlan)).sort((a, b) => a - b)
    lines.push(`${pad(port, 12)}${vlanListText(active)}`)
  }
  return lines
}
function routerPing(ctx, target) {
  if (!isIp(target)) return ['% Unrecognized host or address, or protocol not running.']
  const result = ping(ctx.project, ctx.state, ctx.device.id, target)
  ctx.events.push(...result.events)
  const marks = result.error === 'no-route' ? '.....' : result.replies.map(reply => reply.kind === 'echo-reply' ? '!' : reply.kind === 'unreachable' ? (reply.code === 13 ? 'A' : 'U') : '.').join('')
  const ok = [...marks].filter(mark => mark === '!').length
  return ['Type escape sequence to abort.', `Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`, marks,
    `Success rate is ${Math.round(ok / 5 * 100)} percent (${ok}/5)${ok ? ', round-trip min/avg/max = 0/0/0 ms' : ''}`]
}
function routerTrace(ctx, target) {
  if (!isIp(target)) return ['% Unrecognized host or address, or protocol not running.']
  const result = traceroute(ctx.project, ctx.state, ctx.device.id, target)
  ctx.events.push(...(result.events ?? []))
  const lines = ['Type escape sequence to abort.', `Tracing the route to ${target}`, '']
  for (const hop of result.hops ?? []) {
    const from = hop.replies.find(reply => reply.kind !== 'timeout')?.from
    lines.push(`  ${hop.ttl} ${from !== undefined ? formatIp(from) : ''} ${hop.replies.map(reply => reply.kind === 'timeout' ? '*' : '0 msec').join(' ')}`.replace(/\s+$/, ''))
  }
  return lines
}

// ---------------------------------------------------------------- running configuration

export function runningConfig(device) {
  const c = device.config, out = ['!', `hostname ${c.hostname}`, '!']
  if (device.type === 'switch') {
    for (const port of DEVICE_TYPES.switch.ports) {
      const p = c.ports[port]
      out.push(`interface ${fullPortName(port)}`)
      if (p.description) out.push(` description ${p.description}`)
      if (p.mode === 'access' && p.vlan !== 1) out.push(` switchport access vlan ${p.vlan}`)
      if (p.mode === 'trunk' && p.native !== 1) out.push(` switchport trunk native vlan ${p.native}`)
      if (p.mode === 'trunk' && p.allowed !== 'all') out.push(` switchport trunk allowed vlan ${vlanListText(p.allowed)}`)
      out.push(` switchport mode ${p.mode}`)
      if (p.shutdown) out.push(' shutdown')
      out.push('!')
    }
  } else {
    if (c.dhcp.excluded.length) { for (const range of c.dhcp.excluded) out.push(`ip dhcp excluded-address ${range.start}${range.end !== range.start ? ` ${range.end}` : ''}`); out.push('!') }
    for (const [name, pool] of Object.entries(c.dhcp.pools)) {
      out.push(`ip dhcp pool ${name}`)
      if (pool.network) out.push(` network ${pool.network} ${pool.mask}`)
      if (pool.router) out.push(` default-router ${pool.router}`)
      if (pool.dns) out.push(` dns-server ${pool.dns}`)
      out.push('!')
    }
    for (const name of Object.keys(c.interfaces).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
      const i = c.interfaces[name]
      out.push(`interface ${fullPortName(name)}`)
      if (i.description) out.push(` description ${i.description}`)
      if (name.includes('.') && i.vlan) out.push(` encapsulation dot1Q ${i.vlan}`)
      out.push(i.ip ? ` ip address ${i.ip} ${i.mask}` : ' no ip address')
      if (i.aclIn) out.push(` ip access-group ${i.aclIn} in`)
      if (i.aclOut) out.push(` ip access-group ${i.aclOut} out`)
      if (i.nat) out.push(` ip nat ${i.nat}`)
      if (i.shutdown) out.push(' shutdown')
      out.push('!')
    }
    if (c.ospf) {
      out.push(`router ospf ${c.ospf.pid}`)
      if (c.ospf.routerId) out.push(` router-id ${c.ospf.routerId}`)
      for (const iface of c.ospf.passive) out.push(` passive-interface ${fullPortName(iface)}`)
      for (const n of c.ospf.networks) out.push(` network ${n.network} ${n.wildcard} area ${n.area}`)
      if (c.ospf.defaultOriginate) out.push(' default-information originate')
      out.push('!')
    }
    if (c.nat.overload) out.push(`ip nat inside source list ${c.nat.overload.acl} interface ${fullPortName(c.nat.overload.iface)} overload`)
    for (const item of c.nat.statics) out.push(`ip nat inside source static ${item.inside} ${item.outside}`)
    for (const route of c.routes) out.push(`ip route ${route.network} ${route.mask} ${route.nextHop ?? fullPortName(route.iface)}`)
    out.push('!')
    for (const [name, acl] of Object.entries(c.acls)) {
      if (/^\d+$/.test(name)) for (const entry of acl.entries) out.push(entry.action === 'remark' ? `access-list ${name} remark ${entry.text}` : `access-list ${name} ${aclEntryText(acl, entry).replace(', wildcard bits', '')}`)
      else {
        out.push(`ip access-list ${acl.type} ${name}`)
        for (const entry of acl.entries) out.push(entry.action === 'remark' ? ` remark ${entry.text}` : ` ${aclEntryText(acl, entry).replace(', wildcard bits', '')}`)
      }
    }
    out.push('!')
  }
  out.push('end')
  const body = out.join('\n')
  return ['Building configuration...', '', `Current configuration : ${body.length} bytes`, ...out]
}

/** Replies that mean the line was rejected; informational notices (`% Access VLAN does not exist. Creating …`, `%LINK-5-CHANGED`) are not errors. */
const ERROR_LINES = [/^% OSPF: network .* is already in area/, /^% Invalid input/, /^% Incomplete command/, /^% Ambiguous command/, /^% Unknown command/, /^Bad mask/, /overlaps with/, /^% Configuring IP routing on a LAN subinterface/, /^% Access list type mismatch/, /^% Only one OSPF process/, /^%Inconsistent address and mask/, /^% Invalid address range/, /^% Unrecognized host/, /^%Default VLAN 1 may not be deleted/, /^% Use the access-list command/, /^% A named/]
export const cliError = output => output.split('\n').some(line => ERROR_LINES.some(pattern => pattern.test(line.trim())))
/** Every keyword path the CLI accepts, for documentation and content validation. */
export const COMMAND_PATTERNS = () => COMMANDS.map(item => ({ modes: item.when, types: item.types, pattern: item.tokens.join(' ') }))

import { BROADCAST_MAC, formatIp, isHostAddress, maskToPrefix, networkOf, parseIp, sameSubnet } from './addr.js'
import { deviceMac, findDevice, hostAddressing, isHost, physicalPort } from './model.js'

/**
 * A deterministic, event-driven packet model. One operation (a ping, a DHCP renewal, a web request)
 * runs frames hop by hop through the cabled topology until nothing is left to deliver; every
 * delivery is recorded as an event for the step-by-step view. Simplifications are deliberate and
 * documented in docs/NETWORKING.md: no STP, no timers or ageing, TCP is four segments, OSPF is a
 * single-area shortest-path computation without DR/BDR elections.
 */
export const EVENT_LIMIT = 3000
/** Frames that cross more switches than this are dropped: the guard that stops a cabled loop. */
export const SWITCH_HOP_LIMIT = 24
const BROADCAST_IP = 0xffffffff
const HOST_TTL = 128, ROUTER_TTL = 255
const portKey = (device, port) => `${device}|${port}`
export const emptyState = () => ({ arp: {}, mac: {}, nat: {}, hits: {}, bindings: {} })

export function buildNetwork(project, state = emptyState()) {
  const devices = new Map(project.devices.map(device => [device.id, device]))
  const peers = new Map()
  for (const link of project.links) { peers.set(portKey(link.a.device, link.a.port), link.b); peers.set(portKey(link.b.device, link.b.port), link.a) }
  return { project, devices, peers, state }
}

// ---------------------------------------------------------------- interface state

export function adminUp(device, port) {
  if (isHost(device)) return true
  if (device.type === 'switch') return device.config.ports[port] ? !device.config.ports[port].shutdown : false
  return device.config.interfaces[port] ? !device.config.interfaces[port].shutdown : false
}
/** A physical port is up when it is cabled and both ends are administratively up. */
export function lineUp(net, device, port) {
  const peer = net.peers.get(portKey(device.id, port))
  return Boolean(peer) && adminUp(device, port) && adminUp(net.devices.get(peer.device), peer.port)
}
export function ifaceUp(net, router, name) {
  const config = router.config.interfaces[name]
  return Boolean(config) && !config.shutdown && lineUp(net, router, physicalPort(name))
}
/** Router interfaces (and subinterfaces) that have an address. */
export function routerInterfaces(router) {
  return Object.entries(router.config.interfaces).filter(([, config]) => config.ip && config.mask)
    .map(([name, config]) => ({ name, ip: parseIp(config.ip), mask: parseIp(config.mask), vlan: name.includes('.') ? (config.vlan ?? null) : null, config }))
}
const upInterfaces = (net, router) => routerInterfaces(router).filter(iface => ifaceUp(net, router, iface.name))
const ownsAddress = (net, router, ip) => upInterfaces(net, router).some(iface => iface.ip === ip)

// ---------------------------------------------------------------- switching semantics

const allowedOn = (port, vlan) => port.allowed === 'all' || port.allowed.includes(vlan)
/** VLAN a frame belongs to as it enters a switch port, or null when the port must drop it. */
export function ingressVlan(sw, port, tag) {
  const config = sw.config.ports[port]
  if (config.mode === 'access') return tag === null ? config.vlan : null
  const vlan = tag ?? config.native
  return allowedOn(config, vlan) ? vlan : null
}
function memberPorts(net, sw, vlan, except) {
  if (!sw.config.vlans[vlan]) return []
  return Object.entries(sw.config.ports).filter(([port, config]) => port !== except && lineUp(net, sw, port)
    && (config.mode === 'access' ? config.vlan === vlan : allowedOn(config, vlan))).map(([port]) => port)
}
/** Tag to put on the wire when a frame in `vlan` leaves this port. */
const egressTag = (sw, port, vlan) => sw.config.ports[port].mode === 'trunk' && sw.config.ports[port].native !== vlan ? vlan : null

/**
 * Layer-3 endpoints that share a broadcast domain with a router interface or host: walks cables and
 * switches with the same VLAN rules frames follow. Used for OSPF adjacency.
 */
export function broadcastDomain(net, device, ifaceName) {
  const tag = device.type === 'router' && ifaceName.includes('.') ? (device.config.interfaces[ifaceName]?.vlan ?? null) : null
  const found = [], seen = new Set()
  const walk = (fromDevice, fromPort, wireTag) => {
    const peer = net.peers.get(portKey(fromDevice, fromPort))
    if (!peer || !lineUp(net, net.devices.get(fromDevice), fromPort)) return
    const visit = `${peer.device}|${peer.port}|${wireTag}`
    if (seen.has(visit)) return
    seen.add(visit)
    const target = net.devices.get(peer.device)
    if (target.type === 'switch') {
      const vlan = ingressVlan(target, peer.port, wireTag)
      if (vlan === null) return
      for (const out of memberPorts(net, target, vlan, peer.port)) walk(target.id, out, egressTag(target, out, vlan))
    } else if (target.type === 'router') {
      const entry = routerInterfaces(target).find(iface => physicalPort(iface.name) === peer.port && (wireTag === null ? !iface.name.includes('.') : iface.vlan === wireTag))
      if (entry && ifaceUp(net, target, entry.name)) found.push({ device: target, iface: entry })
    } else if (wireTag === null) found.push({ device: target, iface: { name: 'Fa0' } })
  }
  walk(device.id, physicalPort(ifaceName), tag)
  return found
}

// ---------------------------------------------------------------- routing

const AD = { C: 0, L: 0, S: 1, O: 110 }
function longestMatch(entries, ip) {
  let best = null
  for (const entry of entries) if (((ip & entry.mask) >>> 0) === entry.network && (!best || entry.mask > best.mask)) best = entry
  return best
}
function connectedRoutes(net, router) {
  return upInterfaces(net, router).flatMap(iface => [
    { code: 'C', network: networkOf(iface.ip, iface.mask), mask: iface.mask, iface: iface.name, nextHop: null, ad: 0, metric: 0 },
    ...(maskToPrefix(iface.mask) < 32 ? [{ code: 'L', network: iface.ip, mask: 0xffffffff, iface: iface.name, nextHop: null, ad: 0, metric: 0 }] : []),
  ])
}
function staticRoutes(net, router, connected = connectedRoutes(net, router)) {
  const result = []
  for (const route of router.config.routes) {
    const mask = parseIp(route.mask), network = networkOf(parseIp(route.network), mask)
    if (route.iface) { if (ifaceUp(net, router, route.iface)) result.push({ code: 'S', network, mask, iface: route.iface, nextHop: null, ad: AD.S, metric: 0 }) }
    else {
      const hop = parseIp(route.nextHop), via = longestMatch(connected.filter(entry => entry.code === 'C'), hop)
      if (via) result.push({ code: 'S', network, mask, iface: via.iface, nextHop: hop, ad: AD.S, metric: 0 })
    }
  }
  return result
}

/** OSPF area for an interface whose address matches a `network … area` statement, else null. */
export function ospfArea(router, iface) {
  for (const statement of router.config.ospf?.networks ?? []) {
    const wildcard = parseIp(statement.wildcard), keep = (~wildcard) >>> 0
    if (((iface.ip & keep) >>> 0) === ((parseIp(statement.network) & keep) >>> 0)) return statement.area
  }
  return null
}
export function ospfRouterId(net, router) {
  if (router.config.ospf?.routerId) return parseIp(router.config.ospf.routerId)
  const addresses = upInterfaces(net, router).map(iface => iface.ip)
  return addresses.length ? Math.max(...addresses) : null
}
const ospfInterfaces = (net, router) => router.config.ospf ? upInterfaces(net, router).filter(iface => ospfArea(router, iface) !== null) : []
/** Adjacent OSPF routers: same subnet and area, reachable at layer 2, neither side passive. */
export function ospfNeighbors(net, router) {
  if (!router.config.ospf) return []
  const passive = new Set(router.config.ospf.passive ?? [])
  const result = []
  for (const iface of ospfInterfaces(net, router)) {
    if (passive.has(iface.name)) continue
    const area = ospfArea(router, iface)
    for (const endpoint of broadcastDomain(net, router, iface.name)) {
      const other = endpoint.device
      if (other.type !== 'router' || other.id === router.id || !other.config.ospf || (other.config.ospf.passive ?? []).includes(endpoint.iface.name)) continue
      const theirs = endpoint.iface
      if (!sameSubnet(theirs.ip, iface.ip, iface.mask) || theirs.mask !== iface.mask || ospfArea(other, theirs) !== area) continue
      result.push({ router: other, neighborId: ospfRouterId(net, other), address: theirs.ip, iface: iface.name, area })
    }
  }
  return result
}
function ospfRoutes(net, router) {
  if (!router.config.ospf) return []
  const routers = [...net.devices.values()].filter(device => device.type === 'router' && device.config.ospf)
  const dist = new Map([[router.id, 0]]), firstHop = new Map(), done = new Set()
  while (true) {
    let current = null
    for (const [id, d] of dist) if (!done.has(id) && (current === null || d < dist.get(current) || (d === dist.get(current) && id < current))) current = id
    if (current === null) break
    done.add(current)
    const node = net.devices.get(current)
    for (const neighbor of ospfNeighbors(net, node)) {
      const next = dist.get(current) + 1
      if (!dist.has(neighbor.router.id) || next < dist.get(neighbor.router.id)) {
        dist.set(neighbor.router.id, next)
        firstHop.set(neighbor.router.id, current === router.id ? { nextHop: neighbor.address, iface: neighbor.iface } : firstHop.get(current))
      }
    }
  }
  const connected = connectedRoutes(net, router)
  const best = new Map()
  for (const other of routers) {
    if (other.id === router.id || !dist.has(other.id)) continue
    const hop = firstHop.get(other.id)
    for (const iface of ospfInterfaces(net, other)) {
      const network = networkOf(iface.ip, iface.mask), metric = dist.get(other.id) + 1
      if (connected.some(entry => entry.code === 'C' && entry.network === network && entry.mask === iface.mask)) continue
      const key = `${network}/${iface.mask}`
      if (!best.has(key) || metric < best.get(key).metric) best.set(key, { code: 'O', network, mask: iface.mask, nextHop: hop.nextHop, iface: hop.iface, ad: AD.O, metric })
    }
    if (other.config.ospf.defaultOriginate && staticRoutes(net, other).some(route => route.mask === 0)) {
      const metric = 1
      if (!best.has('default') || dist.get(other.id) < best.get('default').distance) best.set('default', { code: 'O', external: true, network: 0, mask: 0, nextHop: hop.nextHop, iface: hop.iface, ad: AD.O, metric, distance: dist.get(other.id) })
    }
  }
  return [...best.values()]
}
/** The router's selected routes: one per prefix, lowest administrative distance wins. */
export function routingTable(net, router) {
  const connected = connectedRoutes(net, router)
  const candidates = [...connected, ...staticRoutes(net, router, connected), ...ospfRoutes(net, router)]
  const best = new Map()
  for (const entry of candidates) {
    const key = `${entry.network}/${entry.mask}`
    if (!best.has(key) || entry.ad < best.get(key).ad) best.set(key, entry)
  }
  return [...best.values()].sort((a, b) => a.network - b.network || a.mask - b.mask)
}
export const lookupRoute = (net, router, ip) => longestMatch(routingTable(net, router), ip)

// ---------------------------------------------------------------- access lists and NAT

const wildcardMatch = (ip, [address, wildcard]) => ((ip & ~wildcard) >>> 0) === ((address & ~wildcard) >>> 0)
/** Parsed entry → matcher; entries store dotted strings so the project file stays readable. */
function entryMatches(acl, entry, packet) {
  const src = [parseIp(entry.src[0]), parseIp(entry.src[1])]
  if (!wildcardMatch(packet.src, src)) return false
  if (acl.type === 'standard') return true
  if (entry.proto !== 'ip' && entry.proto !== packet.proto) return false
  if (!wildcardMatch(packet.dst, [parseIp(entry.dst[0]), parseIp(entry.dst[1])])) return false
  if (entry.icmpType !== null && entry.icmpType !== undefined && (packet.proto !== 'icmp' || packet.icmp.type !== entry.icmpType)) return false
  if (entry.port !== null && entry.port !== undefined) {
    const port = packet.proto === 'tcp' ? packet.tcp.dport : packet.proto === 'udp' ? packet.udp.dport : null
    if (port !== entry.port) return false
  }
  return true
}
/** First matching entry decides; nothing matching is the implicit deny. A missing list permits. */
export function aclDecision(net, router, name, packet, { count = true } = {}) {
  const acl = router.config.acls[name]
  if (!acl) return { permitted: true, entry: null }
  const index = acl.entries.findIndex(entry => entry.action !== 'remark' && entryMatches(acl, entry, packet))
  if (index < 0) return { permitted: false, entry: null }
  if (count) {
    const hits = ((net.state.hits[router.id] ??= {})[name] ??= {})
    hits[index] = (hits[index] ?? 0) + 1
  }
  return { permitted: acl.entries[index].action === 'permit', entry: index }
}
const portOf = packet => packet.proto === 'icmp' ? packet.icmp.id : packet.proto === 'tcp' ? packet.tcp.sport : packet.udp?.sport
const destPortOf = packet => packet.proto === 'icmp' ? packet.icmp.id : packet.proto === 'tcp' ? packet.tcp.dport : packet.udp?.dport
function withSource(packet, ip, port) {
  const copy = { ...packet, src: ip }
  if (packet.proto === 'icmp') copy.icmp = { ...packet.icmp, id: port }
  else if (packet.proto === 'tcp') copy.tcp = { ...packet.tcp, sport: port }
  else copy.udp = { ...packet.udp, sport: port }
  return copy
}
function withDestination(packet, ip, port) {
  const copy = { ...packet, dst: ip }
  if (packet.proto === 'icmp') copy.icmp = { ...packet.icmp, id: port }
  else if (packet.proto === 'tcp') copy.tcp = { ...packet.tcp, dport: port }
  else copy.udp = { ...packet.udp, dport: port }
  return copy
}
/** Inside → outside: static one-to-one first, then port address translation (overload). */
function natOutbound(net, router, packet, egress, notes) {
  const nat = router.config.nat, table = (net.state.nat[router.id] ??= [])
  const fixed = nat.statics.find(entry => parseIp(entry.inside) === packet.src)
  if (fixed) { notes.push(`NAT: static ${formatIp(packet.src)} → ${fixed.outside}`); return { ...packet, src: parseIp(fixed.outside) } }
  if (!nat.overload || nat.overload.iface !== egress.name) return packet
  if (!aclDecision(net, router, nat.overload.acl, packet, { count: false }).permitted) return packet
  const local = portOf(packet)
  const existing = table.find(entry => entry.proto === packet.proto && entry.insideLocal === packet.src && entry.localPort === local && entry.outside === packet.dst)
  let globalPort = existing?.globalPort ?? local
  if (!existing) {
    while (table.some(entry => entry.proto === packet.proto && entry.globalPort === globalPort && entry.insideGlobal === egress.ip)) globalPort = globalPort < 1024 ? 1024 : globalPort + 1
    table.push({ proto: packet.proto, insideLocal: packet.src, localPort: local, insideGlobal: egress.ip, globalPort, outside: packet.dst, outsidePort: destPortOf(packet) })
  }
  notes.push(`NAT overload: ${formatIp(packet.src)}:${local} → ${formatIp(egress.ip)}:${globalPort}`)
  return withSource(packet, egress.ip, globalPort)
}
/** Outside → inside: reverse a static mapping or a recorded overload translation. */
function natInbound(net, router, packet, notes) {
  const nat = router.config.nat
  const fixed = nat.statics.find(entry => parseIp(entry.outside) === packet.dst)
  if (fixed) { notes.push(`NAT: static ${formatIp(packet.dst)} → ${fixed.inside}`); return { ...packet, dst: parseIp(fixed.inside) } }
  const entry = (net.state.nat[router.id] ?? []).find(item => item.proto === packet.proto && item.insideGlobal === packet.dst && item.globalPort === destPortOf(packet))
  if (!entry) return packet
  notes.push(`NAT overload: ${formatIp(packet.dst)}:${entry.globalPort} → ${formatIp(entry.insideLocal)}:${entry.localPort}`)
  return withDestination(packet, entry.insideLocal, entry.localPort)
}

// ---------------------------------------------------------------- the run: queue, events, delivery

function createRun(net) {
  return { net, queue: [], events: [], time: 0, limited: false, pending: new Map(), results: [] }
}
const nameOf = (run, id) => run.net.devices.get(id)?.name ?? id
const ipText = ip => formatIp(ip)

export function frameLabel(frame) {
  if (frame.type === 'ARP') return 'ARP'
  const packet = frame.ip
  if (packet.proto === 'icmp') return 'ICMP'
  if (packet.proto === 'udp') return packet.udp.app === 'dhcp' ? 'DHCP' : 'DNS'
  return packet.tcp.data ? 'HTTP' : 'TCP'
}
/** Human-readable layers for the step-by-step view. */
export function describeFrame(frame) {
  const layers = [{ layer: 'Ethernet II', text: `${frame.src} → ${frame.dst}${frame.vlan !== null ? ` · 802.1Q VLAN ${frame.vlan}` : ''}` }]
  if (frame.type === 'ARP') {
    const arp = frame.arp
    layers.push({ layer: 'ARP', text: arp.op === 'request' ? `Who has ${ipText(arp.targetIp)}? Tell ${ipText(arp.senderIp)}` : `${ipText(arp.senderIp)} is at ${arp.senderMac}` })
    return layers
  }
  const packet = frame.ip
  layers.push({ layer: 'IPv4', text: `${ipText(packet.src)} → ${ipText(packet.dst)} · TTL ${packet.ttl}` })
  if (packet.proto === 'icmp') {
    const { type, code, id, seq } = packet.icmp
    const kind = type === 8 ? 'Echo request' : type === 0 ? 'Echo reply' : type === 11 ? 'Time exceeded' : code === 13 ? 'Destination unreachable (administratively prohibited)' : code === 1 ? 'Destination unreachable (host)' : 'Destination unreachable (network)'
    layers.push({ layer: 'ICMP', text: `${kind}${type === 8 || type === 0 ? ` · id ${id} seq ${seq}` : ''}` })
  } else if (packet.proto === 'udp') {
    layers.push({ layer: 'UDP', text: `port ${packet.udp.sport} → ${packet.udp.dport}` })
    const data = packet.udp.data
    layers.push(packet.udp.app === 'dhcp' ? { layer: 'DHCP', text: `${data.op}${data.ip ? ` ${ipText(data.ip)}` : ''}` }
      : { layer: 'DNS', text: data.answer === undefined ? `Query A ${data.name}` : data.answer === null ? `${data.name}: no such name` : `${data.name} A ${ipText(data.answer)}` })
  } else {
    layers.push({ layer: 'TCP', text: `port ${packet.tcp.sport} → ${packet.tcp.dport} · ${packet.tcp.flags}` })
    if (packet.tcp.data) layers.push({ layer: 'HTTP', text: packet.tcp.data.request ? `GET ${packet.tcp.data.request}` : `${packet.tcp.data.status} ${packet.tcp.data.status === 200 ? 'OK' : ''}`.trim() })
  }
  return layers
}

function transmit(run, deviceId, port, frame) {
  const device = run.net.devices.get(deviceId)
  if (!lineUp(run.net, device, port)) return false
  run.queue.push({ at: run.time + 1, from: { device: deviceId, port }, to: run.net.peers.get(portKey(deviceId, port)), frame })
  return true
}
function drain(run) {
  while (run.queue.length) {
    if (run.events.length >= EVENT_LIMIT) { run.limited = true; run.queue = []; break }
    const item = run.queue.shift()
    run.time = item.at
    const event = { seq: run.events.length + 1, time: item.at, from: nameOf(run, item.from.device), fromId: item.from.device, fromPort: item.from.port,
      to: nameOf(run, item.to.device), toId: item.to.device, toPort: item.to.port, protocol: frameLabel(item.frame), layers: describeFrame(item.frame), notes: [] }
    run.events.push(event)
    const device = run.net.devices.get(item.to.device)
    if (device.type === 'switch') switchReceive(run, device, item.to.port, item.frame, event.notes)
    else if (device.type === 'router') routerReceive(run, device, item.to.port, item.frame, event.notes)
    else hostReceive(run, device, item.frame, event.notes)
  }
}

// ---------------------------------------------------------------- switches

function switchReceive(run, sw, port, frame, notes) {
  if ((frame.hops ?? 0) >= SWITCH_HOP_LIMIT) { notes.push(`Dropped: the frame crossed ${SWITCH_HOP_LIMIT} switches, which means a loop in the cabling. This lab does not run Spanning Tree.`); return }
  const vlan = ingressVlan(sw, port, frame.vlan)
  if (vlan === null) { notes.push(sw.config.ports[port].mode === 'access' ? `Dropped: tagged frame on access port ${port}.` : `Dropped: VLAN ${frame.vlan} is not allowed on trunk ${port}.`); return }
  if (!sw.config.vlans[vlan]) { notes.push(`Dropped: VLAN ${vlan} does not exist on ${sw.name}.`); return }
  const table = (run.net.state.mac[sw.id] ??= {})
  if (frame.src !== BROADCAST_MAC) {
    if (table[`${vlan}|${frame.src}`] !== port) notes.push(`Learned ${frame.src} on ${port} (VLAN ${vlan}).`)
    table[`${vlan}|${frame.src}`] = port
  }
  const known = frame.dst === BROADCAST_MAC ? null : table[`${vlan}|${frame.dst}`]
  const outPorts = known ? (known === port ? [] : [known]) : memberPorts(run.net, sw, vlan, port)
  if (known === port) notes.push('Filtered: the destination is on the port the frame arrived on.')
  else if (known) notes.push(`Forwarded out ${known} (MAC table).`)
  else notes.push(outPorts.length ? `${frame.dst === BROADCAST_MAC ? 'Broadcast' : 'Unknown unicast'}: flooded out ${outPorts.join(', ')} in VLAN ${vlan}.` : `Nowhere to flood in VLAN ${vlan}.`)
  for (const out of outPorts) transmit(run, sw.id, out, { ...frame, vlan: egressTag(sw, out, vlan), hops: (frame.hops ?? 0) + 1 })
}

// ---------------------------------------------------------------- ARP and IP sending

const arpTable = (run, id) => (run.net.state.arp[id] ??= {})
function learnArp(run, device, ip, mac, iface) { arpTable(run, device.id)[ipText(ip)] = { mac, iface } }
function frameFrom(device, iface, dst, extra) {
  const tag = device.type === 'router' && iface.includes('.') ? (device.config.interfaces[iface].vlan ?? null) : null
  return { src: deviceMac(device, iface), dst, vlan: tag, hops: 0, ...extra }
}
/**
 * Deliver an IP packet to a next hop on an interface. Hosts hold packets while ARP resolves; routers
 * drop the packet that triggered ARP, which is why a first ping through a router often times out.
 */
function sendIp(run, device, iface, nextHop, packet, notes) {
  if (packet.dst === BROADCAST_IP || nextHop === BROADCAST_IP) {
    transmit(run, device.id, physicalPort(iface), frameFrom(device, iface, BROADCAST_MAC, { type: 'IPv4', ip: packet }))
    return
  }
  const entry = arpTable(run, device.id)[ipText(nextHop)]
  if (entry) { transmit(run, device.id, physicalPort(iface), frameFrom(device, iface, entry.mac, { type: 'IPv4', ip: packet })); return }
  const waitKey = `${device.id}|${nextHop}`
  const alreadyAsking = run.pending.has(waitKey)
  if (isHost(device)) { run.pending.set(waitKey, [...(run.pending.get(waitKey) ?? []), { iface, packet }]); notes?.push(`Holding the packet while ARP resolves ${ipText(nextHop)}.`) }
  else notes?.push(`Dropped the packet while ARP resolves next hop ${ipText(nextHop)}; later packets will be forwarded.`)
  if (alreadyAsking && isHost(device)) return
  if (!isHost(device)) run.pending.set(waitKey, [])
  const own = isHost(device) ? hostAddressing(device).ip : routerInterfaces(device).find(item => item.name === iface).ip
  transmit(run, device.id, physicalPort(iface), frameFrom(device, iface, BROADCAST_MAC, { type: 'ARP', arp: { op: 'request', senderIp: own, senderMac: deviceMac(device, iface), targetIp: nextHop, targetMac: '0000.0000.0000' } }))
}
function flushPending(run, device, ip) {
  const waitKey = `${device.id}|${ip}`
  const waiting = run.pending.get(waitKey) ?? []
  run.pending.delete(waitKey)
  for (const { iface, packet } of waiting) sendIp(run, device, iface, ip, packet)
}
/** Host routing decision: on-link destinations directly, everything else to the default gateway. */
function hostSend(run, host, packet, notes) {
  const me = hostAddressing(host)
  if (packet.dst === BROADCAST_IP) { sendIp(run, host, 'Fa0', BROADCAST_IP, packet, notes); return 'sent' }
  if (me.ip === null || me.mask === null) return 'no-address'
  if (sameSubnet(packet.dst, me.ip, me.mask)) { sendIp(run, host, 'Fa0', packet.dst, packet, notes); return 'sent' }
  if (me.gateway === null) return 'no-gateway'
  sendIp(run, host, 'Fa0', me.gateway, packet, notes)
  return 'sent'
}
function icmpPacket(src, dst, ttl, icmp) { return { src, dst, ttl, proto: 'icmp', icmp } }

// ---------------------------------------------------------------- hosts

function hostReceive(run, host, frame, notes) {
  if (frame.vlan !== null) { notes.push('Dropped: a host network card ignores 802.1Q-tagged frames.'); return }
  const myMac = deviceMac(host, 'Fa0'), me = hostAddressing(host)
  if (frame.dst !== myMac && frame.dst !== BROADCAST_MAC) { notes.push('Ignored: the frame is addressed to another MAC.'); return }
  if (frame.type === 'ARP') {
    const arp = frame.arp
    if (arp.op === 'request') {
      if (me.ip === null || arp.targetIp !== me.ip) { notes.push('ARP request is for another address; ignored.'); return }
      learnArp(run, host, arp.senderIp, arp.senderMac, 'Fa0')
      notes.push(`Replies: ${ipText(me.ip)} is at ${myMac}.`)
      transmit(run, host.id, 'Fa0', { src: myMac, dst: arp.senderMac, vlan: null, hops: 0, type: 'ARP', arp: { op: 'reply', senderIp: me.ip, senderMac: myMac, targetIp: arp.senderIp, targetMac: arp.senderMac } })
    } else {
      learnArp(run, host, arp.senderIp, arp.senderMac, 'Fa0')
      notes.push(`Learned ${ipText(arp.senderIp)} at ${arp.senderMac}.`)
      flushPending(run, host, arp.senderIp)
    }
    return
  }
  const packet = frame.ip
  if (packet.proto === 'udp' && packet.udp.app === 'dhcp' && packet.udp.dport === 68) { dhcpClient(run, host, packet, notes); return }
  if (me.ip === null || (packet.dst !== me.ip && packet.dst !== BROADCAST_IP)) { notes.push('Ignored: the packet is for another IP address (hosts do not route).'); return }
  if (packet.proto === 'icmp') {
    const { type } = packet.icmp
    if (type === 8) {
      notes.push('Echo request received; sending an echo reply.')
      hostSend(run, host, icmpPacket(me.ip, packet.src, HOST_TTL, { type: 0, code: 0, id: packet.icmp.id, seq: packet.icmp.seq }), notes)
    } else {
      run.results.push({ device: host.id, kind: type === 0 ? 'echo-reply' : type === 11 ? 'time-exceeded' : 'unreachable', code: packet.icmp.code, from: packet.src, ttl: packet.ttl, id: packet.icmp.id, seq: packet.icmp.seq })
      notes.push(type === 0 ? 'Echo reply received.' : type === 11 ? 'Time exceeded received.' : 'Destination unreachable received.')
    }
    return
  }
  if (packet.proto === 'udp' && packet.udp.app === 'dns') {
    if (packet.udp.dport === 53) dnsServer(run, host, packet, notes)
    else { run.results.push({ device: host.id, kind: 'dns', name: packet.udp.data.name, answer: packet.udp.data.answer }); notes.push('DNS answer received.') }
    return
  }
  if (packet.proto === 'tcp') {
    if (packet.tcp.dport === 80) httpServer(run, host, packet, notes)
    else httpClient(run, host, packet, notes)
  }
}

function dnsServer(run, server, packet, notes) {
  const dns = server.config.services?.dns
  if (!dns?.enabled) { notes.push('DNS service is off; the query is ignored.'); return }
  const record = dns.records.find(item => item.name.toLowerCase() === packet.udp.data.name.toLowerCase())
  notes.push(record ? `Answering ${record.name} → ${record.ip}.` : `No record for ${packet.udp.data.name}.`)
  hostSend(run, server, { src: hostAddressing(server).ip, dst: packet.src, ttl: HOST_TTL, proto: 'udp', udp: { sport: 53, dport: packet.udp.sport, app: 'dns', data: { name: packet.udp.data.name, answer: record ? parseIp(record.ip) : null } } }, notes)
}
function httpServer(run, server, packet, notes) {
  const http = server.config.services?.http, me = hostAddressing(server).ip
  const reply = (flags, data) => hostSend(run, server, { src: me, dst: packet.src, ttl: HOST_TTL, proto: 'tcp', tcp: { sport: 80, dport: packet.tcp.sport, flags, data } }, notes)
  if (!http?.enabled) { notes.push('No service listens on port 80; resetting the connection.'); reply('RST', null); return }
  if (packet.tcp.flags === 'SYN') { notes.push('Port 80 is open: SYN+ACK.'); reply('SYN+ACK', null) }
  else if (packet.tcp.data?.request) { notes.push(`Serving ${packet.tcp.data.request}.`); reply('PSH+ACK', { status: 200, body: http.page }) }
}
function httpClient(run, client, packet, notes) {
  const me = hostAddressing(client).ip
  if (packet.tcp.flags === 'SYN+ACK') {
    notes.push('Connection established; sending the HTTP request.')
    hostSend(run, client, { src: me, dst: packet.src, ttl: HOST_TTL, proto: 'tcp', tcp: { sport: packet.tcp.dport, dport: 80, flags: 'PSH+ACK', data: { request: run.httpPath ?? '/' } } }, notes)
  } else if (packet.tcp.flags === 'RST') { run.results.push({ device: client.id, kind: 'http-refused' }); notes.push('Connection refused.') }
  else if (packet.tcp.data?.status) { run.results.push({ device: client.id, kind: 'http', status: packet.tcp.data.status, body: packet.tcp.data.body }); notes.push('HTTP response received.') }
}
function dhcpClient(run, host, packet, notes) {
  const data = packet.udp.data, mac = deviceMac(host, 'Fa0')
  if (data.client !== mac) { notes.push('DHCP message for another client; ignored.'); return }
  if (data.op === 'OFFER') {
    notes.push(`Offered ${ipText(data.ip)}; requesting it.`)
    sendIp(run, host, 'Fa0', BROADCAST_IP, { src: 0, dst: BROADCAST_IP, ttl: HOST_TTL, proto: 'udp', udp: { sport: 68, dport: 67, app: 'dhcp', data: { op: 'REQUEST', client: mac, ip: data.ip, server: data.server } } }, notes)
  } else if (data.op === 'ACK') {
    run.results.push({ device: host.id, kind: 'dhcp', lease: { ip: ipText(data.ip), mask: ipText(data.mask), gateway: data.router ? ipText(data.router) : '', dns: data.dns ? ipText(data.dns) : '' } })
    notes.push(`Lease accepted: ${ipText(data.ip)}.`)
  }
}

// ---------------------------------------------------------------- routers

function routerReceive(run, router, port, frame, notes) {
  const iface = routerInterfaces(router).find(item => physicalPort(item.name) === port && (frame.vlan === null ? !item.name.includes('.') : item.vlan === frame.vlan))
  if (!iface || !ifaceUp(run.net, router, iface.name)) { notes.push(frame.vlan === null ? `Dropped: ${port} has no address for untagged traffic.` : `Dropped: no subinterface on ${port} for VLAN ${frame.vlan}.`); return }
  const myMac = deviceMac(router, iface.name)
  if (frame.dst !== myMac && frame.dst !== BROADCAST_MAC) { notes.push('Ignored: addressed to another MAC.'); return }
  if (frame.type === 'ARP') {
    const arp = frame.arp
    // A router answers for its own address and, on a NAT outside interface, for static global addresses in that subnet.
    const natAlias = iface.config.nat === 'outside' && sameSubnet(arp.targetIp, iface.ip, iface.mask) && router.config.nat.statics.some(entry => parseIp(entry.outside) === arp.targetIp)
    if (arp.op === 'request' && (arp.targetIp === iface.ip || natAlias)) {
      learnArp(run, router, arp.senderIp, arp.senderMac, iface.name)
      notes.push(`Replies from ${iface.name}: ${ipText(arp.targetIp)} is at ${myMac}${natAlias ? ' (static NAT address)' : ''}.`)
      transmit(run, router.id, port, frameFrom(router, iface.name, arp.senderMac, { type: 'ARP', arp: { op: 'reply', senderIp: arp.targetIp, senderMac: myMac, targetIp: arp.senderIp, targetMac: arp.senderMac } }))
    } else if (arp.op === 'reply') { learnArp(run, router, arp.senderIp, arp.senderMac, iface.name); notes.push(`Learned ${ipText(arp.senderIp)} at ${arp.senderMac}.`) }
    else notes.push('ARP request for another address; ignored.')
    return
  }
  let packet = frame.ip
  // An inbound access list filters everything arriving on the interface, DHCP requests included.
  if (iface.config.aclIn) {
    const decision = aclDecision(run.net, router, iface.config.aclIn, packet)
    if (!decision.permitted) { notes.push(`Denied by access list ${iface.config.aclIn} inbound on ${iface.name}${decision.entry === null ? ' (implicit deny)' : ''}.`); icmpError(run, router, iface, packet, 3, 13, notes); return }
    notes.push(`Permitted by access list ${iface.config.aclIn} inbound.`)
  }
  if (packet.proto === 'udp' && packet.udp.app === 'dhcp' && packet.udp.dport === 67) { dhcpServer(run, router, iface, packet, notes); return }
  if (iface.config.nat === 'outside') packet = natInbound(run.net, router, packet, notes)
  if (ownsAddress(run.net, router, packet.dst)) { routerLocal(run, router, packet, notes); return }
  if (packet.dst === BROADCAST_IP) { notes.push('Broadcast not forwarded.'); return }
  forward(run, router, iface, packet, notes)
}
function routerLocal(run, router, packet, notes) {
  if (packet.proto === 'icmp' && packet.icmp.type === 8) {
    notes.push('Echo request to this router; replying.')
    originate(run, router, icmpPacket(packet.dst, packet.src, ROUTER_TTL, { type: 0, code: 0, id: packet.icmp.id, seq: packet.icmp.seq }), notes, { keepSource: true })
  } else if (packet.proto === 'icmp') {
    run.results.push({ device: router.id, kind: packet.icmp.type === 0 ? 'echo-reply' : packet.icmp.type === 11 ? 'time-exceeded' : 'unreachable', code: packet.icmp.code, from: packet.src, ttl: packet.ttl, id: packet.icmp.id, seq: packet.icmp.seq })
    notes.push('Received by this router.')
  } else notes.push('No service for this packet on the router.')
}
function forward(run, router, ingress, packet, notes) {
  if (packet.ttl <= 1) { notes.push('TTL expired; sending ICMP time exceeded.'); icmpError(run, router, ingress, packet, 11, 0, notes); return }
  const route = lookupRoute(run.net, router, packet.dst)
  if (!route) { notes.push(`No route to ${ipText(packet.dst)}; sending ICMP network unreachable.`); icmpError(run, router, ingress, packet, 3, 0, notes); return }
  const egress = routerInterfaces(router).find(item => item.name === route.iface)
  let next = { ...packet, ttl: packet.ttl - 1 }
  // Inside → outside translation happens before the outbound access list, so the list sees global addresses.
  if (ingress.config.nat === 'inside' && egress.config.nat === 'outside') next = natOutbound(run.net, router, next, egress, notes)
  if (egress.config.aclOut) {
    const decision = aclDecision(run.net, router, egress.config.aclOut, next)
    if (!decision.permitted) { notes.push(`Denied by access list ${egress.config.aclOut} outbound on ${egress.name}${decision.entry === null ? ' (implicit deny)' : ''}.`); icmpError(run, router, ingress, packet, 3, 13, notes); return }
  }
  const hop = route.nextHop ?? next.dst
  notes.push(`Route ${route.code === 'O' ? 'OSPF' : route.code === 'S' ? 'static' : 'connected'} ${ipText(route.network)}/${maskToPrefix(route.mask)}: out ${egress.name}${route.nextHop ? ` via ${ipText(route.nextHop)}` : ''}.`)
  sendIp(run, router, egress.name, hop, next, notes)
}
/** ICMP errors are never sent about ICMP errors. The source is the interface that saw the packet. */
function icmpError(run, router, iface, packet, type, code, notes) {
  if (packet.proto === 'icmp' && packet.icmp.type !== 8 && packet.icmp.type !== 0) return
  originate(run, router, icmpPacket(iface.ip, packet.src, ROUTER_TTL, { type, code, id: packet.proto === 'icmp' ? packet.icmp.id : 0, seq: packet.proto === 'icmp' ? packet.icmp.seq : 0 }), notes, { keepSource: true })
}
/** Packets the router itself sends: routed like any other, but outbound ACLs do not filter them. */
function originate(run, router, packet, notes, { keepSource = false } = {}) {
  const route = lookupRoute(run.net, router, packet.dst)
  if (!route) { notes?.push(`No route back to ${ipText(packet.dst)}.`); return false }
  const egress = routerInterfaces(router).find(item => item.name === route.iface)
  const sourced = keepSource ? packet : { ...packet, src: egress.ip }
  sendIp(run, router, egress.name, route.nextHop ?? sourced.dst, sourced, notes)
  return true
}
function dhcpServer(run, router, iface, packet, notes) {
  const pools = Object.entries(router.config.dhcp?.pools ?? {})
  const found = pools.find(([, pool]) => pool.network && pool.mask && sameSubnet(parseIp(pool.network), iface.ip, parseIp(pool.mask)) && parseIp(pool.mask) === iface.mask)
  if (!found) { notes.push(`No DHCP pool for ${iface.name}'s subnet; ignored.`); return }
  const [name, pool] = found, data = packet.udp.data
  const bindings = (run.net.state.bindings[router.id] ??= {})
  const excluded = (router.config.dhcp.excluded ?? []).map(range => [parseIp(range.start), parseIp(range.end ?? range.start)])
  let address = Object.entries(bindings).find(([, value]) => value.mac === data.client)?.[0]
  if (address) address = parseIp(address)
  if (address === undefined) {
    const network = parseIp(pool.network), mask = parseIp(pool.mask)
    for (let candidate = (networkOf(network, mask) + 1) >>> 0; isHostAddress(candidate, mask) && sameSubnet(candidate, network, mask); candidate = (candidate + 1) >>> 0) {
      if (excluded.some(([start, end]) => candidate >= start && candidate <= end) || candidate === iface.ip || bindings[ipText(candidate)]) continue
      address = candidate
      break
    }
  }
  if (address === undefined) { notes.push(`Pool ${name} has no free addresses.`); return }
  const reply = op => transmit(run, router.id, physicalPort(iface.name), frameFrom(router, iface.name, data.client, { type: 'IPv4', ip: { src: iface.ip, dst: BROADCAST_IP, ttl: ROUTER_TTL, proto: 'udp',
    udp: { sport: 67, dport: 68, app: 'dhcp', data: { op, client: data.client, ip: address, mask: parseIp(pool.mask), router: pool.router ? parseIp(pool.router) : null, dns: pool.dns ? parseIp(pool.dns) : null, server: iface.ip } } } }))
  if (data.op === 'DISCOVER') { notes.push(`Pool ${name} offers ${ipText(address)}.`); reply('OFFER') }
  else if (data.op === 'REQUEST') { bindings[ipText(address)] = { mac: data.client, pool: name }; notes.push(`Pool ${name} binds ${ipText(address)} to ${data.client}.`); reply('ACK') }
}

// ---------------------------------------------------------------- operations

/** Resolve a target written as an address or a DNS name, using the host's DNS server. */
function resolveTarget(net, device, target) {
  const ip = parseIp(target)
  if (ip !== null) return { ip, events: [] }
  if (!isHost(device)) return { ip: null, events: [], error: 'unknown-host' }
  const me = hostAddressing(device)
  if (me.dns === null || me.ip === null) return { ip: null, events: [], error: 'unknown-host' }
  // Resolvers retry: the first query can be lost while a router resolves ARP on the way.
  let events = [], answer = null, limited = false
  for (let attempt = 0; attempt < 3 && !answer; attempt++) {
    const run = createRun(net)
    const result = hostSend(run, device, { src: me.ip, dst: me.dns, ttl: HOST_TTL, proto: 'udp', udp: { sport: 49152 + attempt, dport: 53, app: 'dns', data: { name: target } } }, [])
    if (result === 'sent') drain(run)
    events = [...events, ...shift(run.events, events.at(-1)?.time ?? 0, events.length)]
    limited ||= run.limited
    answer = run.results.find(item => item.kind === 'dns') ?? null
  }
  if (!answer) return { ip: null, events, error: 'dns-timeout', limited }
  return { ip: answer.answer ?? null, events, error: answer.answer ? null : 'unknown-host', limited }
}
const shift = (events, offset, base) => events.map(event => ({ ...event, seq: event.seq + base, time: event.time + offset }))

/** Send ICMP echo requests one at a time, as the desktop `ping` and router `ping` commands do. */
export function ping(project, state, fromId, target, { count, ttl } = {}) {
  const net = buildNetwork(project, state), device = findDevice(project, fromId)
  const router = device.type === 'router'
  const total = count ?? (router ? 5 : 4)
  const resolved = resolveTarget(net, device, target)
  const events = [...resolved.events]
  if (resolved.ip === null) return { error: resolved.error ?? 'unknown-host', target, replies: [], events, limited: Boolean(resolved.limited) }
  const replies = []
  let time = events.at(-1)?.time ?? 0, limited = false
  for (let seq = 1; seq <= total; seq++) {
    const run = createRun(net)
    let status
    if (router) {
      const route = lookupRoute(net, device, resolved.ip)
      if (ownsAddress(net, device, resolved.ip)) status = 'local'
      else if (!route) status = 'no-route'
      else { originate(run, device, icmpPacket(0, resolved.ip, ttl ?? ROUTER_TTL, { type: 8, code: 0, id: 1, seq }), []); status = 'sent' }
    } else {
      const me = hostAddressing(device)
      status = me.ip === null ? 'no-address' : me.ip === resolved.ip ? 'local' : hostSend(run, device, icmpPacket(me.ip, resolved.ip, ttl ?? HOST_TTL, { type: 8, code: 0, id: 1, seq }), [])
    }
    if (status === 'local') { replies.push({ seq, kind: 'echo-reply', from: resolved.ip, ttl: router ? ROUTER_TTL : HOST_TTL }); continue }
    if (status !== 'sent') return { error: status, target, ip: resolved.ip, replies, events, limited }
    drain(run)
    limited ||= run.limited
    events.push(...shift(run.events, time, events.length))
    time = events.at(-1)?.time ?? time
    const answer = run.results.find(item => item.device === device.id && item.seq === seq && item.kind !== 'dns')
    replies.push(answer ? { seq, kind: answer.kind, code: answer.code, from: answer.from, ttl: answer.ttl } : { seq, kind: 'timeout' })
  }
  return { target, ip: resolved.ip, replies, events, limited }
}
/** ICMP probes with rising TTL (three per hop) until the destination answers or 30 hops pass. */
export function traceroute(project, state, fromId, target, { maxHops = 30 } = {}) {
  const hops = [], events = []
  const first = ping(project, state, fromId, target, { count: 0 })
  if (first.error) return { error: first.error, hops, events: first.events }
  for (let ttl = 1; ttl <= maxHops; ttl++) {
    const probe = ping(project, state, fromId, formatIp(first.ip), { count: 3, ttl })
    events.push(...shift(probe.events, events.at(-1)?.time ?? 0, events.length))
    hops.push({ ttl, replies: probe.replies })
    if (probe.replies.some(reply => reply.kind === 'echo-reply' || reply.kind === 'unreachable')) return { ip: first.ip, hops, events, complete: true }
  }
  return { ip: first.ip, hops, events, complete: false }
}
/** A browser request: DNS if needed, then SYN, SYN+ACK, request, response. */
export function httpGet(project, state, fromId, url) {
  const net = buildNetwork(project, state), device = findDevice(project, fromId)
  const match = String(url).trim().match(/^(?:http:\/\/)?([^/:\s]+)(\/[^\s]*)?$/i)
  if (!match) return { error: 'bad-url', events: [] }
  const resolved = resolveTarget(net, device, match[1])
  if (resolved.ip === null) return { error: 'unknown-host', events: resolved.events }
  const run = createRun(net)
  run.httpPath = match[2] ?? '/'
  const me = hostAddressing(device)
  const status = me.ip === null ? 'no-address' : hostSend(run, device, { src: me.ip, dst: resolved.ip, ttl: HOST_TTL, proto: 'tcp', tcp: { sport: 1025, dport: 80, flags: 'SYN', data: null } }, [])
  if (status !== 'sent') return { error: status, events: resolved.events }
  drain(run)
  // A first attempt can be lost while a router resolves ARP; browsers retransmit the SYN.
  let result = run.results.find(item => item.kind === 'http' || item.kind === 'http-refused' || item.kind === 'unreachable')
  let events = [...resolved.events, ...shift(run.events, resolved.events.at(-1)?.time ?? 0, resolved.events.length)]
  // Browsers retransmit an unanswered SYN; each router on a cold path drops one while it resolves ARP.
  for (let attempt = 1; attempt <= 4 && !result; attempt++) {
    const retry = createRun(net)
    retry.httpPath = run.httpPath
    hostSend(retry, device, { src: me.ip, dst: resolved.ip, ttl: HOST_TTL, proto: 'tcp', tcp: { sport: 1025 + attempt, dport: 80, flags: 'SYN', data: null } }, [])
    drain(retry)
    events = [...events, ...shift(retry.events, events.at(-1)?.time ?? 0, events.length)]
    result = retry.results.find(item => item.kind === 'http' || item.kind === 'http-refused' || item.kind === 'unreachable')
  }
  if (!result) return { error: 'timeout', ip: resolved.ip, events }
  if (result.kind === 'unreachable') return { error: 'unreachable', code: result.code, ip: resolved.ip, events }
  if (result.kind === 'http-refused') return { error: 'refused', ip: resolved.ip, events }
  return { status: result.status, body: result.body, ip: resolved.ip, events }
}
export function nslookup(project, state, fromId, name) {
  const net = buildNetwork(project, state), device = findDevice(project, fromId)
  const me = hostAddressing(device)
  if (me.dns === null) return { error: 'no-dns', events: [] }
  const resolved = resolveTarget(net, device, name)
  return { server: me.dns, answer: resolved.ip, timeout: resolved.error === 'dns-timeout', events: resolved.events }
}
/** DHCP discover → offer → request → ack; returns the project with the host's new lease applied. */
export function dhcpRenew(project, state, hostId) {
  const net = buildNetwork(project, state), host = findDevice(project, hostId)
  const run = createRun(net), mac = deviceMac(host, 'Fa0')
  sendIp(run, host, 'Fa0', BROADCAST_IP, { src: 0, dst: BROADCAST_IP, ttl: HOST_TTL, proto: 'udp', udp: { sport: 68, dport: 67, app: 'dhcp', data: { op: 'DISCOVER', client: mac } } }, [])
  drain(run)
  const ack = run.results.find(item => item.kind === 'dhcp' && item.device === host.id)
  const next = { ...project, devices: project.devices.map(device => device.id === host.id ? { ...device, config: { ...device.config, ipMode: 'dhcp', lease: ack ? ack.lease : null } } : device) }
  return { project: next, lease: ack?.lease ?? null, events: run.events, limited: run.limited }
}
export function dhcpRelease(project, hostId) {
  return { ...project, devices: project.devices.map(device => device.id === hostId ? { ...device, config: { ...device.config, lease: null } } : device) }
}

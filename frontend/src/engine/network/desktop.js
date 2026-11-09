import { dashedMac, formatIp, parseIp } from './addr.js'
import { deviceMac, findDevice, hostAddressing } from './model.js'
import { dhcpRelease, dhcpRenew, httpGet, nslookup, ping, traceroute } from './sim.js'

/**
 * The host "Command Prompt": ipconfig, ping, tracert, arp -a and nslookup with desktop-style
 * output. Times are virtual: every hop takes well under a millisecond, so times print as <1ms.
 */
export const DESKTOP_HELP = ['Available commands:', '  ipconfig [/all | /renew | /release]', '  ping <address or name> [-n <count>]', '  tracert <address or name>', '  arp -a', '  nslookup <name>', '  help']

function ipconfigLines(host, all = false) {
  const me = host.config.ipMode === 'dhcp' ? (host.config.lease ?? {}) : host.config
  const lines = ['', 'FastEthernet0 Connection:(default port)', '', '   Connection-specific DNS Suffix..: ']
  if (all) lines.push(`   Physical Address................: ${dashedMac(deviceMac(host, 'Fa0'))}`, `   DHCP Enabled....................: ${host.config.ipMode === 'dhcp' ? 'Yes' : 'No'}`)
  lines.push(`   IPv4 Address....................: ${me.ip || '0.0.0.0'}`, `   Subnet Mask.....................: ${me.mask || '0.0.0.0'}`, `   Default Gateway.................: ${me.gateway || '0.0.0.0'}`)
  if (all) lines.push(`   DNS Servers.....................: ${me.dns || '0.0.0.0'}`)
  return lines
}
const UNREACHABLE = { 0: 'Destination net unreachable.', 1: 'Destination host unreachable.', 13: 'Communication administratively prohibited.' }

function pingLines(project, state, host, target, count) {
  const result = ping(project, state, host.id, target, { count })
  if (result.error === 'unknown-host') return { lines: [`Ping request could not find host ${target}. Please check the name and try again.`], events: result.events }
  const label = parseIp(target) === null && result.ip !== undefined ? `${target} [${formatIp(result.ip)}]` : target
  const lines = ['', `Pinging ${label} with 32 bytes of data:`, '']
  if (result.error) {
    for (let i = 0; i < count; i++) lines.push('PING: transmit failed. General failure.')
    lines.push('', `Ping statistics for ${result.ip !== undefined ? formatIp(result.ip) : target}:`, `    Packets: Sent = ${count}, Received = 0, Lost = ${count} (100% loss),`)
    return { lines, events: result.events }
  }
  let received = 0, echoes = 0
  for (const reply of result.replies) {
    if (reply.kind === 'echo-reply') { received++; echoes++; lines.push(`Reply from ${formatIp(reply.from)}: bytes=32 time<1ms TTL=${reply.ttl}`) }
    else if (reply.kind === 'unreachable') { received++; lines.push(`Reply from ${formatIp(reply.from)}: ${UNREACHABLE[reply.code] ?? UNREACHABLE[0]}`) }
    else if (reply.kind === 'time-exceeded') { received++; lines.push(`Reply from ${formatIp(reply.from)}: TTL expired in transit.`) }
    else lines.push('Request timed out.')
  }
  const lost = count - received
  lines.push('', `Ping statistics for ${formatIp(result.ip)}:`, `    Packets: Sent = ${count}, Received = ${received}, Lost = ${lost} (${Math.round(lost / count * 100)}% loss),`)
  if (echoes) lines.push('Approximate round trip times in milli-seconds:', '    Minimum = 0ms, Maximum = 0ms, Average = 0ms')
  return { lines, events: result.events }
}

function traceLines(project, state, host, target) {
  const result = traceroute(project, state, host.id, target)
  if (result.error === 'unknown-host') return { lines: [`Unable to resolve target system name ${target}.`], events: result.events }
  if (result.error) return { lines: ['Unable to contact IP driver. General failure.'], events: result.events }
  const lines = ['', `Tracing route to ${formatIp(result.ip)} over a maximum of 30 hops:`, '']
  for (const hop of result.hops) {
    const from = hop.replies.find(reply => reply.kind !== 'timeout')?.from
    const times = hop.replies.map(reply => (reply.kind === 'timeout' ? '*' : '<1 ms').padStart(6).padEnd(9)).join('')
    lines.push(`${String(hop.ttl).padStart(3)} ${times} ${from !== undefined ? formatIp(from) : 'Request timed out.'}`)
  }
  lines.push('', result.complete ? 'Trace complete.' : 'Trace stopped after 30 hops.')
  return { lines, events: result.events }
}

/**
 * Run one command-prompt line on a PC or server. Returns the (possibly updated) project, the lines
 * to print, and the events of any network operation for the step-by-step view.
 */
export function runDesktop(project, state, hostId, line) {
  const host = findDevice(project, hostId)
  const words = line.trim().split(/\s+/).filter(Boolean)
  const command = (words[0] ?? '').toLowerCase()
  if (!command) return { project, lines: [], events: [] }
  if (command === 'help' || command === '?') return { project, lines: DESKTOP_HELP, events: [] }
  if (command === 'ipconfig') {
    const flag = (words[1] ?? '').toLowerCase()
    if (!flag) return { project, lines: ipconfigLines(host), events: [] }
    if (flag === '/all') return { project, lines: ipconfigLines(host, true), events: [] }
    if (flag === '/release') {
      if (host.config.ipMode !== 'dhcp') return { project, lines: ['', 'The operation failed: this connection uses a static address.'], events: [] }
      const next = dhcpRelease(project, host.id)
      return { project: next, lines: ipconfigLines(findDevice(next, host.id)), events: [] }
    }
    if (flag === '/renew') {
      if (host.config.ipMode !== 'dhcp') return { project, lines: ['', 'The operation failed: this connection uses a static address.'], events: [] }
      const result = dhcpRenew(project, state, host.id)
      return { project: result.project, lines: result.lease ? ipconfigLines(findDevice(result.project, host.id)) : ['', 'DHCP request failed.'], events: result.events }
    }
    return { project, lines: ['Error: unrecognized or incomplete command line.'], events: [] }
  }
  if (command === 'ping') {
    if (!words[1]) return { project, lines: ['Usage: ping <address or name> [-n <count>]'], events: [] }
    const countIndex = words.findIndex(word => word.toLowerCase() === '-n')
    const count = countIndex > 0 ? Math.min(20, Math.max(1, Number(words[countIndex + 1]) || 4)) : 4
    const target = words.find((word, index) => index > 0 && index !== countIndex && index !== countIndex + 1)
    const result = pingLines(project, state, host, target, count)
    return { project, lines: result.lines, events: result.events }
  }
  if (command === 'tracert') {
    if (!words[1]) return { project, lines: ['Usage: tracert <address or name>'], events: [] }
    const result = traceLines(project, state, host, words[1])
    return { project, lines: result.lines, events: result.events }
  }
  if (command === 'arp') {
    if ((words[1] ?? '').toLowerCase() !== '-a') return { project, lines: ['Usage: arp -a'], events: [] }
    const entries = Object.entries(state.arp[host.id] ?? {})
    if (!entries.length) return { project, lines: ['No ARP Entries Found'], events: [] }
    const me = hostAddressing(host)
    const lines = ['', `Interface: ${me.ip !== null ? formatIp(me.ip) : '0.0.0.0'} --- 0x1`, '  Internet Address      Physical Address      Type']
    for (const [ip, entry] of entries.sort((a, b) => parseIp(a[0]) - parseIp(b[0]))) lines.push(`  ${ip.padEnd(22)}${dashedMac(entry.mac).toLowerCase().padEnd(22)}dynamic`)
    return { project, lines, events: [] }
  }
  if (command === 'nslookup') {
    if (!words[1]) return { project, lines: ['Usage: nslookup <name>'], events: [] }
    const result = nslookup(project, state, host.id, words[1])
    if (result.error) return { project, lines: ['*** Default servers are not available', 'Server:  UnKnown', 'Address:  0.0.0.0'], events: [] }
    const server = formatIp(result.server)
    if (result.timeout) return { project, lines: ['DNS request timed out.', '    timeout was 2 seconds.', `*** Request to ${server} timed-out`], events: result.events }
    const lines = [`Server: [${server}]`, `Address:  ${server}`, '']
    lines.push(...(result.answer !== null ? ['Non-authoritative answer:', `Name:   ${words[1]}`, `Address:  ${formatIp(result.answer)}`] : [`*** UnKnown can't find ${words[1]}: Non-existent domain`]))
    return { project, lines, events: result.events }
  }
  return { project, lines: [`Invalid Command.`], events: [] }
}

/** The web browser: an HTTP GET with readable failures. */
export function browse(project, state, hostId, url) {
  const result = httpGet(project, state, hostId, url)
  const messages = { 'bad-url': 'Invalid URL.', 'unknown-host': 'Host Name Unresolved', 'no-address': 'This computer has no IP address.', 'no-gateway': 'No default gateway is configured.', timeout: 'Request Timeout', refused: 'Connection refused: no web service is listening.', unreachable: result.code === 13 ? 'Blocked: communication administratively prohibited.' : 'Destination unreachable.' }
  return result.error ? { ok: false, message: messages[result.error] ?? 'Request Timeout', events: result.events } : { ok: true, status: result.status, body: result.body, events: result.events }
}

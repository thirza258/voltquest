import { describe, expect, it } from 'vitest'
import { formatIp, isMask, isWildcard, macFor, maskToPrefix, parseIp, prefixToMask } from './addr.js'
import { addDevice, connect, emptyProject, normalizePort, parseProject, updateDevice, validateProject } from './model.js'
import { cliError, createSession, execute, parseVlanList, promptFor } from './cli.js'
import { runDesktop, browse } from './desktop.js'
import { emptyState, ping, SWITCH_HOP_LIMIT } from './sim.js'
import { applySolution, checkGoals } from './checks.js'

/** Build a project from `['pc', 'switch', …]` and cables written `'PC1 Fa0 S1 Fa0/1'`. */
function build(types, cables) {
  let project = emptyProject('test')
  for (const [index, type] of types.entries()) project = addDevice(project, type, 100 + index * 80, 100).project
  for (const cable of cables) {
    const [a, ap, b, bp] = cable.split(' ')
    const find = name => project.devices.find(device => device.name === name).id
    project = connect(project, { device: find(a), port: ap }, { device: find(b), port: bp })
  }
  return project
}
const host = (project, name, ip, mask = '255.255.255.0', gateway = '', dns = '') => updateDevice(project, project.devices.find(d => d.name === name).id, device => ({ ...device, config: { ...device.config, ipMode: 'static', ip, mask, gateway, dns } }))
const id = (project, name) => project.devices.find(device => device.name === name).id
function cli(project, state, name, lines) {
  let session = createSession(id(project, name)), current = project
  const outputs = []
  for (const line of lines) { const result = execute(current, state, session, line); current = result.project; session = result.session; outputs.push(result.output) }
  return { project: current, session, outputs }
}
const desk = (project, state, name, line) => runDesktop(project, state, id(project, name), line)

describe('addressing helpers', () => {
  it('parses, masks and formats IPv4 and MAC addresses', () => {
    expect(parseIp('192.168.1.10')).toBe(3232235786); expect(parseIp('256.1.1.1')).toBeNull(); expect(parseIp('1.2.3')).toBeNull()
    expect(formatIp(parseIp('10.0.0.1'))).toBe('10.0.0.1')
    expect(maskToPrefix('255.255.255.0')).toBe(24); expect(maskToPrefix('255.0.255.0')).toBeNull(); expect(prefixToMask(30)).toBe(parseIp('255.255.255.252'))
    expect(isMask('255.255.255.252')).toBe(true); expect(isWildcard('0.0.0.255')).toBe(true); expect(isWildcard('0.255.0.255')).toBe(false)
    expect(macFor('pc1', 0)).toMatch(/^0060\.[0-9a-f]{4}\.[0-9a-f]{4}$/); expect(macFor('pc1', 0)).toBe(macFor('pc1', 0)); expect(macFor('pc1', 0)).not.toBe(macFor('pc2', 0))
  })
})

describe('project model', () => {
  it('normalizes port abbreviations and validates imported projects atomically', () => {
    expect(normalizePort('g0/0', 'router')).toBe('Gi0/0'); expect(normalizePort('GigabitEthernet 0/1', 'router')).toBe('Gi0/1')
    expect(normalizePort('fa0/3', 'switch')).toBe('Fa0/3'); expect(normalizePort('f0/9', 'switch')).toBeNull()
    expect(normalizePort('g0/0.10', 'router', { allowSub: true })).toBe('Gi0/0.10'); expect(normalizePort('g0/0.10', 'router')).toBeNull()
    const project = build(['pc', 'switch'], ['PC1 Fa0 S1 Fa0/1'])
    expect(parseProject(JSON.stringify(project))).toEqual(project)
    expect(() => validateProject({ ...project, version: 2 })).toThrow()
    expect(() => connect(project, { device: id(project, 'PC1'), port: 'Fa0' }, { device: id(project, 'S1'), port: 'Fa0/2' })).toThrow(/already connected/)
    expect(() => parseProject('{nope')).toThrow(/valid JSON/)
    const broken = structuredClone(project); broken.devices[1].config.ports['Fa0/1'].mode = 'hybrid'
    expect(() => validateProject(broken)).toThrow(/not valid/)
  })
})

describe('switching, ARP and the event log', () => {
  it('pings across a switch, learning MAC addresses and recording each hop', () => {
    let project = build(['pc', 'pc', 'switch'], ['PC1 Fa0 S1 Fa0/1', 'PC2 Fa0 S1 Fa0/2'])
    project = host(host(project, 'PC1', '192.168.1.10'), 'PC2', '192.168.1.11')
    const state = emptyState()
    const result = ping(project, state, id(project, 'PC1'), '192.168.1.11')
    expect(result.replies.map(reply => reply.kind)).toEqual(['echo-reply', 'echo-reply', 'echo-reply', 'echo-reply'])
    expect(result.replies[0].ttl).toBe(128)
    expect(result.events.slice(0, 4).map(event => event.protocol)).toEqual(['ARP', 'ARP', 'ARP', 'ARP'])
    expect(result.events[0].notes.join(' ')).toMatch(/Learned .* on Fa0\/1/)
    expect(result.events[1].notes.join(' ')).toMatch(/is at/)
    const table = cli(project, state, 'S1', ['show mac address-table']).outputs[0]
    expect(table.match(/DYNAMIC/g)).toHaveLength(2)
    const prompt = desk(project, state, 'PC1', 'ping 192.168.1.11').lines.join('\n')
    expect(prompt).toContain('Reply from 192.168.1.11: bytes=32 time<1ms TTL=128')
    expect(prompt).toContain('Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)')
    expect(desk(project, state, 'PC1', 'arp -a').lines.join('\n')).toMatch(/192\.168\.1\.11\s+00-60-/)
  })
  it('stops a cabled switching loop with the hop guard instead of running forever', () => {
    let project = build(['pc', 'pc', 'switch', 'switch'], ['PC1 Fa0 S1 Fa0/1', 'PC2 Fa0 S2 Fa0/1', 'S1 Gi0/1 S2 Gi0/1', 'S1 Gi0/2 S2 Gi0/2'])
    project = host(host(project, 'PC1', '10.0.0.1'), 'PC2', '10.0.0.9')
    const result = ping(project, emptyState(), id(project, 'PC1'), '10.0.0.9', { count: 1 })
    expect(result.events.some(event => event.notes.some(note => note.includes(`${SWITCH_HOP_LIMIT} switches`)))).toBe(true)
  })
})

describe('router command line', () => {
  it('accepts abbreviations, prints the router replies, and rejects ambiguous or invalid input', () => {
    const project = build(['router'], [])
    const state = emptyState()
    const run = cli(project, state, 'R1', ['en', 'conf t', 'int g0/0', 'ip add 192.168.1.1 255.255.255.0', 'no sh', 'do sh ip int br', 'e', 'ip address 10.0.0.1', 'ip address 192.168.1.0 255.255.255.0', 'shw', 'end', 'show running-config'])
    expect(promptFor(run.project.devices[0], run.session)).toBe('R1#')
    expect(run.outputs[1]).toContain('Enter configuration commands')
    expect(run.outputs[5]).toMatch(/GigabitEthernet0\/0\s+192\.168\.1\.1\s+YES manual down\s+down/)
    expect(run.outputs[6]).toBe('% Ambiguous command:  "e"')
    expect(run.outputs[7]).toBe('% Incomplete command.')
    expect(run.outputs[8]).toBe('Bad mask /24 for address 192.168.1.0')
    expect(run.outputs[9]).toMatch(/\^\n% Invalid input detected at '\^' marker\./)
    expect(run.outputs[11]).toContain('interface GigabitEthernet0/0\n ip address 192.168.1.1 255.255.255.0\n!')
    expect(run.outputs[11]).toContain('interface GigabitEthernet0/1\n no ip address\n shutdown')
    expect(cliError(run.outputs[9])).toBe(true); expect(cliError('% Access VLAN does not exist. Creating vlan 10')).toBe(false)
    expect(cli(project, state, 'R1', ['foo']).outputs[0]).toBe('% Unknown command or computer name, or unable to find computer address')
  })
  it('drops the first ping while the router resolves ARP, then forwards with TTL 127', () => {
    let project = build(['pc', 'pc', 'router'], ['PC1 Fa0 R1 Gi0/0', 'PC2 Fa0 R1 Gi0/1'])
    project = host(host(project, 'PC1', '192.168.1.10', '255.255.255.0', '192.168.1.1'), 'PC2', '192.168.2.10', '255.255.255.0', '192.168.2.1')
    const state = emptyState()
    expect(ping(project, state, id(project, 'PC1'), '192.168.2.10').replies.every(reply => reply.kind === 'timeout')).toBe(true)
    project = cli(project, state, 'R1', ['enable', 'configure terminal', 'interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown', 'end']).project
    const lines = desk(project, state, 'PC1', 'ping 192.168.2.10').lines
    expect(lines.slice(3, 7)).toEqual(['Request timed out.', 'Reply from 192.168.2.10: bytes=32 time<1ms TTL=127', 'Reply from 192.168.2.10: bytes=32 time<1ms TTL=127', 'Reply from 192.168.2.10: bytes=32 time<1ms TTL=127'])
    const route = cli(project, state, 'R1', ['show ip route']).outputs[0]
    expect(route).toContain('Gateway of last resort is not set')
    expect(route).toContain('      192.168.1.0/24 is variably subnetted, 2 subnets, 2 masks')
    expect(route).toContain('C        192.168.1.0/24 is directly connected, GigabitEthernet0/0')
    expect(route).toContain('L        192.168.1.1/32 is directly connected, GigabitEthernet0/0')
    expect(cli(project, state, 'R1', ['show ip arp']).outputs[0]).toMatch(/Internet {2}192\.168\.2\.10\s+0\s+0060/)
    const trace = desk(project, state, 'PC1', 'tracert 192.168.2.10').lines.join('\n')
    expect(trace).toMatch(/1\s.*192\.168\.1\.1/); expect(trace).toMatch(/2\s.*192\.168\.2\.10/); expect(trace).toContain('Trace complete.')
    const r1 = cli(project, state, 'R1', ['ping 192.168.2.10']).outputs[0]
    expect(r1).toContain('!!!!!'); expect(r1).toContain('Success rate is 100 percent (5/5)')
  })
})

describe('VLANs, trunks and router-on-a-stick', () => {
  function campus() {
    let project = build(['pc', 'pc', 'pc', 'switch', 'switch', 'router'], ['PC1 Fa0 S1 Fa0/1', 'PC2 Fa0 S1 Fa0/2', 'PC3 Fa0 S2 Fa0/1', 'S1 Gi0/1 S2 Gi0/1', 'S1 Gi0/2 R1 Gi0/0'])
    project = host(project, 'PC1', '192.168.10.11', '255.255.255.0', '192.168.10.1')
    project = host(project, 'PC2', '192.168.20.11', '255.255.255.0', '192.168.20.1')
    project = host(project, 'PC3', '192.168.10.12', '255.255.255.0', '192.168.10.1')
    return project
  }
  it('isolates VLANs, carries them over an 802.1Q trunk and creates missing access VLANs', () => {
    const state = emptyState()
    let project = campus()
    let run = cli(project, state, 'S1', ['enable', 'conf t', 'vlan 10', 'name SALES', 'vlan 20', 'name ENG', 'exit', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'interface f0/2', 'sw mo acc', 'sw acc vl 20', 'interface gi0/1', 'switchport mode trunk', 'end', 'show vlan brief', 'show interfaces trunk'])
    project = run.project
    expect(run.outputs[16]).toMatch(/10\s+SALES\s+active\s+Fa0\/1/); expect(run.outputs[16]).toMatch(/20\s+ENG\s+active\s+Fa0\/2/)
    expect(run.outputs[17]).toMatch(/Gi0\/1\s+on\s+802\.1q\s+trunking\s+1/)
    // S2 has no VLAN 10 yet and no trunk: PC1 cannot reach PC3.
    expect(ping(project, state, id(project, 'PC1'), '192.168.10.12').replies.some(reply => reply.kind === 'echo-reply')).toBe(false)
    run = cli(project, state, 'S2', ['enable', 'configure terminal', 'interface range fa0/1 - 2', 'switchport access vlan 10', 'interface gigabitEthernet 0/1', 'switchport mode trunk', 'end'])
    expect(run.outputs[3]).toBe('% Access VLAN does not exist. Creating vlan 10')
    project = run.project
    expect(project.devices.find(d => d.name === 'S2').config.ports['Fa0/2'].vlan).toBe(10)
    expect(ping(project, state, id(project, 'PC1'), '192.168.10.12').replies.every(reply => reply.kind === 'echo-reply')).toBe(true)
    const tagged = ping(project, emptyState(), id(project, 'PC1'), '192.168.10.12', { count: 1 }).events.find(event => event.fromPort === 'Gi0/1')
    expect(tagged.layers[0].text).toContain('802.1Q VLAN 10')
    // Pruning VLAN 10 from the trunk breaks the path again.
    project = cli(project, state, 'S1', ['enable', 'conf t', 'int g0/1', 'switchport trunk allowed vlan 1,20', 'end']).project
    expect(ping(project, emptyState(), id(project, 'PC1'), '192.168.10.12').replies.some(reply => reply.kind === 'echo-reply')).toBe(false)
  })
  it('routes between VLANs on dot1Q subinterfaces and requires the encapsulation first', () => {
    const state = emptyState()
    let project = campus()
    project = cli(project, state, 'S1', ['enable', 'conf t', 'int fa0/1', 'sw acc vl 10', 'int fa0/2', 'sw acc vl 20', 'int g0/2', 'sw mo tr', 'end']).project
    const run = cli(project, state, 'R1', ['enable', 'conf t', 'int g0/0', 'no shut', 'int g0/0.10', 'ip address 192.168.10.1 255.255.255.0', 'encapsulation dot1Q 10', 'ip address 192.168.10.1 255.255.255.0', 'int g0/0.20', 'encapsulation dot1q 20', 'ip address 192.168.20.1 255.255.255.0', 'end', 'show ip interface brief'])
    expect(run.outputs[5]).toContain('only allowed if that subinterface is already configured as part of an IEEE 802.10, IEEE 802.1Q, or ISL vLAN')
    expect(run.outputs[12]).toMatch(/GigabitEthernet0\/0\.10\s+192\.168\.10\.1\s+YES manual up\s+up/)
    project = run.project
    const reply = ping(project, state, id(project, 'PC1'), '192.168.20.11')
    expect(reply.replies.filter(item => item.kind === 'echo-reply').length).toBeGreaterThanOrEqual(3)
    expect(reply.replies.at(-1).ttl).toBe(127)
  })
})

describe('static and OSPF routing', () => {
  function chain() {
    let project = build(['pc', 'pc', 'router', 'router', 'router'], ['PC1 Fa0 R1 Gi0/0', 'R1 Gi0/1 R2 Gi0/0', 'R2 Gi0/1 R3 Gi0/0', 'PC2 Fa0 R3 Gi0/1'])
    project = host(host(project, 'PC1', '10.1.1.10', '255.255.255.0', '10.1.1.1'), 'PC2', '10.3.3.10', '255.255.255.0', '10.3.3.1')
    const state = emptyState()
    project = cli(project, state, 'R1', ['en', 'conf t', 'int g0/0', 'ip add 10.1.1.1 255.255.255.0', 'no sh', 'int g0/1', 'ip add 10.0.12.1 255.255.255.252', 'no sh', 'end']).project
    project = cli(project, state, 'R2', ['en', 'conf t', 'int g0/0', 'ip add 10.0.12.2 255.255.255.252', 'no sh', 'int g0/1', 'ip add 10.0.23.1 255.255.255.252', 'no sh', 'end']).project
    project = cli(project, state, 'R3', ['en', 'conf t', 'int g0/0', 'ip add 10.0.23.2 255.255.255.252', 'no sh', 'int g0/1', 'ip add 10.3.3.1 255.255.255.0', 'no sh', 'end']).project
    return { project, state }
  }
  it('needs routes in both directions; static and default routes complete the path', () => {
    let { project, state } = chain()
    expect(ping(project, state, id(project, 'PC1'), '10.3.3.10').replies.some(r => r.kind === 'echo-reply')).toBe(false)
    expect(ping(project, state, id(project, 'PC1'), '10.3.3.10').replies.some(r => r.kind === 'unreachable' && formatIp(r.from) === '10.1.1.1')).toBe(true)
    project = cli(project, state, 'R1', ['en', 'conf t', 'ip route 0.0.0.0 0.0.0.0 10.0.12.2', 'end']).project
    project = cli(project, state, 'R2', ['en', 'conf t', 'ip route 10.1.1.0 255.255.255.0 10.0.12.1', 'ip route 10.3.3.0 255.255.255.0 10.0.23.2', 'end']).project
    expect(ping(project, state, id(project, 'PC1'), '10.3.3.10').replies.some(r => r.kind === 'echo-reply')).toBe(false)
    project = cli(project, state, 'R3', ['en', 'conf t', 'ip route 0.0.0.0 0.0.0.0 g0/0', 'no ip route 0.0.0.0 0.0.0.0 g0/0', 'ip route 0.0.0.0 0.0.0.0 10.0.23.1', 'end']).project
    expect(ping(project, state, id(project, 'PC1'), '10.3.3.10').replies.filter(r => r.kind === 'echo-reply').length).toBeGreaterThanOrEqual(2)
    const table = cli(project, state, 'R1', ['show ip route']).outputs[0]
    expect(table).toContain('Gateway of last resort is 10.0.12.2 to network 0.0.0.0'); expect(table).toContain('S*    0.0.0.0/0 [1/0] via 10.0.12.2')
    const hops = desk(project, state, 'PC1', 'tracert 10.3.3.10').lines.join('\n')
    for (const hop of ['10.1.1.1', '10.0.12.2', '10.0.23.2', '10.3.3.10']) expect(hops).toContain(hop)
  })
  it('forms OSPF adjacencies, installs O routes and can originate a default route', () => {
    let { project, state } = chain()
    for (const [name, nets] of [['R1', ['10.1.1.0 0.0.0.255', '10.0.12.0 0.0.0.3']], ['R2', ['10.0.12.0 0.0.0.3', '10.0.23.0 0.0.0.3']], ['R3', ['10.0.23.0 0.0.0.3', '10.3.3.0 0.0.0.255']]]) {
      project = cli(project, state, name, ['en', 'conf t', 'router ospf 1', ...nets.map(n => `network ${n} area 0`), 'end']).project
    }
    project = cli(project, state, 'R1', ['en', 'conf t', 'router ospf 1', 'passive-interface g0/0', 'end']).project
    expect(cli(project, state, 'R2', ['show ip ospf neighbor']).outputs[0].match(/FULL/g)).toHaveLength(2)
    const table = cli(project, state, 'R1', ['show ip route']).outputs[0]
    expect(table).toMatch(/O\s+10\.3\.3\.0\/24 \[110\/3\] via 10\.0\.12\.2, GigabitEthernet0\/1/)
    expect(table).toMatch(/O\s+10\.0\.23\.0\/30 \[110\/2\] via 10\.0\.12\.2/)
    // Each of the three routers drops one echo while it resolves ARP for its next hop.
    expect(ping(project, state, id(project, 'PC1'), '10.3.3.10').replies.map(r => r.kind)).toEqual(['timeout', 'timeout', 'timeout', 'echo-reply'])
    expect(ping(project, state, id(project, 'PC1'), '10.3.3.10').replies.every(r => r.kind === 'echo-reply')).toBe(true)
    project = cli(project, state, 'R3', ['en', 'conf t', 'ip route 0.0.0.0 0.0.0.0 g0/1', 'router ospf 1', 'default-information originate', 'end']).project
    expect(cli(project, state, 'R1', ['show ip route']).outputs[0]).toContain('O*E2  0.0.0.0/0 [110/1] via 10.0.12.2, GigabitEthernet0/1')
    expect(checkGoals(project, [{ type: 'ospf', device: 'R2', neighbors: 2 }, { type: 'route', device: 'R1', prefix: '10.3.3.0/24', code: 'O' }]).passed).toBe(2)
  })
})

describe('DHCP, DNS, HTTP and access lists', () => {
  function office() {
    let project = build(['pc', 'pc', 'server', 'switch', 'router'], ['PC1 Fa0 S1 Fa0/1', 'PC2 Fa0 S1 Fa0/2', 'Server1 Fa0 R1 Gi0/1', 'S1 Gi0/1 R1 Gi0/0'])
    project = host(project, 'Server1', '172.16.0.10', '255.255.255.0', '172.16.0.1')
    project = updateDevice(project, id(project, 'Server1'), device => ({ ...device, config: { ...device.config, services: { http: { enabled: true, page: 'VoltShop staff portal' }, dns: { enabled: true, records: [{ name: 'portal.lab', ip: '172.16.0.10' }] } } } }))
    for (const name of ['PC1', 'PC2']) project = updateDevice(project, id(project, name), device => ({ ...device, config: { ...device.config, ipMode: 'dhcp' } }))
    const state = emptyState()
    project = cli(project, state, 'R1', ['en', 'conf t', 'ip dhcp excluded-address 192.168.1.1 192.168.1.9', 'ip dhcp pool LAN', 'network 192.168.1.0 255.255.255.0', 'default-router 192.168.1.1', 'dns-server 172.16.0.10', 'exit',
      'int g0/0', 'ip add 192.168.1.1 255.255.255.0', 'no sh', 'int g0/1', 'ip add 172.16.0.1 255.255.255.0', 'no sh', 'end']).project
    return { project, state }
  }
  it('leases addresses with DORA, skipping excluded ones, and lists the bindings', () => {
    let { project, state } = office()
    const renew = desk(project, state, 'PC1', 'ipconfig /renew')
    expect(renew.events.filter(event => event.protocol === 'DHCP').length).toBeGreaterThanOrEqual(4)
    project = renew.project
    expect(renew.lines.join('\n')).toContain('IPv4 Address....................: 192.168.1.10')
    project = desk(project, state, 'PC2', 'ipconfig /renew').project
    expect(project.devices.find(d => d.name === 'PC2').config.lease).toEqual({ ip: '192.168.1.11', mask: '255.255.255.0', gateway: '192.168.1.1', dns: '172.16.0.10' })
    expect(cli(project, state, 'R1', ['show ip dhcp binding']).outputs[0]).toMatch(/192\.168\.1\.10\s+0060/)
    expect(desk(project, state, 'PC1', 'ipconfig /all').lines.join('\n')).toContain('DHCP Enabled....................: Yes')
  })
  it('resolves names, loads the web page, and filters it with an extended access list', () => {
    let { project, state } = office()
    project = desk(project, state, 'PC1', 'ipconfig /renew').project
    project = desk(project, state, 'PC2', 'ipconfig /renew').project
    expect(desk(project, state, 'PC1', 'nslookup portal.lab').lines.slice(-3)).toEqual(['Non-authoritative answer:', 'Name:   portal.lab', 'Address:  172.16.0.10'])
    expect(desk(project, state, 'PC1', 'nslookup nope.lab').lines.join('\n')).toContain("can't find nope.lab")
    const page = browse(project, state, id(project, 'PC1'), 'http://portal.lab/')
    expect(page).toMatchObject({ ok: true, status: 200, body: 'VoltShop staff portal' })
    expect(page.events.map(event => event.protocol)).toEqual(expect.arrayContaining(['DNS', 'TCP', 'HTTP']))
    const run = cli(project, state, 'R1', ['en', 'conf t', 'access-list 110 deny tcp host 192.168.1.11 host 172.16.0.10 eq www', 'access-list 110 permit ip any any', 'int g0/0', 'ip access-group 110 in', 'end'])
    project = run.project
    expect(browse(project, state, id(project, 'PC2'), 'http://172.16.0.10/')).toMatchObject({ ok: false, message: 'Blocked: communication administratively prohibited.' })
    expect(browse(project, state, id(project, 'PC1'), 'http://172.16.0.10/').ok).toBe(true)
    expect(desk(project, state, 'PC2', 'ping 172.16.0.10').lines.join('\n')).toContain('Reply from 172.16.0.10')
    const lists = cli(project, state, 'R1', ['show access-lists']).outputs[0]
    expect(lists).toContain('Extended IP access list 110'); expect(lists).toMatch(/10 deny tcp host 192\.168\.1\.11 host 172\.16\.0\.10 eq www \(\d+ match/)
    // Removing the permit leaves only the implicit deny.
    project = cli(project, state, 'R1', ['en', 'conf t', 'no access-list 110', 'access-list 110 deny tcp any any eq 80', 'end']).project
    expect(desk(project, state, 'PC1', 'ping 172.16.0.10').lines.join('\n')).toContain('Communication administratively prohibited')
    expect(cli(project, state, 'R1', ['en', 'conf t', 'access-list 110 permit hostt 1.1.1.1 any']).outputs[2]).toContain("% Invalid input detected at '^' marker.")
  })
  it('translates inside hosts with PAT and a static mapping, and reports the router as unreachable admin', () => {
    let project = build(['pc', 'server', 'router'], ['PC1 Fa0 R1 Gi0/0', 'Server1 Fa0 R1 Gi0/1'])
    project = host(host(project, 'PC1', '192.168.1.10', '255.255.255.0', '192.168.1.1'), 'Server1', '203.0.113.20', '255.255.255.0', '203.0.113.1')
    const state = emptyState()
    project = cli(project, state, 'R1', ['en', 'conf t', 'int g0/0', 'ip add 192.168.1.1 255.255.255.0', 'ip nat inside', 'no sh', 'int g0/1', 'ip add 203.0.113.1 255.255.255.0', 'ip nat outside', 'no sh', 'exit',
      'access-list 1 permit 192.168.1.0 0.0.0.255', 'ip nat inside source list 1 interface g0/1 overload', 'end']).project
    expect(desk(project, state, 'PC1', 'ping 203.0.113.20').lines.join('\n')).toContain('Reply from 203.0.113.20')
    const nat = cli(project, state, 'R1', ['show ip nat translations']).outputs[0]
    expect(nat).toMatch(/icmp 203\.0\.113\.1:1\s+192\.168\.1\.10:1\s+203\.0\.113\.20:1/)
    const echo = ping(project, emptyState(), id(project, 'PC1'), '203.0.113.20', { count: 2 }).events.find(event => event.toId === id(project, 'Server1') && event.protocol === 'ICMP')
    expect(echo.layers[1].text).toContain('203.0.113.1 → 203.0.113.20')
    expect(cli(project, state, 'R1', ['enable', 'show running-config']).outputs[1]).toContain('ip nat inside source list 1 interface GigabitEthernet0/1 overload')
    expect(cli(project, state, 'R1', ['show running-config']).outputs[0]).toContain("% Invalid input detected at '^' marker.")
  })
})

describe('lab goals and solutions', () => {
  it('reports failing goals on the starting topology and passing ones after the solution', () => {
    let project = build(['pc', 'pc', 'router'], ['PC1 Fa0 R1 Gi0/0', 'PC2 Fa0 R1 Gi0/1'])
    project = host(project, 'PC2', '192.168.2.10', '255.255.255.0', '192.168.2.1')
    const goals = [{ type: 'interface', device: 'R1', iface: 'g0/0', ip: '192.168.1.1', up: true }, { type: 'host', device: 'PC1', ip: '192.168.1.10', gateway: '192.168.1.1' }, { type: 'ping', from: 'PC1', to: '192.168.2.10' }]
    expect(checkGoals(project, goals).passed).toBe(0)
    const solved = applySolution(project, [
      { device: 'PC1', host: { ipMode: 'static', ip: '192.168.1.10', mask: '255.255.255.0', gateway: '192.168.1.1' } },
      { device: 'R1', cli: ['enable', 'configure terminal', 'interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown', 'end'] },
    ])
    expect(solved.errors).toEqual([])
    expect(checkGoals(solved.project, goals)).toMatchObject({ passed: 3, total: 3 })
    expect(applySolution(project, [{ device: 'R1', cli: ['enable', 'conf t', 'interface g0/0', 'ip adress 1.1.1.1 255.0.0.0'] }]).errors).toHaveLength(1)
    expect(parseVlanList('10,20-22')).toEqual([10, 20, 21, 22]); expect(parseVlanList('5-2')).toBeNull()
  })
})

describe('project import hardening', () => {
  it('round-trips a fully configured router and rejects malformed services', () => {
    let project = build(['router', 'pc'], ['PC1 Fa0 R1 Gi0/0'])
    const state = emptyState()
    project = cli(project, state, 'R1', ['en', 'conf t', 'int g0/0', 'no sh', 'int g0/0.10', 'encapsulation dot1Q 10', 'ip add 10.10.0.1 255.255.255.0', 'exit',
      'ip route 0.0.0.0 0.0.0.0 g0/0.10', 'router ospf 1', 'network 10.10.0.0 0.0.0.255 area 0', 'passive-interface g0/0.10', 'exit', 'ip dhcp pool A', 'network 10.10.0.0 255.255.255.0', 'exit',
      'ip access-list extended WEB', 'permit tcp any host 10.10.0.5 eq 80', 'deny icmp any any echo', 'remark no other traffic', 'exit', 'ip nat inside source list WEB interface g0/0.10 overload', 'end', 'write memory']).project
    expect(parseProject(JSON.stringify(project))).toEqual(project)
    const r1 = project.devices.find(device => device.name === 'R1')
    for (const mutate of [
      config => { config.acls.WEB.entries[0].src = ['10.0.0.1', '0.255.0.255'] },
      config => { config.acls.WEB.entries.push({ action: 'permit', proto: 'gre', src: ['0.0.0.0', '255.255.255.255'], dst: ['0.0.0.0', '255.255.255.255'] }) },
      config => { config.ospf.networks[0].wildcard = '255.0.255.0' },
      config => { config.dhcp.pools.A.network = 'nope' },
      config => { config.nat.overload.iface = 'Gi9/9' },
      config => { config.saved.hostname = 42 },
    ]) {
      const broken = structuredClone(project)
      mutate(broken.devices.find(device => device.id === r1.id).config)
      expect(() => validateProject(broken)).toThrow(/not valid/)
    }
  })
})

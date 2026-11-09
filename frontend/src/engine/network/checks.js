import { formatIp, maskToPrefix, parseIp } from './addr.js'
import { cliError, createSession, execute } from './cli.js'
import { findDevice, hostAddressing, normalizePort, updateDevice } from './model.js'
import { runDesktop } from './desktop.js'
import { buildNetwork, emptyState, httpGet, ifaceUp, ospfNeighbors, ping, routingTable } from './sim.js'

/**
 * Lab goals, checked against the learner's current project. Connectivity goals run on a copy of the
 * runtime tables, so checking never changes what `show` commands display. A goal passes or fails with
 * a sentence explaining what was observed.
 */
const describe = (device, text) => `${device?.name ?? 'Device'}: ${text}`

export function checkGoal(project, goal) {
  const device = findDevice(project, goal.device ?? goal.from)
  if (!device) return { passed: false, detail: `No device named ${goal.device ?? goal.from}.` }
  const net = buildNetwork(project, emptyState())
  switch (goal.type) {
    case 'ping': {
      // Like a learner, ping twice: the first run may be spent resolving ARP along a cold path.
      const state = emptyState()
      let result = ping(project, state, device.id, goal.to, { count: 4 })
      if (!result.replies?.some(reply => reply.kind === 'echo-reply')) result = ping(project, state, device.id, goal.to, { count: 4 })
      const ok = result.replies?.some(reply => reply.kind === 'echo-reply') ?? false
      const passed = goal.expect === 'fail' ? !ok : ok
      return { passed, detail: describe(device, ok ? `ping ${goal.to} succeeded.` : `ping ${goal.to} got no echo reply.`) }
    }
    case 'http': {
      const result = httpGet(project, emptyState(), device.id, goal.url)
      const ok = !result.error && result.status === 200
      return { passed: goal.expect === 'fail' ? !ok : ok, detail: describe(device, ok ? `${goal.url} loaded.` : `${goal.url} did not load (${result.error}).`) }
    }
    case 'interface': {
      const name = normalizePort(goal.iface, device.type, { allowSub: true })
      const config = device.config.interfaces?.[name]
      if (!config) return { passed: false, detail: describe(device, `${goal.iface} does not exist.`) }
      const wrong = (goal.ip && config.ip !== goal.ip) || (goal.mask && config.mask !== goal.mask) || (goal.up && !ifaceUp(net, device, name)) || (goal.vlan && config.vlan !== goal.vlan)
      return { passed: !wrong, detail: describe(device, `${goal.iface} ${config.ip || 'unassigned'}${config.mask ? `/${maskToPrefix(config.mask)}` : ''}, ${ifaceUp(net, device, name) ? 'up' : 'down'}.`) }
    }
    case 'host': {
      const me = hostAddressing(device)
      const passed = (!goal.dhcp || (device.config.ipMode === 'dhcp' && device.config.lease)) && (!goal.ip || me.ip === parseIp(goal.ip)) && (!goal.mask || me.mask === parseIp(goal.mask)) && (!goal.gateway || me.gateway === parseIp(goal.gateway))
      return { passed: Boolean(passed), detail: describe(device, me.ip !== null ? `address ${formatIp(me.ip)}${me.gateway !== null ? `, gateway ${formatIp(me.gateway)}` : ''}.` : 'no address.') }
    }
    case 'vlan': {
      const name = device.config.vlans?.[goal.vlan]
      return { passed: Boolean(name) && (!goal.name || name.toLowerCase() === goal.name.toLowerCase()), detail: describe(device, name ? `VLAN ${goal.vlan} is ${name}.` : `VLAN ${goal.vlan} does not exist.`) }
    }
    case 'port': {
      const port = device.config.ports?.[normalizePort(goal.port, 'switch')]
      if (!port) return { passed: false, detail: describe(device, `${goal.port} does not exist.`) }
      const passed = (!goal.mode || port.mode === goal.mode) && (!goal.vlan || (port.mode === 'access' && port.vlan === goal.vlan)) && (!goal.native || port.native === goal.native)
      return { passed, detail: describe(device, `${goal.port} is ${port.mode}${port.mode === 'access' ? ` in VLAN ${port.vlan}` : ` (native ${port.native})`}.`) }
    }
    case 'route': {
      const [network, prefix] = goal.prefix.split('/')
      const entry = routingTable(net, device).find(item => formatIp(item.network) === network && maskToPrefix(item.mask) === Number(prefix))
      const passed = Boolean(entry) && (!goal.code || entry.code === goal.code)
      return { passed, detail: describe(device, entry ? `${goal.prefix} is in the routing table (${entry.code}).` : `no route to ${goal.prefix}.`) }
    }
    case 'ospf': {
      const count = ospfNeighbors(net, device).length
      return { passed: count >= goal.neighbors, detail: describe(device, `${count} OSPF neighbor${count === 1 ? '' : 's'}.`) }
    }
    case 'acl': {
      const name = normalizePort(goal.iface, 'router', { allowSub: true })
      const config = device.config.interfaces?.[name]
      const applied = goal.direction === 'out' ? config?.aclOut : config?.aclIn
      return { passed: Boolean(applied) && (!goal.acl || applied === goal.acl) && Boolean(device.config.acls[applied]), detail: describe(device, applied ? `access list ${applied} is applied ${goal.direction ?? 'in'} on ${goal.iface}.` : `no access list ${goal.direction ?? 'in'} on ${goal.iface}.`) }
    }
    case 'nat': {
      const name = normalizePort(goal.iface, 'router', { allowSub: true })
      return { passed: device.config.interfaces?.[name]?.nat === goal.role, detail: describe(device, `${goal.iface} NAT role: ${device.config.interfaces?.[name]?.nat || 'none'}.`) }
    }
    default:
      return { passed: false, detail: `Unknown goal type ${goal.type}.` }
  }
}
export function checkGoals(project, goals) {
  const results = goals.map(goal => ({ goal, ...checkGoal(project, goal) }))
  return { results, passed: results.filter(item => item.passed).length, total: results.length }
}

/**
 * Apply a lab solution: `{ device, cli: [...] }` lines go through the device CLI from user EXEC;
 * `{ device, desktop: [...] }` through the command prompt; `{ device, host: {...} }` sets IP settings.
 * Returns the project and any CLI line that printed an error, so tests can prove every line is valid.
 */
export function applySolution(project, solution) {
  let current = project
  const state = emptyState(), errors = []
  for (const step of solution) {
    const device = findDevice(current, step.device)
    if (!device) { errors.push({ device: step.device, line: '', output: 'No such device.' }); continue }
    if (step.host) current = updateDevice(current, device.id, item => ({ ...item, config: { ...item.config, ...step.host, lease: step.host.ipMode === 'dhcp' ? item.config.lease : null } }))
    if (step.cli) {
      let session = createSession(device.id)
      for (const line of step.cli) {
        const result = execute(current, state, session, line)
        current = result.project; session = result.session
        if (cliError(result.output)) errors.push({ device: step.device, line, output: result.output })
      }
    }
    if (step.desktop) for (const line of step.desktop) current = runDesktop(current, state, device.id, line).project
  }
  return { project: current, errors }
}

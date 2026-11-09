import { connect, defaultConfig, emptyProject, validateProject } from './model.js'
import { cliError, createSession, execute } from './cli.js'
import { emptyState } from './sim.js'

/**
 * Build a lab's starting project from a compact topology:
 * `{ devices: [{ name, type, x, y, host?, services?, config? }], links: ['PC1 Fa0 S1 Fa0/1', …] }`.
 * Device ids are the lower-cased names. `host` sets PC/server addressing, `services` the server's
 * HTTP/DNS, and `config` is CLI typed from user EXEC to pre-configure a router or switch. Any CLI
 * line the model rejects is returned in `errors` so content tests can fail on it.
 */
export function labProject(topology, name = 'Lab') {
  let project = emptyProject(name)
  for (const spec of topology.devices) {
    const config = defaultConfig(spec.type, spec.name)
    if (spec.host) Object.assign(config, { ipMode: 'static', ip: '', mask: '', gateway: '', dns: '', ...spec.host, lease: null })
    if (spec.services) config.services = { http: { ...config.services.http, ...spec.services.http }, dns: { ...config.services.dns, ...spec.services.dns } }
    project = { ...project, devices: [...project.devices, { id: spec.name.toLowerCase(), type: spec.type, name: spec.name, x: spec.x, y: spec.y, config }] }
  }
  for (const link of topology.links) {
    const [a, aPort, b, bPort] = link.split(' ')
    project = connect(project, { device: a.toLowerCase(), port: aPort }, { device: b.toLowerCase(), port: bPort })
  }
  const errors = [], state = emptyState()
  for (const spec of topology.devices) {
    if (!spec.config?.length) continue
    let session = createSession(spec.name.toLowerCase())
    for (const line of spec.config) {
      const result = execute(project, state, session, line)
      project = result.project; session = result.session
      if (cliError(result.output)) errors.push({ device: spec.name, line, output: result.output })
    }
  }
  return { project: validateProject(project), errors }
}

// Public surface of the simulation package (CONTRACTS §8).
export { createSimulation } from './controller.js'
export { createTrace } from './trace.js'
export { deriveEnv, deriveModuleOutputs } from './env.js'

/**
 * @typedef {object} Simulation
 * @property {(doc: object) => void} setDocument
 * @property {(source: string) => void} setCode
 * @property {() => Promise<{ ok: boolean, errors: Array }>} run
 * @property {() => void} stop
 * @property {() => void} reset
 * @property {(componentId: string, patch: object) => void} setControl
 * @property {(on: boolean) => void} setPowered
 * @property {(text: string) => void} serialWrite
 * @property {(req: { method?: string, path: string, body?: string, headers?: object }) => Promise<{ status: number, contentType: string, headers: object, body: string }>} httpRequest
 * @property {(topic: string, payload: string) => void} mqttPublish
 * @property {(ms: number) => void} advance inline mode only
 * @property {() => object} getState SimState snapshot (frozen)
 * @property {(listener: (state: object) => void) => (() => void)} subscribe
 * @property {() => void} dispose
 */

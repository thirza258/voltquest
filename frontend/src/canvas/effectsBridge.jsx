// Single import boundary for G2's effects (CONTRACTS §10). Only what the canvas core itself mounts is
// re-exported here so the rest of the canvas — and its tests — depend on one local module.
export { SmokePuff } from './effects/index.js'

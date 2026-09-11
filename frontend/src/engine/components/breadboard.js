/**
 * Breadboard geometry — CONTRACTS §3 (public entry point).
 *
 * The pure geometry lives in `./geometry.js` (a leaf module) so that `registry.js` can import hole
 * math without creating an import cycle. This module re-exports all of it and adds
 * `terminalPosition`, the one function that has to resolve component pins through the registry.
 */
import * as defaultRegistry from './registry.js'
import { findBreadboard, holeWorldPosition, parseTerminal } from './geometry.js'

export * from './geometry.js'

/**
 * World position of any terminal: a breadboard hole (`bb1:e12`) or a component pin (`c_x:anode`).
 * Component pins are located through `registry.resolvePins` (rotation and mount applied).
 * @param {object} doc
 * @param {string} terminalRef
 * @param {typeof defaultRegistry} [registry]
 * @returns {{x:number,y:number}|null}
 */
export function terminalPosition(doc, terminalRef, registry = defaultRegistry) {
  const ref = parseTerminal(terminalRef)
  if (!ref) return null
  if (findBreadboard(doc, ref.owner)) return holeWorldPosition(doc, ref.owner, ref.pin)
  const component = doc?.components?.find((c) => c.id === ref.owner)
  if (!component) return null
  const pin = registry.resolvePins(component, doc).pins[ref.pin]
  return pin ? { x: pin.x, y: pin.y } : null
}

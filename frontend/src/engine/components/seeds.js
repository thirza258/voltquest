/**
 * Pure document builders for tests, quest authors and the headless harness. They mutate the passed `doc` in
 * place and return the new element's id.
 */
import { layoutBreadboards } from './breadboard.js'
import { createComponent, defaultMcuPlacement } from './registry.js'

/**
 * Empty CircuitDoc (§4.1) with the breadboards for `boardMode` and, when `mcu` is set, the MCU component at its
 * default placement.
 * @param {{ boardMode?: 'half'|'full'|'dual', mcu?: 'uno'|'nano'|'esp32'|'esp32s3'|null, name?: string, mcuId?: string }} [options]
 */
export function makeDoc({ boardMode = 'half', mcu = null, name, mcuId } = {}) {
  const doc = {
    version: 1,
    boardMode,
    breadboards: layoutBreadboards(boardMode),
    mcu: mcu ?? null,
    components: [],
    wires: [],
    meta: name ? { name } : {},
  }
  if (mcu) doc.components.push(createComponent(mcu, defaultMcuPlacement(mcu, boardMode), {}, { id: mcuId ?? `c_${mcu}` }))
  return doc
}

/**
 * Board-mount a component with its anchor pin on `hole` of breadboard `board`.
 * @returns {string} component id
 */
export function place(doc, type, board, hole, props = {}, rotation = 0, id) {
  const component = createComponent(type, { anchor: { board, hole }, rotation }, props, { id })
  doc.components.push(component)
  return component.id
}

/**
 * Free-mount a component with its body top-left at world (x, y).
 * @returns {string} component id
 */
export function placeFree(doc, type, x, y, props = {}, rotation = 0, id) {
  const component = createComponent(type, { position: { x, y }, rotation }, props, { id })
  doc.components.push(component)
  return component.id
}

let wireCounter = 0

/**
 * Add a jumper wire between two TerminalRefs ('bb1:e12', 'c_uno:D13').
 * @returns {string} wire id
 */
export function wire(doc, from, to, color = 'red', id) {
  wireCounter = (wireCounter + 1) % 46656
  const w = { id: id ?? `w_${wireCounter.toString(36).padStart(6, '0')}`, from, to, color }
  doc.wires.push(w)
  return w.id
}

/** The document's MCU component, or null. */
export function mcuOf(doc) {
  return doc.components.find((c) => c.type === doc.mcu) ?? null
}

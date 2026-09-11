/**
 * Pin-definition helpers shared by the board profiles (CONTRACTS §2 PinDef).
 * All pins are fully populated so consumers never need to null-check optional fields.
 */

/** @typedef {import('./index.js').PinDef} PinDef */

/**
 * Build a complete PinDef with sensible defaults for every field.
 * @param {Partial<PinDef> & { name: string, side: 'top'|'bottom'|'left'|'right', index: number }} spec
 * @returns {PinDef}
 */
export function makePin(spec) {
  return {
    name: spec.name,
    label: spec.label ?? spec.name,
    kind: spec.kind ?? 'digital',
    number: spec.number ?? null,
    aliases: spec.aliases ?? [],
    caps: spec.caps ?? [],
    adcChannel: spec.adcChannel ?? null,
    adcUnit: spec.adcUnit ?? null,
    touchChannel: spec.touchChannel ?? null,
    dacChannel: spec.dacChannel ?? null,
    volts: spec.volts ?? null,
    tiedTo: spec.tiedTo ?? null,
    side: spec.side,
    index: spec.index,
  }
}

/** Ground pin (`GND`, `GND2`, ...). */
export function groundPin(name, side, index) {
  return makePin({ name, label: 'GND', kind: 'ground', side, index })
}

/** Supply pin with a fixed voltage (`5V`, `3V3`, `VIN`). */
export function powerPin(name, volts, side, index, label = name) {
  return makePin({ name, label, kind: 'power', volts, side, index })
}

/** Non-electrical / control pin (`RESET`, `AREF`, `EN`, `IOREF`). */
export function otherPin(name, side, index, label = name) {
  return makePin({ name, label, kind: 'other', side, index })
}

/**
 * Assign `side` and `index` to a header row of pins in silkscreen order.
 * @param {'top'|'bottom'|'left'|'right'} side
 * @param {Array<Omit<PinDef,'side'|'index'> | ((side, index) => PinDef)>} builders
 */
export function headerRow(side, builders) {
  return builders.map((b, index) => (typeof b === 'function' ? b(side, index) : makePin({ ...b, side, index })))
}

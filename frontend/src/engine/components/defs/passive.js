/** Passive parts and the NPN transistor. */
import { ALL_BOARDS, RESISTOR_VALUES, enumProp, footprint, numberProp, pin } from './shared.js'
import { capacitorLearn, diodeLearn, npnLearn, resistorLearn } from '../learn/passive.js'

export const resistor = {
  type: 'resistor',
  name: 'Resistor',
  category: 'passive',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('p1', 0), pin('p2', 4)], 5, 1),
  props: { ohms: enumProp('Resistance', RESISTOR_VALUES, 220, { unit: 'Ω', format: 'ohms' }) },
  model: [{ kind: 'resistor', pins: { a: 'p1', b: 'p2' }, ohms: '$props.ohms' }],
  control: null,
  peripheral: null,
  learn: resistorLearn,
  bom: { partName: 'Resistor 1/4 W', catalogId: 'resistor_220' },
}

export const capacitor = {
  type: 'capacitor',
  name: 'Capacitor',
  category: 'passive',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('pos', 0, 0, '+'), pin('neg', 1, 0, '−')], 2, 1),
  props: { uF: numberProp('Capacitance', 100, { min: 1, max: 4700, step: 1, unit: 'µF' }) },
  model: [{ kind: 'capacitor', pins: { a: 'pos', b: 'neg' } }],
  control: null,
  peripheral: null,
  learn: capacitorLearn,
  bom: { partName: 'Electrolytic capacitor 100 µF', catalogId: 'capacitor' },
}

export const diode = {
  type: 'diode',
  name: 'Diode (1N4007)',
  category: 'passive',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('anode', 0, 0, 'A'), pin('cathode', 4, 0, 'K')], 5, 1),
  props: {},
  model: [{ kind: 'diode', pins: { anode: 'anode', cathode: 'cathode' }, vf: 0.7, rOn: 1, ratedMa: 1000, maxMa: 1000 }],
  control: null,
  peripheral: null,
  learn: diodeLearn,
  bom: { partName: 'Rectifier diode 1N4007', catalogId: 'diode_1n4007' },
}

export const transistor_npn = {
  type: 'transistor_npn',
  name: 'NPN transistor (2N2222)',
  category: 'passive',
  mount: 'board',
  recommendedBoards: ALL_BOARDS,
  footprint: footprint([pin('e', 0, 0, 'E'), pin('b', 1, 0, 'B'), pin('c', 2, 0, 'C')], 3, 1),
  props: {},
  model: [{ kind: 'npn', pins: { e: 'e', b: 'b', c: 'c' }, beta: 100, vbeOn: 0.7, vceSat: 0.2, maxMa: 800 }],
  control: null,
  peripheral: null,
  learn: npnLearn,
  bom: { partName: 'NPN transistor 2N2222', catalogId: 'transistor_2n2222' },
}

export const PASSIVE_DEFS = [resistor, capacitor, diode, transistor_npn]

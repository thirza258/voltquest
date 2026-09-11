import { native, noop } from './helpers.js'

export function createWireLibrary() {
  const wire = {
    construct: () => ({ __class: 'TwoWire' }),
    methods: {
      begin: native('bool', () => true), end: noop, setClock: noop, beginTransmission: noop,
      endTransmission: native('int', () => 0), requestFrom: native('int', () => 0),
      write: native('size_t', (args) => args[0]?.length ?? 1), available: native('int', () => 0),
      read: native('int', () => -1), peek: native('int', () => -1), flush: noop,
    },
  }
  return { classes: { TwoWire: wire }, globals: { Wire: wire.construct() } }
}

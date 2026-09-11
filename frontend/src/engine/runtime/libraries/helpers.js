export const native = (returns, fn) => ({ returns, fn })
export const noop = native('void', () => undefined)
export const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback
export const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, integer(value)))

export function deviceByPin(core, protocol, role, pin) {
  const binding = core.bindings.byPin(protocol, role, core.pins.resolve(pin)?.name)
  if (!binding) core.peripheral(null, protocol, {})
  return binding
}

export function deviceByAddress(core, protocol, address) {
  const binding = core.bindings.byAddress(protocol, address)
  if (!binding) core.peripheral(null, protocol, {})
  return binding
}

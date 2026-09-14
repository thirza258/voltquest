/** Deterministic teaching curves, not manufacturer-calibrated sensor fits. Resistance is in Ω. */
function bounded(value, min, max, fallback) {
  return Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback))
}

/** Nominal 10 kΩ at 25 °C, beta 3950 K; no self-heating or thermal lag. */
export function thermistorOhms(temperatureC) {
  const kelvin = bounded(temperatureC, -20, 100, 25) + 273.15
  return 10000 * Math.exp(3950 * (1 / kelvin - 1 / 298.15))
}

/** A simple bend response: 10 kΩ flat, 30 kΩ at 90 degrees. */
export function flexOhms(bendDegrees) {
  return 10000 + 20000 * bounded(bendDegrees, 0, 90, 0) / 90
}

/** A monotonic force response: 1 MΩ unloaded, approximately 1 kΩ at 100%. */
export function forceOhms(forcePercent) {
  return 1000000 / (1 + 999 * bounded(forcePercent, 0, 100, 0) / 100)
}

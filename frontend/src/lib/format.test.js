import { describe, it, expect } from 'vitest'
import { formatVolts, formatAmps, formatOhms, formatWatts, formatDuration, timeAgo, formatPercent } from './format.js'

describe('format', () => {
  it('volts', () => {
    expect(formatVolts(3.3)).toBe('3.30 V')
    expect(formatVolts(0)).toBe('0.00 V')
    expect(formatVolts(0.0004)).toBe('0.4 mV')
    expect(formatVolts(undefined)).toBe('—')
  })
  it('amps', () => {
    expect(formatAmps(0.0125)).toBe('12.5 mA')
    expect(formatAmps(0.317)).toBe('317 mA')
    expect(formatAmps(1.2)).toBe('1.20 A')
    expect(formatAmps(0.00004)).toBe('40 µA')
    expect(formatAmps(0)).toBe('0 mA')
  })
  it('ohms', () => {
    expect(formatOhms(220)).toBe('220 Ω')
    expect(formatOhms(4700)).toBe('4.7 kΩ')
    expect(formatOhms(10000)).toBe('10 kΩ')
    expect(formatOhms(1e6)).toBe('1 MΩ')
  })
  it('watts and durations', () => {
    expect(formatWatts(0.045)).toBe('45.0 mW')
    expect(formatWatts(0.45)).toBe('450 mW')
    expect(formatWatts(2.5)).toBe('2.50 W')
    expect(formatDuration(12345)).toBe('12.3 s')
    expect(formatDuration(125000)).toBe('2m 05s')
    expect(formatPercent(0.789)).toBe('79 %')
  })
  it('timeAgo', () => {
    const now = Date.parse('2026-01-01T12:00:00Z')
    expect(timeAgo('2026-01-01T11:59:50Z', now)).toBe('just now')
    expect(timeAgo('2026-01-01T11:58:00Z', now)).toBe('2 min ago')
    expect(timeAgo('2026-01-01T09:00:00Z', now)).toBe('3 h ago')
    expect(timeAgo('2025-12-31T12:00:00Z', now)).toBe('yesterday')
    expect(timeAgo('bogus', now)).toBe('')
  })
})

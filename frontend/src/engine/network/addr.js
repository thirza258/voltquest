/** IPv4 and MAC helpers. Addresses are unsigned 32-bit numbers; every result stays in 0 … 2³² − 1. */

export function parseIp(text) {
  if (typeof text !== 'string') return null
  const parts = text.trim().split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null
    value = value * 256 + Number(part)
  }
  return value >>> 0
}
export const formatIp = value => [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.')
export const isIp = text => parseIp(text) !== null

/** A mask is valid when its ones are contiguous from the left (0.0.0.0 and 255.255.255.255 included). */
export function maskToPrefix(mask) {
  const value = typeof mask === 'string' ? parseIp(mask) : mask
  if (value === null || value === undefined) return null
  const inverted = (~value) >>> 0
  if ((inverted & (inverted + 1)) !== 0) return null
  let bits = 0
  for (let probe = value; probe; probe = (probe << 1) >>> 0) bits++
  return bits
}
export const prefixToMask = prefix => prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0)
export const isMask = text => maskToPrefix(text) !== null
/** Wildcards are inverted masks; the access lists here accept only contiguous ones. */
export const wildcardToMask = wildcard => (~wildcard) >>> 0
export const isWildcard = text => { const value = parseIp(text); return value !== null && maskToPrefix(wildcardToMask(value)) !== null }

export const networkOf = (ip, mask) => (ip & mask) >>> 0
export const broadcastOf = (ip, mask) => (ip | (~mask >>> 0)) >>> 0
export const sameSubnet = (a, b, mask) => networkOf(a, mask) === networkOf(b, mask)
/** True for a usable host address in its subnet (not the network or broadcast address; /31 and /32 excepted). */
export function isHostAddress(ip, mask) {
  const prefix = maskToPrefix(mask)
  if (prefix === null) return false
  if (prefix >= 31) return true
  return ip !== networkOf(ip, mask) && ip !== broadcastOf(ip, mask)
}
export const cidr = (network, mask) => `${formatIp(network)}/${maskToPrefix(mask)}`
/** Classful major network, used to group `show ip route` the way the router CLI prints it. */
export function classfulMask(ip) {
  const first = ip >>> 24
  return first < 128 ? prefixToMask(8) : first < 192 ? prefixToMask(16) : prefixToMask(24)
}

/** Deterministic MAC for a device port: an FNV-1a hash of the device id, plus the port index. */
export function macFor(deviceId, portIndex) {
  let hash = 0x811c9dc5
  for (const char of String(deviceId)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 0x01000193) >>> 0 }
  // A 0060 prefix keeps every address unicast; six hash digits name the device, two the port.
  const hex = hash.toString(16).padStart(8, '0').slice(0, 6) + (portIndex & 0xff).toString(16).padStart(2, '0')
  return `0060.${hex.slice(0, 4)}.${hex.slice(4, 8)}`
}
export const BROADCAST_MAC = 'ffff.ffff.ffff'
/** Desktop hosts print MAC addresses with dashes. */
export const dashedMac = mac => mac.replace(/\./g, '').toUpperCase().match(/../g).join('-')

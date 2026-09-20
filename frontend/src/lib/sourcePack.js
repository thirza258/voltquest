/** A small stored ZIP for the authored UTF-8 source files. No executable archive content. */
export function sourcePack(files) {
  const encoder = new TextEncoder(), local = [], directory = []
  let offset = 0, directorySize = 0
  for (const [filename, source] of Object.entries(files)) {
    const name = encoder.encode(filename), data = encoder.encode(source)
    let crc = 0xffffffff
    for (const byte of data) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
    crc = (crc ^ 0xffffffff) >>> 0
    const header = new Uint8Array(30 + name.length), h = new DataView(header.buffer)
    h.setUint32(0, 0x04034b50, true)
    h.setUint16(4, 20, true)
    h.setUint16(6, 0x800, true)
    h.setUint16(12, 0x21, true) // 1980-01-01, deterministic DOS date.
    h.setUint32(14, crc, true)
    h.setUint32(18, data.length, true)
    h.setUint32(22, data.length, true)
    h.setUint16(26, name.length, true)
    header.set(name, 30)
    const entry = new Uint8Array(46 + name.length), e = new DataView(entry.buffer)
    e.setUint32(0, 0x02014b50, true)
    e.setUint16(4, 20, true)
    e.setUint16(6, 20, true)
    e.setUint16(8, 0x800, true)
    e.setUint16(14, 0x21, true)
    e.setUint32(16, crc, true)
    e.setUint32(20, data.length, true)
    e.setUint32(24, data.length, true)
    e.setUint16(28, name.length, true)
    e.setUint32(42, offset, true)
    entry.set(name, 46)
    local.push(header, data)
    directory.push(entry)
    offset += header.length + data.length
    directorySize += entry.length
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true)
  e.setUint16(8, directory.length, true)
  e.setUint16(10, directory.length, true)
  e.setUint32(12, directorySize, true)
  e.setUint32(16, offset, true)
  return new Blob([...local, ...directory, end], { type: 'application/zip' })
}

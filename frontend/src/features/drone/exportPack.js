import { positionOf, droneDef } from '../../engine/drone/document.js'
import { deriveConfig } from '../../engine/drone/config.js'
import { billOfMaterials, bomCsv } from '../sandbox/bom.js'
import { downloadBlob } from '../../lib/download.js'
import { exportCanvasPng } from '../../canvas/exportPng.js'

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export function wiringSvg(doc) {
  const links = doc.links.map(l => { const a = positionOf(doc, l.from.split(':')[0]), b = positionOf(doc, l.to.split(':')[0]); return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${l.kind === 'power' ? '#e11d48' : '#0d9488'}"/>` }).join('')
  const parts = doc.components.filter(c => c.type !== 'drone_prop').map(c => { const [x, y] = positionOf(doc, c.id); return `<g transform="translate(${x} ${y})"><rect x="-35" y="-14" width="70" height="28" fill="white" stroke="#475569"/><text text-anchor="middle" y="4" font-size="9">${escape(droneDef(c.type)?.name ?? c.type)}</text></g>` }).join('')
  const rows = doc.links.map((l, i) => `<text x="20" y="${530 + i * 18}" font-size="11">${escape(`${l.from} → ${l.to} · ${l.kind} · ${l.awg} AWG · ${l.lengthM} m`)}</text>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 ${550 + doc.links.length * 18}" width="600" height="${550 + doc.links.length * 18}"><rect width="100%" height="100%" fill="white"/><g fill="#0f172a" font-family="sans-serif"><text x="20" y="25" font-size="16">${escape(doc.droneConfig.name)} — wiring</text>${links}${parts}${rows}</g></svg>`
}

export function checklist(file) {
  const d = deriveConfig(file.circuit.droneConfig), rows = billOfMaterials(file.circuit)
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(file.name)} — pre-flight checklist</title><style>body{font:16px/1.6 sans-serif;max-width:760px;margin:40px auto;padding:20px}li{margin:12px 0}h1{font-size:24px}@media print{body{margin:0}}</style><h1>${escape(file.name)} — build and pre-flight checklist</h1><p>AUW ${d.auwG.toFixed(0)} g · TWR ${d.twr.toFixed(2)} · hover estimate ${d.hoverMinutes.toFixed(1)} min · illustrative BOM total $${rows.reduce((s, r) => s + r.qty * r.unit_price_usd, 0).toFixed(2)}</p><p><strong>Simulated performance figures are estimates from a coefficient teaching model, not measurements of shipped parts or an assessment of flight-worthiness.</strong> Custom numeric settings may differ from the catalog examples. Verify every selected specification, connector, polarity, wire gauge, firmware dependency and vendor price.</p><ul><li>☐ Remove ALL propellers for wiring, ESC arming and motor-order tests.</li><li>☐ Inspect solder joints, continuity and XT60 polarity before connecting power. Use a smoke stopper for the first power-up.</li><li>☐ Check BEC voltage, ESC and motor current ratings, prop clearance, motor order, CW/CCW handedness and fasteners.</li><li>☐ Confirm throttle-low arming, disarm and receiver-loss failsafe with props removed.</li><li>☐ Confirm IMU axes and feedback signs; tune at low energy in a suitable test setup.</li><li>☐ Inspect the LiPo: never use a puffed pack, never over-discharge or charge unattended, use an appropriate balance charger, and follow its storage-voltage instructions between sessions.</li><li>☐ Fit props only after bench checks. Clear the flight area and maintain safe separation.</li><li>☐ Check applicable local aviation rules, registration and weight thresholds, visual line-of-sight requirements and no-fly zones before any real flight.</li></ul><p>The .ino uses VoltQuest teaching helpers (VoltFlight, VoltRC, PID). These helpers are simulator APIs, not a hardware flight stack. Port and independently verify the control, sensor and failsafe implementation for real hardware before use.</p></html>`
}

function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)) } return (crc ^ 0xffffffff) >>> 0 }
/** Small uncompressed ZIP writer: one browser download, no new eager dependency. */
export async function buildZip(files) {
  const encoder = new TextEncoder(), local = [], central = []
  let offset = 0, directorySize = 0
  for (const [filename, content] of Object.entries(files)) {
    const name = encoder.encode(filename), bytes = content instanceof Blob ? new Uint8Array(await content.arrayBuffer()) : encoder.encode(content)
    const crc = crc32(bytes), header = new Uint8Array(30 + name.length), h = new DataView(header.buffer)
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint32(14, crc, true); h.setUint32(18, bytes.length, true); h.setUint32(22, bytes.length, true); h.setUint16(26, name.length, true); header.set(name, 30)
    const entry = new Uint8Array(46 + name.length), e = new DataView(entry.buffer)
    e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true); e.setUint16(8, 0x800, true); e.setUint32(16, crc, true); e.setUint32(20, bytes.length, true); e.setUint32(24, bytes.length, true); e.setUint16(28, name.length, true); e.setUint32(42, offset, true); entry.set(name, 46)
    local.push(header, bytes); central.push(entry); offset += header.length + bytes.length; directorySize += entry.length
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, central.length, true); e.setUint16(10, central.length, true); e.setUint32(12, directorySize, true); e.setUint32(16, offset, true)
  return new Blob([...local, ...central, end], { type: 'application/zip' })
}

export async function exportBuildPack(file, filename) {
  const svgText = wiringSvg(file.circuit), element = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement
  const png = await exportCanvasPng(element)
  const zip = await buildZip({ 'project.json': JSON.stringify(file, null, 2), 'drone-config.json': JSON.stringify(file.circuit.droneConfig, null, 2), 'bill-of-materials.csv': bomCsv(billOfMaterials(file.circuit)), 'wiring.png': png, 'wiring.svg': svgText, 'sketch.ino': file.code, 'pre-flight-checklist.html': checklist(file) })
  downloadBlob(zip, `${filename}-build-pack.zip`)
}

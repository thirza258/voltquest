import { expect, it } from 'vitest'
import { buildZip, checklist, wiringSvg } from './exportPack.js'
import { createDroneDoc } from '../../engine/drone/document.js'
import { billOfMaterials, bomCsv } from '../sandbox/bom.js'
import { projectFile } from '../sandbox/projectFile.js'
import { ASSISTED_CODE } from '../../engine/drone/examples.js'

it('exports the actual wiring and custom specifications with escaped user text', () => {
  const doc = createDroneDoc(); doc.droneConfig.name = '<script>alert(1)</script>'; doc.droneConfig.motors.kv = 1850
  const svg = wiringSvg(doc), html = checklist(projectFile({ name: '<img src=x onerror=alert(1)>', circuit: doc, code: ASSISTED_CODE }))
  expect(svg).not.toContain('<script>'); expect(svg).toContain('&lt;script&gt;')
  for (const link of doc.links) { expect(svg).toContain(link.from); expect(svg).toContain(link.to) }
  expect(html).not.toContain('<img'); expect(html).toContain('simulator APIs'); expect(html).toContain('pre-flight')
  const csv = bomCsv(billOfMaterials(doc)); expect(csv).toContain('1850'); expect(csv.toLowerCase()).not.toContain('breadboard')
})
it('builds a readable archive with UTF-8 text and exact binary PNG contents', async () => {
  const files = { 'sketch.ino': 'void setup() {} // µs', 'wiring.png': new Blob([new Uint8Array([137, 80, 78, 71])]), 'drone-config.json': '{"name":"Drone"}' }
  const bytes = new Uint8Array(await (await buildZip(files)).arrayBuffer()), view = new DataView(bytes.buffer), decoder = new TextDecoder()
  let offset = 0
  const extracted = {}
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), start = offset + 30 + nameLength
    extracted[decoder.decode(bytes.slice(offset + 30, start))] = bytes.slice(start, start + size)
    offset = start + size
  }
  expect(view.getUint32(offset, true)).toBe(0x02014b50)
  expect(Object.keys(extracted)).toEqual(Object.keys(files))
  expect(decoder.decode(extracted['sketch.ino'])).toBe(files['sketch.ino']); expect([...extracted['wiring.png']]).toEqual([137, 80, 78, 71])
  expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50); expect(view.getUint16(bytes.length - 12, true)).toBe(3)
})

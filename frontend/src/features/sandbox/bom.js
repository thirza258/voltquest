import { CATALOG } from '../../content/index.js'
import { droneBomItems } from '../../engine/drone/bom.js'
import { describeValue, getDef } from '../../engine/components/registry.js'

const MAPPING = { uno: 'arduino_uno', nano: 'arduino_nano', esp32: 'esp32_devkit_v1', esp32s3: 'esp32_s3', potentiometer: 'potentiometer_10k', diode: 'diode_1n4007', transistor_npn: 'transistor_2n2222', servo: 'servo_sg90', neopixel_ring: 'neopixel_ring_12', ultrasonic_hcsr04: 'hcsr04' }
export function billOfMaterials(doc) {
  const rows = new Map()
  function add(id, value = '', fallback = id.replaceAll('_', ' ')) {
    const key = `${id}:${value}`
    if (rows.has(key)) { rows.get(key).qty++; return }
    const entry = CATALOG[id] ?? {}
    rows.set(key, { qty: 1, part: entry.name ?? fallback, value, catalog_id: id, unit_price_usd: entry.unitPriceUsd ?? 0, vendor: entry.vendors?.[0]?.name ?? '', link: entry.vendors?.[0]?.url ?? '' })
  }
  if (doc.kind === 'drone') { for (const item of droneBomItems(doc)) add(item.id, item.value); return [...rows.values()] }
  add(doc.boardMode === 'full' ? 'breadboard_full' : 'breadboard_half')
  if (doc.boardMode === 'dual') add('breadboard_half')
  for (const c of doc.components) {
    const id = c.type === 'resistor' ? `resistor_${c.props?.ohms ?? 220}` : c.type === 'led' ? `led_${c.props?.color ?? 'red'}` : MAPPING[c.type] ?? c.type
    add(id, describeValue(c.type, c.props ?? {}), getDef(c.type)?.name)
  }
  if (doc.wires.length) add('jumper_wires')
  return [...rows.values()]
}
export function bomCsv(rows) {
  // A leading apostrophe prevents spreadsheet formula execution in imported labels.
  const quote = value => `"${String(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`
  return [['Qty', 'Part', 'Value', 'Catalog ID', 'Est. unit price (USD)', 'Vendor', 'Link'], ...rows.map(r => [r.qty, r.part, r.value, r.catalog_id, Number(r.unit_price_usd).toFixed(2), r.vendor, r.link])].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}

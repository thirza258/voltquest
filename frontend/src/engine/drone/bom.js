export function droneBomItems(doc) {
  const c = doc.droneConfig, items = [], size = c.props.diameterIn <= 3.2 ? 3 : c.props.diameterIn <= 5.5 ? 5 : 7
  const add = (id, value = '') => items.push({ id, value })
  let escAdded = false
  for (const p of doc.components) {
    switch (p.type) {
      case 'drone_frame': add(`frame_${size}in`, `${c.airframe.wheelbaseMm} mm; ${c.airframe.frameMassG} g`); break
      case 'brushless_motor': add({ '1404': 'motor_1404_4600kv', '2207': 'motor_2207_1750kv', '2806': 'motor_2806_1300kv' }[c.motors.stator], `${c.motors.kv} Kv; ${c.motors.maxCurrentA} A`); break
      case 'drone_prop': add(`prop_${size}in_${size === 7 ? 2 : 3}b`, `${c.props.diameterIn} x ${c.props.pitchIn}; ${c.props.blades} blades; ${p.props.direction}`); break
      case 'esc': if (c.esc.kind === 'single' || !escAdded) add(c.esc.kind === 'single' ? 'esc_single_30a' : 'esc_4in1_45a', `${c.esc.continuousA} A/channel; ${c.esc.protocol}`); escAdded = true; break
      case 'lipo': add(c.battery.cells <= 3 ? 'lipo_3s_2200mah' : c.battery.cells <= 4 ? 'lipo_4s_1500mah' : 'lipo_6s_1300mah', `${c.battery.cells}S ${c.battery.capacityMah} mAh ${c.battery.cRating}C`); break
      case 'esp32': case 'esp32s3': add('fc_carrier_esp32', c.fc.board); break
      case 'rx_elrs': add('rx_elrs_2400'); break
      case 'drone_accessory': break
      default: add(p.type)
    }
  }
  if (doc.links.length) { add('xt60_pair'); add('silicone_wire_16awg', `${doc.links.filter(l => l.kind === 'power').reduce((n, l) => n + l.lengthM, 0).toFixed(2)} m; verify selected gauges`); add('jst_sh_cable') }
  for (const extra of c.extras.filter(e => !['rx_elrs_2400', 'gps'].includes(e.id))) add(extra.id)
  if (doc.flight.bench && !c.extras.some(e => e.id === 'thrust_stand')) add('thrust_stand')
  return items
}

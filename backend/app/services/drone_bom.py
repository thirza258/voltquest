"""Catalog selection preserves configured values alongside illustrative catalog examples."""
def items(doc):
    c = doc['droneConfig']
    size = 3 if c['props']['diameterIn'] <= 3.2 else 5 if c['props']['diameterIn'] <= 5.5 else 7
    rows = []
    esc_added = False
    for p in doc['components']:
        kind = p['type']
        if kind == 'drone_frame':
            rows.append((f'frame_{size}in', f"{c['airframe']['wheelbaseMm']} mm; {c['airframe']['frameMassG']} g"))
        elif kind == 'brushless_motor':
            rows.append(({'1404': 'motor_1404_4600kv', '2207': 'motor_2207_1750kv', '2806': 'motor_2806_1300kv'}[c['motors']['stator']], f"{c['motors']['kv']} Kv; {c['motors']['maxCurrentA']} A"))
        elif kind == 'drone_prop':
            rows.append((f'prop_{size}in_{2 if size == 7 else 3}b', f"{c['props']['diameterIn']} x {c['props']['pitchIn']}; {c['props']['blades']} blades; {p['props']['direction']}"))
        elif kind == 'esc':
            if c['esc']['kind'] == 'single' or not esc_added:
                rows.append(('esc_single_30a' if c['esc']['kind'] == 'single' else 'esc_4in1_45a', f"{c['esc']['continuousA']} A/channel; {c['esc']['protocol']}"))
            esc_added = True
        elif kind == 'lipo':
            rows.append(('lipo_3s_2200mah' if c['battery']['cells'] <= 3 else 'lipo_4s_1500mah' if c['battery']['cells'] <= 4 else 'lipo_6s_1300mah', f"{c['battery']['cells']}S {c['battery']['capacityMah']} mAh {c['battery']['cRating']}C"))
        elif kind in ('esp32', 'esp32s3'):
            rows.append(('fc_carrier_esp32', c['fc']['board']))
        elif kind == 'rx_elrs':
            rows.append(('rx_elrs_2400', ''))
        elif kind != 'drone_accessory':
            rows.append((kind, ''))
    if doc['links']:
        length = sum(l['lengthM'] for l in doc['links'] if l['kind'] == 'power')
        rows += [('xt60_pair', ''), ('silicone_wire_16awg', f'{length:.2f} m; verify selected gauges'), ('jst_sh_cable', '')]
    rows += [(e['id'], '') for e in c['extras'] if e['id'] not in ('rx_elrs_2400', 'gps')]
    if doc['flight']['bench'] and not any(e['id'] == 'thrust_stand' for e in c['extras']):
        rows.append(('thrust_stand', ''))
    return rows

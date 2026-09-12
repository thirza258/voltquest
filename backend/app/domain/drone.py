"""Validate drone documents at the existing project boundary; no firmware runs here."""
import json
import math
from pathlib import Path

from .errors import InvalidInput

CATALOG = json.loads(Path(__file__).with_name('drone_catalog.json').read_text())


def validate_drone(doc, board):
    def require(value, message):
        if not value:
            raise InvalidInput(message)

    def number(value, lo, hi):
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and lo <= value <= hi

    data = CATALOG
    require(doc.get('version') == 1 and doc.get('mcu') == board and board in ('esp32', 'esp32s3') and doc.get('boardMode') == 'half', 'Invalid drone controller or version')
    require(doc.get('breadboards') == [] and doc.get('wires') == [], 'Drone documents use mounts and links')
    c = doc.get('droneConfig')
    require(isinstance(c, dict), 'Missing drone configuration')
    for section, fields in data['fields'].items():
        require(isinstance(c.get(section), dict), f'Missing {section}')
        for key, limits in fields.items():
            require(number(c[section].get(key), limits[0], limits[1]), f'Invalid {section}.{key}')
    require(c.get('schemaVersion') == 1 and c['airframe'].get('class') == 'quad_x' and c['motors'].get('count') == 4, 'Only quad-X is supported')
    require(isinstance(c.get('name'), str) and len(c['name']) <= 80, 'Invalid drone name')
    require(c['battery']['cells'] % 1 == 0 and c['props']['blades'] % 1 == 0, 'Counts must be integers')
    require(c['motors'].get('stator') in ('1404', '2207', '2806'), 'Invalid stator')
    require(c['esc'].get('kind') in ('4in1', 'single') and c['esc'].get('protocol') in ('pwm', 'oneshot125', 'dshot600') and c['battery'].get('chemistry') == 'lipo', 'Invalid ESC or pack')
    fc = c.get('fc', {})
    require(isinstance(fc, dict) and fc.get('board') == board and fc.get('carrier') == 'fc_carrier_esp32' and fc.get('imu') in ('imu_mpu6050', None) and fc.get('baro') in ('baro_bmp280', None), 'Invalid carrier or sensors')
    extras = c.get('extras')
    require(isinstance(extras, list) and len(extras) <= 8, 'Invalid accessories')
    for e in extras:
        require(isinstance(e, dict) and e.get('id') in ('rx_elrs_2400', 'gps', 'prop_guards', 'smoke_stopper', 'thrust_stand') and number(e.get('massG'), 0, 200), 'Invalid accessory')
    require(number(c.get('payloadG'), 0, 0), 'Payloads are outside the teaching model')
    if 'mixer' in c:
        require(isinstance(c['mixer'], list) and len(c['mixer']) == 4 and all(isinstance(row, list) and len(row) == 4 and row[0] == 1 and all(number(n, -1, 1) for n in row) for row in c['mixer']), 'Invalid mixer matrix')
    parts, mounts, links = doc.get('components'), doc.get('mounts'), doc.get('links')
    require(isinstance(parts, list) and len(parts) <= 32 and isinstance(mounts, list) and isinstance(links, list) and len(links) <= 100, 'Invalid assembly size')
    definitions = {d['type']: d for d in data['parts']}
    ids, occupied, ports = set(), set(), {}
    import re
    for p in parts:
        require(isinstance(p, dict) and isinstance(p.get('id'), str) and re.fullmatch(r'[a-zA-Z0-9_-]+', p['id']) and p['id'] not in ids, 'Invalid part ID')
        ids.add(p['id'])
        require(isinstance(p.get('type'), str) and (p.get('type') == board or p.get('type') in definitions), 'Unknown drone part')
        matching = [m for m in mounts if isinstance(m, dict) and m.get('componentId') == p['id']]
        require(len(matching) == 1, 'Each part needs one mount')
        mount = matching[0].get('mount')
        allowed = ['stack'] if p['type'] == board else definitions[p['type']]['mounts']
        require(mount in allowed and mount not in occupied, 'Occupied or incompatible mount')
        occupied.add(mount)
        props = p.get('props')
        require(isinstance(props, dict), 'Invalid part properties')
        if p['type'] in ('brushless_motor', 'drone_prop'):
            require(props.get('direction') in ('cw', 'ccw'), 'Invalid motor/prop direction')
        if p['type'] == 'drone_prop':
            require(isinstance(props.get('fitted'), bool), 'Invalid prop state')
        if p['type'] == board:
            ports[p['id']] = data['boardPorts'][board]
        else:
            ports[p['id']] = definitions[p['type']]['ports']
    require(len(mounts) == len(parts) and sum(p['type'] == board for p in parts) == 1, 'Exactly one FC is required')
    pairs = set()
    for link in links:
        require(isinstance(link, dict) and isinstance(link.get('id'), str) and re.fullmatch(r'[a-zA-Z0-9_-]+', link['id']) and link['id'] not in ids, 'Invalid link ID')
        ids.add(link['id'])
        kind = link.get('kind')
        require(kind in ('power', 'phase', 'signal', 'i2c', 'uart'), 'Invalid connector kind')
        endpoints = []
        for key in ('from', 'to'):
            ref = link.get(key)
            require(isinstance(ref, str) and ref.count(':') == 1, 'Invalid connector endpoint')
            owner, pin = ref.split(':')
            port = ports.get(owner, {}).get(pin)
            require(port == kind or port == 'gpio' and kind in ('signal', 'i2c', 'uart'), 'Incompatible connector')
            endpoints.append(owner)
        require(endpoints[0] != endpoints[1], 'A link must connect two parts')
        pair = tuple(sorted((link['from'], link['to'])))
        require(pair not in pairs, 'Duplicate connector'); pairs.add(pair)
        require(link.get('awg') in (12, 14, 16, 18, 20, 22, 24) and number(link.get('lengthM'), 0.01, 2), 'Invalid conductor')
    gates = doc.get('course')
    require(isinstance(gates, list) and len(gates) <= 24, 'Invalid course')
    for gate in gates:
        require(isinstance(gate, dict) and number(gate.get('x'), -15, 15) and number(gate.get('y'), -15, 15) and number(gate.get('z'), .5, 8) and number(gate.get('radius'), .3, 3), 'Invalid gate')
    flight = doc.get('flight', {})
    require(isinstance(flight, dict) and number(flight.get('seed'), 0, 4294967295) and flight['seed'] % 1 == 0 and isinstance(flight.get('bench'), bool), 'Invalid flight settings')
    wind = flight.get('wind')
    require(isinstance(wind, list) and len(wind) == 3 and all(number(n, -10, 10) for n in wind), 'Invalid wind')

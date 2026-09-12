from copy import deepcopy
import json
from pathlib import Path

import pytest

CONTENT = Path(__file__).resolve().parents[2] / 'content'


def payload():
    solution = json.loads((CONTENT / 'quests/w5-l6.json').read_text())['solution']
    return dict(name='Custom drone', board='esp32', board_mode='half', circuit=solution['circuit'], code=solution['code'], editor_mode='text')


def test_drone_save_publish_preview_fork_and_partial_update(client, guest):
    headers = guest[0]
    created = client.post('/api/projects', json=payload(), headers=headers)
    assert created.status_code == 201, created.text
    project = created.json()
    assert project['circuit']['kind'] == 'drone'
    assert project['drone_config']['motors']['kv'] == 1750
    id = project['id']
    updated = deepcopy(project['circuit'])
    updated['droneConfig']['motors']['kv'] = 1850
    assert client.put(f'/api/projects/{id}', json={'circuit': updated}, headers=headers).status_code == 200
    assert client.put(f'/api/projects/{id}', json={'name': 'Tuned quad'}, headers=headers).status_code == 200
    public = client.post(f'/api/projects/{id}/publish', json={'publish': True}, headers=headers).json()
    slug = public['share_slug']
    preview = client.get(f'/api/showcase/{slug}').json()
    assert preview['circuit'] == updated
    gallery = client.get('/api/showcase?board=esp32').json()['items']
    assert gallery[0]['drone_config']['motors']['kv'] == 1850
    fork = client.post(f'/api/showcase/{slug}/fork', headers=headers)
    assert fork.status_code == 201, fork.text
    assert fork.json()['circuit'] == updated
    assert fork.json()['code'] == project['code']


@pytest.mark.parametrize('mutate', [
    lambda d: d['droneConfig']['motors'].update(kv=0),
    lambda d: d['components'][0].update(type={}),
    lambda d: d['droneConfig'].update(mixer=[[1, 0, 0, 0]]),
    lambda d: d['droneConfig']['battery'].update(cells=4.1),
    lambda d: d['droneConfig']['fc'].update(board='uno'),
    lambda d: d['mounts'][1].update(mount='strap'),
    lambda d: d['links'][0].update(to='not_a_part:vbat'),
    lambda d: d['links'][0].update(kind='i2c'),
    lambda d: d['links'][0].update(lengthM=-1),
    lambda d: d['course'][0].update(radius=-2),
    lambda d: d['flight'].update(wind=[0, 0, 100000]),
])
def test_invalid_drone_update_is_atomic(client, guest, mutate):
    headers = guest[0]
    original = payload()
    create = client.post('/api/projects', json=original, headers=headers)
    assert create.status_code == 201, create.text
    id = create.json()['id']
    bad = deepcopy(original['circuit']); mutate(bad)
    response = client.put(f'/api/projects/{id}', json={'name': 'Must not change', 'circuit': bad}, headers=headers)
    assert response.status_code == 422, response.text
    after = client.get(f'/api/projects/{id}', headers=headers).json()
    assert after['circuit'] == original['circuit'] and after['name'] == original['name']


def test_drone_bom_contains_whole_build_and_no_breadboard(client, guest, monkeypatch):
    from app.services import content
    monkeypatch.setattr(content, 'get_catalog', lambda: json.loads((CONTENT / 'catalog.json').read_text()))
    response = client.post('/api/export/bom.json', json={'circuit': payload()['circuit']}, headers=guest[0])
    assert response.status_code == 200, response.text
    rows = response.json()['rows']
    ids = {r['catalog_id']: r for r in rows}
    assert ids['motor_2207_1750kv']['qty'] == 4
    assert ids['esc_4in1_45a']['qty'] == 1
    assert ids['fc_carrier_esp32']['qty'] == 1
    assert 'xt60_pair' in ids and 'breadboard_half' not in ids
    assert response.json()['total_usd'] > 150


def test_foreign_owner_cannot_update_drone(client, guest):
    created = client.post('/api/projects', json=payload(), headers=guest[0]).json()
    other = client.post('/api/players/guest').json()
    response = client.put(f"/api/projects/{created['id']}", headers={'Authorization': f"Bearer {other['token']}"}, json={'name': 'stolen'})
    assert response.status_code == 404


def test_drone_board_mode_patch_validates_merged_project(client, guest):
    created = client.post('/api/projects', json=payload(), headers=guest[0]).json()
    response = client.put(f"/api/projects/{created['id']}", json={'board_mode': 'dual'}, headers=guest[0])
    assert response.status_code == 422
    assert client.get(f"/api/projects/{created['id']}", headers=guest[0]).json()['board_mode'] == 'half'


def test_drone_agent_metadata_has_ports_and_assembly_contract(monkeypatch):
    from app.services import agent_projects
    monkeypatch.setattr(agent_projects, 'catalog', lambda: json.loads((CONTENT / 'mcp-catalog.json').read_text()))
    guide = agent_projects.guide()['drone']
    assert guide['kind'] == 'drone' and guide['defaultConfig']['fc']['board'] == 'esp32'
    assert 'stack' in guide['mounts']
    esc = agent_projects.get_component('esc')
    assert esc['ports']['phase'] == 'phase' and esc['mounts'] == ['esc1', 'esc2', 'esc3', 'esc4']

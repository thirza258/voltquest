"""MCP JSON-RPC transport, access isolation and persisted project round trips."""
from pathlib import Path
import json
import pytest
from app.core.config import get_settings


@pytest.fixture
def mcp(client, guest, monkeypatch):
    monkeypatch.setattr(get_settings(), "content_dir", str(Path(__file__).resolve().parents[2] / "content"))
    issued = client.post("/api/assistant/mcp/token", headers=guest[0])
    assert issued.status_code == 200
    token = issued.json()["token"]
    headers = {"Authorization": "Bearer " + token, "Accept": "application/json, text/event-stream"}
    def rpc(method, params=None):
        response = client.post("/api/mcp/", headers=headers, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}})
        assert response.status_code == 200, response.text
        return response.json()
    def call(name, arguments=None):
        return rpc("tools/call", {"name": name, "arguments": arguments or {}})["result"]
    return token, rpc, call


def structured(result):
    assert not result.get("isError"), result
    return result.get("structuredContent") or json.loads(result["content"][0]["text"])


def test_initialize_tools_and_auth(client, guest, mcp):
    token, rpc, _ = mcp
    initialized = rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}})
    assert initialized["result"]["serverInfo"]["name"] == "VoltQuest"
    assert {tool["name"] for tool in rpc("tools/list")["result"]["tools"]} == {"get_project_guide", "get_current_context", "get_board", "get_component", "list_projects", "get_project", "create_project", "update_project"}
    assert client.post("/api/mcp/", json={}).status_code == 401
    assert client.post("/api/mcp/", headers=guest[0], json={}).status_code == 401
    assert client.get("/api/players/me", headers={"Authorization": "Bearer " + token}).status_code == 401


@pytest.mark.parametrize("board", ["uno", "nano", "esp32", "esp32s3", "raspberrypi4", "raspberrypi5"])
def test_create_get_update_all_boards(client, guest, mcp, board):
    _, _, call = mcp
    made = structured(call("create_project", {"name": "Agent build", "board": board}))
    project_id = made["project"]["id"]
    assert made["open_path"] == f"/sandbox/{project_id}"
    project = structured(call("get_project", {"project_id": project_id}))
    code = 'print("Hello")' if board.startswith('raspberrypi') else 'void setup() {}\nvoid loop() {}'
    changed = structured(call("update_project", {"project_id": project_id, "expected_updated_at": project["updated_at"], "changes": {"code": code}}))
    assert changed["project"]["code"] == code
    assert client.get(f"/api/projects/{project_id}", headers=guest[0]).json()["code"] == code
    assert call("update_project", {"project_id": project_id, "expected_updated_at": project["updated_at"], "changes": {"code": "stale"}})["isError"]
    assert structured(call("list_projects"))["projects"][0]["id"] == project_id


def test_ownership_revocation_rotation_and_snapshot(client, guest, mcp):
    token, _, call = mcp
    assert structured(call("get_current_context"))["context"] is None
    context = {"mode": "tutorial", "title": "LED", "board": {"id": "uno"}, "code": "// unsaved", "circuit": {}, "selection": [{"id": "c_led"}]}
    result = client.put("/api/assistant/mcp/context", headers=guest[0], json={"question": "Share", "context": context})
    assert result.status_code == 200
    assert structured(call("get_current_context"))["context"]["code"] == "// unsaved"
    project_id = structured(call("create_project", {"name": "Private"}))["project"]["id"]
    stranger = client.post("/api/players/guest").json()
    stranger_headers = {"Authorization": "Bearer " + stranger["token"]}
    other = client.post("/api/assistant/mcp/token", headers=stranger_headers).json()["token"]
    result = client.post("/api/mcp/", headers={"Authorization": "Bearer " + other, "Accept": "application/json, text/event-stream"}, json={"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "get_project", "arguments": {"project_id": project_id}}})
    assert result.json()["result"]["isError"]
    fresh = client.post("/api/assistant/mcp/token", headers=guest[0]).json()["token"]
    assert fresh != token
    assert client.post("/api/mcp/", headers={"Authorization": "Bearer " + token}, json={}).status_code == 401
    assert client.delete("/api/assistant/mcp/access", headers=guest[0]).status_code == 204
    assert client.post("/api/mcp/", headers={"Authorization": "Bearer " + fresh}, json={}).status_code == 401


def test_invalid_wiring_does_not_mutate_and_public_changes_refused(client, guest, mcp):
    _, _, call = mcp
    p = structured(call("create_project", {"name": "Safe"}))["project"]
    current = structured(call("get_project", {"project_id": p["id"]}))
    bad = p["circuit"] | {"wires": [{"id": "w_broken", "from": "c_mcu:NOT_A_PIN", "to": "bb1:a1", "color": "red"}]}
    assert call("update_project", {"project_id": p["id"], "expected_updated_at": current["updated_at"], "changes": {"circuit": bad}})["isError"]
    assert structured(call("get_project", {"project_id": p["id"]}))["circuit"]["wires"] == []
    assert client.post(f"/api/projects/{p['id']}/publish", headers=guest[0], json={"publish": True}).status_code == 200
    current = structured(call("get_project", {"project_id": p["id"]}))
    assert call("update_project", {"project_id": p["id"], "expected_updated_at": current["updated_at"], "changes": {"name": "Unexpected public edit"}})["isError"]


def test_mcp_checks_hosts_and_origins(client, mcp):
    token, _, _ = mcp
    headers = {"Authorization": "Bearer " + token, "Accept": "application/json, text/event-stream"}
    body = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
    assert client.post('/api/mcp/', headers=headers | {"Host": "attacker.example"}, json=body).status_code == 421
    assert client.post('/api/mcp/', headers=headers | {"Origin": "https://attacker.example"}, json=body).status_code == 403
    assert client.post('/api/mcp/', headers=headers | {"Host": "localhost", "Origin": "http://localhost:5173"}, json=body).status_code == 200


def test_extra_sandbox_parts_round_trip_through_mcp_save_fork_and_bom(client, guest, mcp, monkeypatch):
    _, _, call = mcp
    project = structured(call("create_project", {"name": "Expanded parts"}))["project"]
    circuit = project["circuit"]
    types = ["slide_switch", "reed_switch", "tilt_switch", "trimpot", "thermistor_ntc", "force_sensor", "flex_sensor", "variable_resistor"]
    for index, kind in enumerate(types):
        definition = structured(call("get_component", {"component_type": kind}))
        assert kind in json.dumps(definition)
        circuit["components"].append({"id": f"c_extra_{index}", "type": kind, "rotation": 0, "anchor": {"board": "bb1", "hole": f"{'a' if index < 4 else 'f'}{1 + (index % 4) * 7}"}, "props": {"ohms": 10000} if kind == "trimpot" else {}})
    current = structured(call("get_project", {"project_id": project["id"]}))
    changed = structured(call("update_project", {"project_id": project["id"], "expected_updated_at": current["updated_at"], "changes": {"circuit": circuit}}))["project"]
    assert client.get(f"/api/projects/{project['id']}", headers=guest[0]).json()["circuit"] == circuit
    published = client.post(f"/api/projects/{project['id']}/publish", headers=guest[0], json={"publish": True}).json()
    fork = client.post(f"/api/showcase/{published['share_slug']}/fork", headers=guest[0]).json()
    assert fork["circuit"] == changed["circuit"]
    from app.services import content
    catalog = json.loads((Path(__file__).resolve().parents[2] / "content/catalog.json").read_text())
    monkeypatch.setattr(content, "get_catalog", lambda: catalog)
    rows = client.post("/api/export/bom.json", json={"circuit": circuit}).json()["rows"]
    by_id = {row["catalog_id"]: row for row in rows}
    for kind in types:
        assert by_id[kind]["unit_price_usd"] > 0
    assert by_id["trimpot"]["value"] == "10 kOhm"


def test_expired_snapshot_and_token(client, guest, mcp):
    from datetime import timedelta
    from app.db.models import AgentAccess, utcnow
    from app.db.session import session_scope
    token, _, call = mcp
    context = {"mode": "sandbox", "title": "Draft", "board": {}, "code": "// private", "circuit": {}}
    assert client.put('/api/assistant/mcp/context', headers=guest[0], json={"question": "Share", "context": context}).status_code == 200
    with session_scope() as db:
        access = db.get(AgentAccess, guest[1]['id'])
        access.context_updated_at = utcnow() - timedelta(hours=25)
        db.commit()
    assert structured(call('get_current_context'))['context'] is None
    with session_scope() as db:
        access = db.get(AgentAccess, guest[1]['id'])
        access.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert client.post('/api/mcp/', headers={"Authorization": "Bearer " + token}, json={}).status_code == 401
    assert not client.get('/api/assistant/mcp/access', headers=guest[0]).json()['enabled']

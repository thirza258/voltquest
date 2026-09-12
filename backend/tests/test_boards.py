from copy import deepcopy

import pytest

from app.domain.boards import BOARDS
from test_projects_showcase import CIRCUIT


def project_for(board):
    circuit = deepcopy(CIRCUIT)
    circuit["mcu"] = board
    circuit["components"][0]["type"] = board
    circuit["components"][0]["id"] = "controller"
    circuit["wires"] = []
    return {
        "name": f"Test {board}", "board": board, "circuit": circuit,
        "code": "from gpiozero import LED\nled = LED(17)\nled.on()" if board.startswith("raspberrypi") else "void setup() {} void loop() {}",
    }


def test_board_discovery_is_public(client):
    response = client.get("/api/boards")
    assert response.status_code == 200
    profiles = {board["id"]: board for board in response.json()["boards"]}
    assert set(profiles) == set(BOARDS)
    assert profiles["uno"]["logic_voltage"] == 5
    assert profiles["esp32"]["adc_bits"] == 12
    assert profiles["raspberrypi4"]["language"] == "python"
    assert profiles["raspberrypi5"]["simulation"] == "python-gpio-subset"
    assert profiles["raspberrypi4"]["adc_bits"] == 0


@pytest.mark.parametrize("board", BOARDS)
def test_board_project_save_publish_filter_and_fork(client, guest, board):
    headers, _ = guest
    body = project_for(board)
    response = client.post("/api/projects", json=body, headers=headers)
    assert response.status_code == 201, response.text
    project = response.json()
    fetched = client.get(f"/api/projects/{project['id']}", headers=headers).json()
    assert fetched["code"] == body["code"]
    assert fetched["circuit"] == body["circuit"]
    published = client.post(f"/api/projects/{project['id']}/publish", json={"publish": True}, headers=headers).json()
    assert client.get("/api/showcase", params={"board": board}).json()["total"] == 1
    forked = client.post(f"/api/showcase/{published['share_slug']}/fork", headers=headers)
    assert forked.status_code == 201
    assert forked.json()["board"] == board
    assert forked.json()["code"] == body["code"]


def test_invalid_board_and_mismatched_updates_are_rejected_atomically(client, guest):
    headers, _ = guest
    assert client.post("/api/projects", json={"name": "Bad", "board": "unknown"}, headers=headers).status_code == 422
    assert client.get("/api/showcase", params={"board": "unknown"}).status_code == 422
    project = client.post("/api/projects", json=project_for("uno"), headers=headers).json()
    url = f"/api/projects/{project['id']}"
    rejected = client.put(url, json={"name": "Do not save", "board": "raspberrypi4"}, headers=headers)
    assert rejected.status_code == 422
    assert client.get(url, headers=headers).json()["name"] == project["name"]
    updated = client.put(url, json=project_for("raspberrypi4"), headers=headers)
    assert updated.status_code == 200, updated.text
    assert updated.json()["board"] == "raspberrypi4"


@pytest.mark.parametrize("component_type", [None, [], {}, 42])
def test_malformed_component_types_are_rejected(client, guest, component_type):
    headers, _ = guest
    body = project_for("uno")
    project = client.post("/api/projects", json=body, headers=headers).json()
    body["circuit"]["components"][0]["type"] = component_type
    assert client.post("/api/projects", json=body, headers=headers).status_code == 422
    assert client.put(f"/api/projects/{project['id']}", json=body, headers=headers).status_code == 422


def test_pi_rejects_arduino_blocks_and_multiple_controllers(client, guest):
    headers, _ = guest
    body = project_for("raspberrypi4")
    assert client.post("/api/projects", json={**body, "editor_mode": "blocks"}, headers=headers).status_code == 422
    body["circuit"]["components"].append({"id": "another", "type": "uno"})
    assert client.post("/api/projects", json=body, headers=headers).status_code == 422


@pytest.mark.parametrize("field,value", [("code", "π" * 110000), ("blockly_xml", "x" * 210000), ("circuit", {"meta": {"name": "x" * 210000}})])
def test_project_payload_limits_on_create_and_update(client, guest, field, value):
    headers, _ = guest
    body = project_for("uno")
    assert client.post("/api/projects", json={**body, field: value}, headers=headers).status_code == 422
    project = client.post("/api/projects", json=body, headers=headers).json()
    assert client.put(f"/api/projects/{project['id']}", json={field: value}, headers=headers).status_code == 422

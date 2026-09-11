"""Project CRUD, publishing, showcase browsing and forking."""

from __future__ import annotations

CIRCUIT = {
    "version": 1,
    "boardMode": "half",
    "breadboards": [{"id": "bb1", "type": "half", "x": 0, "y": 0}],
    "mcu": "uno",
    "components": [
        {"id": "c_uno", "type": "uno", "props": {}, "rotation": 0, "position": {"x": 0, "y": 0}},
        {"id": "c_led1", "type": "led", "props": {"color": "red"}, "rotation": 0, "anchor": {"board": "bb1", "hole": "e12"}},
    ],
    "wires": [{"id": "w_1", "from": "c_uno:D13", "to": "bb1:e12", "color": "red"}],
    "meta": {"name": "Blinker"},
}


def _new_project(client, headers, **overrides):
    body = {
        "name": "Blinker",
        "description": "An LED that blinks",
        "board": "uno",
        "board_mode": "half",
        "circuit": CIRCUIT,
        "code": "void setup() {}\nvoid loop() {}\n",
        "editor_mode": "text",
        **overrides,
    }
    res = client.post("/api/projects", json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_project_crud(client, guest):
    headers, player = guest
    created = _new_project(client, headers, blockly_xml="<xml/>", editor_mode="blocks")
    assert created["owner_id"] == player["id"]
    assert created["owner_name"] == player["display_name"]
    assert created["editor_mode"] == "blocks" and created["blockly_xml"] == "<xml/>"
    assert created["is_public"] is False and created["share_slug"] is None

    listed = client.get("/api/projects", headers=headers).json()["projects"]
    assert [p["id"] for p in listed] == [created["id"]]
    assert "circuit" not in listed[0], "summaries omit circuit/code/blockly_xml"

    fetched = client.get(f"/api/projects/{created['id']}", headers=headers).json()
    assert fetched["circuit"]["mcu"] == "uno"

    updated = client.put(
        f"/api/projects/{created['id']}",
        json={"name": "Blinker v2", "board_mode": "full", "code": "int x;"},
        headers=headers,
    ).json()
    assert updated["name"] == "Blinker v2" and updated["board_mode"] == "full" and updated["code"] == "int x;"
    assert updated["circuit"]["mcu"] == "uno", "unspecified fields survive a partial update"

    assert client.delete(f"/api/projects/{created['id']}", headers=headers).status_code == 204
    assert client.get(f"/api/projects/{created['id']}", headers=headers).status_code == 404


def test_projects_are_private_to_their_owner(client, guest):
    headers, _ = guest
    created = _new_project(client, headers)
    other = client.post("/api/players/guest").json()
    other_headers = {"Authorization": f"Bearer {other['token']}"}

    assert client.get(f"/api/projects/{created['id']}", headers=other_headers).status_code == 404
    assert client.put(f"/api/projects/{created['id']}", json={"name": "Stolen"}, headers=other_headers).status_code in (
        403,
        404,
    )
    assert client.delete(f"/api/projects/{created['id']}", headers=other_headers).status_code in (403, 404)
    assert client.get("/api/projects", headers=other_headers).json()["projects"] == []


def test_publish_showcase_and_fork(client, guest):
    headers, _ = guest
    created = _new_project(client, headers)
    published = client.post(f"/api/projects/{created['id']}/publish", json={"publish": True}, headers=headers).json()
    slug = published["share_slug"]
    assert published["is_public"] is True and slug and len(slug) == 8

    listing = client.get("/api/showcase").json()
    assert listing["total"] == 1 and listing["items"][0]["share_slug"] == slug

    assert client.get("/api/showcase", params={"q": "blink"}).json()["total"] == 1
    assert client.get("/api/showcase", params={"q": "zzz"}).json()["total"] == 0
    assert client.get("/api/showcase", params={"board": "uno"}).json()["total"] == 1
    assert client.get("/api/showcase", params={"board": "esp32"}).json()["total"] == 0
    paged = client.get("/api/showcase", params={"limit": 1, "offset": 1}).json()
    assert paged["total"] == 1 and paged["items"] == []

    detail = client.get(f"/api/showcase/{slug}").json()
    assert detail["views"] == 1 and detail["code"].startswith("void setup")
    assert client.get("/api/showcase", params={"sort": "popular"}).json()["items"][0]["views"] == 1

    forker = client.post("/api/players/guest").json()
    fork_headers = {"Authorization": f"Bearer {forker['token']}"}
    fork = client.post(f"/api/showcase/{slug}/fork", headers=fork_headers)
    assert fork.status_code == 201
    fork_body = fork.json()
    assert fork_body["name"] == "Fork of Blinker"
    assert fork_body["owner_id"] == forker["player"]["id"]
    assert fork_body["forked_from"] == slug
    assert fork_body["board_mode"] == "half" and fork_body["editor_mode"] == "text"
    assert fork_body["circuit"] == CIRCUIT
    assert fork_body["is_public"] is False and fork_body["share_slug"] is None

    source = client.get(f"/api/showcase/{slug}").json()
    assert source["forks"] == 1

    unpublished = client.post(f"/api/projects/{created['id']}/publish", json={"publish": False}, headers=headers).json()
    assert unpublished["is_public"] is False and unpublished["share_slug"] == slug
    assert client.get(f"/api/showcase/{slug}").status_code == 404
    assert client.get("/api/showcase").json()["total"] == 0
    assert client.post(f"/api/showcase/{slug}/fork", headers=fork_headers).status_code == 404


def test_update_null_clears_only_the_nullable_fields(client, guest):
    """`null` clears blockly_xml/thumbnail; for required columns it is ignored."""
    headers, _ = guest
    created = _new_project(client, headers, blockly_xml="<xml/>", thumbnail="data:image/png;base64,AAA")

    cleared = client.put(
        f"/api/projects/{created['id']}",
        json={"blockly_xml": None, "thumbnail": None},
        headers=headers,
    ).json()
    assert cleared["blockly_xml"] is None and cleared["thumbnail"] is None

    kept = client.put(
        f"/api/projects/{created['id']}",
        json={"description": None, "code": None, "board": None},
        headers=headers,
    ).json()
    assert kept["description"] == created["description"]
    assert kept["code"] == created["code"]
    assert kept["board"] == created["board"]


def test_oversized_thumbnail_is_rejected(client, guest):
    headers, _ = guest
    res = client.post(
        "/api/projects",
        json={"name": "Big", "board": "uno", "thumbnail": "d" * (210 * 1024)},
        headers=headers,
    )
    assert res.status_code == 422

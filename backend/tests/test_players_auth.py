"""Guest creation, profile updates, claiming and login."""

from __future__ import annotations

import os


def test_guest_me_claim_login(client):
    created = client.post("/api/players/guest")
    assert created.status_code == 201
    token = created.json()["token"]
    player = created.json()["player"]
    assert player["display_name"].startswith("Cadet-")
    assert player["username"] is None
    assert player["level"] == 1 and player["xp_for_next"] == 100
    assert player["unlocked"] == {"skins": ["classic"], "wire_palettes": ["standard"]}

    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/players/me", headers=headers)
    assert me.status_code == 200 and me.json()["id"] == player["id"]

    claimed = client.post("/api/players/claim", json={"username": "sparky", "password": "voltage"}, headers=headers)
    assert claimed.status_code == 200 and claimed.json()["username"] == "sparky"

    again = client.post("/api/players/claim", json={"username": "other_one", "password": "voltage"}, headers=headers)
    assert again.status_code == 400

    other = client.post("/api/players/guest").json()
    dup = client.post(
        "/api/players/claim",
        json={"username": "sparky", "password": "voltage"},
        headers={"Authorization": f"Bearer {other['token']}"},
    )
    assert dup.status_code == 409

    bad_name = client.post(
        "/api/players/claim",
        json={"username": "ab", "password": "voltage"},
        headers={"Authorization": f"Bearer {other['token']}"},
    )
    assert bad_name.status_code == 422
    short_pw = client.post(
        "/api/players/claim",
        json={"username": "cadet_two", "password": "abc"},
        headers={"Authorization": f"Bearer {other['token']}"},
    )
    assert short_pw.status_code == 422

    login = client.post("/api/auth/login", json={"username": "sparky", "password": "voltage"})
    assert login.status_code == 200 and login.json()["player"]["id"] == player["id"]
    assert client.post("/api/auth/login", json={"username": "sparky", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "ghost", "password": "voltage"}).status_code == 401


def test_me_requires_a_token(client):
    assert client.get("/api/players/me").status_code == 401
    assert client.get("/api/players/me", headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_patch_me_rejects_locked_cosmetics(client, guest):
    headers, _ = guest
    ok = client.patch(
        "/api/players/me",
        json={"display_name": "Volt Rider", "settings": {"audio": False, "monitor_baud": 115200}},
        headers=headers,
    )
    assert ok.status_code == 200
    assert ok.json()["display_name"] == "Volt Rider"
    assert ok.json()["settings"] == {
        "audio": False,
        "skin": "classic",
        "wire_palette": "standard",
        "monitor_baud": 115200,
    }

    locked = client.patch("/api/players/me", json={"settings": {"skin": "mint"}}, headers=headers)
    assert locked.status_code == 422
    locked_palette = client.patch("/api/players/me", json={"settings": {"wire_palette": "neon"}}, headers=headers)
    assert locked_palette.status_code == 422
    unknown = client.patch("/api/players/me", json={"settings": {"skin": "does_not_exist"}}, headers=headers)
    assert unknown.status_code == 422


def test_default_cosmetics_stay_selectable_when_content_is_unauthored(client, guest, tmp_path):
    """With an empty cosmetics.json the defaults still apply but unknown ids do not."""
    from app.services import content

    (tmp_path / "quests").mkdir()
    (tmp_path / "worlds.json").write_text('{"worlds": []}', encoding="utf-8")
    (tmp_path / "catalog.json").write_text("{}", encoding="utf-8")
    (tmp_path / "cosmetics.json").write_text('{"skins": [], "wirePalettes": []}', encoding="utf-8")

    headers, _ = guest
    try:
        content.load_content(tmp_path)
        assert client.patch("/api/players/me", json={"settings": {"skin": "classic"}}, headers=headers).status_code == 200
        assert (
            client.patch("/api/players/me", json={"settings": {"wire_palette": "standard"}}, headers=headers).status_code
            == 200
        )
        assert client.patch("/api/players/me", json={"settings": {"skin": "mint"}}, headers=headers).status_code == 422
    finally:
        content.load_content(os.environ["CONTENT_DIR"])

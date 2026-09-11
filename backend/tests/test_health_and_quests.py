"""Health probe and public quest content."""

from __future__ import annotations


def test_health_reports_levels(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["db"] == "ok"
    assert body["version"]
    assert body["levels"] == 2


def test_quests_list_groups_levels_by_world(client):
    body = client.get("/api/quests").json()
    assert [w["id"] for w in body["worlds"]] == ["w1"]
    levels = body["worlds"][0]["levels"]
    assert [lv["id"] for lv in levels] == ["w1-l1", "w1-l2"]
    assert levels[0]["title"] == "First Glow"
    assert "objectives" not in levels[0], "summaries must not carry the full level"


def test_quest_detail_and_404(client):
    level = client.get("/api/quests/w1-l1").json()
    assert level["objectives"][0]["id"] == "led_present"
    assert client.get("/api/quests/nope").status_code == 404

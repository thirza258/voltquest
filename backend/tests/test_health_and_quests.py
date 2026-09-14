"""Health probe and public quest content."""

from __future__ import annotations

from pathlib import Path

from app.services import content


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


def test_expanded_campaign_summary_detail_and_completion(client, guest, content_dir):
    """The shared authored catalogue must load through the real quest and XP APIs."""
    try:
        content.load_content(Path(__file__).resolve().parents[2] / "content")
        worlds = client.get("/api/quests").json()["worlds"]
        assert len(worlds) == 7
        assert client.get("/api/health").json()["levels"] == 32
        assert worlds[4]["levelIds"][-1] == "w5-l6"
        assert worlds[5]["levelIds"][0] == "w6-l1"
        for world, difficulty in zip(worlds[5:], ("intermediate", "hard"), strict=True):
            assert len(world["levels"]) == 6
            for summary in world["levels"]:
                assert summary["difficulty"] == difficulty
                assert "solution" not in summary
                assert "objectives" not in summary
                detail = client.get(f"/api/quests/{summary['id']}").json()
                assert detail["difficulty"] == difficulty
                assert detail["starterCircuit"]["wires"] == []
                assert detail["solution"]["circuit"]["wires"]

        headers, _ = guest
        for level_id in ("w6-l1", "w7-l6"):
            level = content.get_level(level_id)
            payload = {"stars": 3, "objectives_passed": content.objective_ids(level)}
            response = client.post(f"/api/progress/{level_id}/complete", headers=headers, json=payload)
            assert response.status_code == 200, response.text
            assert response.json()["xp_gained"] == round(level["xp"] * 1.5)
            replay = client.post(f"/api/progress/{level_id}/complete", headers=headers, json=payload)
            assert replay.status_code == 200
            assert replay.json()["xp_gained"] == 0
    finally:
        content.load_content(content_dir)

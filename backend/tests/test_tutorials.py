import json
from pathlib import Path

import pytest


@pytest.fixture
def tutorial_content(client, monkeypatch):
    from app import content

    source = Path(__file__).resolve().parents[2] / "content" / "tutorials.json"
    tutorials = json.loads(source.read_text())["tutorials"]
    monkeypatch.setattr(content, "_tutorials", tutorials)
    return tutorials


def test_public_tutorials_have_progression_and_explanations(client, tutorial_content):
    response = client.get("/api/tutorials")
    assert response.status_code == 200
    assert response.json()["total"] >= 35
    ranks = {"Easy": 0, "Intermediate": 1, "Hard": 2}
    for board in ("uno", "esp32", "raspberrypi4", "raspberrypi5"):
        tutorials = client.get("/api/tutorials", params={"board": board}).json()["tutorials"]
        tiers = [ranks[tutorial["difficulty"]] for tutorial in tutorials]
        assert tiers == sorted(tiers)
        assert set(tiers) == {0, 1, 2}
        assert all(tutorial["hardwareConcepts"] and tutorial["programConcepts"] for tutorial in tutorials)


def test_tutorial_filter_detail_and_validation(client, tutorial_content):
    matches = client.get("/api/tutorials", params={"board": "raspberrypi4", "difficulty": "Hard", "q": "dimmer"}).json()
    assert matches["total"] == 1
    tutorial = client.get(f"/api/tutorials/{matches['tutorials'][0]['id']}").json()
    assert tutorial["code"].startswith("from gpiozero")
    assert len(tutorial["steps"]) >= 3
    assert client.get("/api/tutorials/no-such-tutorial").status_code == 404
    assert client.get("/api/tutorials", params={"board": "unknown"}).status_code == 422
    assert client.get("/api/tutorials", params={"difficulty": "unknown"}).status_code == 422


def test_cpp_programming_path_is_available_for_arduino_and_esp32(client, tutorial_content):
    for board in ("uno", "nano", "esp32", "esp32s3"):
        response = client.get("/api/tutorials", params={"board": board, "q": "C++"}).json()
        assert response["total"] == 10
        assert response["tutorials"][0]["id"] == "cpp-start"
        assert response["tutorials"][-1]["id"] == "cpp-state-machine"
        assert all(tutorial["language"] == "cpp" for tutorial in response["tutorials"])


def test_missing_tutorial_content_returns_an_empty_list(client, monkeypatch):
    from app import content

    monkeypatch.setattr(content, "_tutorials", [])
    assert client.get("/api/tutorials").json() == {"tutorials": [], "total": 0}

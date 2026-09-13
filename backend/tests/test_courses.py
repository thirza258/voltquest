import json
from pathlib import Path

import pytest


@pytest.fixture
def course_content(client, monkeypatch):
    from app.services import content
    data = json.loads((Path(__file__).resolve().parents[2] / "content/courses.json").read_text())
    monkeypatch.setattr(content, "_courses", data["courses"])
    monkeypatch.setattr(content, "_course_tracks", data["tracks"])
    return data


def test_public_courses_and_formula_content(client, course_content):
    response = client.get("/api/courses")
    assert response.status_code == 200
    assert response.json()["total"] == 22
    assert len(response.json()["tracks"]) == 4
    for track in ("electrical", "iot-parts"):
        entries = client.get("/api/courses", params={"track": track}).json()["courses"]
        assert [entry["order"] for entry in entries] == list(range(1, 11))
        assert [entry["difficulty"] for entry in entries] == ["Fundamental"] * 5 + ["Intermediate"] * 5
    for entry in response.json()["courses"]:
        assert len(entry["lessons"]) == 3 and len(entry["practice"]) == 2
        assert len(entry["exam"]["questions"]) == 5 and entry["exam"]["passPercent"] == 80
        assert all(formula["equation"] and formula["symbols"] and formula["example"] for formula in entry["formulas"])
    for track in ("iot-foundations", "drone-foundations"):
        assert client.get("/api/courses", params={"track": track}).json()["total"] == 1


def test_course_filters_detail_and_validation(client, course_content):
    response = client.get("/api/courses", params={"track": "electrical", "difficulty": "Intermediate", "q": "  capacitor  "})
    assert response.json()["total"] == 1
    course = client.get("/api/courses/ee-capacitors").json()
    assert course["workedExample"] and course["exam"]["questions"][0]["answerId"]
    assert client.get("/api/courses/not-real").status_code == 404
    for params in ({"track": "unknown"}, {"difficulty": "Hard"}, {"q": "x" * 201}):
        assert client.get("/api/courses", params=params).status_code == 422


def test_course_loader_and_absent_content(client, tmp_path):
    from app.services import content
    try:
        content.load_content(Path(__file__).resolve().parents[2] / "content")
        assert len(content.get_courses()) == 22
        content.load_content(tmp_path)
        assert client.get("/api/courses").json() == {"tracks": [], "courses": [], "total": 0}
        (tmp_path / "courses.json").write_text('{"tracks": null, "courses": "invalid"}')
        content.load_content(tmp_path)
        assert content.get_courses() == []
        (tmp_path / "courses.json").write_text(json.dumps({
            "tracks": [{"id": [], "title": "Skip"}, {"id": "electrical", "title": "Electrical"}],
            "courses": [{"id": "partial", "title": "Partial", "track": "electrical", "order": 1,
                         "difficulty": "Fundamental", "summary": [], "lessons": [None, {"title": 5}],
                         "practice": [], "exam": {}}, {"id": "skip", "title": "Skip", "track": []}],
        }))
        content.load_content(tmp_path)
        assert client.get("/api/courses", params={"q": "partial"}).json()["total"] == 1
        content.load_content(tmp_path / "missing")
        assert content.get_course_tracks() == []
    finally:
        content.load_content()

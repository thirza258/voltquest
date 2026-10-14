"""Tests for content-driven seeded showcase projects."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.db.models import Player, Project
from app.domain.community import _SHARE_SLUG
from app.domain.projects import validate_board
from app.services import content
from app.services.showcase import seed_showcase_projects

CONTENT_DIR = Path(__file__).resolve().parents[2] / "content"


def test_showcase_json_content_integrity():
    """Verify content/showcase.json is valid, structurally sound, and satisfies all domain rules."""
    showcase_path = CONTENT_DIR / "showcase.json"
    assert showcase_path.is_file(), "content/showcase.json must exist"

    data = json.loads(showcase_path.read_text(encoding="utf-8"))
    assert isinstance(data, dict) and "projects" in data
    projects = data["projects"]
    assert len(projects) >= 6, "Expected at least 6 seeded showcase projects"

    slugs = set()
    boards = set()

    for p in projects:
        assert isinstance(p, dict)
        name = p.get("name")
        board = p.get("board")
        board_mode = p.get("board_mode", "half")
        editor_mode = p.get("editor_mode", "text")
        circuit = p.get("circuit")
        code = p.get("code")
        slug = p.get("share_slug")
        owner_name = p.get("owner_name")

        assert name and len(name) <= 80, f"Invalid name: {name}"
        assert slug and _SHARE_SLUG.fullmatch(slug), f"Slug {slug} does not match share slug regex"
        assert slug not in slugs, f"Duplicate slug: {slug}"
        slugs.add(slug)

        assert board in ("uno", "nano", "esp32", "esp32s3", "raspberrypi4", "raspberrypi5")
        boards.add(board)
        assert board_mode in ("half", "full", "dual")
        assert editor_mode in ("text", "blocks")
        assert isinstance(circuit, dict)
        assert isinstance(code, str) and len(code) > 0
        assert owner_name and len(owner_name) <= 48

        # Domain board and circuit compatibility
        validate_board(board, circuit, editor_mode)

    # Multi-board coverage
    assert "uno" in boards
    assert "esp32" in boards
    assert "nano" in boards
    assert "raspberrypi4" in boards


def test_seed_showcase_projects_idempotent(db_session, monkeypatch):
    """seed_showcase_projects creates player and project records and is idempotent."""
    # Point content loader at the real content directory for this test
    content.load_content(CONTENT_DIR)
    seeded_items = content.get_showcase()
    assert len(seeded_items) >= 6

    # First run seeds the projects
    inserted = seed_showcase_projects(db_session)
    assert inserted == len(seeded_items)

    # Verify rows exist in DB
    for item in seeded_items:
        slug = item["share_slug"]
        project = db_session.query(Project).filter(Project.share_slug == slug).first()
        assert project is not None
        assert project.is_public is True
        assert project.name == item["name"]
        assert project.board == item["board"]
        assert project.owner is not None
        assert project.owner.display_name == item.get("owner_name", "VoltQuest Creator")

    # Second run is a no-op
    re_inserted = seed_showcase_projects(db_session)
    assert re_inserted == 0


def test_seeded_showcase_api_integration(client, db_session):
    """Seeded projects appear in /api/showcase listing, can be fetched, and forked."""
    content.load_content(CONTENT_DIR)
    inserted = seed_showcase_projects(db_session)
    assert inserted > 0

    # Test listing
    res = client.get("/api/showcase")
    assert res.status_code == 200
    listing = res.json()
    assert listing["total"] == inserted
    assert len(listing["items"]) == inserted

    # Test filter by board
    uno_res = client.get("/api/showcase", params={"board": "uno"})
    assert uno_res.status_code == 200
    assert uno_res.json()["total"] >= 1
    for item in uno_res.json()["items"]:
        assert item["board"] == "uno"

    # Test search by query
    q_res = client.get("/api/showcase", params={"q": "crosswalk"})
    assert q_res.status_code == 200
    assert q_res.json()["total"] >= 1
    assert any("crosswalk" in item["share_slug"] or "Crosswalk" in item["name"] for item in q_res.json()["items"])

    # Test detail fetch increments views
    slug = listing["items"][0]["share_slug"]
    initial_views = listing["items"][0]["views"]
    detail = client.get(f"/api/showcase/{slug}")
    assert detail.status_code == 200
    assert detail.json()["views"] == initial_views + 1
    assert "circuit" in detail.json()
    assert "code" in detail.json()

    # Test fork
    guest = client.post("/api/players/guest").json()
    guest_headers = {"Authorization": f"Bearer {guest['token']}"}
    fork_res = client.post(f"/api/showcase/{slug}/fork", headers=guest_headers)
    assert fork_res.status_code == 201
    forked = fork_res.json()
    assert forked["name"].startswith("Fork of ")
    assert forked["forked_from"] == slug
    assert forked["owner_id"] == guest["player"]["id"]
    assert forked["is_public"] is False

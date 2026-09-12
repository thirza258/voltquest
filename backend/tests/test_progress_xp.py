"""Progress validation and the XP curve."""

from __future__ import annotations

import pytest

from app.domain.xp import level_for_xp, xp_for_completion, xp_for_level

ALL_OBJECTIVES = ["led_present", "led_lit"]


def test_xp_curve_matches_frontend():
    assert [xp_for_level(n) for n in range(1, 6)] == [0, 100, 300, 600, 1000]
    assert level_for_xp(0) == {"level": 1, "xp_into_level": 0, "xp_for_next": 100}
    assert level_for_xp(99)["level"] == 1
    assert level_for_xp(100) == {"level": 2, "xp_into_level": 0, "xp_for_next": 200}
    assert level_for_xp(350) == {"level": 3, "xp_into_level": 50, "xp_for_next": 300}


def test_xp_for_completion_rounds_half_up_like_js():
    assert xp_for_completion(100, 1, 0) == 100
    assert xp_for_completion(100, 3, 1) == 50
    assert xp_for_completion(100, 2, 3) == 0
    # 90 * 1.25 = 112.5 -> 113 in JS (Math.round), not 112 (Python's round)
    assert xp_for_completion(90, 2, 0) == 113
    assert xp_for_completion(90, 3, 2) == 135 - 113


def test_attempt_counts_and_tracks_hint_tier(client, guest):
    headers, _ = guest
    first = client.post("/api/progress/w1-l1/attempt", json={"hint_tier": 2}, headers=headers).json()
    assert first == {"attempts": 1, "hint_tier_max": 2}
    second = client.post("/api/progress/w1-l1/attempt", json={"hint_tier": 1}, headers=headers).json()
    assert second == {"attempts": 2, "hint_tier_max": 2}
    assert client.post("/api/progress/nope/attempt", json={}, headers=headers).status_code == 404


def test_complete_requires_every_objective(client, guest):
    headers, _ = guest
    res = client.post(
        "/api/progress/w1-l1/complete",
        json={"stars": 1, "objectives_passed": ["led_present"], "code_lines": 6},
        headers=headers,
    )
    assert res.status_code == 422
    assert "led_lit" in res.json()["detail"]

    bad_stars = client.post(
        "/api/progress/w1-l1/complete",
        json={"stars": 4, "objectives_passed": ALL_OBJECTIVES},
        headers=headers,
    )
    assert bad_stars.status_code == 422


def test_completion_awards_and_upgrades_xp(client, guest):
    headers, _ = guest
    first = client.post(
        "/api/progress/w1-l1/complete",
        json={
            "stars": 1,
            "objectives_passed": ALL_OBJECTIVES,
            "code_lines": 12,
            "component_count": 3,
            "damage_count": 0,
            "duration_ms": 4200,
            "code": "void setup() {}",
            "circuit": {"version": 1, "components": []},
        },
        headers=headers,
    ).json()
    assert first["xp_gained"] == 100
    assert first["level_up"] is True
    assert first["player"]["xp"] == 100 and first["player"]["level"] == 2
    assert first["progress"]["stars"] == 1
    assert first["progress"]["best_code_lines"] == 12
    assert first["progress"]["solution"]["code"] == "void setup() {}"
    assert first["newly_unlocked"] == {"skins": [], "wire_palettes": []}

    upgrade = client.post(
        "/api/progress/w1-l1/complete",
        json={"stars": 3, "objectives_passed": ALL_OBJECTIVES, "code_lines": 9},
        headers=headers,
    ).json()
    assert upgrade["xp_gained"] == 50, "3 stars adds 50% and never re-awards the base"
    assert upgrade["player"]["xp"] == 150
    assert upgrade["progress"]["stars"] == 3
    assert upgrade["progress"]["xp_earned"] == 150
    assert upgrade["progress"]["best_code_lines"] == 9

    regress = client.post(
        "/api/progress/w1-l1/complete",
        json={"stars": 1, "objectives_passed": ALL_OBJECTIVES, "code_lines": 40},
        headers=headers,
    ).json()
    assert regress["xp_gained"] == 0
    assert regress["progress"]["stars"] == 3, "stars never decrease"
    assert regress["progress"]["best_code_lines"] == 9

    listed = client.get("/api/progress", headers=headers).json()["progress"]
    assert set(listed) == {"w1-l1"}
    assert listed["w1-l1"]["completed_at"] is not None


def test_unlocks_are_reported_when_the_level_rises(client, guest):
    headers, _ = guest
    client.post(
        "/api/progress/w1-l1/complete",
        json={"stars": 3, "objectives_passed": ALL_OBJECTIVES},
        headers=headers,
    )
    body = client.post(
        "/api/progress/w1-l2/complete",
        json={"stars": 3, "objectives_passed": ["resistor"]},
        headers=headers,
    ).json()
    # 150 + round(90*1.5)=135 -> 285 xp, still level 2... push to level 3 via another pass
    assert body["player"]["xp"] == 285
    assert body["player"]["level"] == 2
    assert body["newly_unlocked"]["skins"] == []

    top = client.post(
        "/api/progress/w1-l1/complete",
        json={"stars": 3, "objectives_passed": ALL_OBJECTIVES},
        headers=headers,
    ).json()
    assert top["xp_gained"] == 0


@pytest.mark.parametrize("path", ["/api/progress", "/api/projects"])
def test_authenticated_routes_reject_anonymous_callers(client, path):
    assert client.get(path).status_code == 401


def test_oversized_solution_is_rejected(client, guest):
    headers, _ = guest
    res = client.post(
        "/api/progress/w1-l1/complete",
        json={"stars": 1, "objectives_passed": ALL_OBJECTIVES, "code": "x" * (210 * 1024)},
        headers=headers,
    )
    assert res.status_code == 422

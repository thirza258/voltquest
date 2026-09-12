"""XP curve and cosmetic unlocks. Mirrors ``frontend/src/lib/xp.js`` exactly."""

from __future__ import annotations

import math


def _round_half_up(value: float) -> int:
    """Round like JavaScript's ``Math.round`` (half away from zero upwards)."""
    return math.floor(value + 0.5)


def xp_for_level(n: int) -> int:
    """Cumulative XP needed to reach level ``n`` (level 1 at 0, level 2 at 100)."""
    if n <= 1:
        return 0
    k = n - 1
    return 100 * k * (k + 1) // 2


def level_for_xp(xp: int) -> dict:
    """Map total XP onto ``{level, xp_into_level, xp_for_next}``."""
    total = max(0, int(xp))
    level = 1
    while xp_for_level(level + 1) <= total:
        level += 1
    base = xp_for_level(level)
    nxt = xp_for_level(level + 1)
    return {"level": level, "xp_into_level": total - base, "xp_for_next": nxt - base}


def xp_for_stars(level_xp: int, stars: int) -> int:
    """XP value of finishing a level worth ``level_xp`` at ``stars`` (0 → 0)."""
    if not stars or stars <= 0:
        return 0
    return _round_half_up(level_xp * (1 + 0.25 * (stars - 1)))


def xp_for_completion(level_xp: int, stars: int, prev_stars: int = 0) -> int:
    """XP gained now, given the previous best star count (never negative)."""
    return max(0, xp_for_stars(level_xp, stars) - xp_for_stars(level_xp, prev_stars))


def unlocked_for_level(cosmetics: dict, level: int) -> dict:
    """``{skins, wire_palettes}`` ids unlocked at ``level`` (``unlockLevel <= level``)."""
    return {
        "skins": [c["id"] for c in cosmetics.get("skins", []) if int(c.get("unlockLevel", 1)) <= level],
        "wire_palettes": [
            c["id"] for c in cosmetics.get("wirePalettes", []) if int(c.get("unlockLevel", 1)) <= level
        ],
    }


def newly_unlocked(cosmetics: dict, from_level: int, to_level: int) -> dict:
    """Cosmetic ids that became available moving from ``from_level`` to ``to_level``."""

    def pick(items: list[dict]) -> list[str]:
        return [c["id"] for c in items if from_level < int(c.get("unlockLevel", 1)) <= to_level]

    return {
        "skins": pick(cosmetics.get("skins", [])),
        "wire_palettes": pick(cosmetics.get("wirePalettes", [])),
    }

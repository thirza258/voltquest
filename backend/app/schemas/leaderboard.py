"""Leaderboard request and response contracts."""

from __future__ import annotations

from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    display_name: str
    xp: int
    level: int
    total_stars: int
    levels_completed: int


class LeaderboardOut(BaseModel):
    items: list[LeaderboardEntry]

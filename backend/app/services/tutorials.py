"""Tutorials application operations; independent of HTTP transport."""

from __future__ import annotations

from typing import Literal

from app.domain.boards import BoardId
from app.domain.errors import NotFound
from app.services.content import get_tutorials


def list_tutorials(
    board: BoardId | None, difficulty: Literal["Easy", "Intermediate", "Hard"] | None, q: str
) -> dict:
    query = q.strip().casefold()
    entries = [
        entry
        for entry in get_tutorials()
        if (board is None or board in entry["boards"])
        and (difficulty is None or entry.get("difficulty") == difficulty)
        and (
            not query
            or query
            in " ".join([entry["title"], entry.get("summary", ""), *entry.get("concepts", [])]).casefold()
        )
    ]
    return {"tutorials": entries, "total": len(entries)}


def get_tutorial(tutorial_id: str) -> dict:
    entry = next((entry for entry in get_tutorials() if entry["id"] == tutorial_id), None)
    if entry is None:
        raise NotFound("Tutorial not found")
    return entry

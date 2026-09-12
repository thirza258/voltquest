"""Quests application operations; independent of HTTP transport."""

from __future__ import annotations

from app.domain.errors import NotFound
from app.services import content


def list_quests() -> dict:
    """Worlds with their level summaries (empty while content is unauthored)."""
    return content.quests_payload()


def get_quest(level_id: str) -> dict:
    """The full level document, or 404 when unknown."""
    level = content.get_level(level_id)
    if level is None:
        raise NotFound("Level not found")
    return level

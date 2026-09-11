"""Public quest content endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .. import content

router = APIRouter(prefix="/quests", tags=["quests"])


@router.get("")
def list_quests() -> dict:
    """Worlds with their level summaries (empty while content is unauthored)."""
    return content.quests_payload()


@router.get("/{level_id}")
def get_quest(level_id: str) -> dict:
    """The full level document, or 404 when unknown."""
    level = content.get_level(level_id)
    if level is None:
        raise HTTPException(status_code=404, detail="Level not found")
    return level

"Public quest content endpoints."

from __future__ import annotations

from fastapi import APIRouter

from app.services import quests as service

router = APIRouter(prefix="/quests", tags=["quests"])


@router.get("")
def list_quests() -> dict:
    """Worlds with their level summaries (empty while content is unauthored)."""
    return service.list_quests()


@router.get("/{level_id}")
def get_quest(level_id: str) -> dict:
    """The full level document, or 404 when unknown."""
    return service.get_quest(level_id=level_id)

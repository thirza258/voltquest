"Campaign progress: attempts, hint tiers and level completion."

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_player, get_db
from app.db.models import Player
from app.schemas.progress import (
    AttemptIn,
    AttemptOut,
    CompleteIn,
    CompleteOut,
    ProgressListOut,
)
from app.services import progress as service

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=ProgressListOut)
def list_progress(
    player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> ProgressListOut:
    """Every progress row for the player, keyed by level id."""
    return service.list_progress(player=player, db=db)


@router.post("/{level_id}/attempt", response_model=AttemptOut)
def record_attempt(
    level_id: str,
    body: AttemptIn,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> AttemptOut:
    """Count a run of the level and remember the deepest hint tier used."""
    return service.record_attempt(level_id=level_id, body=body, player=player, db=db)


@router.post("/{level_id}/complete", response_model=CompleteOut)
def complete_level(
    level_id: str,
    body: CompleteIn,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> CompleteOut:
    """Award XP for a completed level; stars and best code length never regress."""
    return service.complete_level(level_id=level_id, body=body, player=player, db=db)

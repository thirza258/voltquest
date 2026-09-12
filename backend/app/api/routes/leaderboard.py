"Public leaderboard."

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.schemas.leaderboard import LeaderboardOut
from app.services import leaderboard as service

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard", response_model=LeaderboardOut)
def leaderboard(
    limit: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db)
) -> LeaderboardOut:
    """Top players by XP; ties broken by the older account first."""
    return service.leaderboard(limit=limit, db=db)

"""Public leaderboard."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import xp
from ..deps import get_db
from ..models import Player, Progress
from ..schemas import LeaderboardEntry, LeaderboardOut

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard", response_model=LeaderboardOut)
def leaderboard(limit: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db)) -> LeaderboardOut:
    """Top players by XP; ties broken by the older account first."""
    stats = {
        row.player_id: (int(row.levels or 0), int(row.stars or 0))
        for row in db.execute(
            select(
                Progress.player_id.label("player_id"),
                func.count(Progress.id).label("levels"),
                func.coalesce(func.sum(Progress.stars), 0).label("stars"),
            )
            .where(Progress.stars > 0)
            .group_by(Progress.player_id)
        )
    }
    players = db.scalars(
        select(Player).where(Player.xp > 0).order_by(Player.xp.desc(), Player.created_at.asc()).limit(limit)
    ).all()
    items = []
    for player in players:
        levels_completed, total_stars = stats.get(player.id, (0, 0))
        items.append(
            LeaderboardEntry(
                display_name=player.display_name,
                xp=player.xp,
                level=xp.level_for_xp(player.xp)["level"],
                total_stars=total_stars,
                levels_completed=levels_completed,
            )
        )
    return LeaderboardOut(items=items)

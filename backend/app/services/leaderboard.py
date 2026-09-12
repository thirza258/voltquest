"""Leaderboard application operations; independent of HTTP transport."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Player, Progress
from app.domain import xp
from app.schemas.leaderboard import LeaderboardEntry, LeaderboardOut


def leaderboard(limit: int, db: Session) -> LeaderboardOut:
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

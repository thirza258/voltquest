"""Progress application operations; independent of HTTP transport."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Player, Progress
from app.domain import xp
from app.domain.errors import InvalidInput, NotFound
from app.domain.limits import MAX_BLOB_BYTES
from app.schemas.players import PlayerOut
from app.schemas.progress import (
    AttemptIn,
    AttemptOut,
    CompleteIn,
    CompleteOut,
    ProgressEntry,
    ProgressListOut,
)
from app.services import content
from app.services.serializers import player_payload, progress_payload


def _row_for(db: Session, player: Player, level_id: str) -> Progress:
    """Fetch (or create) the progress row for one player/level pair."""
    row = db.scalar(select(Progress).where(Progress.player_id == player.id, Progress.level_id == level_id))
    if row is None:
        row = Progress(
            player_id=player.id, level_id=level_id, stars=0, xp_earned=0, attempts=0, hint_tier_max=0
        )
        db.add(row)
    return row


def _require_level(level_id: str) -> dict:
    level = content.get_level(level_id)
    if level is None:
        raise NotFound("Level not found")
    return level


def list_progress(player: Player, db: Session) -> ProgressListOut:
    """Every progress row for the player, keyed by level id."""
    rows = db.scalars(select(Progress).where(Progress.player_id == player.id)).all()
    return ProgressListOut(progress={r.level_id: ProgressEntry(**progress_payload(r)) for r in rows})


def record_attempt(level_id: str, body: AttemptIn, player: Player, db: Session) -> AttemptOut:
    """Count a run of the level and remember the deepest hint tier used."""
    _require_level(level_id)
    row = _row_for(db, player, level_id)
    row.attempts += 1
    row.hint_tier_max = max(row.hint_tier_max, body.hint_tier)
    db.commit()
    db.refresh(row)
    return AttemptOut(attempts=row.attempts, hint_tier_max=row.hint_tier_max)


def complete_level(level_id: str, body: CompleteIn, player: Player, db: Session) -> CompleteOut:
    """Award XP for a completed level; stars and best code length never regress."""
    level = _require_level(level_id)
    required = set(content.objective_ids(level))
    missing = sorted(required - set(body.objectives_passed))
    if missing:
        raise InvalidInput(f"Objectives not passed: {', '.join(missing)}")
    solution = None
    if body.code is not None or body.circuit is not None:
        solution = {"circuit": body.circuit, "code": body.code}
        if len(json.dumps(solution, default=str).encode("utf-8")) > MAX_BLOB_BYTES:
            raise InvalidInput("Solution exceeds 200 kB")
    row = _row_for(db, player, level_id)
    prev_stars = row.stars
    level_xp = int(level.get("xp") or 0)
    gained = xp.xp_for_completion(level_xp, body.stars, prev_stars)
    level_before = xp.level_for_xp(player.xp)["level"]
    player.xp += gained
    level_after = xp.level_for_xp(player.xp)["level"]
    row.stars = max(prev_stars, body.stars)
    row.xp_earned += gained
    if body.code_lines:
        row.best_code_lines = (
            body.code_lines if row.best_code_lines is None else min(row.best_code_lines, body.code_lines)
        )
    if solution is not None:
        row.solution = solution
    if row.completed_at is None:
        row.completed_at = datetime.now(timezone.utc)
    db.add_all([row, player])
    db.commit()
    db.refresh(row)
    db.refresh(player)
    return CompleteOut(
        progress=ProgressEntry(**progress_payload(row)),
        player=PlayerOut(**player_payload(db, player)),
        xp_gained=gained,
        level_up=level_after > level_before,
        newly_unlocked=xp.newly_unlocked(content.get_cosmetics(), level_before, level_after),
    )

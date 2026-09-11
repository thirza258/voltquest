"""Model -> API payload conversion shared by the routers."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import content, xp
from .models import Player, Progress, Project

DEFAULT_SETTINGS = {"audio": True, "skin": "classic", "wire_palette": "standard", "monitor_baud": 9600}


def player_settings(player: Player) -> dict:
    """Stored settings merged over the defaults."""
    stored = player.settings if isinstance(player.settings, dict) else {}
    return {**DEFAULT_SETTINGS, **{k: v for k, v in stored.items() if k in DEFAULT_SETTINGS}}


def player_stats(db: Session, player: Player) -> dict:
    """``{levels_completed, total_stars, projects}`` for the player."""
    completed, stars = db.execute(
        select(func.count(Progress.id), func.coalesce(func.sum(Progress.stars), 0)).where(
            Progress.player_id == player.id, Progress.stars > 0
        )
    ).one()
    projects = db.scalar(select(func.count(Project.id)).where(Project.owner_id == player.id)) or 0
    return {"levels_completed": int(completed or 0), "total_stars": int(stars or 0), "projects": int(projects)}


def player_payload(db: Session, player: Player) -> dict:
    """Full ``Player`` response object (docs/API.md)."""
    curve = xp.level_for_xp(player.xp)
    return {
        "id": player.id,
        "display_name": player.display_name,
        "username": player.username,
        "xp": player.xp,
        "level": curve["level"],
        "xp_into_level": curve["xp_into_level"],
        "xp_for_next": curve["xp_for_next"],
        "unlocked": xp.unlocked_for_level(content.get_cosmetics(), curve["level"]),
        "settings": player_settings(player),
        "created_at": player.created_at,
        "stats": player_stats(db, player),
    }


def progress_payload(row: Progress) -> dict:
    """One ``progress`` map entry."""
    return {
        "stars": row.stars,
        "xp_earned": row.xp_earned,
        "attempts": row.attempts,
        "hint_tier_max": row.hint_tier_max,
        "completed_at": row.completed_at,
        "best_code_lines": row.best_code_lines,
        "solution": row.solution,
    }


def project_summary(project: Project, owner_name: str | None = None) -> dict:
    """``ProjectSummary`` — the full project without circuit/code/blockly_xml."""
    return {
        "id": project.id,
        "owner_id": project.owner_id,
        "owner_name": owner_name if owner_name is not None else (project.owner.display_name if project.owner else ""),
        "name": project.name,
        "description": project.description or "",
        "board": project.board,
        "board_mode": project.board_mode,
        "thumbnail": project.thumbnail,
        "is_public": project.is_public,
        "share_slug": project.share_slug,
        "forked_from": project.forked_from,
        "views": project.views,
        "forks": project.forks,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }


def project_payload(project: Project, owner_name: str | None = None) -> dict:
    """Full ``Project`` response object."""
    return {
        **project_summary(project, owner_name),
        "circuit": project.circuit if isinstance(project.circuit, dict) else {},
        "code": project.code or "",
        "blockly_xml": project.blockly_xml,
        "editor_mode": project.editor_mode,
    }

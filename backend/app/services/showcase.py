"""Showcase application operations; independent of HTTP transport."""

from __future__ import annotations

from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models import Player, Project
from app.domain.boards import BoardId
from app.domain.errors import NotFound
from app.schemas.projects import ProjectOut, ProjectSummaryOut, ShowcaseListOut
from app.services.serializers import project_payload, project_summary


def _public_project(slug: str, db: Session) -> Project:
    project = db.scalar(select(Project).where(Project.share_slug == slug, Project.is_public.is_(True)))
    if project is None:
        raise NotFound("Project not found")
    return project


def list_showcase(
    sort: Literal["recent", "popular"],
    q: str,
    board: BoardId | Literal[""],
    limit: int,
    offset: int,
    db: Session,
) -> ShowcaseListOut:
    """Published projects with search, board filter and pagination."""
    where = [Project.is_public.is_(True)]
    if q.strip():
        pattern = f"%{q.strip().lower()}%"
        where.append(
            or_(func.lower(Project.name).like(pattern), func.lower(Project.description).like(pattern))
        )
    if board.strip():
        where.append(Project.board == board.strip())
    total = db.scalar(select(func.count(Project.id)).where(*where)) or 0
    order = (
        (Project.views.desc(), Project.forks.desc(), Project.created_at.desc(), Project.id.desc())
        if sort == "popular"
        else (Project.created_at.desc(), Project.id.desc())
    )
    rows = db.scalars(select(Project).where(*where).order_by(*order).limit(limit).offset(offset)).all()
    return ShowcaseListOut(items=[ProjectSummaryOut(**project_summary(p)) for p in rows], total=int(total))


def get_showcase_project(slug: str, db: Session) -> ProjectOut:
    """Read a published project and count the view."""
    project = _public_project(slug, db)
    project.views += 1
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut(**project_payload(project))


def fork_showcase_project(slug: str, player: Player, db: Session) -> ProjectOut:
    """Copy a published project into the caller's own projects."""
    source = _public_project(slug, db)
    fork = Project(
        owner_id=player.id,
        name=f"Fork of {source.name}"[:80],
        description=source.description,
        board=source.board,
        board_mode=source.board_mode,
        circuit=source.circuit,
        code=source.code,
        blockly_xml=source.blockly_xml,
        editor_mode=source.editor_mode,
        thumbnail=source.thumbnail,
        is_public=False,
        share_slug=None,
        forked_from=slug,
    )
    source.forks += 1
    db.add_all([fork, source])
    db.commit()
    db.refresh(fork)
    return ProjectOut(**project_payload(fork, player.display_name))


def seed_showcase_projects(db: Session) -> int:
    """Seed initial showcase projects from content/showcase.json if not already present."""
    from app.services import content

    seeded = content.get_showcase()
    if not seeded:
        return 0

    inserted = 0
    for item in seeded:
        slug = item.get("share_slug")
        if not slug:
            continue
        existing = db.scalar(select(Project.id).where(Project.share_slug == slug))
        if existing is not None:
            continue

        owner_name = item.get("owner_name") or "VoltQuest Creator"
        username = item.get("owner_username") or f"author_{slug}"[:24]

        owner = db.scalar(select(Player).where(Player.username == username))
        if owner is None:
            owner = Player(
                display_name=owner_name[:48],
                username=username,
                xp=1000,
            )
            db.add(owner)
            db.flush()

        project = Project(
            owner_id=owner.id,
            name=item["name"][:80],
            description=item.get("description", ""),
            board=item["board"],
            board_mode=item.get("board_mode", "half"),
            circuit=item["circuit"],
            code=item.get("code", ""),
            blockly_xml=item.get("blockly_xml"),
            editor_mode=item.get("editor_mode", "text"),
            thumbnail=item.get("thumbnail"),
            is_public=True,
            share_slug=slug,
            views=int(item.get("views", 0)),
            forks=int(item.get("forks", 0)),
        )
        db.add(project)
        inserted += 1

    if inserted > 0:
        db.commit()
    return inserted

"""Public showcase browsing and forking."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..deps import get_current_player, get_db
from ..boards import BoardId
from ..models import Player, Project
from ..schemas import ProjectOut, ProjectSummaryOut, ShowcaseListOut
from ..serializers import project_payload, project_summary

router = APIRouter(prefix="/showcase", tags=["showcase"])


def _public_project(slug: str, db: Session) -> Project:
    project = db.scalar(select(Project).where(Project.share_slug == slug, Project.is_public.is_(True)))
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("", response_model=ShowcaseListOut)
def list_showcase(
    sort: Literal["recent", "popular"] = "recent",
    q: str = "",
    board: BoardId | Literal[""] = "",
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ShowcaseListOut:
    """Published projects with search, board filter and pagination."""
    where = [Project.is_public.is_(True)]
    if q.strip():
        pattern = f"%{q.strip().lower()}%"
        where.append(or_(func.lower(Project.name).like(pattern), func.lower(Project.description).like(pattern)))
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


@router.get("/{slug}", response_model=ProjectOut)
def get_showcase_project(slug: str, db: Session = Depends(get_db)) -> ProjectOut:
    """Read a published project and count the view."""
    project = _public_project(slug, db)
    project.views += 1
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut(**project_payload(project))


@router.post("/{slug}/fork", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def fork_showcase_project(
    slug: str,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> ProjectOut:
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

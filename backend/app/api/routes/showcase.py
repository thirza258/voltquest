"Public showcase browsing and forking."

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_player, get_db
from app.db.models import Player
from app.domain.boards import BoardId
from app.schemas.projects import ProjectOut, ShowcaseListOut
from app.services import showcase as service

router = APIRouter(prefix="/showcase", tags=["showcase"])


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
    return service.list_showcase(sort=sort, q=q, board=board, limit=limit, offset=offset, db=db)


@router.get("/{slug}", response_model=ProjectOut)
def get_showcase_project(slug: str, db: Session = Depends(get_db)) -> ProjectOut:
    """Read a published project and count the view."""
    return service.get_showcase_project(slug=slug, db=db)


@router.post("/{slug}/fork", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def fork_showcase_project(
    slug: str, player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> ProjectOut:
    """Copy a published project into the caller's own projects."""
    return service.fork_showcase_project(slug=slug, player=player, db=db)

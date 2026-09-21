"Community discussions: public reading, player-authenticated posting."

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_player, get_db
from app.db.models import Player
from app.domain.boards import BoardId
from app.domain.community import CategoryId, SortId
from app.schemas.community import (
    AnswerIn,
    PostOut,
    ReplyIn,
    ThreadIn,
    ThreadListOut,
    ThreadOut,
    ThreadPatch,
)
from app.services import community as service

router = APIRouter(prefix="/community", tags=["community"])


@router.get("/threads", response_model=ThreadListOut)
def list_threads(
    category: CategoryId | Literal[""] = "",
    board: BoardId | Literal[""] = "",
    project: str = "",
    q: str = "",
    sort: SortId = "active",
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ThreadListOut:
    """Discussions with search, filters, sorting and pagination."""
    return service.list_threads(
        category=category, board=board, project=project, q=q, sort=sort, limit=limit, offset=offset, db=db
    )


@router.post("/threads", response_model=ThreadOut, status_code=status.HTTP_201_CREATED)
def create_thread(
    body: ThreadIn, player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> ThreadOut:
    """Start a discussion."""
    return service.create_thread(body=body, player=player, db=db)


@router.get("/threads/{thread_id}", response_model=ThreadOut)
def get_thread(thread_id: str, db: Session = Depends(get_db)) -> ThreadOut:
    """Read one discussion with its replies and count the view."""
    return service.get_thread(thread_id=thread_id, db=db)


@router.patch("/threads/{thread_id}", response_model=ThreadOut)
def update_thread(
    thread_id: str,
    body: ThreadPatch,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> ThreadOut:
    """Edit your own discussion."""
    return service.update_thread(thread_id=thread_id, body=body, player=player, db=db)


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_thread(
    thread_id: str, player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> Response:
    """Withdraw your own discussion."""
    service.delete_thread(thread_id=thread_id, player=player, db=db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/threads/{thread_id}/replies", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_reply(
    thread_id: str,
    body: ReplyIn,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> PostOut:
    """Reply to a discussion."""
    return service.create_reply(thread_id=thread_id, body=body, player=player, db=db)


@router.patch("/replies/{post_id}", response_model=PostOut)
def update_reply(
    post_id: str,
    body: ReplyIn,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> PostOut:
    """Edit your own reply."""
    return service.update_reply(post_id=post_id, body=body, player=player, db=db)


@router.delete("/replies/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reply(
    post_id: str, player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> Response:
    """Withdraw your own reply."""
    service.delete_reply(post_id=post_id, player=player, db=db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/threads/{thread_id}/replies/{post_id}/answer", response_model=ThreadOut)
def mark_answer(
    thread_id: str,
    post_id: str,
    body: AnswerIn,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> ThreadOut:
    """Accept or un-accept one reply as the answer to your own question."""
    return service.mark_answer(thread_id=thread_id, post_id=post_id, body=body, player=player, db=db)

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query

from app.domain.boards import BoardId
from app.services import tutorials as service

router = APIRouter(prefix="/tutorials", tags=["tutorials"])


@router.get("")
def list_tutorials(
    board: BoardId | None = None,
    difficulty: Literal["Easy", "Intermediate", "Hard"] | None = None,
    q: str = Query(default="", max_length=200),
) -> dict:
    return service.list_tutorials(board=board, difficulty=difficulty, q=q)


@router.get("/{tutorial_id}")
def get_tutorial(tutorial_id: str) -> dict:
    return service.get_tutorial(tutorial_id=tutorial_id)

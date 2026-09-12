from __future__ import annotations

from fastapi import APIRouter

from app.schemas.boards import BoardListOut
from app.services import boards as service

router = APIRouter(prefix="/boards", tags=["boards"])


@router.get("", response_model=BoardListOut)
def list_boards() -> BoardListOut:
    return service.list_boards()

"""Username/password login."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..deps import get_db
from ..models import Player
from ..schemas import Credentials, PlayerOut, TokenOut
from ..security import create_token, verify_password
from ..serializers import player_payload

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(body: Credentials, db: Session = Depends(get_db)) -> TokenOut:
    """Exchange credentials for a bearer token (401 when they do not match)."""
    player = db.scalar(select(Player).where(func.lower(Player.username) == body.username))
    if player is None or not verify_password(body.password, player.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return TokenOut(token=create_token(player.id), player=PlayerOut(**player_payload(db, player)))

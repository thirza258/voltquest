"""FastAPI dependencies: database session and the authenticated player."""

from __future__ import annotations

from collections.abc import Iterator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import SessionLocal
from .models import Player
from .security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Iterator[Session]:
    """Request-scoped SQLAlchemy session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_player(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Player:
    """Resolve the bearer token to a player, or raise 401."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or not credentials.credentials:
        raise unauthorized
    player_id = decode_token(credentials.credentials)
    if not player_id:
        raise unauthorized
    player = db.get(Player, player_id)
    if player is None:
        raise unauthorized
    return player

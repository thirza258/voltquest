"""Request-scoped database sessions and bearer authentication."""

from collections.abc import Iterator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.models import Player
from app.db.session import session_scope
from app.domain.errors import AuthenticationFailed
from app.services.auth import resolve_player

bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Iterator[Session]:
    """Share one session across the request and roll back failures."""
    with session_scope() as db:
        yield db


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
    try:
        return resolve_player(credentials.credentials, db)
    except AuthenticationFailed as exc:
        raise unauthorized from exc

"""Auth application operations; independent of HTTP transport."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import create_token, decode_token, verify_password
from app.db.models import Player
from app.domain.errors import AuthenticationFailed
from app.schemas.players import Credentials, PlayerOut, TokenOut
from app.services.serializers import player_payload


def resolve_player(token: str, db: Session) -> Player:
    """Resolve a valid token to an existing player without HTTP dependencies."""
    player_id = decode_token(token)
    player = db.get(Player, player_id) if player_id else None
    if player is None:
        raise AuthenticationFailed("Not authenticated")
    return player


def login(body: Credentials, db: Session) -> TokenOut:
    """Exchange credentials for a bearer token (401 when they do not match)."""
    player = db.scalar(select(Player).where(func.lower(Player.username) == body.username))
    if player is None or not verify_password(body.password, player.password_hash):
        raise AuthenticationFailed("Invalid username or password")
    return TokenOut(token=create_token(player.id), player=PlayerOut(**player_payload(db, player)))

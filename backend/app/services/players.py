"""Players application operations; independent of HTTP transport."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import (
    MIN_PASSWORD_LEN,
    USERNAME_RE,
    create_token,
    guest_display_name,
    hash_password,
)
from app.db.models import Player
from app.domain import xp
from app.domain.errors import Conflict, InvalidInput, InvalidOperation
from app.schemas.players import Credentials, PlayerOut, PlayerPatch, TokenOut
from app.services import content
from app.services.serializers import DEFAULT_SETTINGS, player_payload, player_settings


def create_guest(db: Session) -> TokenOut:
    """Create an anonymous player and hand back its bearer token."""
    player = Player(display_name=guest_display_name(), xp=0, settings=dict(DEFAULT_SETTINGS))
    db.add(player)
    db.commit()
    db.refresh(player)
    return TokenOut(token=create_token(player.id), player=PlayerOut(**player_payload(db, player)))


def read_me(player: Player, db: Session) -> PlayerOut:
    """The authenticated player."""
    return PlayerOut(**player_payload(db, player))


def update_me(patch: PlayerPatch, player: Player, db: Session) -> PlayerOut:
    """Update the display name and/or settings.

    A ``skin`` or ``wire_palette`` that is not yet unlocked at the player's
    level (or that does not exist at all) is rejected with 422.
    """
    if patch.settings is not None:
        level = xp.level_for_xp(player.xp)["level"]
        unlocked = xp.unlocked_for_level(content.get_cosmetics(), level)
        requested = patch.settings.model_dump(exclude_none=True)
        for field, bucket in (("skin", "skins"), ("wire_palette", "wire_palettes")):
            value = requested.get(field)
            if value is None:
                continue
            if value == DEFAULT_SETTINGS[field]:
                continue
            if value not in unlocked[bucket]:
                raise InvalidInput(f"{field} '{value}' is not unlocked at level {level}")
        player.settings = {**player_settings(player), **requested}
    if patch.display_name is not None:
        player.display_name = patch.display_name
    db.add(player)
    db.commit()
    db.refresh(player)
    return PlayerOut(**player_payload(db, player))


def claim_account(body: Credentials, player: Player, db: Session) -> PlayerOut:
    """Attach a username/password to the current guest account."""
    if player.username:
        raise InvalidOperation("This account is already claimed")
    if not USERNAME_RE.match(body.username):
        raise InvalidInput("Username must be 3-24 characters of a-z, 0-9 or underscore")
    if len(body.password) < MIN_PASSWORD_LEN:
        raise InvalidInput(f"Password must be at least {MIN_PASSWORD_LEN} characters")
    taken = db.scalar(select(func.count(Player.id)).where(func.lower(Player.username) == body.username))
    if taken:
        raise Conflict("That username is taken")
    player.username = body.username
    player.password_hash = hash_password(body.password)
    if player.display_name.startswith("Cadet-"):
        player.display_name = body.username
    db.add(player)
    db.commit()
    db.refresh(player)
    return PlayerOut(**player_payload(db, player))

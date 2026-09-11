"""Player creation, profile and credential claiming."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import content, xp
from ..deps import get_current_player, get_db
from ..models import Player
from ..schemas import Credentials, PlayerOut, PlayerPatch, TokenOut
from ..security import MIN_PASSWORD_LEN, USERNAME_RE, create_token, guest_display_name, hash_password
from ..serializers import DEFAULT_SETTINGS, player_payload, player_settings

router = APIRouter(prefix="/players", tags=["players"])


@router.post("/guest", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def create_guest(db: Session = Depends(get_db)) -> TokenOut:
    """Create an anonymous player and hand back its bearer token."""
    player = Player(display_name=guest_display_name(), xp=0, settings=dict(DEFAULT_SETTINGS))
    db.add(player)
    db.commit()
    db.refresh(player)
    return TokenOut(token=create_token(player.id), player=PlayerOut(**player_payload(db, player)))


@router.get("/me", response_model=PlayerOut)
def read_me(player: Player = Depends(get_current_player), db: Session = Depends(get_db)) -> PlayerOut:
    """The authenticated player."""
    return PlayerOut(**player_payload(db, player))


@router.patch("/me", response_model=PlayerOut)
def update_me(
    patch: PlayerPatch,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> PlayerOut:
    """Update the display name and/or settings.

    A ``skin`` or ``wire_palette`` that is not yet unlocked at the player's
    level (or that does not exist at all) is rejected with 422.
    """
    if patch.display_name is not None:
        player.display_name = patch.display_name
    if patch.settings is not None:
        level = xp.level_for_xp(player.xp)["level"]
        unlocked = xp.unlocked_for_level(content.get_cosmetics(), level)
        requested = patch.settings.model_dump(exclude_none=True)
        for field, bucket in (("skin", "skins"), ("wire_palette", "wire_palettes")):
            value = requested.get(field)
            if value is None:
                continue
            # The built-in default stays selectable even before cosmetics are authored.
            if value == DEFAULT_SETTINGS[field]:
                continue
            if value not in unlocked[bucket]:
                raise HTTPException(
                    status_code=422,
                    detail=f"{field} '{value}' is not unlocked at level {level}",
                )
        player.settings = {**player_settings(player), **requested}
    db.add(player)
    db.commit()
    db.refresh(player)
    return PlayerOut(**player_payload(db, player))


@router.post("/claim", response_model=PlayerOut)
def claim_account(
    body: Credentials,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> PlayerOut:
    """Attach a username/password to the current guest account."""
    if player.username:
        raise HTTPException(status_code=400, detail="This account is already claimed")
    if not USERNAME_RE.match(body.username):
        raise HTTPException(
            status_code=422, detail="Username must be 3-24 characters of a-z, 0-9 or underscore"
        )
    if len(body.password) < MIN_PASSWORD_LEN:
        raise HTTPException(status_code=422, detail=f"Password must be at least {MIN_PASSWORD_LEN} characters")
    taken = db.scalar(select(func.count(Player.id)).where(func.lower(Player.username) == body.username))
    if taken:
        raise HTTPException(status_code=409, detail="That username is taken")
    player.username = body.username
    player.password_hash = hash_password(body.password)
    if player.display_name.startswith("Cadet-"):
        player.display_name = body.username
    db.add(player)
    db.commit()
    db.refresh(player)
    return PlayerOut(**player_payload(db, player))

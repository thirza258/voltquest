"Player creation, profile and credential claiming."

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_player, get_db
from app.db.models import Player
from app.schemas.players import Credentials, PlayerOut, PlayerPatch, TokenOut
from app.services import players as service

router = APIRouter(prefix="/players", tags=["players"])


@router.post("/guest", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def create_guest(db: Session = Depends(get_db)) -> TokenOut:
    """Create an anonymous player and hand back its bearer token."""
    return service.create_guest(db=db)


@router.get("/me", response_model=PlayerOut)
def read_me(player: Player = Depends(get_current_player), db: Session = Depends(get_db)) -> PlayerOut:
    """The authenticated player."""
    return service.read_me(player=player, db=db)


@router.patch("/me", response_model=PlayerOut)
def update_me(
    patch: PlayerPatch, player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> PlayerOut:
    """Update the display name and/or settings.

    A ``skin`` or ``wire_palette`` that is not yet unlocked at the player's
    level (or that does not exist at all) is rejected with 422.
    """
    return service.update_me(patch=patch, player=player, db=db)


@router.post("/claim", response_model=PlayerOut)
def claim_account(
    body: Credentials, player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> PlayerOut:
    """Attach a username/password to the current guest account."""
    return service.claim_account(body=body, player=player, db=db)

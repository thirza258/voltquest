"Username/password login."

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.schemas.players import Credentials, TokenOut
from app.services import auth as service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(body: Credentials, db: Session = Depends(get_db)) -> TokenOut:
    """Exchange credentials for a bearer token (401 when they do not match)."""
    return service.login(body=body, db=db)

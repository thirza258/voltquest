"GET /api/health."

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.health import HealthOut
from app.services import health as service

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    """Liveness probe: app version, database reachability and level count."""
    return service.health()

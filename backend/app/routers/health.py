"""GET /api/health."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from .. import content
from ..config import get_settings
from ..db import engine
from ..schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    """Liveness probe: app version, database reachability and level count."""
    db_status = "ok"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - any driver error means the db is down
        db_status = "error"
    return HealthOut(
        status="ok" if db_status == "ok" else "degraded",
        version=get_settings().app_version,
        db=db_status,
        levels=len(content.get_levels()),
    )

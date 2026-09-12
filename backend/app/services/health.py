"""Health application operations; independent of HTTP transport."""

from __future__ import annotations

from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import engine
from app.schemas.health import HealthOut
from app.services import content


def health() -> HealthOut:
    """Liveness probe: app version, database reachability and level count."""
    db_status = "ok"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
    return HealthOut(
        status="ok" if db_status == "ok" else "degraded",
        version=get_settings().app_version,
        db=db_status,
        levels=len(content.get_levels()),
    )

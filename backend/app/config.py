"""Application settings loaded from the environment (see docs/API.md)."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger("voltquest.config")

#: The ``backend/`` directory — CONTENT_DIR is resolved relative to it.
BACKEND_DIR = Path(__file__).resolve().parents[1]

#: Fallback signing secret used only when JWT_SECRET is unset (dev convenience).
DEV_JWT_SECRET = "voltquest-development-secret-change-me-before-deploy"


class Settings(BaseSettings):
    """Environment-driven configuration.

    ``CORS_ORIGINS`` is a comma-separated string (not JSON) so it can be set
    straight from docker-compose; read the parsed form via
    :attr:`cors_origin_list`.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    database_url: str = "sqlite:///./voltquest.db"
    jwt_secret: str = ""
    content_dir: str = "../content"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    app_version: str = "1.0.0"
    jwt_algorithm: str = "HS256"
    jwt_expiry_days: int = 30

    @property
    def cors_origin_list(self) -> list[str]:
        """Allowed CORS origins as a list (``["*"]`` allows every origin)."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def content_path(self) -> Path:
        """CONTENT_DIR resolved against the backend directory when relative."""
        raw = Path(self.content_dir).expanduser()
        return raw if raw.is_absolute() else (BACKEND_DIR / raw).resolve()

    @property
    def jwt_secret_effective(self) -> str:
        """The signing secret, falling back to the insecure dev default."""
        return self.jwt_secret or DEV_JWT_SECRET

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def is_memory_sqlite(self) -> bool:
        """True for in-memory SQLite URLs, which need a shared static pool."""
        return self.is_sqlite and (":memory:" in self.database_url or self.database_url in ("sqlite://", "sqlite:///"))

    def warn_insecure(self) -> None:
        """Log a loud warning when running on the built-in dev JWT secret."""
        if not self.jwt_secret:
            log.warning(
                "JWT_SECRET is not set - using the insecure development secret. "
                "Set JWT_SECRET before deploying VoltQuest."
            )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings singleton. Tests call ``get_settings.cache_clear()``."""
    return Settings()

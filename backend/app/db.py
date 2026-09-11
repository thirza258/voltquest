"""SQLAlchemy engine, session factory and declarative base."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import get_settings


class Base(DeclarativeBase):
    """Declarative base for every VoltQuest model."""


def _make_engine():
    settings = get_settings()
    kwargs: dict = {"pool_pre_ping": True, "future": True}
    if settings.is_sqlite:
        kwargs["connect_args"] = {"check_same_thread": False}
        if settings.is_memory_sqlite:
            # One shared connection so every session sees the same in-memory db.
            kwargs["poolclass"] = StaticPool
            kwargs.pop("pool_pre_ping", None)
    return create_engine(settings.database_url, **kwargs)


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)


def create_all() -> None:
    """Create any missing tables (called at application startup)."""
    from . import models  # noqa: F401  (registers the mappers)

    Base.metadata.create_all(bind=engine)


def session_scope() -> Iterator[Session]:
    """Yield a session and always close it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

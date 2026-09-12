"""SQLAlchemy models (see docs/API.md "Models")."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


def new_id() -> str:
    """Fresh UUID4 string primary key."""
    return str(uuid.uuid4())


def utcnow() -> datetime:
    """Timezone-aware current UTC time."""
    return datetime.now(timezone.utc)


class Player(Base):
    """A campaign player — anonymous (guest) until credentials are claimed."""

    __tablename__ = "players"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    display_name: Mapped[str] = mapped_column(String(48), nullable=False)
    username: Mapped[str | None] = mapped_column(String(24), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    settings: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    progress: Mapped[list["Progress"]] = relationship(
        back_populates="player", cascade="all, delete-orphan", lazy="selectin"
    )
    projects: Mapped[list["Project"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan", lazy="selectin"
    )


class Progress(Base):
    """Per-level progress for one player."""

    __tablename__ = "progress"
    __table_args__ = (UniqueConstraint("player_id", "level_id", name="uq_progress_player_level"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    player_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("players.id", ondelete="CASCADE"), nullable=False
    )
    level_id: Mapped[str] = mapped_column(String(48), nullable=False)
    stars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    xp_earned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hint_tier_max: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    best_code_lines: Mapped[int | None] = mapped_column(Integer, nullable=True)
    solution: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    player: Mapped[Player] = relationship(back_populates="progress")


class Project(Base):
    """A sandbox project; optionally published to the showcase."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("players.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    board: Mapped[str] = mapped_column(String(16), nullable=False)
    board_mode: Mapped[str] = mapped_column(String(8), nullable=False, default="half")
    circuit: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    code: Mapped[str] = mapped_column(Text, nullable=False, default="")
    blockly_xml: Mapped[str | None] = mapped_column(Text, nullable=True)
    editor_mode: Mapped[str] = mapped_column(String(8), nullable=False, default="text")
    thumbnail: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    share_slug: Mapped[str | None] = mapped_column(String(16), unique=True, nullable=True)
    forked_from: Mapped[str | None] = mapped_column(String(16), nullable=True)
    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    forks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    owner: Mapped[Player] = relationship(back_populates="projects")

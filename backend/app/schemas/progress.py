"""Progress request and response contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .players import PlayerOut, PlayerUnlocks


class AttemptIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hint_tier: int = Field(default=0, ge=0, le=3)


class AttemptOut(BaseModel):
    attempts: int
    hint_tier_max: int


class CompleteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stars: int = Field(ge=1, le=3)
    objectives_passed: list[str] = Field(default_factory=list)
    code_lines: int = Field(default=0, ge=0)
    component_count: int = Field(default=0, ge=0)
    damage_count: int = Field(default=0, ge=0)
    duration_ms: int = Field(default=0, ge=0)
    code: str | None = None
    circuit: dict[str, Any] | None = None


class ProgressEntry(BaseModel):
    stars: int
    xp_earned: int
    attempts: int
    hint_tier_max: int
    completed_at: datetime | None
    best_code_lines: int | None
    solution: dict[str, Any] | None


class ProgressListOut(BaseModel):
    progress: dict[str, ProgressEntry]


class CompleteOut(BaseModel):
    progress: ProgressEntry
    player: PlayerOut
    xp_gained: int
    level_up: bool
    newly_unlocked: PlayerUnlocks

"""Pydantic request/response schemas (docs/API.md)."""

from __future__ import annotations

from datetime import datetime
import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from .boards import BoardId

#: Cap on stored solution / thumbnail payloads.
MAX_BLOB_BYTES = 200 * 1024

BoardMode = Literal["half", "full", "dual"]
EditorMode = Literal["text", "blocks"]


class HealthOut(BaseModel):
    status: str
    version: str
    db: str
    levels: int


class PlayerSettings(BaseModel):
    """Client-side preferences stored on the player row."""

    audio: bool = True
    skin: str = "classic"
    wire_palette: str = "standard"
    monitor_baud: int = 9600


class PlayerUnlocks(BaseModel):
    skins: list[str] = Field(default_factory=list)
    wire_palettes: list[str] = Field(default_factory=list)


class PlayerStats(BaseModel):
    levels_completed: int = 0
    total_stars: int = 0
    projects: int = 0


class PlayerOut(BaseModel):
    id: str
    display_name: str
    username: str | None
    xp: int
    level: int
    xp_into_level: int
    xp_for_next: int
    unlocked: PlayerUnlocks
    settings: PlayerSettings
    created_at: datetime
    stats: PlayerStats


class TokenOut(BaseModel):
    token: str
    player: PlayerOut


class SettingsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audio: bool | None = None
    skin: str | None = None
    wire_palette: str | None = None
    monitor_baud: int | None = None

    @field_validator("skin", "wire_palette")
    @classmethod
    def _cosmetic_id(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v or len(v) > 32:
            raise ValueError("must be 1-32 characters")
        return v

    @field_validator("monitor_baud")
    @classmethod
    def _baud(cls, v: int | None) -> int | None:
        allowed = {300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000}
        if v is not None and v not in allowed:
            raise ValueError(f"unsupported baud rate; expected one of {sorted(allowed)}")
        return v


class PlayerPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = None
    settings: SettingsPatch | None = None

    @field_validator("display_name")
    @classmethod
    def _display_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not 2 <= len(v) <= 24:
            raise ValueError("display_name must be 2-24 characters")
        return v


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str
    password: str

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        return v.strip().lower()


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


class ProjectPayload(BaseModel):
    @field_validator("code", "blockly_xml", "circuit", check_fields=False)
    @classmethod
    def _payload_size(cls, value):
        if value is None:
            return value
        text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        if len(text.encode("utf-8")) > MAX_BLOB_BYTES:
            raise ValueError("project field exceeds 200 kB")
        return value


class ProjectIn(ProjectPayload):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str = ""
    board: BoardId
    board_mode: BoardMode = "half"
    circuit: dict[str, Any] = Field(default_factory=dict)
    code: str = ""
    blockly_xml: str | None = None
    editor_mode: EditorMode = "text"
    thumbnail: str | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not 1 <= len(v) <= 80:
            raise ValueError("name must be 1-80 characters")
        return v

    @field_validator("thumbnail")
    @classmethod
    def _thumb(cls, v: str | None) -> str | None:
        if v is not None and len(v.encode("utf-8")) > MAX_BLOB_BYTES:
            raise ValueError("thumbnail exceeds 200 kB")
        return v


class ProjectPatch(ProjectPayload):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    description: str | None = None
    board: BoardId | None = None
    board_mode: BoardMode | None = None
    circuit: dict[str, Any] | None = None
    code: str | None = None
    blockly_xml: str | None = None
    editor_mode: EditorMode | None = None
    thumbnail: str | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not 1 <= len(v) <= 80:
            raise ValueError("name must be 1-80 characters")
        return v

    @field_validator("thumbnail")
    @classmethod
    def _thumb(cls, v: str | None) -> str | None:
        if v is not None and len(v.encode("utf-8")) > MAX_BLOB_BYTES:
            raise ValueError("thumbnail exceeds 200 kB")
        return v


class ProjectSummaryOut(BaseModel):
    id: str
    owner_id: str
    owner_name: str
    name: str
    description: str
    board: str
    board_mode: str
    thumbnail: str | None
    is_public: bool
    share_slug: str | None
    forked_from: str | None
    views: int
    forks: int
    created_at: datetime
    updated_at: datetime


class ProjectOut(ProjectSummaryOut):
    circuit: dict[str, Any]
    code: str
    blockly_xml: str | None
    editor_mode: str


class ProjectListOut(BaseModel):
    projects: list[ProjectSummaryOut]


class PublishIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    publish: bool = True


class ShowcaseListOut(BaseModel):
    items: list[ProjectSummaryOut]
    total: int


class BomIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    circuit: dict[str, Any] = Field(default_factory=dict)


class BomRow(BaseModel):
    qty: int
    part: str
    value: str
    catalog_id: str
    unit_price_usd: float
    vendor: str
    link: str


class BomJsonOut(BaseModel):
    rows: list[BomRow]
    total_usd: float


class LeaderboardEntry(BaseModel):
    display_name: str
    xp: int
    level: int
    total_stars: int
    levels_completed: int


class LeaderboardOut(BaseModel):
    items: list[LeaderboardEntry]

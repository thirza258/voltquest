"""Players request and response contracts."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


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

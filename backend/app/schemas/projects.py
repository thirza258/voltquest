"""Projects request and response contracts."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.boards import BoardId
from app.domain.limits import MAX_BLOB_BYTES

BoardMode = Literal["half", "full", "dual"]
EditorMode = Literal["text", "blocks"]


class ProjectPayload(BaseModel):
    @field_validator("code", "blockly_xml", "circuit", check_fields=False)
    @classmethod
    def _payload_size(cls, value):
        if value is None:
            return value
        text = (
            value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        )
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

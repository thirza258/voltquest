"""Bounded, transient input for the project tutor; never a code execution request."""

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)


class AssistantContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["campaign", "tutorial", "sandbox", "showcase"]
    title: str = Field(max_length=200)
    board: dict[str, Any]
    code: str = Field(max_length=24000)
    circuit: dict[str, Any]
    selection: list[dict[str, Any]] = Field(default_factory=list, max_length=20)
    simulation: dict[str, Any] = Field(default_factory=dict)
    lesson: dict[str, Any] | None = None
    truncated: list[str] = Field(default_factory=list, max_length=30)


class AssistantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    question: str = Field(min_length=1, max_length=2000)
    locale: Literal["en", "id"] = "en"
    history: list[ChatMessage] = Field(default_factory=list, max_length=8)
    context: AssistantContext

    @field_validator("context")
    @classmethod
    def context_size(cls, value):
        if len(json.dumps(value.model_dump(), ensure_ascii=False).encode("utf-8")) > 96 * 1024:
            raise ValueError("assistant context exceeds 96 KiB")
        return value


class AssistantReply(BaseModel):
    answer: str

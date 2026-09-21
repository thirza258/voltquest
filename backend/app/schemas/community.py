"""Community discussion request and response contracts."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.domain import community as rules
from app.domain.boards import BoardId


class ThreadIn(BaseModel):
    """A new discussion. ``project_slug`` links it to a published showcase project."""

    model_config = ConfigDict(extra="forbid")

    title: str
    body: str
    category: rules.CategoryId
    board: BoardId | None = None
    project_slug: str | None = None

    _title = field_validator("title")(lambda v: rules.normalize_title(v))
    _body = field_validator("body")(lambda v: rules.normalize_body(v))
    _slug = field_validator("project_slug")(lambda v: rules.normalize_project_slug(v))


class ThreadPatch(BaseModel):
    """An author's edit. Omitted fields are left as they are."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    body: str | None = None
    category: rules.CategoryId | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str | None) -> str | None:
        return None if v is None else rules.normalize_title(v)

    @field_validator("body")
    @classmethod
    def _body(cls, v: str | None) -> str | None:
        return None if v is None else rules.normalize_body(v)


class ReplyIn(BaseModel):
    """A reply to an open discussion."""

    model_config = ConfigDict(extra="forbid")

    body: str

    _body = field_validator("body")(lambda v: rules.normalize_body(v))


class AnswerIn(BaseModel):
    """Mark or unmark one reply as the accepted answer. Thread author only."""

    model_config = ConfigDict(extra="forbid")

    is_answer: bool = True


class AuthorOut(BaseModel):
    """The public identity shown beside a post — no username or e-mail."""

    id: str
    display_name: str
    level: int


class PostOut(BaseModel):
    """A reply. A deleted reply keeps its place with an empty body and ``is_deleted``."""

    id: str
    thread_id: str
    author: AuthorOut
    body: str
    is_answer: bool
    is_deleted: bool
    edited_at: datetime | None
    created_at: datetime


class ThreadSummaryOut(BaseModel):
    """List row: everything the index needs, without the opening post's full body."""

    id: str
    author: AuthorOut
    category: str
    title: str
    excerpt: str
    board: str | None
    project_slug: str | None
    views: int
    reply_count: int
    is_solved: bool
    last_activity_at: datetime
    created_at: datetime


class ThreadOut(ThreadSummaryOut):
    """A discussion with its opening post and every reply in order."""

    body: str
    is_deleted: bool
    edited_at: datetime | None
    posts: list[PostOut]


class CategoryOut(BaseModel):
    """One board section and how many live discussions it holds."""

    id: str
    label: str
    threads: int


class ThreadListOut(BaseModel):
    items: list[ThreadSummaryOut]
    total: int
    categories: list[CategoryOut]

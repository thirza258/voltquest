"""Community discussion rules: categories, text limits and normalization.

Framework independent on purpose (see ``tests/test_architecture.py``): the schemas call these
helpers from pydantic validators and the services call them again before writing, so one
definition of "an acceptable post" serves both the HTTP boundary and the application layer.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Literal, get_args

#: Board sections, in the order they are offered. Stored verbatim in ``discussion_threads.category``.
CategoryId = Literal["help", "builds", "hardware", "firmware", "courses", "ideas"]
CATEGORIES: tuple[str, ...] = get_args(CategoryId)

#: English labels; the client translates them like every other interface string.
CATEGORY_LABELS: dict[str, str] = {
    "help": "Get help",
    "builds": "Show your build",
    "hardware": "Hardware and wiring",
    "firmware": "Code and firmware",
    "courses": "Courses and tutorials",
    "ideas": "Ideas and feedback",
}

#: ``active`` orders by last reply, ``recent`` by creation, ``popular`` by replies then views.
SortId = Literal["active", "recent", "popular"]
SORTS: tuple[str, ...] = get_args(SortId)

TITLE_MIN_CHARS = 4
TITLE_MAX_CHARS = 120
BODY_MIN_CHARS = 2
BODY_MAX_CHARS = 8000
MAX_SEARCH_CHARS = 200

_LINE_BREAKS = re.compile(r"\r\n?")
_TRAILING_SPACE = re.compile(r"[ \t]+$", re.MULTILINE)
_BLANK_RUN = re.compile(r"\n{3,}")
_WHITESPACE_RUN = re.compile(r"\s+")
_SHARE_SLUG = re.compile(r"^[a-z0-9]{4,16}$")


def _strip_control_characters(text: str) -> str:
    """Drop invisible control characters; keep newlines and tabs, which carry meaning in code."""
    return "".join(ch for ch in text if ch in "\n\t" or unicodedata.category(ch)[0] != "C")


def normalize_body(value: str) -> str:
    """Normalize a post body: one newline style, no trailing spaces, at most one blank line."""
    if not isinstance(value, str):
        raise ValueError("body must be text")
    text = _strip_control_characters(_LINE_BREAKS.sub("\n", value))
    text = _BLANK_RUN.sub("\n\n", _TRAILING_SPACE.sub("", text)).strip()
    if len(text) < BODY_MIN_CHARS:
        raise ValueError(f"body must be at least {BODY_MIN_CHARS} characters")
    if len(text) > BODY_MAX_CHARS:
        raise ValueError(f"body must be at most {BODY_MAX_CHARS} characters")
    return text


def normalize_title(value: str) -> str:
    """Normalize a thread title to a single line of collapsed whitespace."""
    if not isinstance(value, str):
        raise ValueError("title must be text")
    text = _WHITESPACE_RUN.sub(" ", _strip_control_characters(value)).strip()
    if len(text) < TITLE_MIN_CHARS:
        raise ValueError(f"title must be at least {TITLE_MIN_CHARS} characters")
    if len(text) > TITLE_MAX_CHARS:
        raise ValueError(f"title must be at most {TITLE_MAX_CHARS} characters")
    return text


def normalize_category(value: str) -> str:
    """Return a known category id, or raise."""
    text = (value or "").strip().lower()
    if text not in CATEGORIES:
        raise ValueError(f"category must be one of: {', '.join(CATEGORIES)}")
    return text


def normalize_project_slug(value: str | None) -> str | None:
    """Return a showcase slug shape, or None. Existence is checked against the database later."""
    if value is None:
        return None
    text = value.strip().lower()
    if not text:
        return None
    if not _SHARE_SLUG.match(text):
        raise ValueError("project_slug is not a showcase share slug")
    return text

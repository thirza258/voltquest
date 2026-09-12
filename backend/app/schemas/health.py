"""Health request and response contracts."""

from __future__ import annotations

from pydantic import BaseModel


class HealthOut(BaseModel):
    status: str
    version: str
    db: str
    levels: int

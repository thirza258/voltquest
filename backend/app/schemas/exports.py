"""Exports request and response contracts."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


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

"""BOM exports (CSV download and JSON for the UI table)."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from .. import bom
from ..schemas import BomIn, BomJsonOut, BomRow

router = APIRouter(prefix="/export", tags=["exports"])


@router.post("/bom")
def export_bom_csv(payload: BomIn) -> StreamingResponse:
    """Stream the bill of materials as a ``bom.csv`` attachment."""
    csv_text = bom.rows_to_csv(bom.build_rows(payload.circuit))
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="bom.csv"'},
    )


@router.post("/bom.json", response_model=BomJsonOut)
def export_bom_json(payload: BomIn) -> BomJsonOut:
    """The same rows as JSON plus the estimated total cost."""
    rows = bom.build_rows(payload.circuit)
    return BomJsonOut(rows=[BomRow(**row) for row in rows], total_usd=bom.total_usd(rows))

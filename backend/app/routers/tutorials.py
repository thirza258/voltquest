from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from ..boards import BoardId
from ..content import get_tutorials

router = APIRouter(prefix="/tutorials", tags=["tutorials"])


@router.get("")
def list_tutorials(board: BoardId | None = None, difficulty: Literal["Easy", "Intermediate", "Hard"] | None = None, q: str = Query(default="", max_length=200)) -> dict:
    query = q.strip().casefold()
    entries = [entry for entry in get_tutorials()
               if (board is None or board in entry["boards"])
               and (difficulty is None or entry.get("difficulty") == difficulty)
               and (not query or query in " ".join([entry["title"], entry.get("summary", ""), *entry.get("concepts", [])]).casefold())]
    return {"tutorials": entries, "total": len(entries)}


@router.get("/{tutorial_id}")
def get_tutorial(tutorial_id: str) -> dict:
    entry = next((entry for entry in get_tutorials() if entry["id"] == tutorial_id), None)
    if entry is None:
        raise HTTPException(status_code=404, detail="Tutorial not found")
    return entry

from fastapi import APIRouter
from pydantic import BaseModel

from ..boards import BOARDS, BoardId

router = APIRouter(prefix="/boards", tags=["boards"])


class BoardOut(BaseModel):
    id: BoardId
    name: str
    family: str
    language: str
    logic_voltage: float
    adc_bits: int
    simulation: str


class BoardListOut(BaseModel):
    boards: list[BoardOut]


@router.get("", response_model=BoardListOut)
def list_boards() -> BoardListOut:
    return BoardListOut(boards=[
        BoardOut(id=board_id, **profile, simulation="python-gpio-subset" if profile["language"] == "python" else "arduino-subset")
        for board_id, profile in BOARDS.items()
    ])

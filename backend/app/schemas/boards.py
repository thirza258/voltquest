"""Board discovery response contracts."""

from pydantic import BaseModel

from app.domain.boards import BoardId


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

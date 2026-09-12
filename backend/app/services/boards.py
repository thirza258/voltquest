"""Boards application operations; independent of HTTP transport."""

from __future__ import annotations

from app.domain.boards import BOARDS
from app.schemas.boards import BoardListOut, BoardOut


def list_boards() -> BoardListOut:
    return BoardListOut(
        boards=[
            BoardOut(
                id=board_id,
                **profile,
                simulation="python-gpio-subset" if profile["language"] == "python" else "arduino-subset",
            )
            for board_id, profile in BOARDS.items()
        ]
    )

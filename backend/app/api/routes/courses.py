from typing import Literal

from fastapi import APIRouter, Query

from app.services import courses as service

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("")
def list_courses(
    track: Literal["electrical", "iot-parts", "iot-foundations", "drone-foundations", "programming"] | None = None,
    difficulty: Literal["Fundamental", "Intermediate"] | None = None,
    q: str = Query(default="", max_length=200),
) -> dict:
    return service.list_courses(track=track, difficulty=difficulty, q=q)


@router.get("/{course_id}")
def get_course(course_id: str) -> dict:
    return service.get_course(course_id)

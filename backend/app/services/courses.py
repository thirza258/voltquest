"""Public self-study curriculum. Exams are locally graded, not certified assessments."""

from app.domain.errors import NotFound
from app.services.content import get_courses, get_course_tracks


def list_courses(track: str | None, difficulty: str | None, q: str) -> dict:
    query = q.strip().casefold()
    courses = [
        course for course in get_courses()
        if (track is None or course["track"] == track)
        and (difficulty is None or course["difficulty"] == difficulty)
        and (not query or query in " ".join(
            text for text in [
                course["title"], course.get("summary", ""),
                *[lesson.get("title", "") for lesson in course["lessons"] if isinstance(lesson, dict)],
            ] if isinstance(text, str)
        ).casefold())
    ]
    return {"tracks": get_course_tracks(), "courses": courses, "total": len(courses)}


def get_course(course_id: str) -> dict:
    course = next((entry for entry in get_courses() if entry["id"] == course_id), None)
    if course is None:
        raise NotFound("Course not found")
    return course

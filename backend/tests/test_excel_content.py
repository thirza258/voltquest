"""The Excel course curriculum and datasets must be valid and conform to course contracts."""

import csv
import json
from io import StringIO
from pathlib import Path

CONTENT = Path(__file__).resolve().parents[2] / "content"


def test_excel_content_conforms_to_course_and_certificate_contract():
    data = json.loads((CONTENT / "excel.json").read_text(encoding="utf-8"))
    assert "courses" in data
    courses = data["courses"]
    assert len(courses) == 10

    all_lesson_ids = set()
    all_question_ids = set()

    expected_difficulties = {"Fundamental", "Intermediate", "Advanced"}

    for idx, course in enumerate(courses):
        assert course["id"].startswith("excel-"), f"Unexpected course id {course['id']}"
        assert course["order"] == idx + 1
        assert course["version"] == 1
        assert course["difficulty"] in expected_difficulties
        assert course["minutes"] >= 30
        assert course["codeExt"] == "csv"
        assert len(course["code"]) > 50

        # Validate CSV parsing
        reader = list(csv.reader(StringIO(course["code"])))
        assert len(reader) >= 4, f"{course['id']} CSV must have at least 4 rows"

        # Validate dataset matrix
        assert "dataset" in course
        dataset = course["dataset"]
        assert isinstance(dataset, list) and len(dataset) >= 4
        for row in dataset:
            assert isinstance(row, list)

        # Validate steps, expected, challenge
        assert isinstance(course.get("steps"), list) and len(course["steps"]) >= 3
        assert isinstance(course.get("expected"), str) and len(course["expected"]) > 10
        assert isinstance(course.get("challenge"), str) and len(course["challenge"]) > 10

        # Validate lessons
        assert len(course["lessons"]) == 4, f"{course['id']} must have exactly 4 lessons"
        for lesson in course["lessons"]:
            assert lesson["id"] not in all_lesson_ids, f"Duplicate lesson ID: {lesson['id']}"
            all_lesson_ids.add(lesson["id"])
            assert len(lesson["title"]) > 5
            assert len(lesson["paragraphs"]) >= 2
            assert len(lesson.get("pitfall", "")) > 10

            q = lesson["question"]
            assert q["id"] not in all_question_ids, f"Duplicate question ID: {q['id']}"
            all_question_ids.add(q["id"])
            assert q["lessonId"] == lesson["id"]
            assert len(q["options"]) == 3
            assert q["answerId"] in [o["id"] for o in q["options"]]
            assert len(q["explanation"]) > 10

        # Validate exam
        exam = course["exam"]
        assert exam["passPercent"] == 80
        assert len(exam["questions"]) == 5
        for eq in exam["questions"]:
            assert eq["id"] not in all_question_ids, f"Duplicate question ID: {eq['id']}"
            all_question_ids.add(eq["id"])
            assert len(eq["options"]) == 3
            assert eq["answerId"] in [o["id"] for o in eq["options"]]
            assert len(eq["explanation"]) > 10

    assert len(all_lesson_ids) == 40
    assert len(all_question_ids) == 90

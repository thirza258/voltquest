#!/usr/bin/env python3
"""Generate and validate content/gamemodding.json with 10 comprehensive Game Modding courses."""

import json
import sys
from pathlib import Path

# Add scripts directory to path to import course modules
SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

from gamemodding_courses.c1_to_c3 import COURSES_1_TO_3
from gamemodding_courses.c4_to_c6 import COURSES_4_TO_6
from gamemodding_courses.c7_to_c10 import COURSES_7_TO_10

CONTENT_DIR = Path(__file__).resolve().parents[1] / "content"

COURSES = COURSES_1_TO_3 + COURSES_4_TO_6 + COURSES_7_TO_10


def validate_and_generate():
    assert len(COURSES) == 10, f"Expected 10 courses, got {len(COURSES)}"

    all_lesson_ids = set()
    all_question_ids = set()
    expected_difficulties = {"Fundamental", "Intermediate", "Advanced"}

    for idx, course in enumerate(COURSES, start=1):
        assert course["id"].startswith("mod-"), f"Course ID {course['id']} must start with mod-"
        assert course["order"] == idx, f"Course {course['id']} order {course['order']} != {idx}"
        assert course["version"] == 1, f"Course {course['id']} version != 1"
        assert course["difficulty"] in expected_difficulties, f"Invalid difficulty {course['difficulty']} in {course['id']}"
        assert course["minutes"] >= 20, f"Course {course['id']} minutes < 20"
        assert len(course["code"]) > 50, f"Course {course['id']} code too short"
        assert course["codeExt"] in {"cpp", "cs", "py"}, f"Invalid codeExt in {course['id']}"
        assert len(course["steps"]) == 4, f"Course {course['id']} steps != 4"
        assert len(course["challenge"]["acceptance"]) == 3, f"Course {course['id']} acceptance != 3"
        assert len(course.get("sources", [])) >= 2, f"Course {course['id']} sources < 2"
        for src in course["sources"]:
            assert src["title"] and src["url"]

        # Validate lessons
        assert len(course["lessons"]) == 4, f"Course {course['id']} lessons != 4"
        course_lesson_ids = set()
        course_question_ids = set()

        for lesson in course["lessons"]:
            lid = lesson["id"]
            assert lid not in all_lesson_ids, f"Duplicate lesson ID: {lid}"
            all_lesson_ids.add(lid)
            course_lesson_ids.add(lid)

            assert len(lesson["paragraphs"]) >= 2, f"Lesson {lid} paragraphs < 2"
            assert lesson["example"], f"Lesson {lid} missing example"
            assert lesson["pitfall"], f"Lesson {lid} missing pitfall"

            q = lesson["question"]
            qid = q["id"]
            assert qid not in all_question_ids, f"Duplicate question ID: {qid}"
            all_question_ids.add(qid)
            course_question_ids.add(qid)

            assert len(q["options"]) == 3, f"Question {qid} options != 3"
            opt_ids = {opt["id"] for opt in q["options"]}
            assert opt_ids == {"a", "b", "c"}, f"Question {qid} option IDs != a,b,c: {opt_ids}"
            assert q["answerId"] in opt_ids, f"Question {qid} answerId {q['answerId']} not in options"
            assert q["lessonId"] == lid, f"Question {qid} lessonId {q['lessonId']} != {lid}"
            assert q["prompt"] and q["explanation"], f"Question {qid} missing prompt or explanation"

        # Validate exam
        exam = course["exam"]
        assert exam["passPercent"] == 80, f"Course {course['id']} exam passPercent != 80"
        assert len(exam["questions"]) == 5, f"Course {course['id']} exam questions != 5"

        for eq in exam["questions"]:
            eqid = eq["id"]
            assert eqid not in all_question_ids, f"Duplicate question ID in exam: {eqid}"
            all_question_ids.add(eqid)
            course_question_ids.add(eqid)

            assert len(eq["options"]) == 3, f"Exam question {eqid} options != 3"
            opt_ids = {opt["id"] for opt in eq["options"]}
            assert opt_ids == {"a", "b", "c"}, f"Exam question {eqid} option IDs != a,b,c"
            assert eq["answerId"] in opt_ids, f"Exam question {eqid} answerId not in options"
            assert eq["lessonId"] in course_lesson_ids, f"Exam question {eqid} lessonId {eq['lessonId']} not in course lessons"
            assert eq["prompt"] and eq["explanation"], f"Exam question {eqid} missing prompt or explanation"

        # Check total questions per course: 4 lessons + 5 exam = 9
        assert len(course_question_ids) == 9, f"Course {course['id']} total questions != 9"

    assert len(all_lesson_ids) == 40, f"Total lessons != 40, got {len(all_lesson_ids)}"
    assert len(all_question_ids) == 90, f"Total questions != 90, got {len(all_question_ids)}"

    # Generate JSON
    output_path = CONTENT_DIR / "gamemodding.json"
    data = {
        "reviewedAt": "2026-10-20",
        "courses": COURSES
    }
    output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Successfully generated and validated {output_path} with {len(COURSES)} courses, 40 lessons, and 90 questions.")


if __name__ == "__main__":
    validate_and_generate()

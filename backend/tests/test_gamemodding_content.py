"""The Game Modding course manifests and programs must be valid and structured.

Every course supplies a complete, self-contained code program (C++, C#, or Python).
This test parses gamemodding.json, verifies that all courses adhere to the ReadingTrack
specification, validates Python AST parsing, performs C++ syntax checking, and asserts
that all 90 question IDs and 40 lesson IDs are unique.
"""

import ast
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

CONTENT = Path(__file__).resolve().parents[2] / "content"


def test_every_gamemodding_course_is_valid_and_structured():
    data = json.loads((CONTENT / "gamemodding.json").read_text(encoding="utf-8"))
    courses = data["courses"]
    assert len(courses) == 10
    assert data["reviewedAt"] == "2026-10-20"

    expected_difficulties = {"Fundamental", "Intermediate", "Advanced"}
    all_question_ids = set()
    all_lesson_ids = set()

    has_gxx = shutil.which("g++") is not None

    for idx, course in enumerate(courses, start=1):
        assert course["id"].startswith("mod-")
        assert course["version"] == 1
        assert course["order"] == idx
        assert course["difficulty"] in expected_difficulties
        assert course["codeExt"] in {"cpp", "cs", "py"}
        assert len(course["code"]) > 50
        assert len(course["steps"]) == 4
        assert len(course["challenge"]["acceptance"]) == 3
        assert len(course.get("sources", [])) >= 2
        for src in course["sources"]:
            assert src["title"] and src["url"]

        # Code validation
        if course["codeExt"] == "py":
            # Must parse cleanly with Python AST
            tree = ast.parse(course["code"])
            assert len(tree.body) > 0, f"Course {course['id']} python AST empty"
        elif course["codeExt"] == "cpp" and has_gxx:
            # Syntax-check with g++ -fsyntax-only
            with tempfile.NamedTemporaryFile("w", suffix=".cpp") as f:
                f.write(course["code"])
                f.flush()
                res = subprocess.run(["g++", "-std=c++17", "-fsyntax-only", f.name], capture_output=True, text=True)
                assert res.returncode == 0, f"C++ syntax error in {course['id']}: {res.stderr}"

        # Validate lessons and questions
        assert len(course["lessons"]) == 4
        course_lesson_ids = set()
        course_q_ids = set()

        for lesson in course["lessons"]:
            lid = lesson["id"]
            assert lid not in all_lesson_ids, f"Duplicate lesson ID: {lid}"
            all_lesson_ids.add(lid)
            course_lesson_ids.add(lid)

            assert len(lesson["paragraphs"]) >= 2
            assert lesson["example"]
            assert lesson["pitfall"]

            q = lesson["question"]
            qid = q["id"]
            assert qid not in all_question_ids, f"Duplicate question ID: {qid}"
            all_question_ids.add(qid)
            course_q_ids.add(qid)

            assert len(q["options"]) == 3
            opt_ids = {opt["id"] for opt in q["options"]}
            assert opt_ids == {"a", "b", "c"}
            assert q["answerId"] in opt_ids
            assert q["lessonId"] == lid
            assert q["prompt"] and q["explanation"]

        # Validate exam
        assert course["exam"]["passPercent"] == 80
        exam_questions = course["exam"]["questions"]
        assert len(exam_questions) == 5

        for q in exam_questions:
            eqid = q["id"]
            assert eqid not in all_question_ids, f"Duplicate question ID in exam: {eqid}"
            all_question_ids.add(eqid)
            course_q_ids.add(eqid)

            assert len(q["options"]) == 3
            opt_ids = {opt["id"] for opt in q["options"]}
            assert opt_ids == {"a", "b", "c"}
            assert q["answerId"] in opt_ids
            assert q["lessonId"] in course_lesson_ids
            assert q["prompt"] and q["explanation"]

        assert len(course_q_ids) == 9

    assert len(all_lesson_ids) == 40
    assert len(all_question_ids) == 90

"""The Embedded IoT in C course manifests and C programs must be valid and structured.

Every course supplies a complete, self-contained C code program.
This test parses iot-c.json, verifies that all courses adhere to the ReadingTrack
specification, checks C code syntax and executes each binary with gcc,
and asserts that all 90 question IDs and 40 lesson IDs are globally unique.
"""

import json
from pathlib import Path
import shutil
import subprocess
import tempfile

CONTENT = Path(__file__).resolve().parents[2] / "content"


def test_every_iot_c_course_is_valid_and_structured():
    data = json.loads((CONTENT / "iot-c.json").read_text(encoding="utf-8"))
    courses = data["courses"]
    assert len(courses) == 10
    assert data["reviewedAt"] == "2026-10-22"

    expected_difficulties = {"Fundamental", "Intermediate", "Advanced"}
    all_question_ids = set()
    all_lesson_ids = set()

    has_gcc = shutil.which("gcc") is not None

    for idx, course in enumerate(courses, start=1):
        assert course["id"].startswith("iot-c-")
        assert course["version"] == 1
        assert course["order"] == idx
        assert course["difficulty"] in expected_difficulties
        assert course["codeExt"] == "c"
        assert len(course["code"]) > 50
        assert len(course["steps"]) == 4
        assert len(course["challenge"]["acceptance"]) == 3
        assert len(course.get("sources", [])) >= 2
        for src in course["sources"]:
            assert src["title"] and src["url"]

        # Code compilation and execution check with gcc
        if has_gcc:
            with tempfile.NamedTemporaryFile("w", suffix=".c", delete=False) as f:
                f.write(course["code"])
                f_name = f.name
            exe_name = f_name + ".bin"
            try:
                compile_res = subprocess.run(
                    ["gcc", "-std=c11", "-Wall", "-Wextra", f_name, "-o", exe_name],
                    capture_output=True,
                    text=True
                )
                assert compile_res.returncode == 0, f"C compilation failed in {course['id']}: {compile_res.stderr}"

                run_res = subprocess.run([exe_name], capture_output=True, text=True, timeout=5)
                assert run_res.returncode == 0, f"C execution failed in {course['id']}: {run_res.stderr}"
            finally:
                Path(f_name).unlink(missing_ok=True)
                Path(exe_name).unlink(missing_ok=True)

        # Validate lessons and questions
        assert len(course["lessons"]) == 4
        course_lesson_ids = set()
        course_q_ids = set()

        for lesson in course["lessons"]:
            lid = lesson["id"]
            assert lid.startswith("iot-c-")
            assert lid not in all_lesson_ids
            assert lid not in course_lesson_ids
            all_lesson_ids.add(lid)
            course_lesson_ids.add(lid)

            assert len(lesson["paragraphs"]) >= 2
            assert lesson["example"]
            assert lesson["pitfall"]

            q = lesson["question"]
            qid = q["id"]
            assert qid.startswith("q-iot-c-")
            assert qid not in all_question_ids
            assert qid not in course_q_ids
            all_question_ids.add(qid)
            course_q_ids.add(qid)

            assert len(q["options"]) == 3
            opt_ids = [opt["id"] for opt in q["options"]]
            assert len(set(opt_ids)) == 3
            assert q["answerId"] in opt_ids
            assert q["explanation"]

        # Validate exam
        exam = course["exam"]
        assert exam["passPercent"] == 80
        assert len(exam["questions"]) == 5

        for eq in exam["questions"]:
            eqid = eq["id"]
            assert eqid.startswith("q-iot-c-")
            assert eqid not in all_question_ids
            assert eqid not in course_q_ids
            all_question_ids.add(eqid)
            course_q_ids.add(eqid)

            assert len(eq["options"]) in (3, 4)
            opt_ids = [opt["id"] for opt in eq["options"]]
            assert len(set(opt_ids)) == len(eq["options"])
            assert eq["answerId"] in opt_ids
            assert eq["explanation"]

    assert len(all_lesson_ids) == 40
    assert len(all_question_ids) == 90

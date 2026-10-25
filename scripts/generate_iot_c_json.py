#!/usr/bin/env python3
"""Generate and validate content/iot-c.json with 10 comprehensive Embedded IoT in C courses."""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

# Add scripts directory to path to import course modules
SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

from iot_c_courses.c1_to_c3 import COURSES_1_TO_3
from iot_c_courses.c4_to_c6 import COURSES_4_TO_6
from iot_c_courses.c7_to_c10 import COURSES_7_TO_10

CONTENT_DIR = Path(__file__).resolve().parents[1] / "content"

COURSES = COURSES_1_TO_3 + COURSES_4_TO_6 + COURSES_7_TO_10


def validate_and_generate():
    assert len(COURSES) == 10, f"Expected 10 courses, got {len(COURSES)}"

    all_lesson_ids = set()
    all_question_ids = set()
    expected_difficulties = {"Fundamental", "Intermediate", "Advanced"}

    for idx, course in enumerate(COURSES, start=1):
        assert course["id"].startswith("iot-c-"), f"Course ID {course['id']} must start with iot-c-"
        assert course["order"] == idx, f"Course {course['id']} order {course['order']} != {idx}"
        assert course["version"] == 1, f"Course {course['id']} version != 1"
        assert course["difficulty"] in expected_difficulties, f"Invalid difficulty {course['difficulty']} in {course['id']}"
        assert course["minutes"] >= 20, f"Course {course['id']} minutes < 20"
        assert len(course["code"]) > 50, f"Course {course['id']} code too short"
        assert course["codeExt"] == "c", f"Invalid codeExt in {course['id']}"
        assert len(course["steps"]) == 4, f"Course {course['id']} steps != 4"
        assert len(course["challenge"]["acceptance"]) == 3, f"Course {course['id']} acceptance != 3"
        assert len(course.get("sources", [])) >= 2, f"Course {course['id']} sources < 2"
        for src in course["sources"]:
            assert src["title"] and src["url"]

        # Compile and run C code with gcc
        with tempfile.NamedTemporaryFile("w", suffix=".c", delete=False) as c_file:
            c_file.write(course["code"])
            c_file_path = c_file.name

        exe_path = c_file_path + ".bin"
        try:
            compile_res = subprocess.run(
                ["gcc", "-std=c11", "-Wall", "-Wextra", c_file_path, "-o", exe_path],
                capture_output=True,
                text=True
            )
            assert compile_res.returncode == 0, f"Compilation failed for {course['id']}:\\n{compile_res.stderr}"

            # Run the compiled binary
            run_res = subprocess.run([exe_path], capture_output=True, text=True, timeout=5)
            assert run_res.returncode == 0, f"Execution failed for {course['id']}:\\n{run_res.stderr}"
        finally:
            if os.path.exists(c_file_path):
                os.remove(c_file_path)
            if os.path.exists(exe_path):
                os.remove(exe_path)

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

            assert len(q["options"]) == 3, f"Question {qid} must have exactly 3 options"
            opt_ids = [opt["id"] for opt in q["options"]]
            assert len(set(opt_ids)) == 3, f"Question {qid} option IDs not unique"
            assert q["answerId"] in opt_ids, f"Question {qid} answerId not in options"
            assert q["explanation"], f"Question {qid} missing explanation"

        # Validate exam
        exam = course["exam"]
        assert exam["passPercent"] == 80, f"Course {course['id']} exam passPercent != 80"
        assert len(exam["questions"]) == 5, f"Course {course['id']} exam questions != 5"
        for eq in exam["questions"]:
            eqid = eq["id"]
            assert eqid not in all_question_ids, f"Duplicate exam question ID: {eqid}"
            all_question_ids.add(eqid)
            course_question_ids.add(eqid)

            assert len(eq["options"]) in (3, 4), f"Exam question {eqid} must have 3-4 options"
            opt_ids = [opt["id"] for opt in eq["options"]]
            assert len(set(opt_ids)) == len(eq["options"]), f"Exam question {eqid} option IDs not unique"
            assert eq["answerId"] in opt_ids, f"Exam question {eqid} answerId not in options"
            assert eq["explanation"], f"Exam question {eqid} missing explanation"

    # Write content/iot-c.json
    output_path = CONTENT_DIR / "iot-c.json"
    data = {
        "reviewedAt": "2026-10-22",
        "courses": COURSES
    }
    output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Successfully generated {output_path}")
    print(f"Validated 10 courses, {len(all_lesson_ids)} lessons, {len(all_question_ids)} unique questions.")
    print("All 10 C programs compiled with GCC (-std=c11 -Wall -Wextra) and executed cleanly (exit code 0).")


if __name__ == "__main__":
    validate_and_generate()

#!/usr/bin/env python3
"""Generate and validate content/networking.json: the 10-course computer networking track.

The course data lives in scripts/networking_courses/. This script checks the structure and wording
rules, then writes the JSON. The executable checks (every lesson example replayed on the lab's
router/switch CLI or PC command prompt, every lab solved) run in
frontend/src/features/networking/networkingContent.test.js:

    python3 scripts/generate_networking_json.py
    cd frontend && npx vitest run src/features/networking/networkingContent.test.js
"""

import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True
SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

from networking_courses.c1_to_c3 import COURSES_1_TO_3  # noqa: E402
from networking_courses.c4_to_c6 import COURSES_4_TO_6  # noqa: E402
from networking_courses.c7_to_c10 import COURSES_7_TO_10  # noqa: E402

OUTPUT = SCRIPTS_DIR.parent / "content" / "networking.json"
REVIEWED_AT = "2026-11-09"
COURSES = COURSES_1_TO_3 + COURSES_4_TO_6 + COURSES_7_TO_10

COURSE_IDS = [
    "net-foundations", "net-addressing", "net-switching", "net-routing", "net-vlans",
    "net-intervlan", "net-ospf", "net-services", "net-acl", "net-nat",
]
# Vendor and product names stay out of the track; the lab is "the router/switch command line".
BANNED = [re.compile(r"cisco", re.I), re.compile(r"packet[\s-]*tracer", re.I)] + [
    re.compile(rf"\b{word}\b") for word in ("IOS", "CCNA", "CDP", "DTP", "ISL", "HSRP", "PVST")
]
# The content test's prompt patterns: lines like these in an `exampleDevice: none` table would be
# read as transcript lines.
PROMPT = re.compile(r"^([A-Za-z][\w-]*)((?:\([a-z-]+\))?[>#])\s?(.*)$")
PC_PROMPT = re.compile(r"^C:\\>\s?(.*)$")


def fail(where, message):
    raise SystemExit(f"{where}: {message}")


def check_question(where, q, lesson_ids=None):
    if len(q["options"]) != 3 or [o["id"] for o in q["options"]] != ["a", "b", "c"]:
        fail(where, "questions need options a, b and c")
    if q["answerId"] not in ("a", "b", "c"):
        fail(where, "answerId must be a, b or c")
    if len(q["explanation"]) <= 30:
        fail(where, "explanation too short")
    if lesson_ids is not None and q.get("lessonId") not in lesson_ids:
        fail(where, f"lessonId {q.get('lessonId')} is not a lesson of this course")


def validate():
    if [course["id"] for course in COURSES] != COURSE_IDS:
        fail("courses", "ids or order differ from the fixed track")
    for index, course in enumerate(COURSES, start=1):
        cid = course["id"]
        if course["order"] != index or course["version"] != 1 or not course["title"].startswith(f"{index}. "):
            fail(cid, "order, version or title prefix")
        if course["difficulty"] not in ("Fundamental", "Intermediate", "Advanced"):
            fail(cid, "difficulty")
        if not 20 <= course["minutes"] <= 90 or len(course["summary"]) <= 60:
            fail(cid, "minutes or summary")
        lessons = course["lessons"]
        if [lesson["id"] for lesson in lessons] != [f"{cid}-s{n}" for n in range(1, 5)]:
            fail(cid, "lessons must be <id>-s1 to -s4")
        for lesson in lessons:
            lid = lesson["id"]
            if len(lesson["paragraphs"]) < 2 or any(len(text) < 120 for text in lesson["paragraphs"]):
                fail(lid, "needs 2+ paragraphs of 120+ characters")
            if lesson["exampleDevice"] not in ("router", "switch", "pc", "none"):
                fail(lid, "exampleDevice")
            if len(lesson["example"].strip()) <= 10 or len(lesson["pitfall"]) <= 40:
                fail(lid, "example or pitfall too short")
            if lesson["exampleDevice"] == "none":
                for row in lesson["example"].split("\n"):
                    if PROMPT.match(row.strip()) or PC_PROMPT.match(row.strip()):
                        fail(lid, f"table row looks like a prompt line: {row}")
            check_question(lid, lesson["question"])
        if not 4 <= len(course["steps"]) <= 7:
            fail(cid, "4 to 7 steps")
        if len(course["expected"]) <= 40 or len(course["challenge"]["task"]) <= 40:
            fail(cid, "expected or challenge too short")
        if not 2 <= len(course["challenge"]["acceptance"]) <= 4:
            fail(cid, "2 to 4 acceptance criteria")
        lab = course["lab"]
        if len(lab["title"]) <= 5 or len(lab["brief"]) <= 60:
            fail(cid, "lab title or brief")
        devices = lab["topology"]["devices"]
        if len(devices) > 12:
            fail(cid, "at most 12 lab devices")
        names = [item["name"] for item in devices]
        for item in devices:
            if not (40 <= item["x"] <= 720 and 40 <= item["y"] <= 380):
                fail(cid, f"{item['name']} is off the canvas")
            if not re.match(r"^(PC|Server|S|R)\d+$", item["name"]):
                fail(cid, f"device name {item['name']}")
        for link in lab["topology"]["links"]:
            a, _, b, _ = link.split(" ")
            if a not in names or b not in names:
                fail(cid, f"link {link} names an unknown device")
        if not 2 <= len(lab["goals"]) <= 8 or any(len(goal.get("label", "")) <= 5 for goal in lab["goals"]):
            fail(cid, "2 to 8 goals, each with a label")
        for step in lab["solution"]:
            if step["device"] not in names or not ({"host", "cli", "desktop"} & set(step)):
                fail(cid, f"solution step {step}")
            if "cli" in step and step["cli"][0] != "enable":
                fail(cid, "solution CLI runs from user EXEC, so it starts with enable")
        exam = course["exam"]
        if exam["passPercent"] != 80 or len(exam["questions"]) != 5:
            fail(cid, "exam needs passPercent 80 and 5 questions")
        lesson_ids = {lesson["id"] for lesson in lessons}
        for q in exam["questions"]:
            check_question(q["id"], q, lesson_ids)
        question_ids = [lesson["question"]["id"] for lesson in lessons] + [q["id"] for q in exam["questions"]]
        if len(set(question_ids)) != len(question_ids):
            fail(cid, "question ids must be unique")
        if not 2 <= len(course["sources"]) <= 4 or any(not s["url"].startswith("https://") for s in course["sources"]):
            fail(cid, "2 to 4 https sources")
        text = json.dumps(course, ensure_ascii=False)
        for pattern in BANNED:
            if pattern.search(text):
                fail(cid, f"banned word matched {pattern.pattern}")


def main():
    validate()
    data = {"reviewedAt": REVIEWED_AT, "courses": COURSES}
    OUTPUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    lessons = sum(len(course["lessons"]) for course in COURSES)
    print(f"Wrote {OUTPUT.relative_to(SCRIPTS_DIR.parent)}: {len(COURSES)} courses, {lessons} lessons.")


if __name__ == "__main__":
    main()

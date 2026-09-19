"""Server-graded, immutable self-study certificates for all authored course paths."""

import hashlib
import json
from datetime import timezone
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.db.models import CourseCertificate, new_id, utcnow
from app.domain.errors import Conflict, InvalidInput, NotFound
from app.services.certificate_pdf import build_certificate, certificate_name

CATALOGUES = (
    ("courses.json", "courses", "/courses"), ("robotics.json", "tutorials", "/robotics"),
    ("vision.json", "tutorials", "/vision"), ("hpc.json", "courses", "/hpc"),
    ("cybersecurity.json", "courses", "/cybersecurity"), ("matlab.json", "courses", "/matlab"),
    ("ai-agents.json", "courses", "/ai-agents"), ("computer-architecture.json", "courses", "/computer-architecture"),
)


@lru_cache(maxsize=4)
def certificate_courses(content_path: str) -> dict:
    courses = {}
    for filename, key, route in CATALOGUES:
        try:
            data = json.loads((Path(content_path) / filename).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        entries = data.get(key, []) if isinstance(data, dict) else []
        for course in entries if isinstance(entries, list) else []:
            if not isinstance(course, dict):
                continue
            exam = course.get("exam")
            if not isinstance(exam, dict):
                continue
            questions = exam.get("questions")
            if not isinstance(questions, list) or len(questions) != 5 or exam.get("passPercent") != 80 or any(not isinstance(q, dict) for q in questions):
                continue
            if not course.get("id") or not course.get("title") or type(course.get("version")) is not int:
                continue
            if len({q.get("id") for q in questions}) != 5 or any(not q.get("id") or q.get("answerId") not in [o.get("id") for o in q.get("options", [])] for q in questions):
                continue
            if course["id"] in courses:
                raise ValueError("Certificate course ids must be unique across paths")
            courses[course["id"]] = {**course, "path": f"{route}/{course['id']}"}
    return courses


def public_record(record) -> dict:
    issued = record.issued_at
    if issued.tzinfo is None:
        issued = issued.replace(tzinfo=timezone.utc)
    return {"id": record.id, "learner_name": record.learner_name, "course_id": record.course_id,
            "course_version": record.course_version, "course_title": record.course_title,
            "course_path": record.course_path, "percent": record.percent,
            "issued_at": issued.isoformat(), "verification_url": record.verification_url,
            "pdf_sha256": record.pdf_sha256, "assessment": "unproctored-self-study", "status": "issued"}


def mine(db, player, course_id=None) -> dict:
    query = select(CourseCertificate).where(CourseCertificate.player_id == player.id)
    if course_id:
        query = query.where(CourseCertificate.course_id == course_id)
    return {"certificates": [public_record(record) for record in db.scalars(query.order_by(CourseCertificate.issued_at.desc()))]}


def verified_record(db, code: str):
    try:
        if str(UUID(code)) != code:
            raise ValueError()
    except ValueError:
        raise NotFound("Certificate not found") from None
    record = db.get(CourseCertificate, code)
    if record is None:
        raise NotFound("Certificate not found")
    return record


def issue(db, player, body):
    course = certificate_courses(str(get_settings().content_path)).get(body.course_id)
    if course is None:
        raise NotFound("Course not found")
    if course["version"] != body.course_version:
        raise Conflict("The course has changed. Reload and complete its current exam.")
    questions = course["exam"]["questions"]
    if set(body.answers) != {question["id"] for question in questions}:
        raise InvalidInput("Answer all five questions from this course exam.")
    if any(body.answers[q["id"]] not in {o["id"] for o in q["options"]} for q in questions):
        raise InvalidInput("An exam answer is not a valid option.")
    percent = 20 * sum(body.answers[q["id"]] == q["answerId"] for q in questions)
    if percent < 80:
        raise InvalidInput("Pass the course exam with at least 80% before issuing a certificate.")
    name = certificate_name(body.learner_name)
    query = select(CourseCertificate).where(CourseCertificate.player_id == player.id,
        CourseCertificate.course_id == course["id"], CourseCertificate.course_version == course["version"])
    existing = db.scalar(query)
    if existing:
        return public_record(existing)
    origin = get_settings().public_app_url.rstrip("/")
    parsed = urlsplit(origin)
    if (len(origin) > 180 or parsed.scheme not in ("http", "https") or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path
            or any(char.isspace() for char in origin)):
        raise InvalidInput("Certificate issuer URL is not configured correctly.")
    code = new_id()
    record = CourseCertificate(id=code, player_id=player.id, course_id=course["id"],
        course_version=course["version"], course_title=course["title"], course_path=course["path"],
        learner_name=name, percent=percent, issued_at=utcnow(), verification_url=f"{origin}/certificates/{code}")
    record.pdf = build_certificate(record)
    record.pdf_sha256 = hashlib.sha256(record.pdf).hexdigest()
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(query)
        if existing:
            return public_record(existing)
        raise
    return public_record(record)

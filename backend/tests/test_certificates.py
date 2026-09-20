"""Certificate issuance verifies real authored exams and preserves exact public PDFs."""

import hashlib
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import pytest
from pypdf import PdfReader

from app.core.config import get_settings
from app.services.certificates import certificate_courses

CONTENT = Path(__file__).resolve().parents[2] / "content"


@pytest.fixture()
def courses(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "content_dir", str(CONTENT))
    monkeypatch.setattr(settings, "public_app_url", "https://learn.example.test")
    return certificate_courses(str(CONTENT))


def request_body(course, wrong=0):
    answers = {q["id"]: q["answerId"] for q in course["exam"]["questions"]}
    for question in course["exam"]["questions"][:wrong]:
        answers[question["id"]] = next(o["id"] for o in question["options"] if o["id"] != question["answerId"])
    return {"course_id": course["id"], "course_version": course["version"], "learner_name": "Dewi García",
            "answers": answers, "share_consent": True}


def test_issues_and_parses_exact_pdfs_for_all_150_courses(client, guest, courses):
    headers, player = guest
    assert len(courses) == 150
    for course in courses.values():
        response = client.post("/api/certificates", headers=headers, json=request_body(course, wrong=1))
        assert response.status_code == 200, (course["id"], response.text)
        certificate = response.json()
        assert certificate["percent"] == 80
        assert certificate["course_path"] == course["path"]
        public = client.get(f"/api/certificates/{certificate['id']}")
        assert public.json() == certificate
        assert "player_id" not in public.json()
        assert public.headers["cache-control"] == "no-store"
        pdf = client.get(f"/api/certificates/{certificate['id']}/pdf")
        assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf"
        assert hashlib.sha256(pdf.content).hexdigest() == certificate["pdf_sha256"]
        assert 10000 < len(pdf.content) < 100000
        reader = PdfReader(BytesIO(pdf.content))
        assert len(reader.pages) == 1
        page = reader.pages[0]
        text = page.extract_text()
        assert "Dewi García" in text and "Score: 80%" in text and certificate["id"] in text
        assert " ".join(course["title"].split()) in " ".join(text.split())
        assert "Unproctored self-study exam" in text
        assert page["/Annots"][0].get_object()["/A"]["/URI"] == certificate["verification_url"]
        assert certificate["verification_url"].startswith("https://learn.example.test/certificates/")
    assert len(client.get("/api/certificates/mine", headers=headers).json()["certificates"]) == 150
    assert client.get("/api/players/me", headers=headers).json()["xp"] == player["xp"]


def test_requires_auth_consent_current_version_valid_complete_passing_answers(client, guest, courses):
    headers, _ = guest
    course = courses["computer-bits"]
    valid = request_body(course)
    assert client.post("/api/certificates", json=valid).status_code == 401
    assert client.get("/api/certificates/mine").status_code == 401
    failures = [
        ({**valid, "share_consent": False}, 422), ({**valid, "percent": 100}, 422),
        ({**valid, "course_version": 2}, 409), ({**valid, "course_id": "missing"}, 404),
        ({**valid, "answers": {}}, 422), ({**valid, "answers": dict(list(valid["answers"].items())[:4])}, 422),
        ({**valid, "answers": {"fake"+str(i): "a" for i in range(5)}}, 422),
        ({**valid, "answers": {key: "invented" for key in valid["answers"]}}, 422),
        (request_body(course, wrong=2), 422), ({**valid, "learner_name": "  "}, 422),
        ({**valid, "learner_name": "One\nTwo"}, 422), ({**valid, "learner_name": "Student 🧱"}, 422),
        ({**valid, "learner_name": "A"*81}, 422), ({**valid, "course_version": True}, 422),
    ]
    for body, status in failures:
        response = client.post("/api/certificates", headers=headers, json=body)
        assert response.status_code == status, response.text
    assert client.get("/api/certificates/mine", headers=headers).json() == {"certificates": []}


def test_duplicate_issue_is_immutable_and_mine_is_owned(client, guest, courses):
    headers, _ = guest
    body = request_body(courses["assembly-loops"], wrong=1)
    certificate = client.post("/api/certificates", headers=headers, json=body).json()
    body = {**request_body(courses["assembly-loops"]), "learner_name": "Another Name"}
    repeated = client.post("/api/certificates", headers=headers, json=body).json()
    assert repeated == certificate
    other = client.post("/api/players/guest").json()
    other_headers = {"Authorization": f"Bearer {other['token']}"}
    assert client.get("/api/certificates/mine", headers=other_headers).json() == {"certificates": []}
    assert client.get("/api/certificates/mine?course_id=computer-bits", headers=headers).json() == {"certificates": []}
    assert len(client.get("/api/certificates/mine?course_id=assembly-loops", headers=headers).json()["certificates"]) == 1
    own = client.post("/api/certificates", headers=other_headers, json=body).json()
    assert own["id"] != certificate["id"]
    assert client.get(f"/api/certificates/{certificate['id']}").status_code == 200


def test_record_survives_catalogue_changes_and_account_claim(client, guest, courses, monkeypatch):
    headers, _ = guest
    certificate = client.post("/api/certificates", headers=headers, json=request_body(courses["hpc-correctness"])).json()
    client.post("/api/players/claim", headers=headers, json={"username": "certificate_user", "password": "a-local-test-password"})
    login = client.post("/api/auth/login", json={"username": "certificate_user", "password": "a-local-test-password"}).json()
    monkeypatch.setattr(get_settings(), "content_dir", "/missing")
    saved = client.get("/api/certificates/mine", headers={"Authorization": f"Bearer {login['token']}"}).json()
    assert saved["certificates"] == [certificate]
    assert client.get(f"/api/certificates/{certificate['id']}/pdf").status_code == 200


def test_invalid_codes_and_configured_origin_not_request_host(client, guest, courses, monkeypatch):
    headers, _ = guest
    for code in ["invented", "a"*36, str(uuid4())]:
        assert client.get(f"/api/certificates/{code}").status_code == 404
        assert client.get(f"/api/certificates/{code}/pdf").status_code == 404
    body = request_body(courses["computer-bits"])
    result = client.post("/api/certificates", headers={**headers, "Host": "fake.invalid", "X-Forwarded-Host": "fake.invalid"}, json=body)
    assert result.status_code == 200
    assert "fake.invalid" not in result.json()["verification_url"]
    for origin in ["javascript:bad", "https://name:password@example.test", "https://example.test?next=bad", "https://example.test/path"]:
        monkeypatch.setattr(get_settings(), "public_app_url", origin)
        assert client.post("/api/certificates", headers=headers, json=request_body(courses["computer-cpu"])).status_code == 422

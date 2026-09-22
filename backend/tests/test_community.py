"""Community discussions: browsing, posting, editing, withdrawal and accepted answers."""

from __future__ import annotations

import pytest

from app.services import community as service


@pytest.fixture(autouse=True)
def fresh_budgets():
    """Per-process write budgets must not leak between tests."""
    service.thread_budget.recent.clear()
    service.reply_budget.recent.clear()
    yield
    service.thread_budget.recent.clear()
    service.reply_budget.recent.clear()


def _other_guest(client):
    body = client.post("/api/players/guest").json()
    return {"Authorization": f"Bearer {body['token']}"}, body["player"]


def _new_thread(client, headers, **overrides):
    body = {
        "title": "My LED will not light",
        "body": "I wired D13 to the anode through 220 ohm and nothing happens.",
        "category": "help",
        **overrides,
    }
    res = client.post("/api/community/threads", json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_thread_lifecycle_and_public_reading(client, guest):
    headers, player = guest
    created = _new_thread(client, headers, board="uno")
    assert created["author"]["display_name"] == player["display_name"]
    assert created["category"] == "help" and created["board"] == "uno"
    assert created["reply_count"] == 0 and created["is_solved"] is False
    assert created["posts"] == [] and created["edited_at"] is None

    # Reading needs no credentials and counts a view.
    read = client.get(f"/api/community/threads/{created['id']}")
    assert read.status_code == 200
    assert read.json()["views"] == 1
    assert read.json()["author"].keys() == {"id", "display_name", "level"}, "no username is exposed"

    listed = client.get("/api/community/threads").json()
    assert listed["total"] == 1
    row = listed["items"][0]
    assert "body" not in row and row["excerpt"].startswith("I wired D13")
    assert {c["id"]: c["threads"] for c in listed["categories"]}["help"] == 1

    edited = client.patch(
        f"/api/community/threads/{created['id']}", json={"title": "LED stays dark"}, headers=headers
    ).json()
    assert edited["title"] == "LED stays dark" and edited["edited_at"] is not None
    assert edited["body"] == created["body"], "an omitted field is left alone"

    assert client.delete(f"/api/community/threads/{created['id']}", headers=headers).status_code == 204
    assert client.get(f"/api/community/threads/{created['id']}").status_code == 404
    assert client.get("/api/community/threads").json()["total"] == 0


def test_only_the_author_may_edit_or_withdraw(client, guest):
    headers, _ = guest
    created = _new_thread(client, headers)
    other, _ = _other_guest(client)

    # The discussion is public, so denial is 403 — pretending it is missing would be a lie.
    assert client.patch(f"/api/community/threads/{created['id']}", json={"title": "Hijacked"}, headers=other).status_code == 403
    assert client.delete(f"/api/community/threads/{created['id']}", headers=other).status_code == 403
    assert client.get(f"/api/community/threads/{created['id']}").json()["title"] == created["title"]

    # Anonymous writes are rejected outright.
    assert client.post("/api/community/threads", json={"title": "Hello there", "body": "hi there", "category": "help"}).status_code == 401
    assert client.post(f"/api/community/threads/{created['id']}/replies", json={"body": "me too"}).status_code == 401


def test_replies_maintain_counters_activity_and_the_accepted_answer(client, guest):
    headers, _ = guest
    created = _new_thread(client, headers)
    helper, helper_player = _other_guest(client)

    first = client.post(
        f"/api/community/threads/{created['id']}/replies", json={"body": "Check the resistor leg."}, headers=helper
    )
    assert first.status_code == 201, first.text
    first = first.json()
    assert first["author"]["display_name"] == helper_player["display_name"]
    assert first["is_answer"] is False and first["is_deleted"] is False

    second = client.post(
        f"/api/community/threads/{created['id']}/replies", json={"body": "Or the LED is backwards."}, headers=helper
    ).json()

    thread = client.get(f"/api/community/threads/{created['id']}").json()
    assert thread["reply_count"] == 2
    assert [p["id"] for p in thread["posts"]] == [first["id"], second["id"]], "replies stay in posting order"
    assert thread["last_activity_at"] > thread["created_at"]

    # Only the person who asked can accept an answer.
    assert client.post(
        f"/api/community/threads/{created['id']}/replies/{first['id']}/answer", json={"is_answer": True}, headers=helper
    ).status_code == 403
    accepted = client.post(
        f"/api/community/threads/{created['id']}/replies/{first['id']}/answer", json={"is_answer": True}, headers=headers
    ).json()
    assert accepted["is_solved"] is True
    assert [p["is_answer"] for p in accepted["posts"]] == [True, False]

    # Accepting another reply moves the mark rather than adding a second one.
    moved = client.post(
        f"/api/community/threads/{created['id']}/replies/{second['id']}/answer", json={"is_answer": True}, headers=headers
    ).json()
    assert [p["is_answer"] for p in moved["posts"]] == [False, True] and moved["is_solved"] is True

    # Withdrawing the accepted reply clears the mark and the counter.
    assert client.delete(f"/api/community/replies/{second['id']}", headers=helper).status_code == 204
    after = client.get(f"/api/community/threads/{created['id']}").json()
    assert after["reply_count"] == 1 and after["is_solved"] is False
    withdrawn = next(p for p in after["posts"] if p["id"] == second["id"])
    assert withdrawn["is_deleted"] is True and withdrawn["body"] == "", "a withdrawn reply keeps its place, not its text"


def test_editing_and_withdrawing_replies(client, guest):
    headers, _ = guest
    created = _new_thread(client, headers)
    helper, _ = _other_guest(client)
    reply = client.post(
        f"/api/community/threads/{created['id']}/replies", json={"body": "Try 330 ohm."}, headers=helper
    ).json()

    assert client.patch(f"/api/community/replies/{reply['id']}", json={"body": "Try 330 ohm instead."}, headers=headers).status_code == 403
    edited = client.patch(
        f"/api/community/replies/{reply['id']}", json={"body": "Try 330 ohm instead."}, headers=helper
    ).json()
    assert edited["body"] == "Try 330 ohm instead." and edited["edited_at"] is not None

    assert client.delete(f"/api/community/replies/{reply['id']}", headers=helper).status_code == 204
    assert client.patch(f"/api/community/replies/{reply['id']}", json={"body": "again"}, headers=helper).status_code == 404


def test_a_withdrawn_question_keeps_other_peoples_replies_readable(client, guest):
    headers, _ = guest
    created = _new_thread(client, headers)
    helper, _ = _other_guest(client)
    client.post(f"/api/community/threads/{created['id']}/replies", json={"body": "Answer worth keeping."}, headers=helper)

    assert client.delete(f"/api/community/threads/{created['id']}", headers=headers).status_code == 204
    thread = client.get(f"/api/community/threads/{created['id']}")
    assert thread.status_code == 200, "a conversation other people joined is not erased"
    thread = thread.json()
    assert thread["is_deleted"] is True and thread["body"] == ""
    assert thread["posts"][0]["body"] == "Answer worth keeping."
    assert client.get("/api/community/threads").json()["items"][0]["excerpt"] == ""

    # It is closed to new and edited contributions, including accepting an answer.
    reply_id = thread["posts"][0]["id"]
    assert client.post(f"/api/community/threads/{created['id']}/replies", json={"body": "late"}, headers=helper).status_code == 422
    assert client.patch(f"/api/community/threads/{created['id']}", json={"title": "Reopened"}, headers=headers).status_code == 422
    assert client.post(
        f"/api/community/threads/{created['id']}/replies/{reply_id}/answer", json={"is_answer": True}, headers=headers
    ).status_code == 422


def test_filters_search_sorting_and_pagination(client, guest):
    headers, _ = guest
    other, _ = _other_guest(client)
    _new_thread(client, headers, title="Servo jitters on the ESP32", category="hardware", board="esp32")
    firmware = _new_thread(client, headers, title="State machine keeps resetting", category="firmware", board="uno")
    _new_thread(client, headers, title="Which course covers PWM", category="courses")
    client.post(f"/api/community/threads/{firmware['id']}/replies", json={"body": "Show your loop."}, headers=other)

    assert client.get("/api/community/threads", params={"category": "hardware"}).json()["total"] == 1
    assert client.get("/api/community/threads", params={"board": "uno"}).json()["total"] == 1
    assert client.get("/api/community/threads", params={"q": "SERVO"}).json()["total"] == 1, "search is case-insensitive"
    assert client.get("/api/community/threads", params={"q": "show your loop"}).json()["total"] == 0, "search covers the question, not replies"

    # The category facet honours the other filters but not the selected category.
    facets = client.get("/api/community/threads", params={"category": "hardware"}).json()["categories"]
    assert {c["id"]: c["threads"] for c in facets} == {"help": 0, "builds": 0, "hardware": 1, "firmware": 1, "courses": 1, "ideas": 0}
    assert [c["label"] for c in facets][:1] == ["Get help"]

    # The replied-to thread is the most active; creation order is unchanged.
    assert client.get("/api/community/threads", params={"sort": "active"}).json()["items"][0]["id"] == firmware["id"]
    assert client.get("/api/community/threads", params={"sort": "recent"}).json()["items"][0]["title"] == "Which course covers PWM"
    assert client.get("/api/community/threads", params={"sort": "popular"}).json()["items"][0]["id"] == firmware["id"]

    page = client.get("/api/community/threads", params={"limit": 2, "offset": 2}).json()
    assert page["total"] == 3 and len(page["items"]) == 1

    assert client.get("/api/community/threads", params={"category": "nope"}).status_code == 422
    assert client.get("/api/community/threads", params={"sort": "loudest"}).status_code == 422
    assert client.get("/api/community/threads", params={"board": "pico"}).status_code == 422


def test_input_rules_reject_unusable_posts(client, guest):
    headers, _ = guest
    bad_bodies = [
        {"title": "hi", "body": "long enough", "category": "help"},
        {"title": "A fine title", "body": " ", "category": "help"},
        {"title": "A fine title", "body": "x" * 8001, "category": "help"},
        {"title": "A fine title", "body": "ok body", "category": "gossip"},
        {"title": "A fine title", "body": "ok body", "category": "help", "board": "pico"},
        {"title": "A fine title", "body": "ok body", "category": "help", "project_slug": "not a slug"},
        {"title": "A fine title", "body": "ok body", "category": "help", "pinned": True},
    ]
    for body in bad_bodies:
        assert client.post("/api/community/threads", json=body, headers=headers).status_code == 422, body

    # Titles collapse whitespace; bodies keep code indentation but lose control characters.
    created = _new_thread(
        client, headers, title="  Serial   prints\u0007 nothing  ", body="Here:\r\n\r\n\r\n    Serial.begin(9600);   \n"
    )
    assert created["title"] == "Serial prints nothing"
    assert created["body"] == "Here:\n\n    Serial.begin(9600);"

    assert client.patch(f"/api/community/threads/{created['id']}", json={}, headers=headers).status_code == 422
    assert client.patch(f"/api/community/threads/{created['id']}", json={"title": "no"}, headers=headers).status_code == 422
    assert client.patch(f"/api/community/threads/{created['id']}", json={"board": "esp32"}, headers=headers).status_code == 422


def test_double_submits_are_rejected_as_conflicts(client, guest):
    headers, _ = guest
    created = _new_thread(client, headers)
    duplicate = client.post(
        "/api/community/threads",
        json={"title": created["title"], "body": created["body"], "category": "help"},
        headers=headers,
    )
    assert duplicate.status_code == 409

    client.post(f"/api/community/threads/{created['id']}/replies", json={"body": "Any ideas?"}, headers=headers)
    again = client.post(f"/api/community/threads/{created['id']}/replies", json={"body": "Any ideas?"}, headers=headers)
    assert again.status_code == 409
    assert client.get(f"/api/community/threads/{created['id']}").json()["reply_count"] == 1


def test_write_budgets_bound_a_single_player(client, guest):
    headers, _ = guest
    for index in range(service.thread_budget.per_player):
        _new_thread(client, headers, title=f"Question number {index}")
    blocked = client.post(
        "/api/community/threads", json={"title": "One more question", "body": "and its body", "category": "help"}, headers=headers
    )
    assert blocked.status_code == 429 and blocked.json()["detail"] == "community_rate_limited"

    # A different player is unaffected until the overall budget is reached.
    other, _ = _other_guest(client)
    assert client.post(
        "/api/community/threads", json={"title": "A separate question", "body": "with a body", "category": "help"}, headers=other
    ).status_code == 201


def test_threads_can_reference_a_published_showcase_project(client, guest):
    headers, _ = guest
    project = client.post(
        "/api/projects",
        json={"name": "Blinker", "board": "uno", "board_mode": "half", "circuit": {}, "code": ""},
        headers=headers,
    ).json()

    unpublished = client.post(
        "/api/community/threads",
        json={"title": "Feedback on my blinker", "body": "How would you tidy the wiring?", "category": "builds", "project_slug": "abcd2345"},
        headers=headers,
    )
    assert unpublished.status_code == 422

    slug = client.post(f"/api/projects/{project['id']}/publish", json={"publish": True}, headers=headers).json()["share_slug"]
    thread = _new_thread(
        client, headers, title="Feedback on my blinker", body="How would you tidy the wiring?", category="builds", project_slug=slug
    )
    assert thread["project_slug"] == slug
    assert client.get("/api/community/threads", params={"project": slug}).json()["total"] == 1
    assert client.get("/api/community/threads", params={"project": "zzzz9999"}).json()["total"] == 0


def test_unknown_threads_and_replies_are_not_found(client, guest):
    headers, _ = guest
    assert client.get("/api/community/threads/missing").status_code == 404
    assert client.patch("/api/community/threads/missing", json={"title": "Whatever"}, headers=headers).status_code == 404
    assert client.delete("/api/community/threads/missing", headers=headers).status_code == 404
    assert client.post("/api/community/threads/missing/replies", json={"body": "hello"}, headers=headers).status_code == 404
    assert client.delete("/api/community/replies/missing", headers=headers).status_code == 404

    created = _new_thread(client, headers)
    assert client.post(f"/api/community/threads/{created['id']}/replies/missing/answer", json={"is_answer": True}, headers=headers).status_code == 404


def test_reading_a_thread_does_not_scale_its_query_count_with_replies(client, guest):
    """A discussion returns every reply, so reading one must cost the same at any length."""
    from sqlalchemy import event

    from app.db.session import engine

    headers, _ = guest

    def selects_to_read(reply_count):
        thread = _new_thread(client, headers, title=f"A thread with {reply_count} replies")
        for index in range(reply_count):
            helper, _ = _other_guest(client)
            assert client.post(
                f"/api/community/threads/{thread['id']}/replies", json={"body": f"Reply {index}"}, headers=helper
            ).status_code == 201
        statements = []
        record = lambda conn, cursor, statement, *rest: statements.append(statement)  # noqa: E731
        event.listen(engine, "before_cursor_execute", record)
        try:
            body = client.get(f"/api/community/threads/{thread['id']}").json()
        finally:
            event.remove(engine, "before_cursor_execute", record)
        assert len(body["posts"]) == reply_count
        assert len({post["author"]["id"] for post in body["posts"]}) == reply_count, "each reply has its own author"
        return len([s for s in statements if s.lstrip().upper().startswith("SELECT")])

    short, long = selects_to_read(2), selects_to_read(9)
    assert short == long, f"reply authors are loaded per row: {short} selects for 2 replies, {long} for 9"

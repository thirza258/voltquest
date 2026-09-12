"""Exercise use cases directly, without FastAPI dependency injection."""

import pytest
from app.core.security import create_token
from app.db.models import Player, Progress
from app.db.session import session_scope
from app.domain.errors import AuthenticationFailed, InvalidInput, NotFound
from app.domain.limits import MAX_BLOB_BYTES
from app.schemas.players import PlayerPatch, SettingsPatch
from app.schemas.progress import CompleteIn
from app.schemas.projects import ProjectIn, ProjectPatch, PublishIn
from app.services import auth, players, progress, projects, showcase
from sqlalchemy import select


def test_project_publish_and_fork_without_http(db_session):
    owner_token = players.create_guest(db_session)
    owner = auth.resolve_player(owner_token.token, db_session)
    project = projects.create_project(
        ProjectIn(name="GPIO lesson", board="raspberrypi5", circuit={"mcu": "raspberrypi5"}),
        owner,
        db_session,
    )
    published = projects.publish_project(project.id, PublishIn(), owner, db_session)
    assert len(published.share_slug) == 8
    assert showcase.get_showcase_project(published.share_slug, db_session).views == 1

    other = auth.resolve_player(players.create_guest(db_session).token, db_session)
    with pytest.raises(NotFound, match="Project not found"):
        projects.get_project(project.id, other, db_session)
    fork = showcase.fork_showcase_project(published.share_slug, other, db_session)
    assert fork.owner_id == other.id
    assert fork.forked_from == published.share_slug
    assert fork.is_public is False
    assert fork.circuit == project.circuit
    projects.update_project(fork.id, ProjectPatch(code="print('fork')"), other, db_session)
    assert projects.get_project(project.id, owner, db_session).code == ""
    assert projects.get_project(project.id, owner, db_session).forks == 1


@pytest.mark.parametrize("operation", ["profile", "progress"])
def test_rejected_use_case_does_not_leave_changes_for_the_next_commit(db_session, operation):
    player = auth.resolve_player(players.create_guest(db_session).token, db_session)
    original_name = player.display_name
    with pytest.raises(InvalidInput):
        if operation == "profile":
            players.update_me(
                PlayerPatch(display_name="Uncommitted", settings=SettingsPatch(skin="locked")),
                player,
                db_session,
            )
        else:
            progress.complete_level(
                "w1-l1",
                CompleteIn(stars=3, objectives_passed=["led_present", "led_lit"], code="x" * MAX_BLOB_BYTES),
                player,
                db_session,
            )
    # Another valid operation commits the same session after the caller handles the failure.
    players.update_me(PlayerPatch(settings=SettingsPatch(audio=False)), player, db_session)
    db_session.expire_all()
    assert player.display_name == original_name
    assert player.xp == 0
    assert db_session.scalar(select(Progress).where(Progress.player_id == player.id)) is None


def test_session_scope_rolls_back_flushed_changes(database_schema):
    with pytest.raises(RuntimeError, match="operation failed"):
        with session_scope() as db:
            player = Player(display_name="Temporary")
            db.add(player)
            db.flush()
            player_id = player.id
            raise RuntimeError("operation failed")
    with session_scope() as db:
        assert db.get(Player, player_id) is None
        assert not db.new


@pytest.mark.parametrize("token", ["not-a-token", create_token("missing-player")])
def test_token_resolution_rejects_invalid_or_deleted_players(db_session, token):
    with pytest.raises(AuthenticationFailed, match="Not authenticated"):
        auth.resolve_player(token, db_session)


def test_auth_dependency_preserves_bearer_challenge(client):
    for headers in (
        {},
        {"Authorization": "Bearer invalid"},
        {"Authorization": f"Bearer {create_token('deleted')}"},
    ):
        response = client.get("/api/players/me", headers=headers)
        assert response.status_code == 401
        assert response.headers["WWW-Authenticate"] == "Bearer"
        assert response.json() == {"detail": "Not authenticated"}

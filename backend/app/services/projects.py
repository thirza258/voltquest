"""Projects application operations; independent of HTTP transport."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import new_share_slug
from app.db.models import Player, Project
from app.domain.errors import NotFound, ServiceError
from app.domain.projects import validate_board
from app.schemas.projects import (
    ProjectIn,
    ProjectListOut,
    ProjectOut,
    ProjectPatch,
    ProjectSummaryOut,
    PublishIn,
)
from app.services.serializers import project_payload, project_summary


def owned_project(project_id: str, player: Player, db: Session) -> Project:
    """Load a project owned by ``player``; 404 for anything else (no leak)."""
    project = db.get(Project, project_id)
    if project is None or project.owner_id != player.id:
        raise NotFound("Project not found")
    return project


def unique_slug(db: Session) -> str:
    """A share slug that no project holds yet."""
    for _ in range(20):
        slug = new_share_slug()
        if db.scalar(select(Project.id).where(Project.share_slug == slug)) is None:
            return slug
    raise ServiceError("Could not allocate a share slug")


def list_projects(player: Player, db: Session) -> ProjectListOut:
    """The caller's projects, newest first."""
    rows = db.scalars(
        select(Project)
        .where(Project.owner_id == player.id)
        .order_by(Project.created_at.desc(), Project.id.desc())
    ).all()
    return ProjectListOut(
        projects=[ProjectSummaryOut(**project_summary(p, player.display_name)) for p in rows]
    )


def create_project(body: ProjectIn, player: Player, db: Session) -> ProjectOut:
    """Save a new sandbox project."""
    validate_board(body.board, body.circuit, body.editor_mode)
    project = Project(owner_id=player.id, **body.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut(**project_payload(project, player.display_name))


def get_project(project_id: str, player: Player, db: Session) -> ProjectOut:
    """One of the caller's projects."""
    project = owned_project(project_id, player, db)
    return ProjectOut(**project_payload(project, player.display_name))


def update_project(project_id: str, body: ProjectPatch, player: Player, db: Session) -> ProjectOut:
    """Partially update one of the caller's projects."""
    project = owned_project(project_id, player, db)
    validate_board(
        body.board or project.board,
        body.circuit if body.circuit is not None else project.circuit,
        body.editor_mode or project.editor_mode,
    )
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None or field in ("blockly_xml", "thumbnail"):
            setattr(project, field, value)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut(**project_payload(project, player.display_name))


def delete_project(project_id: str, player: Player, db: Session) -> None:
    """Delete one of the caller's projects."""
    project = owned_project(project_id, player, db)
    db.delete(project)
    db.commit()


def publish_project(project_id: str, body: PublishIn, player: Player, db: Session) -> ProjectOut:
    """Publish to (or withdraw from) the public showcase; the slug is kept."""
    project = owned_project(project_id, player, db)
    if body.publish and (not project.share_slug):
        project.share_slug = unique_slug(db)
    project.is_public = bool(body.publish)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut(**project_payload(project, player.display_name))

"Sandbox project CRUD and publishing."

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_player, get_db
from app.db.models import Player
from app.schemas.projects import (
    ProjectIn,
    ProjectListOut,
    ProjectOut,
    ProjectPatch,
    PublishIn,
)
from app.services import projects as service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=ProjectListOut)
def list_projects(
    player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> ProjectListOut:
    """The caller's projects, newest first."""
    return service.list_projects(player=player, db=db)


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectIn, player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> ProjectOut:
    """Save a new sandbox project."""
    return service.create_project(body=body, player=player, db=db)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str, player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> ProjectOut:
    """One of the caller's projects."""
    return service.get_project(project_id=project_id, player=player, db=db)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    body: ProjectPatch,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> ProjectOut:
    """Partially update one of the caller's projects."""
    return service.update_project(project_id=project_id, body=body, player=player, db=db)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str, player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> Response:
    """Delete one of the caller's projects."""
    service.delete_project(project_id=project_id, player=player, db=db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{project_id}/publish", response_model=ProjectOut)
def publish_project(
    project_id: str,
    body: PublishIn,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> ProjectOut:
    """Publish to (or withdraw from) the public showcase; the slug is kept."""
    return service.publish_project(project_id=project_id, body=body, player=player, db=db)

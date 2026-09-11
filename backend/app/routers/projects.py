"""Sandbox project CRUD and publishing."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..deps import get_current_player, get_db
from ..boards import BOARDS
from ..models import Player, Project
from ..schemas import ProjectIn, ProjectListOut, ProjectOut, ProjectPatch, ProjectSummaryOut, PublishIn
from ..security import new_share_slug
from ..serializers import project_payload, project_summary

router = APIRouter(prefix="/projects", tags=["projects"])


def validate_board(board: str, circuit: dict, editor_mode: str) -> None:
    if board not in BOARDS:
        raise HTTPException(status_code=422, detail="Unsupported project board")
    if circuit.get("mcu") is not None and circuit["mcu"] != board:
        raise HTTPException(status_code=422, detail="Project board must match circuit.mcu")
    components = circuit.get("components", [])
    if not isinstance(components, list) or any(not isinstance(component, dict) for component in components):
        raise HTTPException(status_code=422, detail="Circuit components must be a list of objects")
    if any(not isinstance(component.get("type"), str) for component in components):
        raise HTTPException(status_code=422, detail="Every circuit component must have a string type")
    controllers = [component for component in components if component.get("type") in BOARDS]
    if len(controllers) > 1 or any(component["type"] != board for component in controllers):
        raise HTTPException(status_code=422, detail="Circuit must contain at most one controller matching the project board")
    if BOARDS[board]["language"] == "python" and editor_mode != "text":
        raise HTTPException(status_code=422, detail="Raspberry Pi projects use the Python text editor; Blockly generates Arduino C++")


def owned_project(project_id: str, player: Player, db: Session) -> Project:
    """Load a project owned by ``player``; 404 for anything else (no leak)."""
    project = db.get(Project, project_id)
    if project is None or project.owner_id != player.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def unique_slug(db: Session) -> str:
    """A share slug that no project holds yet."""
    for _ in range(20):
        slug = new_share_slug()
        if db.scalar(select(Project.id).where(Project.share_slug == slug)) is None:
            return slug
    raise HTTPException(status_code=500, detail="Could not allocate a share slug")


@router.get("", response_model=ProjectListOut)
def list_projects(player: Player = Depends(get_current_player), db: Session = Depends(get_db)) -> ProjectListOut:
    """The caller's projects, newest first."""
    rows = db.scalars(
        select(Project).where(Project.owner_id == player.id).order_by(Project.created_at.desc(), Project.id.desc())
    ).all()
    return ProjectListOut(projects=[ProjectSummaryOut(**project_summary(p, player.display_name)) for p in rows])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectIn,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> ProjectOut:
    """Save a new sandbox project."""
    validate_board(body.board, body.circuit, body.editor_mode)
    project = Project(owner_id=player.id, **body.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut(**project_payload(project, player.display_name))


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> ProjectOut:
    """One of the caller's projects."""
    project = owned_project(project_id, player, db)
    return ProjectOut(**project_payload(project, player.display_name))


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    body: ProjectPatch,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> ProjectOut:
    """Partially update one of the caller's projects."""
    project = owned_project(project_id, player, db)
    validate_board(body.board or project.board, body.circuit if body.circuit is not None else project.circuit, body.editor_mode or project.editor_mode)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None or field in ("blockly_xml", "thumbnail"):
            setattr(project, field, value)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut(**project_payload(project, player.display_name))


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> Response:
    """Delete one of the caller's projects."""
    project = owned_project(project_id, player, db)
    db.delete(project)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{project_id}/publish", response_model=ProjectOut)
def publish_project(
    project_id: str,
    body: PublishIn,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> ProjectOut:
    """Publish to (or withdraw from) the public showcase; the slug is kept."""
    project = owned_project(project_id, player, db)
    if body.publish and not project.share_slug:
        project.share_slug = unique_slug(db)
    project.is_public = bool(body.publish)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut(**project_payload(project, player.display_name))

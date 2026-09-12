"""HTTP adapter for the context-aware tutor; guest authentication is sufficient."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_player, get_db
from app.db.models import Player
from app.schemas.assistant import AssistantRequest, AssistantReply
from app.services import assistant as service
from app.services import agent_access

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.get("/status")
def assistant_status() -> dict:
    return {"enabled": service.is_enabled()}


@router.post("/chat", response_model=AssistantReply)
async def assistant_chat(body: AssistantRequest, player: Player = Depends(get_current_player)):
    return await service.ask(body=body, player_id=player.id)


@router.get("/mcp/access")
def mcp_access(player: Player = Depends(get_current_player), db: Session = Depends(get_db)):
    return agent_access.status(player, db)


@router.post("/mcp/token")
def mcp_token(response: Response, player: Player = Depends(get_current_player), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return agent_access.issue(player, db)


@router.delete("/mcp/access", status_code=204)
def revoke_mcp(player: Player = Depends(get_current_player), db: Session = Depends(get_db)):
    agent_access.revoke(player, db)
    return Response(status_code=204)


@router.put("/mcp/context")
def share_mcp_context(body: AssistantRequest, player: Player = Depends(get_current_player), db: Session = Depends(get_db)):
    return agent_access.share_context(body.context, player, db)

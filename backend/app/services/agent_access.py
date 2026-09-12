"""MCP credentials are opaque and project-scoped; never accepted as player JWTs."""

from datetime import timedelta, timezone
from hashlib import sha256
import secrets

from sqlalchemy import select

from app.db.models import AgentAccess, Player, utcnow
from app.domain.errors import AuthenticationFailed, InvalidOperation


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def issue(player, db):
    token = "vq_mcp_" + secrets.token_urlsafe(32)
    record = db.get(AgentAccess, player.id)
    if record is None:
        record = AgentAccess(player_id=player.id)
    record.token_hash = sha256(token.encode()).hexdigest()
    record.expires_at = utcnow() + timedelta(days=30)
    db.add(record)
    db.commit()
    return {"token": token, "expires_at": aware(record.expires_at).isoformat()}


def status(player, db):
    record = db.get(AgentAccess, player.id)
    return {"enabled": bool(record and aware(record.expires_at) > utcnow()),
            "expires_at": aware(record.expires_at).isoformat() if record else None}


def revoke(player, db):
    record = db.get(AgentAccess, player.id)
    if record:
        db.delete(record)
        db.commit()


def resolve(token, db):
    if not token.startswith("vq_mcp_") or len(token) > 128:
        raise AuthenticationFailed("Invalid MCP token")
    record = db.scalar(select(AgentAccess).where(AgentAccess.token_hash == sha256(token.encode()).hexdigest()))
    if not record or aware(record.expires_at) <= utcnow():
        raise AuthenticationFailed("Invalid MCP token")
    player = db.get(Player, record.player_id)
    if not player:
        raise AuthenticationFailed("Invalid MCP token")
    return player, record


def share_context(context, player, db):
    record = db.get(AgentAccess, player.id)
    if not record or aware(record.expires_at) <= utcnow():
        raise InvalidOperation("Create an MCP token before sharing context")
    record.context = context.model_dump()
    record.context_updated_at = utcnow()
    db.commit()
    return {"shared_at": aware(record.context_updated_at).isoformat()}


def current_context(record):
    if not record.context_updated_at or aware(record.context_updated_at) < utcnow() - timedelta(hours=24):
        return {"context": None, "message": "Ask the learner to use Share current context in the AI panel."}
    return {"context": record.context, "shared_at": aware(record.context_updated_at).isoformat(),
            "note": "Explicit snapshot, not a live browser connection. Ask the learner to share again after edits."}

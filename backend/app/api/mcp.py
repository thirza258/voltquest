"""Streamable HTTP MCP adapter for Claude Code and Codex (official Python SDK)."""

from contextlib import contextmanager

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import Headers
from starlette.responses import JSONResponse

from app.core.config import get_settings
from app.db.session import session_scope
from app.domain.boards import BoardId
from app.domain.errors import AuthenticationFailed, ServiceError
from app.schemas.projects import ProjectIn
from app.services import agent_access, agent_projects, projects


class AuthenticateMCP:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = Headers(scope=scope)
        authorization = headers.get("authorization", "")
        token = authorization[7:] if authorization.lower().startswith("bearer ") else ""

        def check():
            with session_scope() as db:
                agent_access.resolve(token, db)
        try:
            await run_in_threadpool(check)
        except AuthenticationFailed:
            return await JSONResponse({"detail": "Invalid or expired MCP token"}, status_code=401,
                                      headers={"WWW-Authenticate": "Bearer"})(scope, receive, send)
        scope.setdefault("state", {})["mcp_token"] = token
        await self.app(scope, receive, send)


@contextmanager
def actor(ctx):
    token = ctx.request_context.request.scope["state"]["mcp_token"]
    try:
        with session_scope() as db:
            player, access = agent_access.resolve(token, db)
            yield player, access, db
    except ServiceError as exc:
        # Expected application errors should be actionable tool errors, not HTTP crashes.
        raise ValueError(str(exc)) from exc


def create_mcp():
    settings = get_settings()
    mcp = FastMCP(
        "VoltQuest", instructions="Create and edit the learner's private circuit projects. Start with get_project_guide and get_current_context. Use get_board and get_component for actual pin definitions. Never claim firmware was tested; only the browser simulator runs it.",
        streamable_http_path="/", stateless_http=True, json_response=True,
        max_request_body_size=1024 * 1024,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=True,
            allowed_hosts=[h.strip() for h in settings.mcp_allowed_hosts.split(",")],
            allowed_origins=settings.cors_origin_list + ["https://pcb.nevatal.id", "http://127.0.0.1:5173", "http://127.0.0.1:8080"]),
    )
    read = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)
    write = ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=False)

    @mcp.tool(annotations=read)
    def get_project_guide() -> dict:
        """Read circuit schema, supported parts and the project creation workflow."""
        return agent_projects.guide()

    @mcp.tool(annotations=read)
    def get_board(board: BoardId) -> dict:
        """Get a board's exact pins, capabilities, default controller placement and breadboard layouts."""
        return agent_projects.get_board(board)

    @mcp.tool(annotations=read)
    def get_component(component_type: str) -> dict:
        """Read a component's footprint, pin names, property defaults and learning notes."""
        return agent_projects.get_component(component_type)

    @mcp.tool(annotations=read)
    def get_current_context(ctx: Context) -> dict:
        """Read the latest snapshot explicitly shared from the learner's circuit panel (valid for 24 hours)."""
        with actor(ctx) as (_, access, _db):
            return agent_access.current_context(access)

    @mcp.tool(annotations=read)
    def list_projects(ctx: Context) -> dict:
        """List only the authenticated learner's saved projects."""
        with actor(ctx) as (player, _, db):
            result = projects.list_projects(player, db).model_dump(mode="json")
            return result

    @mcp.tool(annotations=read)
    def get_project(project_id: str, ctx: Context) -> dict:
        """Read one owned project, including code, wiring and updated_at for conflict detection."""
        with actor(ctx) as (player, _, db):
            result = projects.get_project(project_id, player, db).model_dump(mode="json")
            result["updated_at"] = agent_access.aware(projects.owned_project(project_id, player, db).updated_at).isoformat()
            return result

    @mcp.tool(annotations=write)
    def create_project(name: str, ctx: Context, board: BoardId = "uno", circuit: dict | None = None, code: str = "", description: str = "") -> dict:
        """Create a private project. Omit circuit to start with a correctly placed controller; otherwise supply a complete CircuitDoc. Firmware is never executed here."""
        with actor(ctx) as (player, _, db):
            doc = circuit if circuit is not None else agent_projects.starter(board)
            payload = ProjectIn(name=name, board=board, board_mode=doc.get("boardMode", "half"), circuit=doc, code=code, description=description, editor_mode="text")
            return agent_projects.create_project(payload, player, db)

    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=True, openWorldHint=False))
    def update_project(project_id: str, expected_updated_at: str, changes: dict, ctx: Context) -> dict:
        """Update an owned private project after get_project. Pass its exact updated_at and changed project fields; circuit replaces the full CircuitDoc. Conflicts require re-reading. Public projects must be copied to a new private project."""
        with actor(ctx) as (player, _, db):
            return agent_projects.update_project(project_id, expected_updated_at, changes, player, db)

    return mcp, AuthenticateMCP(mcp.streamable_http_app())

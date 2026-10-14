"""FastAPI application factory for the VoltQuest backend."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import service_error_response
from app.api.router import api_router
from app.api.mcp import create_mcp
from app.core.config import get_settings
from app.db.session import create_all, session_scope
from app.domain.errors import ServiceError
from app.services import content, showcase

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("voltquest")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Create the database schema and load quest content before serving."""
    settings = get_settings()
    settings.warn_insecure()
    create_all()
    content.load_content()
    log.info("VoltQuest %s ready (%d levels)", settings.app_version, len(content.get_levels()))
    with session_scope() as db:
        showcase.seed_showcase_projects(db)
    async with _app.state.mcp.session_manager.run():
        yield


def create_app() -> FastAPI:
    """Build the ASGI app with CORS and every ``/api`` router mounted."""
    settings = get_settings()
    app = FastAPI(
        title="VoltQuest API",
        version=settings.app_version,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(ServiceError, service_error_response)
    app.include_router(api_router)
    mcp, mcp_app = create_mcp()
    app.state.mcp = mcp
    app.mount("/api/mcp", mcp_app)
    return app


app = create_app()

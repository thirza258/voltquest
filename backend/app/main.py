"""FastAPI application factory for the VoltQuest backend."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import content
from .config import get_settings
from .db import create_all
from .routers import auth, boards, exports, health, leaderboard, players, progress, projects, quests, showcase, tutorials

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
    for router in (
        health.router,
        boards.router,
        tutorials.router,
        players.router,
        auth.router,
        quests.router,
        progress.router,
        projects.router,
        showcase.router,
        exports.router,
        leaderboard.router,
    ):
        app.include_router(router, prefix="/api")
    return app


app = create_app()

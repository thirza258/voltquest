"""Compose the public API in one place; feature routes own their paths."""

from fastapi import APIRouter

from app.api.routes import (
    assistant,
    auth,
    boards,
    community,
    courses,
    certificates,
    exports,
    health,
    leaderboard,
    players,
    progress,
    projects,
    quests,
    showcase,
    tutorials,
)

api_router = APIRouter(prefix="/api")
for router in (
    assistant.router,
    health.router,
    boards.router,
    tutorials.router,
    courses.router,
    certificates.router,
    community.router,
    players.router,
    auth.router,
    quests.router,
    progress.router,
    projects.router,
    showcase.router,
    exports.router,
    leaderboard.router,
):
    api_router.include_router(router)

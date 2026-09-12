"""Pytest fixtures: in-memory database + a tiny throwaway content directory."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

# Environment must be in place before any `app.*` import builds the engine.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "voltquest-test-secret-at-least-32-bytes-long"
os.environ["CONTENT_DIR"] = str(BACKEND_DIR / "tests" / "_unused")
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

LEVEL_W1_L1 = {
    "id": "w1-l1",
    "worldId": "w1",
    "order": 1,
    "title": "First Glow",
    "codeName": "Level 1-1",
    "board": "uno",
    "boardMode": "half",
    "xp": 100,
    "estimatedMinutes": 4,
    "summary": "Light an LED.",
    "concepts": ["current"],
    "objectives": [
        {
            "id": "led_present",
            "text": "Place an LED",
            "rules": [{"type": "component_present", "componentType": "led"}],
        },
        {"id": "led_lit", "text": "Light it", "rules": [{"type": "led_lit"}]},
    ],
    "starCriteria": {"damageExpected": False, "three": []},
}

LEVEL_W1_L2 = {
    "id": "w1-l2",
    "worldId": "w1",
    "order": 2,
    "title": "The Shield",
    "codeName": "Level 1-2",
    "board": "uno",
    "boardMode": "half",
    "xp": 90,
    "estimatedMinutes": 5,
    "summary": "Add a resistor.",
    "concepts": ["ohms law"],
    "objectives": [{"id": "resistor", "text": "Add 220 ohm", "rules": []}],
}

WORLDS = {
    "worlds": [
        {
            "id": "w1",
            "order": 1,
            "title": "The Spark of Life",
            "subtitle": "Power, LEDs, resistors",
            "theme": "amber",
            "board": "uno",
            "intro": "Welcome!",
            "levelIds": ["w1-l1", "w1-l2"],
        }
    ]
}

CATALOG = {
    "led_red": {
        "name": "Red LED 5 mm",
        "unitPriceUsd": 0.12,
        "vendors": [{"name": "Adafruit", "url": "https://example.test/led-red"}],
        "notes": "",
    },
    "resistor_220": {
        "name": "Resistor 220 Ohm 1/4 W",
        "unitPriceUsd": 0.05,
        "vendors": [{"name": "Mouser", "url": "https://example.test/r220"}],
        "notes": "",
    },
    "arduino_uno": {
        "name": "Arduino Uno R3",
        "unitPriceUsd": 24.0,
        "vendors": [{"name": "Arduino", "url": "https://example.test/uno"}],
        "notes": "",
    },
    "breadboard_half": {
        "name": "Breadboard, half size",
        "unitPriceUsd": 4.5,
        "vendors": [{"name": "Adafruit", "url": "https://example.test/bb"}],
        "notes": "",
    },
    "jumper_wires": {
        "name": "Jumper wire set",
        "unitPriceUsd": 6.0,
        "vendors": [{"name": "Adafruit", "url": "https://example.test/wires"}],
        "notes": "",
    },
}

COSMETICS = {
    "skins": [
        {"id": "classic", "name": "Classic", "unlockLevel": 1, "description": "Default"},
        {"id": "mint", "name": "Mint", "unlockLevel": 3, "description": "Cool"},
    ],
    "wirePalettes": [
        {"id": "standard", "name": "Standard", "unlockLevel": 1},
        {"id": "neon", "name": "Neon", "unlockLevel": 4},
    ],
}


def _write_content(root: Path) -> None:
    (root / "quests").mkdir(parents=True, exist_ok=True)
    (root / "worlds.json").write_text(json.dumps(WORLDS), encoding="utf-8")
    (root / "catalog.json").write_text(json.dumps(CATALOG), encoding="utf-8")
    (root / "cosmetics.json").write_text(json.dumps(COSMETICS), encoding="utf-8")
    for level in (LEVEL_W1_L1, LEVEL_W1_L2):
        (root / "quests" / f"{level['id']}.json").write_text(json.dumps(level), encoding="utf-8")


@pytest.fixture(scope="session", autouse=True)
def content_dir(tmp_path_factory) -> Path:
    """A minimal content tree; CONTENT_DIR points at it for the whole session."""
    root = tmp_path_factory.mktemp("content")
    _write_content(root)
    os.environ["CONTENT_DIR"] = str(root)

    from app.core.config import get_settings

    get_settings.cache_clear()
    from app.services import content as content_module

    content_module.load_content(root)
    return root


@pytest.fixture()
def database_schema(content_dir):
    """A fresh in-memory schema shared by HTTP and service tests."""
    from app.db.base import Base
    from app.db.session import create_all, engine

    Base.metadata.drop_all(bind=engine)
    create_all()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session(database_schema):
    """An application session with no FastAPI app or HTTP client."""
    from app.db.session import session_scope

    with session_scope() as db:
        yield db


@pytest.fixture()
def client(database_schema):
    """A TestClient on a freshly created in-memory schema."""
    from app.main import create_app
    from fastapi.testclient import TestClient

    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture()
def guest(client):
    """``(headers, player)`` for a freshly created guest account."""
    res = client.post("/api/players/guest")
    assert res.status_code == 201, res.text
    body = res.json()
    return {"Authorization": f"Bearer {body['token']}"}, body["player"]

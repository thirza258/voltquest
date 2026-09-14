"""Loads ``content/`` (worlds, quests, catalog, cosmetics) into memory at startup.

Content is authored by another package, so a missing or partially filled
``content/`` directory must never raise: every loader logs a warning and falls
back to an empty structure.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.core.config import get_settings

log = logging.getLogger("voltquest.content")

#: Fields every level file must carry to be usable by the frontend.
REQUIRED_LEVEL_FIELDS = ("id", "worldId", "order", "title", "board", "xp", "objectives")

#: Fields exposed by ``LevelSummary`` in GET /api/quests.
SUMMARY_FIELDS = (
    "id",
    "worldId",
    "order",
    "title",
    "codeName",
    "board",
    "xp",
    "estimatedMinutes",
    "summary",
    "concepts",
    "difficulty",
)

_worlds: list[dict] = []
_levels: dict[str, dict] = {}
_catalog: dict[str, dict] = {}
_cosmetics: dict[str, list] = {"skins": [], "wirePalettes": []}
_tutorials: list[dict] = []
_courses: list[dict] = []
_course_tracks: list[dict] = []
_loaded = False


def _read_json(path: Path):
    """Parse a JSON file, returning None (with a warning) on any problem."""
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        log.warning("content: %s is missing", path)
    except (json.JSONDecodeError, OSError) as exc:
        log.warning("content: %s could not be read (%s)", path, exc)
    return None


def _load_worlds(root: Path) -> list[dict]:
    data = _read_json(root / "worlds.json")
    worlds = data.get("worlds") if isinstance(data, dict) else None
    if not isinstance(worlds, list):
        if data is not None:
            log.warning("content: worlds.json has no 'worlds' array")
        return []
    clean = [w for w in worlds if isinstance(w, dict) and w.get("id")]
    clean.sort(key=lambda w: (w.get("order") or 0, str(w.get("id"))))
    return clean


def _load_levels(root: Path) -> dict[str, dict]:
    quests_dir = root / "quests"
    if not quests_dir.is_dir():
        log.warning("content: %s is missing - /api/quests will be empty", quests_dir)
        return {}
    levels: dict[str, dict] = {}
    files = sorted(quests_dir.glob("*.json"))
    if not files:
        log.warning("content: no level files in %s - /api/quests will be empty", quests_dir)
    for path in files:
        level = _read_json(path)
        if not isinstance(level, dict):
            continue
        missing = [f for f in REQUIRED_LEVEL_FIELDS if level.get(f) in (None, "")]
        if missing:
            log.warning(
                "content: %s is missing required field(s) %s - skipped", path.name, ", ".join(missing)
            )
            continue
        if not isinstance(level.get("objectives"), list):
            log.warning("content: %s has a non-list 'objectives' - skipped", path.name)
            continue
        level_id = str(level["id"])
        if level_id in levels:
            log.warning("content: duplicate level id %s in %s - skipped", level_id, path.name)
            continue
        levels[level_id] = level
    return levels


def _load_catalog(root: Path) -> dict[str, dict]:
    data = _read_json(root / "catalog.json")
    if not isinstance(data, dict):
        return {}
    entries = {k: v for k, v in data.items() if isinstance(v, dict)}
    if not entries:
        log.warning("content: catalog.json is empty - BOM rows will use generic pricing")
    return entries


def _load_cosmetics(root: Path) -> dict[str, list]:
    data = _read_json(root / "cosmetics.json")
    if not isinstance(data, dict):
        data = {}
    skins = [c for c in data.get("skins", []) if isinstance(c, dict) and c.get("id")]
    palettes = [c for c in data.get("wirePalettes", []) if isinstance(c, dict) and c.get("id")]
    if not skins and not palettes:
        log.warning("content: cosmetics.json has no skins or wirePalettes")
    return {"skins": skins, "wirePalettes": palettes}


def load_content(content_dir: str | Path | None = None) -> None:
    """(Re)load every content file from ``content_dir`` (default: CONTENT_DIR)."""
    global _worlds, _levels, _catalog, _cosmetics, _tutorials, _courses, _course_tracks, _loaded
    root = Path(content_dir) if content_dir else get_settings().content_path
    if not root.is_dir():
        log.warning("content: CONTENT_DIR %s does not exist - serving empty content", root)
        _worlds, _levels, _catalog, _cosmetics = [], {}, {}, {"skins": [], "wirePalettes": []}
        _tutorials = []
        _courses, _course_tracks = [], []
        _loaded = True
        return
    _worlds = _load_worlds(root)
    _levels = _load_levels(root)
    _catalog = _load_catalog(root)
    _cosmetics = _load_cosmetics(root)
    tutorial_data = _read_json(root / "tutorials.json")
    entries = tutorial_data.get("tutorials", []) if isinstance(tutorial_data, dict) else []
    _tutorials = (
        [
            entry
            for entry in entries
            if isinstance(entry, dict)
            and entry.get("id")
            and entry.get("title")
            and isinstance(entry.get("boards"), list)
        ]
        if isinstance(entries, list)
        else []
    )
    tiers = {"Easy": 0, "Intermediate": 1, "Hard": 2}
    _tutorials.sort(key=lambda entry: (tiers.get(entry.get("difficulty"), 3), entry.get("order", 0)))
    course_data = _read_json(root / "courses.json")
    if not isinstance(course_data, dict):
        course_data = {}
    tracks = course_data.get("tracks", [])
    _course_tracks = [entry for entry in tracks if isinstance(entry, dict) and isinstance(entry.get("id"), str) and entry["id"] and isinstance(entry.get("title"), str) and entry["title"]] if isinstance(tracks, list) else []
    track_order = {entry["id"]: i for i, entry in enumerate(_course_tracks)}
    entries = course_data.get("courses", [])
    _courses = [
        entry for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("id"), str) and entry["id"]
        and isinstance(entry.get("title"), str) and entry["title"]
        and isinstance(entry.get("track"), str) and entry["track"] in track_order and isinstance(entry.get("order"), int)
        and entry.get("difficulty") in ("Fundamental", "Intermediate")
        and isinstance(entry.get("lessons"), list) and isinstance(entry.get("practice"), list)
        and isinstance(entry.get("exam"), dict)
    ] if isinstance(entries, list) else []
    _courses.sort(key=lambda entry: (track_order[entry["track"]], entry["order"]))
    _loaded = True
    log.info("content: loaded %d world(s), %d level(s) from %s", len(_worlds), len(_levels), root)


def ensure_loaded() -> None:
    """Load content on first use if startup has not already done so."""
    if not _loaded:
        load_content()


def get_worlds() -> list[dict]:
    """Raw ``worlds.json`` entries, ordered."""
    ensure_loaded()
    return _worlds


def get_levels() -> dict[str, dict]:
    """All valid level documents keyed by level id."""
    ensure_loaded()
    return _levels


def get_level(level_id: str) -> dict | None:
    """One full level document, or None when unknown."""
    return get_levels().get(level_id)


def get_catalog() -> dict[str, dict]:
    """``content/catalog.json`` (catalogId -> metadata)."""
    ensure_loaded()
    return _catalog


def get_cosmetics() -> dict[str, list]:
    """``content/cosmetics.json`` with ``skins`` / ``wirePalettes`` lists."""
    ensure_loaded()
    return _cosmetics


def get_tutorials() -> list[dict]:
    ensure_loaded()
    return _tutorials


def get_courses() -> list[dict]:
    ensure_loaded()
    return _courses


def get_course_tracks() -> list[dict]:
    ensure_loaded()
    return _course_tracks


def level_summary(level: dict) -> dict:
    """Project a level document down to ``LevelSummary`` (docs/API.md)."""
    return {field: level.get(field) for field in SUMMARY_FIELDS}


def objective_ids(level: dict) -> list[str]:
    """Objective ids declared by a level, in order."""
    return [str(o["id"]) for o in level.get("objectives", []) if isinstance(o, dict) and o.get("id")]


def quests_payload() -> dict:
    """``{ worlds: [ { ...world, levels: [LevelSummary] } ] }`` for GET /api/quests.

    Worlds keep their authored ``levelIds`` order; levels that belong to no
    declared world are appended to a synthetic world so nothing is lost.
    """
    levels = get_levels()
    worlds_out: list[dict] = []
    claimed: set[str] = set()
    for world in get_worlds():
        ids = [str(i) for i in world.get("levelIds", []) if str(i) in levels]
        extra = sorted(
            (lid for lid, lv in levels.items() if lv.get("worldId") == world.get("id") and lid not in ids),
            key=lambda lid: (levels[lid].get("order") or 0, lid),
        )
        ordered = ids + extra
        claimed.update(ordered)
        worlds_out.append({**world, "levels": [level_summary(levels[lid]) for lid in ordered]})
    orphans = sorted(
        (lid for lid in levels if lid not in claimed),
        key=lambda lid: (str(levels[lid].get("worldId") or ""), levels[lid].get("order") or 0, lid),
    )
    if orphans:
        log.warning("content: %d level(s) belong to no declared world", len(orphans))
        worlds_out.append(
            {
                "id": "unsorted",
                "order": len(worlds_out) + 1,
                "title": "Unsorted",
                "subtitle": "Levels with no declared world",
                "levelIds": orphans,
                "levels": [level_summary(levels[lid]) for lid in orphans],
            }
        )
    return {"worlds": worlds_out}

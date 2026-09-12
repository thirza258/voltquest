"""Keep application dependencies directed toward the lower layers."""

import ast
from importlib.util import resolve_name
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1] / "app"
ALLOWED = {
    "domain": {"domain"},
    "core": {"core", "domain"},
    "db": {"db", "core", "domain"},
    "schemas": {"schemas", "domain"},
    "services": {"services", "schemas", "db", "core", "domain"},
    "api": {"api", "services", "schemas", "db", "core", "domain"},
}


def imports_for(path):
    package = ".".join(path.relative_to(APP_DIR.parent).parts[:-1])
    for node in ast.walk(ast.parse(path.read_text())):
        if isinstance(node, ast.Import):
            yield from (alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if node.level:
                module = resolve_name("." * node.level + module, package)
            yield module
            yield from (f"{module}.{alias.name}" for alias in node.names)


@pytest.mark.parametrize("layer", ALLOWED)
def test_dependency_direction(layer):
    violations = []
    for path in (APP_DIR / layer).rglob("*.py"):
        for imported in imports_for(path):
            parts = imported.split(".")
            if parts[0] == "app" and len(parts) > 1 and parts[1] not in ALLOWED[layer]:
                violations.append(f"{path.relative_to(APP_DIR)} imports {imported}")
            if layer != "api" and parts[0] in {"fastapi", "starlette"}:
                violations.append(f"{path.relative_to(APP_DIR)} depends on HTTP transport")
            if layer == "domain" and parts[0] in {"sqlalchemy", "pydantic", "pydantic_settings"}:
                violations.append(f"{path.relative_to(APP_DIR)} is not framework independent")
    assert not violations, "\n".join(violations)


def test_http_adapters_do_not_query_or_mutate_the_database():
    """Session/Player annotations are allowed; queries and commits belong in services."""
    violations = []
    database_operations = {
        "add",
        "add_all",
        "begin",
        "commit",
        "delete",
        "execute",
        "flush",
        "get",
        "query",
        "refresh",
        "rollback",
        "scalar",
        "scalars",
    }
    for path in (APP_DIR / "api").rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.ImportFrom) and node.module == "sqlalchemy":
                violations.append(f"{path.name} imports query builders")
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and isinstance(node.func.value, ast.Name)
                and node.func.value.id == "db"
                and node.func.attr in database_operations
            ):
                violations.append(f"{path.name} calls db.{node.func.attr}")
    assert not violations, "\n".join(violations)


def test_content_paths_still_resolve_from_backend_after_config_move(tmp_path, monkeypatch):
    from app.core.config import BACKEND_DIR, Settings

    monkeypatch.chdir(tmp_path)
    assert BACKEND_DIR == APP_DIR.parent
    assert Settings(_env_file=None, content_dir="../content").content_path == APP_DIR.parents[1] / "content"
    assert Settings(_env_file=None, content_dir=str(tmp_path)).content_path == tmp_path

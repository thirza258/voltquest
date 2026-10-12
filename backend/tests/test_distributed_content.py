"""The distributed-systems course programs must actually run on the standard library.

Unlike the PyTorch programs (torch is not installed, so they are only parsed), these
are pure-stdlib simulations, so this test EXECUTES each one with `python3 -I`, asserts a
clean exit and a deterministic final line, and checks that every import is in the
standard library. That makes "runnable, deterministic, standard-library only" a verified
claim for content/distributed.json rather than an assertion in prose.
"""

import ast
import json
import subprocess
import sys
from pathlib import Path

CONTENT = Path(__file__).resolve().parents[2] / "content"


def _imports(src: str) -> set[str]:
    mods: set[str] = set()
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.Import):
            mods.update(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            mods.add(node.module.split(".")[0])
    return mods


def test_every_distributed_program_runs_on_the_standard_library():
    courses = json.loads((CONTENT / "distributed.json").read_text(encoding="utf-8"))["courses"]
    assert len(courses) == 10
    stdlib = sys.stdlib_module_names
    for course in courses:
        code = course["code"]
        non_stdlib = sorted(m for m in _imports(code) if m not in stdlib)
        assert non_stdlib == [], f"{course['id']} imports non-stdlib: {non_stdlib}"
        result = subprocess.run(
            [sys.executable, "-I", "-c", code],
            capture_output=True, text=True, timeout=30,
        )
        assert result.returncode == 0, f"{course['id']} exited {result.returncode}: {result.stderr[-400:]}"
        last = result.stdout.strip().splitlines()[-1]
        assert last.endswith("True"), f"{course['id']} final line was not a passing assertion: {last!r}"

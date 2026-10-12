"""The downloadable PyTorch programs must be runnable: valid syntax and no undefined names.

torch is not installed in CI, so the programs are not executed; instead each is parsed and its
names are resolved with the standard library's ``symtable`` (module-level references and every
function/method global must be bound by an import or assignment, or be a builtin). This is the
durable form of the authoring-time check and guards against regressions in content/pytorch.json.
"""

import ast
import builtins
import json
import symtable
from pathlib import Path

CONTENT = Path(__file__).resolve().parents[2] / "content"
_BUILTINS = set(dir(builtins)) | {"__name__", "__file__", "__doc__"}


def _undefined_names(src: str) -> list[str]:
    ast.parse(src)  # raises SyntaxError on invalid syntax
    top = symtable.symtable(src, "pytorch", "exec")
    module_bound = {s.get_name() for s in top.get_symbols() if s.is_assigned() or s.is_imported()}
    problems: list[str] = []
    for sym in top.get_symbols():
        name = sym.get_name()
        if sym.is_referenced() and not (sym.is_assigned() or sym.is_imported() or sym.is_parameter()) and name not in _BUILTINS:
            problems.append(f"module:{name}")

    def walk(table):
        for child in table.get_children():
            for sym in child.get_symbols():
                name = sym.get_name()
                if sym.is_referenced() and sym.is_global() and name not in module_bound and name not in _BUILTINS:
                    problems.append(f"{child.get_name()}:{name}")
            walk(child)

    walk(top)
    return problems


def test_every_pytorch_program_parses_and_has_no_undefined_names():
    courses = json.loads((CONTENT / "pytorch.json").read_text(encoding="utf-8"))["courses"]
    assert len(courses) == 10
    for course in courses:
        code = course["code"]
        assert "import torch" in code, course["id"]
        assert _undefined_names(code) == [], course["id"]

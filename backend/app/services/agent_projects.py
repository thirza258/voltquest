"""Project tools use the real catalog and reject documents that the canvas cannot open."""

from functools import lru_cache
import json
import math

from sqlalchemy import update

from app.core.config import get_settings
from app.db.models import Project, utcnow
from app.domain.errors import Conflict, InvalidInput, NotFound
from app.schemas.projects import ProjectIn, ProjectPatch
from app.services import projects
from app.services.agent_access import aware


@lru_cache(maxsize=4)
def load_catalog(path):
    return json.loads(path.read_text())


def catalog():
    return load_catalog(get_settings().content_path / "mcp-catalog.json")


def guide():
    data = catalog()
    return {"boards": list(data["boards"]), "components": [{"type": d["type"], "name": d["name"], "mount": d["mount"]} for d in data["components"].values()],
            "schema": {"version": 1, "mcu": "board id", "boardMode": "half|full|dual", "breadboards": "use get_board layouts", "components": [{"id": "c_unique", "type": "registry type", "props": {}, "rotation": 0, "anchor": {"board": "bb1", "hole": "e20"}}], "wires": [{"id": "w_unique", "from": "componentId:pinName or bb1:hole", "to": "another terminal", "color": "red"}], "meta": {"name": "optional"}},
            "placement": "Board-mounted parts require anchor; free-mounted parts require position {x,y} in pixels. Rotation is 0/90/180/270. Pitch is 24px. Footprint dx follows numbered columns; dy follows letter rows (a=4,b=5,c=6,d=7,e=8,f=11,g=12,h=13,i=14,j=15). The trench separates e/f. a-e of one number are connected; f-j form another strip. Power rails need explicit supply/ground wires. Do not occupy the same hole with a jumper and a leg; use another hole on the same strip. Use catalog defaults for props. Exactly one matching controller is required.",
            "workflow": "Read current context and get_board/get_component first. create_project without circuit makes a valid starter. Supply complete circuit and code to build. update_project requires the updated_at returned by get_project. Returned /sandbox links open saved results. Tools do not execute code, publish projects or modify the learner's unsaved browser document. Raspberry Pi supports restricted GPIO Python only; no ADC, Linux, arbitrary functions or network. Firmware execution stays in the browser."}


def get_board(board):
    if board not in catalog()["boards"]:
        raise NotFound("Unsupported board")
    return {"board": catalog()["boards"][board], "layouts": catalog()["layouts"]}


def get_component(component_type):
    if component_type not in catalog()["components"]:
        raise NotFound("Unsupported component")
    return catalog()["components"][component_type]


def starter(board):
    profile = get_board(board)["board"]
    mode = "dual" if profile["family"] == "esp32" else "half"
    return {"version": 1, "mcu": board, "boardMode": mode, "breadboards": catalog()["layouts"][mode],
            "components": [{"id": "c_mcu", "type": board, "props": {}, "rotation": 0, **profile["placements"][mode]}], "wires": [], "meta": {}}


def hole_positions(board_type):
    rows = 30 if board_type == "half" else 63
    holes = {f"{letter}{n}": (1.5 + n - 1, y) for letter, y in zip("abcdefghij", [4,5,6,7,8,11,12,13,14,15]) for n in range(1, rows + 1)}
    for rail, y in {"TP": 1, "TN": 2, "BN": 17, "BP": 18}.items():
        for k in range(25 if board_type == "half" else 50):
            holes[f"{rail}{k + 1}"] = (2.5 + 6 * (k // 5) + k % 5, y)
    return holes


def validate_circuit(doc, board, mode):
    def require(ok, message):
        if not ok:
            raise InvalidInput(message)
    require(doc.get("version") == 1 and doc.get("mcu") == board and doc.get("boardMode") == mode, "Circuit version, board and layout must match the project")
    require(mode in catalog()["layouts"] and doc.get("breadboards") == catalog()["layouts"][mode], "Use the breadboard layouts returned by get_board")
    comps, wires = doc.get("components"), doc.get("wires")
    require(isinstance(comps, list) and len(comps) <= 200 and isinstance(wires, list) and len(wires) <= 400, "Provide at most 200 components and 400 wires")
    holes = {bb["id"]: hole_positions(bb["type"]) for bb in doc["breadboards"]}
    origins = {bb["id"]: (bb["x"] / 24, bb["y"] / 24) for bb in doc["breadboards"]}
    world_positions = {(x + origins[bid][0], y + origins[bid][1]) for bid, entries in holes.items() for x, y in entries.values()}
    terminals = {f"{bid}:{hole}" for bid, entries in holes.items() for hole in entries}
    ids = set(holes)
    controllers = 0
    for comp in comps:
        require(isinstance(comp, dict), "Invalid component")
        ident, kind = comp.get("id"), comp.get("type")
        require(isinstance(ident, str) and 1 <= len(ident) <= 80 and ':' not in ident and ident not in ids, "Component IDs must be unique")
        ids.add(ident)
        require(isinstance(kind, str) and kind in catalog()["components"], "Unsupported component type")
        definition = get_component(kind)
        if definition["category"] == "mcu":
            controllers += 1
            require(kind == board, "Controller must match board")
        rotation = comp.get("rotation", 0)
        require(rotation in [0, 90, 180, 270], "Invalid rotation")
        props = comp.get("props", {})
        require(isinstance(props, dict) and set(props) <= set(definition["props"]), "Unsupported component properties")
        for key, spec in definition["props"].items():
            value = props.get(key, spec["default"])
            if spec["type"] == "enum":
                require(value in spec["options"], f"Invalid {kind}.{key}")
            elif spec["type"] == "boolean":
                require(isinstance(value, bool), f"Invalid {kind}.{key}")
            else:
                require(type(value) in [int, float] and math.isfinite(value), f"Invalid {kind}.{key}")
                require(spec.get("min", -math.inf) <= value <= spec.get("max", math.inf), f"Out of range {kind}.{key}")
        # Defaults ensure a newly created part behaves like a part from the drawer.
        comp["props"] = {key: props.get(key, spec["default"]) for key, spec in definition["props"].items()}
        if definition["mount"] == "board":
            anchor = comp.get("anchor")
            require(isinstance(anchor, dict) and "position" not in comp, "Board-mounted parts need anchor only")
            require(anchor.get("board") in holes and anchor.get("hole") in holes[anchor["board"]], "Invalid anchor hole")
            x, y = holes[anchor["board"]][anchor["hole"]]
            ox, oy = origins[anchor["board"]]
            x, y = x + ox, y + oy
            for pin in definition["footprint"]["pins"]:
                dx, dy = pin["dx"], pin["dy"]
                dx, dy = {0:(dx,dy),90:(-dy,dx),180:(-dx,-dy),270:(dy,-dx)}[rotation]
                require((x + dx, y + dy) in world_positions, f"{ident}:{pin['id']} does not fit a breadboard hole")
        else:
            pos = comp.get("position")
            require(isinstance(pos, dict) and "anchor" not in comp, "Free-mounted parts need position only")
            require(all(type(pos.get(k)) in [int, float] and math.isfinite(pos[k]) and abs(pos[k]) <= 10000 for k in ["x", "y"]), "Invalid position")
        terminals.update(f"{ident}:{pin['id']}" for pin in definition["footprint"]["pins"])
    require(controllers == 1, "Exactly one controller is required")
    for wire in wires:
        require(isinstance(wire, dict), "Invalid wire")
        ident = wire.get("id")
        require(isinstance(ident, str) and 1 <= len(ident) <= 80 and ident not in ids, "Wire IDs must be unique")
        ids.add(ident)
        require(isinstance(wire.get("from"), str) and isinstance(wire.get("to"), str) and wire["from"] in terminals and wire["to"] in terminals, "Unknown wire terminal")
        require(wire.get("color", "red") in ["red","black","yellow","green","blue","orange","white","purple"], "Invalid wire color")


def create_project(payload, player, db):
    validate_circuit(payload.circuit, payload.board, payload.board_mode)
    result = projects.create_project(body=payload, player=player, db=db)
    return {"project": result.model_dump(mode="json"), "open_path": f"/sandbox/{result.id}"}


def update_project(project_id, expected_updated_at, changes, player, db):
    current = projects.owned_project(project_id, player, db)
    if aware(current.updated_at).isoformat() != expected_updated_at:
        raise Conflict("Project changed. Read it again before updating.")
    if current.is_public:
        raise InvalidInput("Copy this public project to a new private project before editing with MCP.")
    patch = ProjectPatch.model_validate(changes)
    merged = ProjectIn.model_validate({key: value for key, value in projects.get_project(project_id, player, db).model_dump().items() if key in ProjectIn.model_fields} | patch.model_dump(exclude_unset=True))
    validate_circuit(merged.circuit, merged.board, merged.board_mode)
    from app.domain.projects import validate_board
    validate_board(merged.board, merged.circuit, merged.editor_mode)
    values = merged.model_dump()
    values["updated_at"] = utcnow()
    result = db.execute(update(Project).where(Project.id == project_id, Project.owner_id == player.id, Project.updated_at == current.updated_at).values(**values))
    if result.rowcount != 1:
        db.rollback()
        raise Conflict("Project changed. Read it again before updating.")
    db.commit()
    db.expire_all()
    result = projects.get_project(project_id, player, db)
    return {"project": result.model_dump(mode="json"), "open_path": f"/sandbox/{project_id}"}

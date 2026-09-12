"""Circuit and editor compatibility rules shared by project operations."""

from .boards import BOARDS
from .errors import InvalidInput


def validate_board(board: str, circuit: dict, editor_mode: str) -> None:
    if board not in BOARDS:
        raise InvalidInput("Unsupported project board")
    if circuit.get("mcu") is not None and circuit["mcu"] != board:
        raise InvalidInput("Project board must match circuit.mcu")
    components = circuit.get("components", [])
    if not isinstance(components, list) or any((not isinstance(component, dict) for component in components)):
        raise InvalidInput("Circuit components must be a list of objects")
    if any((not isinstance(component.get("type"), str) for component in components)):
        raise InvalidInput("Every circuit component must have a string type")
    controllers = [component for component in components if component.get("type") in BOARDS]
    if len(controllers) > 1 or any((component["type"] != board for component in controllers)):
        raise InvalidInput("Circuit must contain at most one controller matching the project board")
    if BOARDS[board]["language"] == "python" and editor_mode != "text":
        raise InvalidInput("Raspberry Pi projects use the Python text editor; Blockly generates Arduino C++")

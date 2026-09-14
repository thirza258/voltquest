"""Bill-of-materials generation from a CircuitDoc (docs/API.md "Exports")."""

from __future__ import annotations

import csv
import io
from typing import Any

from . import content

#: CSV header, binding for the UI table and the download.
BOM_COLUMNS = ["Qty", "Part", "Value", "Catalog ID", "Est. unit price (USD)", "Vendor", "Link"]

#: Component type -> catalog id for the types whose ids differ from the type name.
TYPE_TO_CATALOG = {
    "uno": "arduino_uno",
    "nano": "arduino_nano",
    "esp32": "esp32_devkit_v1",
    "esp32s3": "esp32_s3",
    "potentiometer": "potentiometer_10k",
    "diode": "diode_1n4007",
    "transistor_npn": "transistor_2n2222",
    "servo": "servo_sg90",
    "neopixel_ring": "neopixel_ring_12",
    "ultrasonic_hcsr04": "hcsr04",
}

#: Readable fallback names for catalog ids missing from content/catalog.json.
FALLBACK_NAMES = {
    "arduino_uno": "Arduino Uno R3",
    "arduino_nano": "Arduino Nano",
    "esp32_devkit_v1": "ESP32 DevKit V1",
    "esp32_s3": "ESP32-S3 DevKitC",
    "breadboard_half": "Breadboard, half size (400 tie points)",
    "breadboard_full": "Breadboard, full size (830 tie points)",
    "jumper_wires": "Jumper wire set (male-male)",
    "potentiometer_10k": "Potentiometer 10 k",
    "diode_1n4007": "Rectifier diode 1N4007",
    "transistor_2n2222": "NPN transistor 2N2222",
    "servo_sg90": "Micro servo SG90",
    "neopixel_ring_12": "NeoPixel ring, 12 x WS2812B",
    "hcsr04": "Ultrasonic sensor HC-SR04",
}


def _format_ohms(ohms: float) -> str:
    """220 -> ``220 Ohm``; 4700 -> ``4.7 kOhm``; 100000 -> ``100 kOhm``."""
    value = float(ohms)
    if value >= 1000:
        k = value / 1000
        text = f"{k:.1f}".rstrip("0").rstrip(".")
        return f"{text} kOhm"
    text = f"{value:.0f}" if value == int(value) else f"{value}"
    return f"{text} Ohm"


def catalog_id_for(component: dict) -> str:
    """Catalog id for one CircuitDoc component (docs/API.md mapping)."""
    ctype = str(component.get("type") or "unknown")
    props = component.get("props") if isinstance(component.get("props"), dict) else {}
    if ctype == "resistor":
        try:
            ohms = int(round(float(props.get("ohms", 220))))
        except (TypeError, ValueError):
            ohms = 220
        return f"resistor_{ohms}"
    if ctype == "led":
        color = str(props.get("color") or "red")
        return f"led_{color}"
    return TYPE_TO_CATALOG.get(ctype, ctype)


def value_for(component: dict) -> str:
    """Human-readable value column (resistance, colour, pixel count, address)."""
    ctype = str(component.get("type") or "")
    props = component.get("props") if isinstance(component.get("props"), dict) else {}
    if ctype in ("resistor", "trimpot") and props.get("ohms") is not None:
        try:
            return _format_ohms(props["ohms"])
        except (TypeError, ValueError):
            return str(props["ohms"])
    if props.get("color"):
        return str(props["color"])
    if props.get("count") is not None:
        return f"{props['count']} px"
    if props.get("addr"):
        return str(props["addr"])
    if props.get("uf") is not None:
        return f"{props['uf']} uF"
    return ""


def _fallback_name(catalog_id: str) -> str:
    if catalog_id in FALLBACK_NAMES:
        return FALLBACK_NAMES[catalog_id]
    if catalog_id.startswith("resistor_"):
        return f"Resistor {_format_ohms(catalog_id.removeprefix('resistor_'))} 1/4 W"
    if catalog_id.startswith("led_"):
        return f"{catalog_id.removeprefix('led_').capitalize()} LED 5 mm"
    return catalog_id.replace("_", " ").strip().capitalize()


def _breadboard_ids(board_mode: str) -> list[str]:
    """Breadboard catalog ids implied by ``boardMode``."""
    if board_mode == "full":
        return ["breadboard_full"]
    if board_mode == "dual":
        return ["breadboard_half", "breadboard_half"]
    return ["breadboard_half"]


def build_rows(circuit: dict[str, Any]) -> list[dict]:
    """Grouped BOM rows for a CircuitDoc, in a stable, readable order."""
    catalog = content.get_catalog()
    circuit = circuit if isinstance(circuit, dict) else {}
    components = circuit.get("components") if isinstance(circuit.get("components"), list) else []
    wires = circuit.get("wires") if isinstance(circuit.get("wires"), list) else []

    grouped: dict[tuple[str, str], dict] = {}
    order: list[tuple[str, str]] = []

    def add(catalog_id: str, value: str = "") -> None:
        key = (catalog_id, value)
        if key not in grouped:
            entry = catalog.get(catalog_id) or {}
            vendors = entry.get("vendors") if isinstance(entry.get("vendors"), list) else []
            vendor = vendors[0] if vendors and isinstance(vendors[0], dict) else {}
            try:
                price = round(float(entry.get("unitPriceUsd", 0) or 0), 2)
            except (TypeError, ValueError):
                price = 0.0
            grouped[key] = {
                "qty": 0,
                "part": str(entry.get("name") or _fallback_name(catalog_id)),
                "value": value,
                "catalog_id": catalog_id,
                "unit_price_usd": price,
                "vendor": str(vendor.get("name") or ""),
                "link": str(vendor.get("url") or ""),
            }
            order.append(key)
        grouped[key]["qty"] += 1

    if circuit.get('kind') == 'drone':
        from app.domain.drone import validate_drone
        from .drone_bom import items
        validate_drone(circuit, circuit.get('mcu'))
        for cid, value in items(circuit):
            add(cid, value)
        return [grouped[key] for key in order]
    for cid in _breadboard_ids(str(circuit.get("boardMode") or "half")):
        add(cid)
    for component in components:
        if isinstance(component, dict) and component.get("type"):
            add(catalog_id_for(component), value_for(component))
    if wires:
        add("jumper_wires")

    return [grouped[key] for key in order]


def total_usd(rows: list[dict]) -> float:
    """Sum of ``qty x unit price`` across all rows, rounded to cents."""
    return round(sum(float(r["unit_price_usd"]) * int(r["qty"]) for r in rows), 2)


def rows_to_csv(rows: list[dict]) -> str:
    """Render BOM rows as a CSV document with the binding column header."""
    buf = io.StringIO(newline="")
    writer = csv.writer(buf, lineterminator="\r\n")
    writer.writerow(BOM_COLUMNS)
    for row in rows:
        writer.writerow(
            [
                row["qty"],
                row["part"],
                row["value"],
                row["catalog_id"],
                f"{float(row['unit_price_usd']):.2f}",
                row["vendor"],
                row["link"],
            ]
        )
    return buf.getvalue()

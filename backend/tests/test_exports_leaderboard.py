"""BOM exports and the leaderboard."""

from __future__ import annotations

import csv
import io

CIRCUIT = {
    "version": 1,
    "boardMode": "half",
    "mcu": "uno",
    "components": [
        {"id": "c_uno", "type": "uno", "props": {}},
        {"id": "c_led1", "type": "led", "props": {"color": "red"}},
        {"id": "c_led2", "type": "led", "props": {"color": "red"}},
        {"id": "c_r1", "type": "resistor", "props": {"ohms": 220}},
        {"id": "c_hc", "type": "ultrasonic_hcsr04", "props": {}},
    ],
    "wires": [{"id": "w_1", "from": "c_uno:D13", "to": "bb1:e12", "color": "red"}],
}


def _csv_rows(text: str) -> list[list[str]]:
    return list(csv.reader(io.StringIO(text)))


def test_bom_csv(client):
    res = client.post("/api/export/bom", json={"circuit": CIRCUIT})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert 'filename="bom.csv"' in res.headers["content-disposition"]

    rows = _csv_rows(res.text)
    assert rows[0] == ["Qty", "Part", "Value", "Catalog ID", "Est. unit price (USD)", "Vendor", "Link"]
    by_id = {r[3]: r for r in rows[1:]}

    assert by_id["breadboard_half"][0] == "1"
    assert by_id["arduino_uno"][1] == "Arduino Uno R3"
    assert by_id["led_red"][0] == "2", "identical parts group into a quantity"
    assert by_id["led_red"][2] == "red"
    assert by_id["resistor_220"][2] == "220 Ohm"
    assert by_id["resistor_220"][5:] == ["Mouser", "https://example.test/r220"]
    assert by_id["hcsr04"][0] == "1", "ultrasonic_hcsr04 maps to the hcsr04 catalog id"
    assert by_id["hcsr04"][4] == "0.00", "catalog misses hold a generic zero-price row"
    assert by_id["jumper_wires"][0] == "1"


def test_bom_json_totals(client):
    body = client.post("/api/export/bom.json", json={"circuit": CIRCUIT}).json()
    prices = {r["catalog_id"]: (r["qty"], r["unit_price_usd"]) for r in body["rows"]}
    assert prices["led_red"] == (2, 0.12)
    expected = 4.5 + 24.0 + 2 * 0.12 + 0.05 + 6.0
    assert body["total_usd"] == round(expected, 2)


def test_bom_breadboards_follow_board_mode(client):
    single = client.post("/api/export/bom.json", json={"circuit": {"boardMode": "full", "components": []}}).json()
    assert [(r["catalog_id"], r["qty"]) for r in single["rows"]] == [("breadboard_full", 1)]

    dual = client.post("/api/export/bom.json", json={"circuit": {"boardMode": "dual", "components": []}}).json()
    assert [(r["catalog_id"], r["qty"]) for r in dual["rows"]] == [("breadboard_half", 2)]

    assert all(r["catalog_id"] != "jumper_wires" for r in dual["rows"]), "no wires -> no jumper line"


def test_leaderboard_orders_by_xp(client):
    def make(stars_by_level):
        token = client.post("/api/players/guest").json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        for level_id, stars, objectives in stars_by_level:
            client.post(
                f"/api/progress/{level_id}/complete",
                json={"stars": stars, "objectives_passed": objectives},
                headers=headers,
            )
        return client.get("/api/players/me", headers=headers).json()

    low = make([("w1-l2", 1, ["resistor"])])
    high = make([("w1-l1", 3, ["led_present", "led_lit"]), ("w1-l2", 2, ["resistor"])])
    make([])  # a zero-XP guest must not appear

    items = client.get("/api/leaderboard", params={"limit": 5}).json()["items"]
    assert [i["display_name"] for i in items] == [high["display_name"], low["display_name"]]
    assert items[0]["xp"] == 150 + 113
    assert items[0]["levels_completed"] == 2
    assert items[0]["total_stars"] == 5
    assert items[1]["xp"] == 90 and items[1]["level"] == 1

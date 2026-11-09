"""Shared builders for the networking course data (content/networking.json).

Lab topologies use the compact format read by frontend/src/engine/network/lab.js and the goal and
solution formats of frontend/src/engine/network/checks.js. The contract test that replays every
example and solves every lab is frontend/src/features/networking/networkingContent.test.js.
"""


def lines(*rows):
    """Join transcript or table rows into one example string."""
    return "\n".join(rows)


def question(qid, prompt, options, answer, explanation, lesson=None):
    """A multiple-choice question with options a, b and c."""
    assert len(options) == 3, qid
    item = {
        "id": qid,
        "prompt": prompt,
        "options": [{"id": key, "text": text} for key, text in zip("abc", options)],
        "answerId": answer,
        "explanation": explanation,
    }
    if lesson:
        item["lessonId"] = lesson
    return item


def lesson(lid, title, paragraphs, device, example, pitfall, check):
    return {
        "id": lid,
        "title": title,
        "paragraphs": paragraphs,
        "exampleDevice": device,
        "example": example,
        "pitfall": pitfall,
        "question": check,
    }


def host(ip="", mask="", gateway="", dns="", mode="static"):
    """IP settings for a PC or server, as typed in its IP configuration."""
    return {"ipMode": mode, "ip": ip, "mask": mask, "gateway": gateway, "dns": dns}


def dhcp_client():
    return host(mode="dhcp")


def device(name, kind, x, y, settings=None, services=None, config=None):
    """One lab device. `config` is router/switch CLI typed from user EXEC."""
    item = {"name": name, "type": kind, "x": x, "y": y}
    if settings is not None:
        item["host"] = settings
    if services is not None:
        item["services"] = services
    if config:
        item["config"] = config
    return item


def web(page, records=None):
    """Server services: a web page, and optionally DNS A records as (name, ip) pairs."""
    return {
        "http": {"enabled": True, "page": page},
        "dns": {"enabled": bool(records), "records": [{"name": n, "ip": ip} for n, ip in (records or [])]},
    }


def rfc(number, title):
    return {"title": f"RFC {number}: {title}", "url": f"https://www.rfc-editor.org/rfc/rfc{number}"}


IEEE_8023 = {"title": "IEEE 802.3-2022: IEEE Standard for Ethernet", "url": "https://standards.ieee.org/ieee/802.3/10422/"}
IEEE_8021Q = {
    "title": "IEEE 802.1Q-2022: Bridges and Bridged Networks (VLAN tagging and spanning tree)",
    "url": "https://standards.ieee.org/ieee/802.1Q/10323/",
}
NIST_80041 = {
    "title": "NIST SP 800-41 Rev. 1: Guidelines on Firewalls and Firewall Policy",
    "url": "https://csrc.nist.gov/pubs/sp/800/41/r1/final",
}

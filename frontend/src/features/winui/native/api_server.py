"""Disposable local API for the C++/WinUI course. Python 3, standard library only.

Run: python api_server.py
HTTP on 127.0.0.1:8766 only. Tasks live in memory and reset when restarted.
This is a practice fixture, not an authenticated production service.
"""
import argparse
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class PracticeAPI(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port=8766, slow_seconds=15):
        super().__init__(("127.0.0.1", port), Handler)
        self.tasks = [{"id": 1, "title": "Learn native HTTP"}]
        self.lock = threading.Lock()
        self.slow_seconds = slow_seconds


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def log_message(self, *_args):
        pass

    def send(self, status, value, media_type="application/json", raw=False):
        body = value if raw else json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", media_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass  # Expected when the client cancels the slow fixture.

    def do_GET(self):
        if self.path in ("/tasks", "/slow"):
            if self.path == "/slow":
                time.sleep(self.server.slow_seconds)
            with self.server.lock:
                snapshot = [dict(item) for item in self.server.tasks]
            return self.send(200, {"tasks": snapshot})
        fixtures = {
            "/unauthorized": (401, {"error": "Sign-in required (fixture only)"}),
            "/server-error": (503, {"error": "Temporarily unavailable"}),
            "/invalid-schema": (200, {"tasks": [{"id": 1, "title": 42}]}),
            "/oversized": (200, {"padding": "x" * (65 * 1024)}),
        }
        if self.path in fixtures:
            return self.send(*fixtures[self.path])
        if self.path == "/invalid-json":
            return self.send(200, b'{"tasks":', raw=True)
        if self.path == "/wrong-type":
            return self.send(200, b"<p>This is HTML</p>", "text/html", raw=True)
        return self.send(404, {"error": "Route not found"})

    def do_POST(self):
        if self.path != "/tasks":
            return self.send(404, {"error": "Route not found"})
        if self.headers.get("Transfer-Encoding"):
            return self.send(400, {"error": "Use Content-Length in this fixture"})
        if self.headers.get("Content-Type", "").split(";")[0].strip().lower() != "application/json":
            return self.send(415, {"error": "Use application/json"})
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            return self.send(400, {"error": "Content-Length required"})
        if not 1 <= length <= 4096:
            return self.send(413, {"error": "Request must be 1..4096 bytes"})
        try:
            raw = self.rfile.read(length)
            if len(raw) != length:
                return self.send(400, {"error": "Incomplete request"})
            data = json.loads(raw.decode("utf-8"))
            title = data.get("title") if isinstance(data, dict) else None
            if not isinstance(title, str):
                raise ValueError("title must be a string")
            units = len(title.encode("utf-16-le")) // 2
            if not 1 <= units <= 80 or title != title.strip(" \t") or any(ord(c) < 32 or ord(c) == 127 for c in title):
                raise ValueError("title must be trimmed and 1..80 UTF-16 units without control characters")
        except (ValueError, UnicodeError):
            return self.send(400, {"error": "Invalid JSON task title"})
        with self.server.lock:
            if len(self.server.tasks) >= 100:
                return self.send(409, {"error": "The 100-task limit is reached"})
            task = {"id": len(self.server.tasks) + 1, "title": title}
            self.server.tasks.append(task)
        self.send(201, task)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()
    with PracticeAPI(args.port) as server:
        print(f"Practice API: http://127.0.0.1:{server.server_port}/tasks", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

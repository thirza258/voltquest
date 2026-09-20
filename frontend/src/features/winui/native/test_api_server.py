"""Run with: python -m unittest -v test_api_server.py"""
import http.client
import json
import os
from pathlib import Path
import subprocess
import threading
import time
import unittest
from api_server import PracticeAPI


class APITests(unittest.TestCase):
    def setUp(self):
        self.server = PracticeAPI(port=0, slow_seconds=0.15)
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def request(self, method="GET", path="/tasks", body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        try:
            conn.request(method, path, body=body, headers=headers or {})
            response = conn.getresponse()
            return response.status, response.read(), dict(response.getheaders())
        finally:
            conn.close()

    def post(self, title):
        return self.request("POST", body=json.dumps({"title": title}).encode(), headers={"Content-Type": "application/json"})

    def test_get_initial_state_and_no_store(self):
        status, body, headers = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"tasks": [{"id": 1, "title": "Learn native HTTP"}]})
        self.assertEqual(headers["Cache-Control"], "no-store")

    def test_post_escaped_unicode_title_and_get_readback(self):
        title = 'C++ "fetch" \\ café 🚀'
        status, body, _ = self.post(title)
        self.assertEqual(status, 201)
        self.assertEqual(json.loads(body), {"id": 2, "title": title})
        self.assertEqual(json.loads(self.request()[1])["tasks"][-1]["title"], title)

    def test_http_error_statuses_remain_errors(self):
        for route, status in [("/missing", 404), ("/unauthorized", 401), ("/server-error", 503)]:
            with self.subTest(route=route):
                self.assertEqual(self.request(path=route)[0], status)
        self.assertEqual(self.request("POST", "/missing")[0], 404)

    def test_invalid_json_and_schema_fixtures(self):
        status, raw, _ = self.request(path="/invalid-json")
        self.assertEqual(status, 200)
        with self.assertRaises(json.JSONDecodeError):
            json.loads(raw)
        self.assertIsInstance(json.loads(self.request(path="/invalid-schema")[1])["tasks"][0]["title"], int)

    def test_wrong_media_and_oversized_fixtures(self):
        self.assertTrue(self.request(path="/wrong-type")[2]["Content-Type"].startswith("text/html"))
        status, body, headers = self.request(path="/oversized")
        self.assertEqual(status, 200)
        self.assertGreater(len(body), 64 * 1024)
        self.assertEqual(int(headers["Content-Length"]), len(body))

    def test_invalid_titles_preserve_state(self):
        for title in ["", " edge", "edge ", "line\nbreak", "nul\x00value", "x" * 81, 42, None, "\ud800"]:
            with self.subTest(title=repr(title)):
                self.assertEqual(self.post(title)[0], 400)
        self.assertEqual(len(json.loads(self.request()[1])["tasks"]), 1)

    def test_utf16_length_boundary(self):
        self.assertEqual(self.post("🚀" * 40)[0], 201)
        self.assertEqual(self.post("🚀" * 41)[0], 400)

    def test_invalid_json_and_request_media(self):
        self.assertEqual(self.request("POST", body=b'{"title":', headers={"Content-Type": "application/json"})[0], 400)
        self.assertEqual(self.request("POST", body=b"title=a", headers={"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.request("POST", body=b"[]", headers={"Content-Type": "application/json"})[0], 400)

    def test_request_byte_limit(self):
        self.assertEqual(self.request("POST", body=b"x" * 4097, headers={"Content-Type": "application/json"})[0], 413)
        self.assertEqual(self.request("POST", body=b"", headers={"Content-Type": "application/json"})[0], 413)

    def test_task_limit_keeps_accepted_state(self):
        for index in range(99):
            self.assertEqual(self.post(f"Task {index}")[0], 201)
        self.assertEqual(self.post("One too many")[0], 409)
        self.assertEqual(len(json.loads(self.request()[1])["tasks"]), 100)

    def test_slow_request_and_disconnect_leave_server_usable(self):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=1)
        conn.request("GET", "/slow")
        conn.close()
        self.assertEqual(self.request()[0], 200)
        started = time.monotonic()
        self.assertEqual(self.request(path="/slow")[0], 200)
        self.assertGreaterEqual(time.monotonic() - started, 0.1)

    def test_actual_fetch_companion_creates_and_reads_back(self):
        env = {**os.environ, "VQ_API_BASE": f"http://127.0.0.1:{self.server.server_port}"}
        result = subprocess.run([env.get("VQ_NODE", "node"), str(Path(__file__).with_name("fetch-demo.mjs"))], env=env,
                                check=True, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.stdout.splitlines(), ["GET: 1 task(s)", "POST: 2 Created with fetch", "GET readback: 2 task(s)"])
        self.assertEqual(json.loads(self.request()[1])["tasks"][-1]["title"], "Created with fetch")


if __name__ == "__main__":
    unittest.main()

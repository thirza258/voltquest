"""Local native Qt lesson fixture. Run explicitly; Ctrl+C stops it."""
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        ok = self.path == '/tasks'
        data = json.dumps({'message': 'Hello from the local Qt fixture' if ok else 'Not found'}).encode()
        self.send_response(200 if ok else 404)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

if __name__ == '__main__':
    print('Qt fixture: http://127.0.0.1:8765/tasks (Ctrl+C to stop)', flush=True)
    HTTPServer(('127.0.0.1', 8765), Handler).serve_forever()

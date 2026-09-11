#!/usr/bin/env bash
# Runs the API (uvicorn --reload) and the web client (vite) together.
# Web:  http://localhost:5173   API:  http://localhost:8000/api/health
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-5173}"
pids=()

cleanup() {
  trap - EXIT INT TERM
  for pid in "${pids[@]:-}"; do
    [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [ ! -x "$ROOT/backend/.venv/bin/uvicorn" ]; then
  echo "backend/.venv is missing. Create it with:"
  echo "  python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt"
  exit 1
fi

echo "==> API on http://localhost:$API_PORT"
(cd "$ROOT/backend" && .venv/bin/uvicorn app.main:app --reload --port "$API_PORT") &
pids+=($!)

echo "==> Web on http://localhost:$WEB_PORT"
(cd "$ROOT/frontend" && VITE_PROXY_TARGET="http://localhost:$API_PORT" npx vite --port "$WEB_PORT") &
pids+=($!)

# bash 3.2 has no `wait -n`; poll so that either process exiting stops the other.
while kill -0 "${pids[0]}" 2>/dev/null && kill -0 "${pids[1]}" 2>/dev/null; do
  sleep 1
done
echo '==> one process exited; shutting the other down'

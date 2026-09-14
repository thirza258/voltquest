#!/usr/bin/env bash
# Full verification gate: frontend lint + tests + build (with an initial-payload budget)
# followed by the backend test suite. Exits non-zero on the first failure.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"

# PRD NFR: initial load under 3 s on 15 Mbps. Monaco and Blockly are lazy chunks,
# so only what index.html pulls eagerly counts against this budget.
BUDGET_KB="${INITIAL_JS_BUDGET_KB:-1500}"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

step "frontend: eslint"
(cd "$FRONTEND" && npx eslint src)

step "frontend: vitest"
(cd "$FRONTEND" && npx vitest run)

step "frontend: vite build"
(cd "$FRONTEND" && npx vite build)

step "frontend: initial JS payload budget (${BUDGET_KB} kB gzipped)"
(
  cd "$FRONTEND"
  index="dist/index.html"
  [ -f "$index" ] || { echo "missing $index"; exit 1; }

  # Scripts and modulepreloads in index.html are the eager payload; everything
  # else in dist/assets is fetched on demand. (Plain while-read: macOS ships bash 3.2,
  # which has no `mapfile`.)
  eager=$(grep -oE '(src|href)="/assets/[^"]+\.js"' "$index" | sed -E 's/.*"\/assets\/(.*)"/assets\/\1/' | sort -u)
  if [ -z "$eager" ]; then echo "could not find any eager JS in $index"; exit 1; fi

  total=0
  while IFS= read -r asset; do
    [ -n "$asset" ] || continue
    case "$asset" in
      assets/monaco-*|assets/blockly-*|assets/VirtualPhone-*|assets/three-*|assets/Circuit3DView-*|assets/hpc-model-*|assets/HpcPage-*)
        echo "FAIL: $asset must load lazily, but index.html requests it eagerly."
        exit 1
        ;;
    esac
    [ -f "dist/$asset" ] || { echo "referenced but missing: dist/$asset"; exit 1; }
    size=$(gzip -9 -c "dist/$asset" | wc -c | tr -d ' ')
    printf '  %-48s %8.1f kB\n' "$asset" "$(echo "$size" | awk '{print $1/1024}')"
    total=$((total + size))
  done <<EOF_ASSETS
$eager
EOF_ASSETS

  total_kb=$(echo "$total" | awk '{printf "%.1f", $1/1024}')
  echo "  ---"
  printf '  %-48s %8s kB\n' "initial payload (gzipped)" "$total_kb"
  if [ "$total" -gt $((BUDGET_KB * 1024)) ]; then
    echo "FAIL: initial payload ${total_kb} kB exceeds the ${BUDGET_KB} kB budget."
    echo "      Keep Monaco, Blockly and the Virtual Phone behind React.lazy."
    exit 1
  fi
)

step "backend: pytest"
if [ -x "$BACKEND/.venv/bin/python" ]; then
  (cd "$BACKEND" && .venv/bin/python -m pytest -q)
elif command -v python3 >/dev/null; then
  echo "no backend/.venv — falling back to system python3"
  (cd "$BACKEND" && python3 -m pytest -q)
else
  echo "SKIP: no python available"
fi

printf '\n\033[1;32mAll checks passed.\033[0m\n'

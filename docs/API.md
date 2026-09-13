# Backend API (FastAPI) — base path `/api`

Auth: JWT bearer (`Authorization: Bearer <token>`), HS256, 30-day expiry, payload `{ sub: player_id, iat, exp }`.
Errors: FastAPI default `{ "detail": "..." }`. All timestamps ISO-8601 UTC. IDs are UUID4 strings.
CORS: origins from `CORS_ORIGINS` (default `http://localhost:5173,http://localhost:8080`).

## Health
`GET /api/health` → `{ "status": "ok", "version": "1.0.0", "db": "ok", "levels": 14 }`

## Players & auth
- `POST /api/players/guest` → 201 `{ token, player }` — creates an anonymous player with `display_name` like `Cadet-4f3a`.
- `GET /api/players/me` (auth) → `Player`
- `PATCH /api/players/me` (auth) `{ display_name?, settings?: { audio?, skin?, wire_palette?, monitor_baud? } }` → `Player` (422 when `skin`/`wire_palette` is not yet unlocked for the player's level)
- `POST /api/players/claim` (auth) `{ username, password }` → `Player` — attaches credentials to the guest (409 if username taken, 400 if already claimed; username 3–24 `[a-z0-9_]`, password ≥ 6).
- `POST /api/auth/login` `{ username, password }` → `{ token, player }` (401 on bad credentials).
```
Player { id, display_name, username: string|null, xp, level, xp_into_level, xp_for_next, unlocked: { skins: [...], wire_palettes: [...] }, settings: { audio, skin, wire_palette }, created_at, stats: { levels_completed, total_stars, projects } }
```
XP → level: cumulative `xp_for_level(n) = 100*(n-1)*n/2` (level 1 at 0, level 2 at 100, level 3 at 300). Unlocks from `content/cosmetics.json` (`unlockLevel <= level`). Completion XP: `xp_for_completion(level_xp, stars, prev_stars) = round(level_xp*(1+0.25*(stars-1))) - round(level_xp*(1+0.25*(prev_stars-1)))` (prev_stars 0 → full amount). Mirrors `frontend/src/lib/xp.js`.

## Quests (public)
- `GET /api/quests` → `{ worlds: [ { ...world, levels: [ LevelSummary ] } ] }`; `LevelSummary { id, worldId, order, title, codeName, board, xp, estimatedMinutes, summary, concepts }`
- `GET /api/quests/{level_id}` → full level JSON (404 if unknown)

## Progress (auth)
- `GET /api/progress` → `{ progress: { [levelId]: { stars, xp_earned, attempts, hint_tier_max, completed_at, best_code_lines, solution: { circuit, code } | null } } }`
- `POST /api/progress/{level_id}/attempt` `{ hint_tier?: 0..3 }` → `{ attempts, hint_tier_max }`
- `POST /api/progress/{level_id}/complete` `{ stars: 1..3, objectives_passed: [ids], code_lines, component_count, damage_count, duration_ms, code?, circuit? }`
  → validates: level exists; `objectives_passed` ⊇ all objective ids of the level (else 422); stars ∈ 1..3.
  XP per `xp_for_completion` above; stars never decrease; `solution` (≤ 200 kB) stored when provided.
  → `{ progress: {...}, player: Player, xp_gained, level_up: bool, newly_unlocked: { skins:[], wire_palettes:[] } }`

## Projects (auth; sandbox saves)
Supported `board` ids: `uno`, `nano`, `esp32`, `esp32s3`, `raspberrypi4`, `raspberrypi5`.
Unknown ids return 422. The board must match `circuit.mcu` when present and any controller component;
at most one controller is allowed. Partial updates validate the merged document before saving.
Raspberry Pi projects require `editor_mode: 'text'` because they contain Python, not Arduino blocks.
`code`, `blockly_xml`, and serialized `circuit` each have a 200 KiB UTF-8 limit on create/update.

- `GET /api/projects` → `{ projects: [ ProjectSummary ] }` (mine, newest first)
- `POST /api/projects` `{ name, description?, board, board_mode, circuit, code, blockly_xml?, editor_mode?: 'text'|'blocks', thumbnail?: dataURL(≤200 kB) }` → 201 `Project`
- `GET /api/projects/{id}` → `Project` (owner only; 404 otherwise)
- `PUT /api/projects/{id}` (same body, partial) → `Project`
- `DELETE /api/projects/{id}` → 204
- `POST /api/projects/{id}/publish` `{ publish: true|false }` → `Project` (sets `share_slug` 8 chars, `is_public`)
```
Project { id, owner_id, owner_name, name, description, board, board_mode, circuit, code, blockly_xml, editor_mode, thumbnail, is_public, share_slug, forked_from: slug|null, views, forks, created_at, updated_at }
ProjectSummary = Project without circuit/code/blockly_xml
```

## Showcase (public read, auth for fork)
- `GET /api/showcase?sort=recent|popular&q=&board=&limit=24&offset=0` → `{ items: [ ProjectSummary ], total }` (public only)
- `GET /api/showcase/{slug}` → `Project` (increments `views`)
- `POST /api/showcase/{slug}/fork` (auth) → 201 `Project` (copy owned by caller, `forked_from = slug`, name "Fork of …"; increments source `forks`)

## Exports
- `POST /api/export/bom` `{ circuit: CircuitDoc }` → `text/csv` attachment `bom.csv` with columns `Qty,Part,Value,Catalog ID,Est. unit price (USD),Vendor,Link`. Component→catalog mapping via `content/catalog.json` (mapping: `resistor` → `resistor_<ohms>`, `nano` → `arduino_nano`, `esp32s3` → `esp32_s3`, `potentiometer` → `potentiometer_10k`, `diode` → `diode_1n4007`, `transistor_npn` → `transistor_2n2222`, `servo` → `servo_sg90`, `neopixel_ring` → `neopixel_ring_12`, `ultrasonic_hcsr04` → `hcsr04`, others → same name; , `led` → `led_<color>`, `uno` → `arduino_uno`, `esp32` → `esp32_devkit_v1`, breadboards from `boardMode`, plus one `jumper_wires` line when wires exist). Unknown catalog ids get a generic row.
- `POST /api/export/bom.json` same input → `{ rows: [...] , total_usd }` (used by the UI table).

## Leaderboard (public)
- `GET /api/leaderboard?limit=20` → `{ items: [ { display_name, xp, level, total_stars, levels_completed } ] }`

## Boards and tutorials (public)
- `GET /api/boards` → `{ boards: [{ id, name, family, language, logic_voltage, adc_bits, simulation }] }`.
  `simulation` is `arduino-subset` or `python-gpio-subset`; Raspberry Pi has no built-in ADC.
- `GET /api/tutorials?board=&difficulty=&q=` → `{ tutorials: [...], total }`.
  Difficulty: `Easy`, `Intermediate`, `Hard`; results follow that progression, then authored order.
- `GET /api/tutorials/{tutorial_id}` → full tutorial, including explanations, steps, code and board-specific
  code overrides (404 if missing). See `TUTORIALS.md` and `RASPBERRY_PI.md` for the content/runtime contracts.

## Models (SQLAlchemy)
players(id, display_name, username unique null, password_hash null, xp int, settings json, created_at), progress(id, player_id fk, level_id, stars, xp_earned, attempts, hint_tier_max, best_code_lines, solution json null, completed_at null, unique(player_id, level_id)),
projects(id, owner_id fk, name, description, board, board_mode, circuit json, code text, blockly_xml text null, editor_mode, thumbnail text, is_public bool, share_slug unique null, forked_from null, views, forks, created_at, updated_at).
JSON columns: use `sqlalchemy.JSON` (works on SQLite and Postgres).
Env: `DATABASE_URL` (default `sqlite:///./voltquest.db`), `JWT_SECRET` (default dev secret + startup warning), `CONTENT_DIR` (default `../content`), `CORS_ORIGINS`.

## Public self-study courses (2026-09-13)

- `GET /api/courses?track=&difficulty=&q=` → `{ tracks, courses, total }` in track/course order.
  Difficulty is `Fundamental|Intermediate`; track ids come from `content/courses.json`; search is
  case-insensitive over titles, summaries and lesson titles (maximum 200 characters).
- `GET /api/courses/{course_id}` → complete course or 404. Invalid filters return 422.

Both endpoints are public. Missing content returns an empty catalog. Answer keys and explanations
are public study material. Assessment progress is browser-local; there is no server grading or XP.
`api.courses.list(params)` and `api.courses.get(id)` expose the endpoints in the frontend API client.

## AI assistant (2026-09-12 extension)

- `GET /api/assistant/status` (public) → `{ enabled: boolean }`; exposes no provider credentials.
- `POST /api/assistant/chat` (player auth, guests allowed) → `{ answer: string }`.
  Request: `{ question: string(1..2000), locale?: 'en'|'id', history?: [{role:'user'|'assistant',
  content:string(1..12000)}] (max 8), context: AssistantContext }`. Default locale is English.
  Context: `{ mode:'campaign'|'tutorial'|'sandbox'|'showcase', title:string(≤200), board:object,
  code:string(≤24000), circuit:object, selection?:object[](≤20), simulation?:object,
  lesson?:object|null, truncated?:string[](≤30) }`; serialized UTF-8 context ≤96 KiB.
  Extra top-level fields and system-role history are rejected (422).

The adapter in `api/routes/assistant.py` calls `services/assistant.py`, which uses `AsyncOpenAI`
with `AI_BASE_URL` (default `https://openrouter.ai/api/v1`), `AI_MODEL` (default
`openai/gpt-4.1-mini`) and server-only `OPENROUTER_API_KEY` (`AI_API_KEY` alias). Model output
is capped at 1,600 completion tokens, the SDK has no automatic retries, and the service deadline
is 45 seconds. No chat/snapshot database storage or code execution occurs on this path.
Per-process limits are 10/player/minute, 60/minute globally, one active/player and four active total.
Errors: 503 `assistant_not_configured`, 429 `assistant_rate_limited`, 504 `assistant_timeout`,
502 `assistant_provider_error` / `assistant_invalid_response`. Provider errors never expose keys.

## MCP credentials and context (player auth)

- `GET /api/assistant/mcp/access` → `{ enabled, expires_at: string|null }`.
- `POST /api/assistant/mcp/token` → `{ token, expires_at }` with `Cache-Control: no-store`.
  Issues an opaque `vq_mcp_` bearer token valid for 30 days, replacing the player's previous token.
- `DELETE /api/assistant/mcp/access` → 204; removes token hash and shared snapshot.
- `PUT /api/assistant/mcp/context` accepts the same validated body as chat (only `context` is
  stored) → `{ shared_at }`; requires active MCP access. Shared snapshots are readable for 24 hours.

Additive table: `agent_access(player_id PK/FK, token_hash unique, expires_at, context JSON nullable,
context_updated_at nullable)`. Only a SHA-256 hash of the token is persisted. Token lifetime and
context lifetime are independently checked; creating a new token does not extend snapshot freshness.

## MCP Streamable HTTP (separate MCP bearer auth)

`/api/mcp/` is mounted through `api/mcp.py` using official MCP Python SDK 1.x, stateless HTTP sessions
and JSON responses. The trailing slash is part of the client configuration. Invalid, expired or
revoked tokens return 401; player JWTs are not MCP credentials. Every tool rechecks ownership.
The MCP bearer cannot call ordinary account/project/paid-chat REST endpoints.

Tools: `get_project_guide()`, `get_board(board)`, `get_component(component_type)`,
`get_current_context()`, `list_projects()`, `get_project(project_id)`,
`create_project(name, board='uno', circuit?, code='', description='')`,
`update_project(project_id, expected_updated_at, changes)`.
Creation returns `{project, open_path}`; an omitted circuit produces a valid starter for any of
the six boards. Updates require the exact timestamp returned by `get_project`; stale writes return
a tool error and must re-read. Public projects cannot be changed through MCP. Normal project field
limits apply, plus complete version/layout, exactly one matching MCU, known properties/terminals,
valid footprint placement, at most 200 components and 400 wires. Invalid documents never mutate data.
MCP bodies are limited to 1 MiB. Expected domain failures are MCP tool errors, not HTTP 500 responses.

Tools are backed by `services/agent_access.py` and `services/agent_projects.py`; geometry/catalog
metadata is generated as `content/mcp-catalog.json` (see `ASSISTANT.md`). The endpoint checks Host
against `MCP_ALLOWED_HOSTS` and browser Origin against configured CORS origins, the deployed origin,
and standard loopback dev origins. Add deployment domains explicitly. No tool runs firmware,
executes shell commands, publishes, deletes projects, or changes the browser's unsaved document.

## Drone projects (additive)

The existing `/api/projects`, `/api/showcase` and `/api/exports` endpoints accept CircuitDoc
`kind:'drone'` on `esp32`/`esp32s3`. No migration, new authentication or firmware endpoint is added.
The payload retains `board_mode:'half'` but the document has empty breadboards/wires and uses named
mounts, typed links, `droneConfig`, `flight`, and `course`; see [DRONE.md](DRONE.md). Full project-field
UTF-8 limits and ownership rules still apply. Both document and project board/layout must agree.
Partial updates validate the merged project, including a board_mode-only patch, before any mutation.
Invalid numeric ranges, ids, mounts, connector types/endpoints, counts, environment or course geometry
return 422. Incomplete but structurally valid assemblies remain saveable for lessons.

`ProjectSummary`/`ProjectOut` add nullable `drone_config` (the stored specification for a drone, null
for a breadboard). Clients compute the spec-sheet estimates; derived figures are never trusted as
input or stored. Save/open, publish/preview, editable fork and ownership work through the same services.
Drone BOM rows use actual component counts and configured specifications, grouping four logical ESC
channels into one physical item for a 4-in-1 package.

MCP `get_project_guide()` adds a `drone` section with schema guidance, numeric field intervals, default
configuration, mounts and firmware notes. `get_component` returns drone mount/socket metadata.
Existing MCP project creation/update accepts complete valid drone documents; no new publish, delete
or run tool is exposed. Omitting the circuit still creates the usual breadboard starter.

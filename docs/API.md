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

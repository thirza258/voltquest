// Regenerate the shared API validation metadata after changing drone fields, ports or mounts.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CONFIG_FIELDS, DEFAULT_CONFIG, PRESETS, MODEL } from '../frontend/src/engine/drone/config.js'
import { DRONE_DEFS, MOUNTS } from '../frontend/src/engine/drone/document.js'
import { getBoard } from '../frontend/src/engine/boards/index.js'
const boardPorts = Object.fromEntries(['esp32', 'esp32s3'].map(id => [id, Object.fromEntries(getBoard(id).pins.map(p => [p.name, ['power', 'ground'].includes(p.kind) ? 'power' : 'gpio']))]))
const metadata = JSON.stringify({ fields: CONFIG_FIELDS, defaultConfig: DEFAULT_CONFIG, presets: PRESETS, model: MODEL, parts: DRONE_DEFS, mounts: MOUNTS, boardPorts }, null, 2) + "\n"
writeFileSync(fileURLToPath(new URL('../content/drone-catalog.json', import.meta.url)), metadata)
writeFileSync(fileURLToPath(new URL("../backend/app/domain/drone_catalog.json", import.meta.url)), metadata)

// Regenerate after changing board profiles, footprints, defaults or breadboard layouts.
import { writeFileSync } from 'node:fs'
import { BOARD_IDS, getBoard } from '../frontend/src/engine/boards/index.js'
import { defaultMcuPlacement, listDefs } from '../frontend/src/engine/components/registry.js'
import { layoutBreadboards } from '../frontend/src/engine/components/breadboard.js'

const modes = ['half', 'full', 'dual']
const catalog = {
  boards: Object.fromEntries(BOARD_IDS.map(id => [id, { ...getBoard(id), placements: Object.fromEntries(modes.map(mode => [mode, defaultMcuPlacement(id, mode)])) }])),
  components: Object.fromEntries(listDefs().map(def => [def.type, { name: def.name, type: def.type, mount: def.mount, category: def.category, footprint: def.footprint, props: def.props, learn: def.learn }])),
  layouts: Object.fromEntries(modes.map(mode => [mode, layoutBreadboards(mode)])),
}
writeFileSync(new URL('../content/mcp-catalog.json', import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`)

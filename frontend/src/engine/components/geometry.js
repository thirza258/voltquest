/**
 * Breadboard geometry primitives — CONTRACTS §3 (leaf module: imports nothing from the registry).
 *
 * `breadboard.js` re-exports everything here and adds `terminalPosition`, which needs the registry.
 * Keeping the pure geometry in a leaf module breaks the registry <-> breadboard import cycle.
 *
 * Long axis horizontal. Rows 1..N left→right; columns a–e (upper block) and f–j (lower block) top→bottom;
 * rails TP/TN above and BN/BP below. All positions are px at zoom 1 (PITCH = 24 px = 0.1 in).
 */

export const PITCH = 24
export const BREADBOARD_TYPES = { half: { rows: 30, tiePoints: 400 }, full: { rows: 63, tiePoints: 830 } }

/** Column letter → y index (in pitches). a→j spans 11 pitches, as on real boards. */
export const COLUMN_Y = { a: 4, b: 5, c: 6, d: 7, e: 8, f: 11, g: 12, h: 13, i: 14, j: 15 }
export const UPPER_COLUMNS = ['a', 'b', 'c', 'd', 'e']
export const LOWER_COLUMNS = ['f', 'g', 'h', 'i', 'j']
/** Rail name → { yIdx, polarity }. */
export const RAILS = {
  TP: { y: 1, rail: '+' },
  TN: { y: 2, rail: '-' },
  BN: { y: 17, rail: '-' },
  BP: { y: 18, rail: '+' },
}
const RAIL_NAMES = ['TP', 'TN', 'BN', 'BP']
const RAIL_GROUP_SIZE = 5
const RAIL_GROUP_STRIDE = 6
const HEIGHT_PITCHES = 20
/** Vertical gap between bb1 and bb2 in dual mode (bb1 row j → bb2 row a = 10 pitches). */
export const DUAL_OFFSET_Y = 21 * PITCH

/**
 * @typedef Hole
 * @property {string} name        'e12' | 'TP7'
 * @property {number} x           local px (board origin = top-left)
 * @property {number} y
 * @property {string} strip       'row12:upper' | 'row12:lower' | 'TP' | 'TN' | 'BN' | 'BP'
 * @property {'main'|'rail'} kind
 * @property {'+'|'-'|null} rail
 * @property {number} row         1-based row for main holes; the aligned row for rail holes
 * @property {string|null} column 'a'..'j' for main holes, null for rails
 */

/** x of a hole in row `row` (1-based). */
function rowX(row) {
  return (1.5 + (row - 1)) * PITCH
}

/** Row aligned with rail hole `k` (1-based): groups of 5 at rows 2..6, 8..12, ... */
function railHoleRow(k) {
  return 2 + RAIL_GROUP_STRIDE * Math.floor((k - 1) / RAIL_GROUP_SIZE) + ((k - 1) % RAIL_GROUP_SIZE)
}

function railHoleCount(rows) {
  // A rail group g (0-based) occupies rows 6g+2 .. 6g+6, so it fits while 6g+6 <= rows.
  // Complete groups = floor(rows / 6): 30 rows -> 5 groups (25 holes), 63 rows -> 10 groups (50 holes).
  return RAIL_GROUP_SIZE * Math.floor(rows / RAIL_GROUP_STRIDE)
}

/** Per-type memo: { holes, byName, byGrid } where byGrid is keyed `${row},${yIdx}`. */
const geometryCache = new Map()

function geometry(type) {
  const cached = geometryCache.get(type)
  if (cached) return cached
  const spec = BREADBOARD_TYPES[type]
  if (!spec) return null
  const holes = []
  const byName = new Map()
  const byGrid = new Map()
  const add = (hole, row, yIdx) => {
    holes.push(hole)
    byName.set(hole.name, hole)
    byGrid.set(`${row},${yIdx}`, hole)
  }
  for (let row = 1; row <= spec.rows; row++) {
    for (const column of [...UPPER_COLUMNS, ...LOWER_COLUMNS]) {
      const yIdx = COLUMN_Y[column]
      const block = UPPER_COLUMNS.includes(column) ? 'upper' : 'lower'
      add(
        { name: `${column}${row}`, x: rowX(row), y: yIdx * PITCH, strip: `row${row}:${block}`, kind: 'main', rail: null, row, column },
        row,
        yIdx,
      )
    }
  }
  const railCount = railHoleCount(spec.rows)
  for (const railName of RAIL_NAMES) {
    const { y: yIdx, rail } = RAILS[railName]
    for (let k = 1; k <= railCount; k++) {
      const row = railHoleRow(k)
      add({ name: `${railName}${k}`, x: rowX(row), y: yIdx * PITCH, strip: railName, kind: 'rail', rail, row, column: null }, row, yIdx)
    }
  }
  const result = { holes: Object.freeze(holes), byName, byGrid }
  geometryCache.set(type, result)
  return result
}

/**
 * Outer size of a breadboard body in px.
 * @param {'half'|'full'} type
 */
export function boardSize(type) {
  const rows = BREADBOARD_TYPES[type]?.rows ?? BREADBOARD_TYPES.half.rows
  return { width: (rows + 2) * PITCH, height: HEIGHT_PITCHES * PITCH }
}

/**
 * Every tie point of a board type (memoized, frozen). 400 for half, 830 for full.
 * @param {'half'|'full'} type
 * @returns {Hole[]}
 */
export function boardHoles(type) {
  return geometry(type)?.holes ?? []
}

/**
 * Hole by name ('e12', 'TP7'), or null when the name does not exist on this board type.
 * @param {'half'|'full'} type
 * @param {string} name
 * @returns {Hole|null}
 */
export function holeByName(type, name) {
  return geometry(type)?.byName.get(name) ?? null
}

/**
 * Parse a hole name into its row/yIdx grid coordinates without checking the board type.
 * @returns {{ row: number, yIdx: number }|null}
 */
export function parseHoleName(name) {
  if (typeof name !== 'string') return null
  const main = /^([a-j])(\d+)$/.exec(name)
  if (main) {
    const row = Number(main[2])
    return row >= 1 ? { row, yIdx: COLUMN_Y[main[1]] } : null
  }
  const rail = /^(TP|TN|BN|BP)(\d+)$/.exec(name)
  if (rail) {
    const k = Number(rail[2])
    return k >= 1 ? { row: railHoleRow(k), yIdx: RAILS[rail[1]].y } : null
  }
  return null
}

/**
 * Local center of a hole name on any board type (type-independent geometry; existence not checked).
 * @returns {{x:number,y:number}|null}
 */
export function holeLocalPosition(name) {
  const grid = parseHoleName(name)
  return grid ? { x: rowX(grid.row), y: grid.yIdx * PITCH } : null
}

/**
 * Nearest hole to a local point within `tolerance` px, or null.
 * @param {'half'|'full'} type
 * @param {number} localX
 * @param {number} localY
 * @param {number} [tolerance]
 * @returns {Hole|null}
 */
export function holeAt(type, localX, localY, tolerance = PITCH * 0.45) {
  const geo = geometry(type)
  if (!geo || !Number.isFinite(localX) || !Number.isFinite(localY)) return null
  const row = Math.round(localX / PITCH - 0.5)
  const yIdx = Math.round(localY / PITCH)
  const hole = geo.byGrid.get(`${row},${yIdx}`)
  if (!hole) return null
  const dx = hole.x - localX
  const dy = hole.y - localY
  return Math.hypot(dx, dy) <= tolerance ? hole : null
}

/**
 * Strip id of a hole ('row12:upper', 'TP'); '' for unknown holes.
 * @param {'half'|'full'} type
 * @param {string} holeName
 */
export function stripOf(type, holeName) {
  return holeByName(type, holeName)?.strip ?? ''
}

/**
 * All holes on a strip (5 for a row block, 25/50 for a rail).
 * @param {'half'|'full'} type
 * @param {string} strip
 * @returns {Hole[]}
 */
export function holesInStrip(type, strip) {
  return boardHoles(type).filter((h) => h.strip === strip)
}

/**
 * Breadboard placement for a board mode. Dual mode stacks a second half board so that bb1 row j → bb2 row a
 * is exactly 10 pitches (an ESP32 anchored at bb1 j bridges both boards).
 * @param {'half'|'full'|'dual'} boardMode
 * @returns {{ id: string, type: 'half'|'full', x: number, y: number }[]}
 */
export function layoutBreadboards(boardMode) {
  if (boardMode === 'dual') {
    return [
      { id: 'bb1', type: 'half', x: 0, y: 0 },
      { id: 'bb2', type: 'half', x: 0, y: DUAL_OFFSET_Y },
    ]
  }
  return [{ id: 'bb1', type: boardMode === 'full' ? 'full' : 'half', x: 0, y: 0 }]
}

export function findBreadboard(doc, boardId) {
  return doc?.breadboards?.find((b) => b.id === boardId) ?? null
}

/**
 * World center of a hole on one of the document's breadboards.
 * @returns {{x:number,y:number}|null}
 */
export function holeWorldPosition(doc, boardId, holeName) {
  const bb = findBreadboard(doc, boardId)
  if (!bb) return null
  const hole = holeByName(bb.type, holeName)
  return hole ? { x: bb.x + hole.x, y: bb.y + hole.y } : null
}

/**
 * The hole under a world point on ANY of the document's breadboards.
 * @returns {{ board: string, hole: Hole }|null}
 */
export function holeAtWorld(doc, x, y, tolerance = PITCH * 0.45) {
  for (const bb of doc?.breadboards ?? []) {
    const size = boardSize(bb.type)
    if (x < bb.x - tolerance || y < bb.y - tolerance || x > bb.x + size.width + tolerance || y > bb.y + size.height + tolerance) continue
    const hole = holeAt(bb.type, x - bb.x, y - bb.y, tolerance)
    if (hole) return { board: bb.id, hole }
  }
  return null
}

/**
 * Split a TerminalRef into owner and pin. `'bb1:e12'` → `{ owner:'bb1', pin:'e12' }`.
 * @returns {{ owner: string, pin: string }|null}
 */
export function parseTerminal(terminalRef) {
  if (typeof terminalRef !== 'string') return null
  const idx = terminalRef.indexOf(':')
  if (idx <= 0 || idx === terminalRef.length - 1) return null
  return { owner: terminalRef.slice(0, idx), pin: terminalRef.slice(idx + 1) }
}

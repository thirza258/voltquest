import { BOARD_IDS } from '../../engine/boards/index.js'
import { getDef, resolvePins } from '../../engine/components/registry.js'
import { layoutBreadboards, terminalPosition } from '../../engine/components/breadboard.js'

const LIMIT = 200 * 1024
const bytes = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const object = value => value != null && typeof value === 'object' && !Array.isArray(value)

/** Validate completely before replacing an open project. Files never carry executable JavaScript. */
export function validateProject(data) {
  assert(object(data), 'Choose a VoltQuest project file.')
  assert(BOARD_IDS.includes(data.board), 'Unsupported controller board.')
  assert(['half', 'full', 'dual'].includes(data.boardMode), 'Invalid breadboard layout.')
  assert(typeof data.code === 'string' && bytes(data.code) <= LIMIT, 'Code must be text, at most 200 KiB.')
  assert(data.blocklyXml == null || (typeof data.blocklyXml === 'string' && bytes(data.blocklyXml) <= LIMIT), 'Blocks must be XML text, at most 200 KiB.')
  assert(['text', 'blocks'].includes(data.editorMode), 'Invalid editor mode.')
  assert(!data.board.startsWith('raspberrypi') || data.editorMode === 'text', 'Raspberry Pi projects use the Python text editor.')
  const doc = data.circuit
  assert(object(doc) && doc.version === 1 && bytes(doc) <= LIMIT, 'Invalid circuit or circuit larger than 200 KiB.')
  assert(doc.mcu === data.board && doc.boardMode === data.boardMode, 'The project board and circuit must match.')
  assert(Array.isArray(doc.components) && Array.isArray(doc.wires), 'The circuit needs component and wire arrays.')
  const layout = layoutBreadboards(doc.boardMode)
  assert(Array.isArray(doc.breadboards) && doc.breadboards.length === layout.length && layout.every((b, i) => ['id', 'type', 'x', 'y'].every(k => doc.breadboards[i]?.[k] === b[k])), 'Invalid breadboard geometry.')
  const ids = new Set(layout.map(b => b.id))
  const unique = id => { assert(typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id) && !ids.has(id), 'Circuit IDs must be unique.'); ids.add(id) }
  let controllers = 0
  for (const part of doc.components) {
    assert(object(part), 'Invalid component.')
    unique(part.id)
    const def = getDef(part.type)
    assert(def, `Unknown component: ${part.type}`)
    if (def.category === 'mcu') { controllers++; assert(part.type === data.board, 'Controller does not match the project board.') }
    assert([0, 90, 180, 270].includes(part.rotation ?? 0), 'Invalid component rotation.')
    if (def.mount === 'free') assert(object(part.position) && Number.isFinite(part.position.x) && Number.isFinite(part.position.y), 'Invalid component position.')
    else assert(object(part.anchor) && typeof part.anchor.hole === 'string' && layout.some(b => b.id === part.anchor.board), 'Invalid component anchor.')
    assert(part.props == null || object(part.props), 'Invalid component properties.')
    for (const [key, value] of Object.entries(part.props ?? {})) {
      const schema = def.props?.[key]
      if (!schema) continue
      assert(schema.type === 'enum' ? schema.options.includes(value) : schema.type === 'boolean' ? typeof value === 'boolean' : Number.isFinite(value) && (schema.min == null || value >= schema.min) && (schema.max == null || value <= schema.max), `Invalid ${def.name} ${key}.`)
    }
    assert(resolvePins(part, doc).valid, `${def.name} has legs outside the breadboard.`)
  }
  assert(controllers === 1, 'A project must contain exactly one controller.')
  for (const wire of doc.wires) {
    assert(object(wire), 'Invalid wire.')
    unique(wire.id)
    assert(typeof wire.from === 'string' && typeof wire.to === 'string' && terminalPosition(doc, wire.from) && terminalPosition(doc, wire.to), 'A wire endpoint does not exist.')
    assert(wire.color == null || typeof wire.color === 'string', 'Invalid wire color.')
    assert(wire.points == null || (Array.isArray(wire.points) && wire.points.every(p => object(p) && Number.isFinite(p.x) && Number.isFinite(p.y))), 'Invalid wire bends.')
  }
  return { ...data, name: String(data.name || 'Untitled circuit').slice(0, 80), description: String(data.description || '').slice(0, 1000) }
}

export function parseProjectFile(text) {
  assert(bytes(text) <= LIMIT * 4, 'Project file is too large.')
  let value
  try { value = JSON.parse(text) } catch { throw new Error('This file is not valid JSON.') }
  assert(value?.format === 'voltquest-project' && value.version === 1, 'Use a version 1 VoltQuest project file.')
  return validateProject(value)
}

export function projectFile({ name, description = '', circuit, code, blocklyXml = null, editorMode = 'text' }) {
  return { format: 'voltquest-project', version: 1, name, description, board: circuit.mcu, boardMode: circuit.boardMode, circuit, code, blocklyXml, editorMode, exportedAt: new Date().toISOString() }
}
export function projectPayload(file) {
  const value = validateProject(file)
  return { name: value.name, description: value.description, board: value.board, board_mode: value.boardMode, circuit: value.circuit, code: value.code, blockly_xml: value.blocklyXml ?? null, editor_mode: value.editorMode }
}
export function seedFromProject(project) {
  const value = validateProject({ ...project, boardMode: project.board_mode ?? project.boardMode, blocklyXml: project.blockly_xml ?? project.blocklyXml ?? null, editorMode: project.editor_mode ?? project.editorMode ?? 'text' })
  return { board: value.board, boardMode: value.boardMode, starterCircuit: value.circuit, starterCode: value.code, starterBlocklyXml: value.blocklyXml, starterEditorMode: value.editorMode }
}

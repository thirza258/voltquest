import { describe, expect, it } from 'vitest'
import { LEVELS } from '../../content/index.js'
import { BOARD_IDS } from '../../engine/boards/index.js'
import { buildStarterDoc } from '../../hooks/useLevelSession.js'
import { parseProjectFile, projectFile, projectPayload, seedFromProject } from './projectFile.js'
import { billOfMaterials, bomCsv } from './bom.js'

const fileFor = board => projectFile({ name: 'Test circuit', circuit: buildStarterDoc({ board, boardMode: board.startsWith('esp32') ? 'dual' : 'half' }), code: board.startsWith('raspberrypi') ? 'print(42)' : 'void setup() {}\nvoid loop() {}' })
describe('project files', () => {
  it.each(BOARD_IDS)('round-trips %s through JSON and the API shape', board => {
    const file = fileFor(board)
    const parsed = parseProjectFile(JSON.stringify(file))
    const payload = projectPayload(parsed)
    const seed = seedFromProject(payload)
    expect(seed.starterCircuit).toEqual(file.circuit)
    expect(seed.starterCode).toBe(file.code)
    expect(payload.board).toBe(board)
  })
  it.each(Object.values(LEVELS))('accepts the authored $id reference circuit', level => {
    expect(() => projectPayload(projectFile({ name: level.title, circuit: level.solution.circuit, code: level.solution.code }))).not.toThrow()
  })
  it.each([
    [file => { file.version = 2 }, /version 1/],
    [file => { file.board = 'pico' }, /Unsupported/],
    [file => { file.circuit.mcu = 'nano' }, /must match/],
    [file => { file.circuit.components.push({ ...file.circuit.components[0] }) }, /unique/],
    [file => { file.circuit.components[0].position.x = 'NaN' }, /position/],
    [file => { file.circuit.wires.push({ id: 'bad', from: 'bb1:e99', to: 'bb1:a1' }) }, /endpoint/],
    [file => { file.code = '🧪'.repeat(52000) }, /200 KiB/],
  ])('rejects malformed or oversized projects before loading', (mutate, expected) => {
    const file = fileFor('uno'); mutate(file)
    expect(() => parseProjectFile(JSON.stringify(file))).toThrow(expected)
  })
  it('rejects block mode for Python and malformed JSON', () => {
    const file = fileFor('raspberrypi5'); file.editorMode = 'blocks'
    expect(() => projectPayload(file)).toThrow(/Python text/)
    expect(() => parseProjectFile('{')).toThrow(/valid JSON/)
  })
  it('includes both breadboards and groups resistor quantities in an offline BOM', () => {
    const doc = structuredClone(LEVELS['w3-l1'].solution.circuit)
    const rows = billOfMaterials(doc)
    expect(rows.find(r => r.catalog_id === 'breadboard_half').qty).toBe(2)
    expect(rows.find(r => r.catalog_id === 'esp32_devkit_v1').qty).toBe(1)
    expect(rows.find(r => r.catalog_id === 'jumper_wires').qty).toBe(1)
    expect(bomCsv(rows)).toContain('Catalog ID')
    expect(bomCsv([{ qty: 1, part: '=CMD()', value: 'a,"b', catalog_id: 'x', unit_price_usd: 1, vendor: '', link: '' }])).toContain('"\'=CMD()"')
  })
})

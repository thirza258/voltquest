import { describe, it, expect } from 'vitest'
import { TUTORIALS } from '../../content/index.js'
import { createSimulation } from '../../engine/sim/index.js'
import { resolvePins } from '../../engine/components/registry.js'
import { tutorialCircuit, tutorialCode } from './circuits.js'

describe('tutorial learning paths and reference circuits', () => {
  it('provides Easy, Intermediate and Hard paths for Uno, ESP32 and Raspberry Pi', () => {
    expect(TUTORIALS.length).toBeGreaterThanOrEqual(35)
    for (const board of ['uno', 'nano', 'esp32', 'esp32s3', 'raspberrypi4', 'raspberrypi5']) {
      const tutorials = TUTORIALS.filter((tutorial) => tutorial.boards.includes(board))
      const rank = { Easy: 0, Intermediate: 1, Hard: 2 }
      expect(new Set(tutorials.map((tutorial) => tutorial.difficulty))).toEqual(new Set(Object.keys(rank)))
      const order = tutorials.map((tutorial) => rank[tutorial.difficulty])
      expect(order).toEqual(order.slice().sort())
      for (const tutorial of tutorials) {
        expect(tutorial.hardwareConcepts.length).toBeGreaterThanOrEqual(2)
        expect(tutorial.programConcepts.length).toBeGreaterThanOrEqual(2)
        expect(tutorial.steps.length).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it.each(TUTORIALS.flatMap((tutorial) => tutorial.boards.map((board) => [tutorial.id, board, tutorial])))('%s runs on %s without damage or runtime errors', async (id, board, tutorial) => {
    const doc = tutorialCircuit(tutorial, board)
    for (const component of doc.components) expect(resolvePins(component, doc).valid, `${id}: ${component.id}`).toBe(true)
    const occupied = new Set(doc.components.flatMap((component) => Object.values(resolvePins(component, doc).pins).map((pin) => pin.hole).filter(Boolean)))
    const cableHoles = doc.wires.flatMap((cable) => [cable.from, cable.to]).filter((terminal) => terminal.startsWith('bb'))
    expect(new Set(cableHoles).size).toBe(cableHoles.length)
    for (const terminal of cableHoles) expect(occupied.has(terminal), `${id}: occupied cable hole ${terminal}`).toBe(false)
    const sim = createSimulation({ inline: true })
    try {
      sim.setDocument(doc)
      sim.setCode(tutorialCode(tutorial, board))
      const result = await sim.run()
      expect(result.errors).toEqual([])
      expect(result.ok).toBe(true)
      for (let step = 0; step < 25; step++) sim.advance(50)
      await new Promise((resolve) => setTimeout(resolve, 0))
      const state = sim.getState()
      expect(state.runtimeError).toBeNull()
      expect(state.events.filter((event) => ['blow', 'burnt_pin', 'short'].includes(event.type))).toEqual([])
      expect(state.warningCodesSeen.unbound_device).toBeUndefined()
      if (tutorial.preset === 'button') {
        sim.setControl('c_button', { pressed: true })
        sim.advance(100)
        const pin = board.startsWith('raspberry') ? 'GPIO17' : 'D9'
        expect(sim.getState().mcuPins[pin].level).toBe(1)
      }
    } finally { sim.dispose() }
  })
})

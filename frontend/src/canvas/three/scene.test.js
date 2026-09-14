import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { BOARD_IDS } from '../../engine/boards/index.js'
import { makeDoc, place, wire } from '../../engine/components/seeds.js'
import { listDefs, resolvePins } from '../../engine/components/registry.js'
import { terminalPosition } from '../../engine/components/breadboard.js'
import { compileCircuit, evaluateCircuit } from '../../engine/circuit/index.js'
import { circuitModel, worldPoint } from './model.js'
import { createCircuitScene } from './scene.js'

describe('3D circuit geometry', () => {
  it.each(BOARD_IDS)('%s uses actual pin positions and wire endpoints across both breadboards', board => {
    const doc = makeDoc({ mcu: board, boardMode: 'dual' })
    const part = place(doc, 'led', 'bb2', 'a26')
    wire(doc, `c_${board}:GND`, `${part}:cathode`)
    wire(doc, 'bb1:TP7', 'bb2:a10')
    const before = structuredClone(doc)
    const model = circuitModel(doc)
    expect(model.parts).toHaveLength(2)
    const view = createCircuitScene(doc)
    try {
      for (const part of model.parts) {
        const group = view.root.getObjectByName(part.comp.id)
        for (const pin of part.def.footprint.pins) {
          const point = group.localToWorld(new Vector3(pin.dx, 0, pin.dy))
          const actual = resolvePins(part.comp, doc).pins[pin.id]
          expect(point.x).toBeCloseTo(actual.x / 24, 8)
          expect(point.z).toBeCloseTo(actual.y / 24, 8)
        }
      }
      for (const wire of model.wires) {
        for (const [ref, point] of [[wire.from, wire.points[0]], [wire.to, wire.points.at(-1)]]) {
          const actual = worldPoint(terminalPosition(doc, ref))
          expect([point[0], point[2]]).toEqual([actual[0], actual[2]])
        }
      }
      expect(doc).toEqual(before)
    } finally { view.dispose() }
  })

  it.each([0, 90, 180, 270])('rotates a board-mounted and free-mounted part by %s° around the registry origin', rotation => {
    const doc = makeDoc({ mcu: 'uno' })
    doc.components[0].rotation = rotation
    place(doc, 'resistor', 'bb1', 'e15', {}, rotation)
    const view = createCircuitScene(doc)
    try {
      for (const part of view.model.parts) for (const pin of part.def.footprint.pins) {
        const point = view.root.getObjectByName(part.comp.id).localToWorld(new Vector3(pin.dx, 0, pin.dy))
        const resolved = resolvePins(part.comp, doc).pins[pin.id]
        expect(point.x).toBeCloseTo(resolved.x / 24, 8)
        expect(point.z).toBeCloseTo(resolved.y / 24, 8)
      }
    } finally { view.dispose() }
  })

  it('every available part builds finite, selectable geometry and releases its resources', () => {
    for (const def of listDefs().filter(def => def.category !== 'mcu')) {
      const doc = makeDoc()
      const id = place(doc, def.type, 'bb1', 'a10')
      const scene = createCircuitScene(doc)
      let meshes = 0
      const resources = new Set(), disposed = new Set()
      scene.root.traverse(object => {
        if (!object.isMesh) return
        meshes++
        for (const number of object.geometry.attributes.position.array) expect(Number.isFinite(number), def.type).toBe(true)
        if (object.parent.name === id) expect(object.userData.selectId).toBe(id)
        resources.add(object.geometry)
        for (const material of [].concat(object.material)) resources.add(material)
      })
      for (const resource of resources) resource.addEventListener('dispose', () => disposed.add(resource))
      expect(meshes, def.type).toBeGreaterThan(1)
      scene.dispose()
      expect(disposed.size, def.type).toBe(resources.size)
    }
  })

  it('LED emission follows the real electrical result, power and damage without replacing geometry', () => {
    const doc = makeDoc({ mcu: 'uno' })
    const resistor = place(doc, 'resistor', 'bb1', 'a1', { ohms: 220 })
    const led = place(doc, 'led', 'bb1', 'a10')
    wire(doc, 'c_uno:D13', `${resistor}:p1`); wire(doc, `${resistor}:p2`, `${led}:anode`); wire(doc, `${led}:cathode`, 'c_uno:GND')
    const scene = createCircuitScene(doc)
    const compiled = compileCircuit(doc)
    const part = scene.root.getObjectByName(led)
    const lens = part.children.find(child => child.geometry?.type === 'SphereGeometry')
    const geometry = lens.geometry
    try {
      for (const level of [0, 1, 0]) {
        const evaluation = evaluateCircuit(compiled, { powered: true, mcuPins: { D13: { mode: 'output', level } } })
        scene.update({ evaluation }, [led])
        expect(lens.material.emissiveIntensity).toBeCloseTo(evaluation.componentStates[led].brightness * 2.2)
        expect(lens.geometry).toBe(geometry)
      }
      scene.update({ powered: false, evaluation: { componentStates: { [led]: { brightness: 1 } } } })
      expect(lens.material.emissiveIntensity).toBe(0)
      scene.update({ damaged: { [led]: true }, evaluation: { componentStates: { [led]: { brightness: 1 } } } })
      expect(lens.material.emissiveIntensity).toBe(0)
      expect(scene.root.children.some(child => child.type === 'Box3Helper' && child.visible && child.material.color.getHexString() === 'e11d48')).toBe(true)
    } finally { scene.dispose() }
  })
})

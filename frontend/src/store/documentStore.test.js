import { describe, it, expect, beforeEach } from 'vitest'
import { createDocumentStore, emptyDoc } from './documentStore.js'
import { fakeRegistry, fakeBoards, fakeBreadboard } from './testFakes.js'

const deps = { registry: fakeRegistry, boards: fakeBoards, breadboard: fakeBreadboard }

describe('documentStore', () => {
  let store
  beforeEach(() => {
    store = createDocumentStore(deps)
  })

  it('starts empty and adds components with selection + undo/redo', () => {
    const s = store.getState()
    expect(s.doc.boardMode).toBe('half')
    expect(s.doc.components).toEqual([])

    const id = s.addComponent('led', { anchor: { board: 'bb1', hole: 'e12' } }, { color: 'green' })
    expect(store.getState().doc.components).toHaveLength(1)
    expect(store.getState().doc.components[0]).toMatchObject({ id, type: 'led', props: { color: 'green' }, anchor: { board: 'bb1', hole: 'e12' } })
    expect(store.getState().selectedIds).toEqual([id])
    expect(store.getState().past).toHaveLength(1)

    expect(store.getState().undo()).toBe(true)
    expect(store.getState().doc.components).toHaveLength(0)
    expect(store.getState().selectedIds).toEqual([])
    expect(store.getState().future).toHaveLength(1)

    expect(store.getState().redo()).toBe(true)
    expect(store.getState().doc.components).toHaveLength(1)
    expect(store.getState().future).toHaveLength(0)
    expect(store.getState().redo()).toBe(false)
  })

  it('caps history at 100 entries and clears redo on a new edit', () => {
    // 130 *distinct* wires: addWire dedupes identical endpoint pairs, so reusing pairs would not commit.
    for (let i = 0; i < 130; i++) {
      const column = 'abcde'[i % 5]
      const row = Math.floor(i / 5) + 1
      store.getState().addWire(`bb1:${column}${row}`, 'bb1:TP1', 'red')
    }
    expect(store.getState().past).toHaveLength(100)
    store.getState().undo()
    expect(store.getState().future).toHaveLength(1)
    store.getState().addWire('bb1:j30', 'bb1:BP1') // a pair the loop above did not use
    expect(store.getState().future).toHaveLength(0)
  })

  it('removes components with their aliased wires and mirrors the mcu field', () => {
    const s = store.getState()
    const unoId = s.addComponent('uno', { position: { x: 0, y: 0 } })
    expect(store.getState().doc.mcu).toBe('uno')
    const ledId = store.getState().addComponent('led', { anchor: { board: 'bb1', hole: 'e12' } })
    const w1 = store.getState().addWire(`${unoId}:D13`, 'bb1:a12')
    const w2 = store.getState().addWire('bb1:b13', 'bb1:TN3')
    expect(store.getState().doc.wires.map((w) => w.id)).toEqual([w1, w2])

    store.getState().removeComponents([unoId])
    expect(store.getState().doc.mcu).toBeNull()
    expect(store.getState().doc.wires.map((w) => w.id)).toEqual([w2])
    expect(store.getState().doc.components.map((c) => c.id)).toEqual([ledId])
  })

  it('adding a second MCU replaces the first', () => {
    store.getState().addComponent('uno', { position: { x: 0, y: 0 } })
    store.getState().addComponent('nano', { anchor: { board: 'bb1', hole: 'b1' } })
    const comps = store.getState().doc.components
    expect(comps).toHaveLength(1)
    expect(comps[0].type).toBe('nano')
    expect(store.getState().doc.mcu).toBe('nano')
  })

  it('setMcu remaps wires per the contract and removes unmappable ones', () => {
    const unoId = store.getState().addComponent('uno', { position: { x: 0, y: 0 } })
    const wPower = store.getState().addWire(`${unoId}:5V`, 'bb1:TP1', 'red')
    const wAdc = store.getState().addWire(`${unoId}:A0`, 'bb1:c5', 'yellow')
    const wAdc1 = store.getState().addWire(`${unoId}:A1`, 'bb1:c6', 'yellow')
    const wGnd = store.getState().addWire(`${unoId}:GND3`, 'bb1:TN1', 'black')
    const wD13 = store.getState().addWire(`${unoId}:D13`, 'bb1:a12', 'green')
    const wPlain = store.getState().addWire('bb1:a1', 'bb1:f1', 'blue')

    const result = store.getState().setMcu('esp32')
    const doc = store.getState().doc
    expect(doc.mcu).toBe('esp32')
    expect(doc.components).toHaveLength(1)
    expect(doc.components[0]).toMatchObject({ type: 'esp32', anchor: { board: 'bb1', hole: 'a1' } })
    const newId = doc.components[0].id
    const byId = Object.fromEntries(doc.wires.map((w) => [w.id, w]))

    expect(result.removedWires).toEqual([wD13])
    expect(byId[wPower].from).toBe(`${newId}:VIN`)
    expect(byId[wAdc].from).toBe(`${newId}:GPIO2`)
    expect(byId[wAdc1].from).toBe(`${newId}:GPIO4`)
    expect(byId[wGnd].from).toBe(`${newId}:GND`)
    expect(byId[wPlain]).toEqual(expect.objectContaining({ from: 'bb1:a1', to: 'bb1:f1' }))
    expect(result.remapped).toEqual(expect.arrayContaining([
      { wireId: wPower, end: 'from', fromPin: '5V', toPin: 'VIN' },
      { wireId: wAdc, end: 'from', fromPin: 'A0', toPin: 'GPIO2' },
      { wireId: wGnd, end: 'from', fromPin: 'GND3', toPin: 'GND' },
    ]))

    // same board again is a no-op, null removes the MCU and its wires
    expect(store.getState().setMcu('esp32')).toEqual({ removedWires: [], remapped: [] })
    const removal = store.getState().setMcu(null)
    expect(removal.removedWires.sort()).toEqual([wPower, wAdc, wAdc1, wGnd].sort())
    expect(store.getState().doc.mcu).toBeNull()
    expect(store.getState().doc.wires.map((w) => w.id)).toEqual([wPlain])
  })

  it('setMcu uses the dual placement when the layout is dual', () => {
    store.getState().setBoardMode('dual')
    store.getState().setMcu('esp32')
    expect(store.getState().doc.components[0].anchor).toEqual({ board: 'bb1', hole: 'j1' })
  })

  it('setBoardMode grows freely, refuses to shrink over parts on bb2 and drops dangling wires otherwise', () => {
    expect(store.getState().setBoardMode('dual')).toEqual({ ok: true, removedWires: [] })
    expect(store.getState().doc.breadboards.map((b) => b.id)).toEqual(['bb1', 'bb2'])

    const ledId = store.getState().addComponent('led', { anchor: { board: 'bb2', hole: 'e3' } })
    const refused = store.getState().setBoardMode('half')
    expect(refused).toEqual({ ok: false, blocking: [ledId] })
    expect(store.getState().doc.boardMode).toBe('dual')

    store.getState().removeComponents(ledId)
    const wire = store.getState().addWire('bb2:a1', 'bb1:a1')
    const keep = store.getState().addWire('bb1:a2', 'bb1:f2')
    const ok = store.getState().setBoardMode('half')
    expect(ok).toEqual({ ok: true, removedWires: [wire] })
    expect(store.getState().doc.wires.map((w) => w.id)).toEqual([keep])
    expect(store.getState().doc.breadboards).toHaveLength(1)
  })

  it('setBoardMode refuses full → half when a part sits beyond row 30', () => {
    store.getState().setBoardMode('full')
    const far = store.getState().addComponent('resistor', { anchor: { board: 'bb1', hole: 'e40' } })
    const near = store.getState().addComponent('resistor', { anchor: { board: 'bb1', hole: 'e10' } })
    expect(store.getState().setBoardMode('half')).toEqual({ ok: false, blocking: [far] })
    store.getState().removeComponents([far])
    expect(store.getState().setBoardMode('half').ok).toBe(true)
    expect(store.getState().doc.components.map((c) => c.id)).toEqual([near])
  })

  it('setBoardMode re-seats an untethered board-mounted MCU at the default placement', () => {
    store.getState().setMcu('esp32')
    expect(store.getState().doc.components[0].anchor.hole).toBe('a1')
    store.getState().setBoardMode('dual')
    expect(store.getState().doc.components[0].anchor).toEqual({ board: 'bb1', hole: 'j1' })
  })

  it('replaceComponent keeps type/props/placement and re-points aliased wires', () => {
    const id = store.getState().addComponent('resistor', { anchor: { board: 'bb1', hole: 'e12' }, rotation: 90 }, { ohms: 1000 })
    const w = store.getState().addWire(`${id}:p1`, 'bb1:TP1')
    const fresh = store.getState().replaceComponent(id)
    expect(fresh).not.toBe(id)
    const comp = store.getState().doc.components.find((c) => c.id === fresh)
    expect(comp).toMatchObject({ type: 'resistor', props: { ohms: 1000 }, anchor: { board: 'bb1', hole: 'e12' }, rotation: 90 })
    expect(store.getState().doc.components.some((c) => c.id === id)).toBe(false)
    expect(store.getState().doc.wires.find((x) => x.id === w).from).toBe(`${fresh}:p1`)
  })

  it('props, move, rotate, wires and selection helpers', () => {
    const id = store.getState().addComponent('resistor', { anchor: { board: 'bb1', hole: 'e12' } })
    store.getState().setProps(id, { ohms: 100 })
    expect(store.getState().doc.components[0].props.ohms).toBe(100)
    store.getState().rotateComponent(id)
    expect(store.getState().doc.components[0].rotation).toBe(90)
    store.getState().rotateComponent(id, -90)
    expect(store.getState().doc.components[0].rotation).toBe(0)
    store.getState().moveComponent(id, { anchor: { board: 'bb1', hole: 'a3' } })
    expect(store.getState().doc.components[0].anchor).toEqual({ board: 'bb1', hole: 'a3' })

    expect(store.getState().addWire('bb1:a1', 'bb1:a1')).toBeNull()
    const w = store.getState().addWire('bb1:a1', 'bb1:f1', 'blue')
    expect(store.getState().addWire('bb1:f1', 'bb1:a1', 'red')).toBe(w)
    store.getState().updateWire(w, { color: 'green' })
    expect(store.getState().doc.wires[0].color).toBe('green')
    store.getState().select([id, w, 'missing'])
    expect(store.getState().selectedIds).toEqual([id, w])
    store.getState().removeWires(w)
    expect(store.getState().selectedIds).toEqual([id])
    store.getState().select(null)
    expect(store.getState().selectedIds).toEqual([])
  })

  it('load normalises the doc and resets history; setMeta is undoable', () => {
    store.getState().addWire('bb1:a1', 'bb1:f1')
    const doc = { ...emptyDoc('half', fakeBreadboard), components: [{ id: 'c_uno', type: 'uno', props: {}, rotation: 0, position: { x: 0, y: -600 } }], mcu: null }
    store.getState().load(doc)
    expect(store.getState().doc.mcu).toBe('uno')
    expect(store.getState().past).toEqual([])
    expect(store.getState().undo()).toBe(false)
    store.getState().setMeta({ name: 'Blinky' })
    expect(store.getState().doc.meta.name).toBe('Blinky')
    store.getState().undo()
    expect(store.getState().doc.meta.name).toBeUndefined()
  })
})

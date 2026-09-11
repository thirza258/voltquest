// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, createEvent, fireEvent, render } from '@testing-library/react'
import { BREADBOARD_TYPES, holeWorldPosition } from '../engine/components/breadboard.js'
import { WIRE_COLORS } from '../engine/components/registry.js'
import { makeDoc, place, wire } from '../engine/components/seeds.js'
import { BreadboardCanvas } from './BreadboardCanvas.jsx'
import { rendererFor } from './ComponentLayer.jsx'
import { GenericPartRenderer } from './GenericPartRenderer.jsx'
import { RENDERERS } from './renderers/index.js'
import { DND_MIME, docBounds, fitView, worldToScreen } from './geometry.js'
import { exportCanvasPng } from './exportPng.js'

const VIEW_SIZE = { width: 800, height: 600 }

beforeAll(() => {
  // jsdom has neither layout nor pointer/drag event classes; MouseEvent carries button + clientX/Y.
  if (!window.PointerEvent) window.PointerEvent = window.MouseEvent
  if (!window.DragEvent) window.DragEvent = window.MouseEvent
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, left: 0, top: 0, right: VIEW_SIZE.width, bottom: VIEW_SIZE.height, ...VIEW_SIZE, toJSON: () => ({}) }
  }
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.hasPointerCapture = () => false
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

/** Client point of a breadboard hole, using the same fit the canvas applies on mount. */
function holeClientPoint(doc, boardId, hole) {
  const view = fitView(docBounds(doc), VIEW_SIZE)
  return worldToScreen(view, holeWorldPosition(doc, boardId, hole))
}

function renderCanvas(props) {
  const utils = render(<BreadboardCanvas {...props} />)
  const root = utils.container.querySelector('[data-canvas-root]')
  return { ...utils, root }
}

describe('BreadboardCanvas structure', () => {
  it('renders the contract root and a half board with every tie point', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const { container, root } = renderCanvas({ doc })

    expect(root).toBeTruthy()
    expect(root.getAttribute('role')).toBe('application')
    expect(root.getAttribute('aria-label')).toBe('Breadboard canvas')
    expect(root.tabIndex).toBe(0)

    const svg = container.querySelector('svg[data-canvas-svg]')
    expect(svg).toBeTruthy()
    expect(svg.querySelector('[data-viewport]')).toBeTruthy()

    const holes = container.querySelectorAll('[data-breadboard-holes] circle')
    expect(holes).toHaveLength(BREADBOARD_TYPES.half.tiePoints)
    expect(holes).toHaveLength(400)
  })

  it('renders both boards of a dual layout', () => {
    const doc = makeDoc({ boardMode: 'dual' })
    const { container } = renderCanvas({ doc })
    expect(container.querySelectorAll('[data-breadboard-id]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-breadboard-holes] circle')).toHaveLength(800)
  })

  it('renders a full board with 830 tie points', () => {
    const doc = makeDoc({ boardMode: 'full' })
    const { container } = renderCanvas({ doc })
    expect(container.querySelectorAll('[data-breadboard-holes] circle')).toHaveLength(BREADBOARD_TYPES.full.tiePoints)
  })

  it('draws placed components and wires', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const ledId = place(doc, 'led', 'bb1', 'e5')
    place(doc, 'resistor', 'bb1', 'e7', { ohms: 220 })
    const wireId = wire(doc, 'bb1:a5', 'bb1:TP1', 'red')
    const { container } = renderCanvas({ doc })

    expect(container.querySelector(`[data-component-id="${ledId}"]`)).toBeTruthy()
    expect(container.querySelector(`[data-wire-id="${wireId}"]`)).toBeTruthy()
    // renderers repeat data-component-id/type on their own frame, so count the layer's direct children
    expect(container.querySelectorAll('[data-layer="components"] > [data-component-id]')).toHaveLength(2)
  })

  it('shows the zoom toolbar and whatever the shell adds to it', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const { container, getByTestId, getByLabelText } = renderCanvas({
      doc,
      toolbarExtra: <span data-testid="layout-switcher">Half</span>,
    })
    expect(container.querySelector('[data-canvas-toolbar]')).toBeTruthy()
    expect(getByLabelText('Zoom in')).toBeTruthy()
    expect(getByLabelText('Fit to circuit (F)')).toBeTruthy()
    expect(getByTestId('layout-switcher')).toBeTruthy()
  })
})

describe('renderer resolution', () => {
  it('falls back to GenericPartRenderer for a type with no renderer', () => {
    expect(rendererFor('totally_made_up_part')).toBe(GenericPartRenderer)
    expect(rendererFor(undefined)).toBe(GenericPartRenderer)
  })

  it('uses the registered renderer when one exists', () => {
    expect(rendererFor('led')).toBe(RENDERERS.led)
    expect(rendererFor('led')).not.toBe(GenericPartRenderer)
  })

  it('draws a labelled box with a pad per footprint pin', () => {
    const def = {
      type: 'mystery',
      name: 'Mystery part',
      mount: 'board',
      footprint: { width: 3, height: 1, pins: [{ id: 'p1', label: 'P1', dx: 0, dy: 0 }, { id: 'p2', label: 'P2', dx: 2, dy: 0 }] },
    }
    const { container } = render(
      <svg>
        <GenericPartRenderer comp={{ id: 'c_x', type: 'mystery' }} def={def} />
      </svg>,
    )
    expect(container.textContent).toContain('Mystery part')
    expect(container.querySelectorAll('[data-generic-pin]')).toHaveLength(2)
  })
})

describe('hotkeys', () => {
  it('fire when the canvas or the body has focus, and never while typing', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const onToolChange = vi.fn()
    const onWireColorChange = vi.fn()
    const { root } = renderCanvas({ doc, onToolChange, onWireColorChange })

    root.focus()
    fireEvent.keyDown(document, { key: 'w' })
    expect(onToolChange).toHaveBeenCalledWith('wire')

    fireEvent.keyDown(document, { key: '3' })
    expect(onWireColorChange).toHaveBeenCalledWith(WIRE_COLORS[2])

    // focus back on <body> still counts as "in the canvas" per §10
    root.blur()
    onToolChange.mockClear()
    fireEvent.keyDown(document, { key: 'v' })
    expect(onToolChange).toHaveBeenCalledWith('select')

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    onToolChange.mockClear()
    onWireColorChange.mockClear()
    fireEvent.keyDown(document, { key: 'w' })
    fireEvent.keyDown(document, { key: '1' })
    expect(onToolChange).not.toHaveBeenCalled()
    expect(onWireColorChange).not.toHaveBeenCalled()
    input.remove()
  })

  it('rotates and removes the current selection', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const ledId = place(doc, 'led', 'bb1', 'e5')
    const wireId = wire(doc, 'bb1:a5', 'bb1:TP1', 'red')
    const onRotateComponent = vi.fn()
    const onRemove = vi.fn()
    const onRemoveWire = vi.fn()
    const { root } = renderCanvas({ doc, selectedIds: [ledId, wireId], onRotateComponent, onRemove, onRemoveWire })

    root.focus()
    fireEvent.keyDown(document, { key: 'r' })
    expect(onRotateComponent).toHaveBeenCalledWith(ledId)
    expect(onRotateComponent).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Delete' })
    expect(onRemove).toHaveBeenCalledWith([ledId])
    expect(onRemoveWire).toHaveBeenCalledWith(wireId)
  })

  it('clears the selection on Escape', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const ledId = place(doc, 'led', 'bb1', 'e5')
    const onSelect = vi.fn()
    const { root } = renderCanvas({ doc, selectedIds: [ledId], onSelect })
    root.focus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onSelect).toHaveBeenCalledWith([])
  })
})

describe('readOnly', () => {
  function readOnlyCanvas() {
    const doc = makeDoc({ boardMode: 'half' })
    const buttonId = place(doc, 'pushbutton', 'bb1', 'a5')
    const spies = {
      onControl: vi.fn(),
      onRemove: vi.fn(),
      onRotateComponent: vi.fn(),
      onAddComponent: vi.fn(),
      onDropRejected: vi.fn(),
    }
    const utils = renderCanvas({ doc, readOnly: true, selectedIds: [buttonId], ...spies })
    return { doc, buttonId, spies, ...utils }
  }

  it('keeps controls live so the showcase preview stays interactive', () => {
    const { container, buttonId, spies } = readOnlyCanvas()
    const cap = container.querySelector('[data-pushbutton]')
    expect(cap).toBeTruthy()
    fireEvent.pointerDown(cap, { button: 0 })
    expect(spies.onControl).toHaveBeenCalledWith(buttonId, { pressed: true })
  })

  it('blocks delete and rotate', () => {
    const { root, spies } = readOnlyCanvas()
    root.focus()
    fireEvent.keyDown(document, { key: 'Backspace' })
    fireEvent.keyDown(document, { key: 'r' })
    expect(spies.onRemove).not.toHaveBeenCalled()
    expect(spies.onRotateComponent).not.toHaveBeenCalled()
  })

  it('rejects drops with the readOnly reason', () => {
    const { doc, root, spies } = readOnlyCanvas()
    dropComponent(root, doc, 'led', 'bb1', 'e12')
    expect(spies.onAddComponent).not.toHaveBeenCalled()
    expect(spies.onDropRejected).toHaveBeenCalledWith('readOnly')
  })
})

/** Simulate the parts drawer dropping `type` onto a breadboard hole. */
function dropComponent(root, doc, payload, boardId, hole) {
  const point = holeClientPoint(doc, boardId, hole)
  const dataTransfer = {
    types: [DND_MIME],
    dropEffect: 'none',
    getData: (type) => (type === DND_MIME ? payload : ''),
  }
  const event = createEvent.drop(root, { clientX: point.x, clientY: point.y })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  fireEvent(root, event)
}

describe('parts-drawer drops', () => {
  it('snaps a board part to the hole under the pointer', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const onAddComponent = vi.fn()
    const onDropRejected = vi.fn()
    const { root } = renderCanvas({ doc, onAddComponent, onDropRejected })

    dropComponent(root, doc, 'led', 'bb1', 'e12')
    expect(onDropRejected).not.toHaveBeenCalled()
    expect(onAddComponent).toHaveBeenCalledWith('led', { anchor: { board: 'bb1', hole: 'e12' }, rotation: 0 }, undefined)
  })

  it('accepts a JSON payload with props', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const onAddComponent = vi.fn()
    const { root } = renderCanvas({ doc, onAddComponent })

    dropComponent(root, doc, JSON.stringify({ type: 'resistor', props: { ohms: 470 } }), 'bb1', 'e12')
    expect(onAddComponent).toHaveBeenCalledWith(
      'resistor',
      { anchor: { board: 'bb1', hole: 'e12' }, rotation: 0 },
      { ohms: 470 },
    )
  })

  it('rejects an unknown component type', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const onAddComponent = vi.fn()
    const onDropRejected = vi.fn()
    const { root } = renderCanvas({ doc, onAddComponent, onDropRejected })

    dropComponent(root, doc, 'not_a_part', 'bb1', 'e12')
    expect(onAddComponent).not.toHaveBeenCalled()
    expect(onDropRejected).toHaveBeenCalledWith('unknown_type')
  })

  it('places an ESP32 on a half board and then asks for the second breadboard', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const onAddComponent = vi.fn()
    const onEspNeedsDualBoard = vi.fn()
    const onDropRejected = vi.fn()
    const { root } = renderCanvas({ doc, onAddComponent, onEspNeedsDualBoard, onDropRejected })

    dropComponent(root, doc, 'esp32', 'bb1', 'a1')

    expect(onDropRejected).not.toHaveBeenCalled()
    expect(onAddComponent).toHaveBeenCalledWith('esp32', { anchor: { board: 'bb1', hole: 'a1' }, rotation: 0 }, undefined)
    expect(onEspNeedsDualBoard).toHaveBeenCalledTimes(1)
  })

  it('does not ask for a second board when the layout is already dual', () => {
    const doc = makeDoc({ boardMode: 'dual' })
    const onAddComponent = vi.fn()
    const onEspNeedsDualBoard = vi.fn()
    const { root } = renderCanvas({ doc, onAddComponent, onEspNeedsDualBoard })

    dropComponent(root, doc, 'esp32', 'bb1', 'j1')
    expect(onAddComponent).toHaveBeenCalled()
    expect(onEspNeedsDualBoard).not.toHaveBeenCalled()
  })
})

describe('selection', () => {
  it('selects a wire when it is clicked', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const wireId = wire(doc, 'bb1:a5', 'bb1:TP1', 'red')
    const onSelect = vi.fn()
    const { container, root } = renderCanvas({ doc, onSelect })

    const hit = container.querySelector(`[data-wire-id="${wireId}"] .vq-wire-hit`)
    expect(hit).toBeTruthy()
    fireEvent.pointerDown(hit, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerUp(root, { button: 0, clientX: 100, clientY: 100 })
    expect(onSelect).toHaveBeenCalledWith([wireId])
  })
})

describe('moving a component', () => {
  function dragComponent(doc, extraProps, fromHole, to) {
    const spies = { onMoveComponent: vi.fn(), onDropRejected: vi.fn(), onSelect: vi.fn() }
    const { container, root } = renderCanvas({ doc, ...spies, ...extraProps })
    const node = container.querySelector('[data-layer="components"] > [data-component-id]')
    const from = holeClientPoint(doc, 'bb1', fromHole)
    fireEvent.pointerDown(node, { button: 0, clientX: from.x, clientY: from.y })
    fireEvent.pointerMove(root, { button: 0, clientX: to.x, clientY: to.y })
    fireEvent.pointerUp(root, { button: 0, clientX: to.x, clientY: to.y })
    return spies
  }

  it('commits the move even when press, drag and release land in one frame', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const ledId = place(doc, 'led', 'bb1', 'e5')
    const spies = dragComponent(doc, {}, 'e5', holeClientPoint(doc, 'bb1', 'e10'))

    expect(spies.onSelect).toHaveBeenCalledWith([ledId])
    expect(spies.onMoveComponent).toHaveBeenCalledWith(ledId, { anchor: { board: 'bb1', hole: 'e10' }, rotation: 0 })
    expect(spies.onDropRejected).not.toHaveBeenCalled()
  })

  it('rejects a drop that leaves the board instead of moving silently', () => {
    const doc = makeDoc({ boardMode: 'half' })
    place(doc, 'led', 'bb1', 'e5')
    const spies = dragComponent(doc, {}, 'e5', { x: 2, y: 2 })

    expect(spies.onMoveComponent).not.toHaveBeenCalled()
    expect(spies.onDropRejected).toHaveBeenCalledWith('off_board')
  })

  it('does not move anything in readOnly mode', () => {
    const doc = makeDoc({ boardMode: 'half' })
    place(doc, 'led', 'bb1', 'e5')
    const spies = dragComponent(doc, { readOnly: true }, 'e5', holeClientPoint(doc, 'bb1', 'e10'))

    expect(spies.onMoveComponent).not.toHaveBeenCalled()
    expect(spies.onDropRejected).not.toHaveBeenCalled()
  })
})

describe('wire tool', () => {
  it('draws a wire between two holes hit-tested mathematically', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const onAddWire = vi.fn()
    const { root } = renderCanvas({ doc, tool: 'wire', wireColor: 'green', onAddWire })

    const from = holeClientPoint(doc, 'bb1', 'e5')
    const to = holeClientPoint(doc, 'bb1', 'TP3')
    fireEvent.pointerDown(root, { button: 0, clientX: from.x, clientY: from.y })
    fireEvent.pointerUp(root, { button: 0, clientX: to.x, clientY: to.y })

    expect(onAddWire).toHaveBeenCalledWith('bb1:e5', 'bb1:TP3', 'green')
  })

  it('cancels when both ends are the same terminal', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const onAddWire = vi.fn()
    const { root } = renderCanvas({ doc, tool: 'wire', onAddWire })

    const point = holeClientPoint(doc, 'bb1', 'e5')
    fireEvent.pointerDown(root, { button: 0, clientX: point.x, clientY: point.y })
    fireEvent.pointerUp(root, { button: 0, clientX: point.x, clientY: point.y })

    expect(onAddWire).not.toHaveBeenCalled()
  })

  it('does not start a wire in readOnly mode', () => {
    const doc = makeDoc({ boardMode: 'half' })
    const onAddWire = vi.fn()
    const { root } = renderCanvas({ doc, tool: 'wire', readOnly: true, onAddWire })

    const from = holeClientPoint(doc, 'bb1', 'e5')
    const to = holeClientPoint(doc, 'bb1', 'TP3')
    fireEvent.pointerDown(root, { button: 0, clientX: from.x, clientY: from.y })
    fireEvent.pointerUp(root, { button: 0, clientX: to.x, clientY: to.y })

    expect(onAddWire).not.toHaveBeenCalled()
  })
})

describe('exportCanvasPng', () => {
  it('rejects instead of hanging when there is no SVG element', async () => {
    await expect(exportCanvasPng(null)).rejects.toThrow(/expected the canvas SVG element/)
  })

  it('serialises the SVG without the interaction-only overlays', async () => {
    const doc = makeDoc({ boardMode: 'half' })
    const { container } = renderCanvas({ doc })
    const svg = container.querySelector('svg[data-canvas-svg]')
    const { serializeCanvasSvg } = await import('./exportPng.js')
    const { xml, width, height } = serializeCanvasSvg(svg)
    expect(width).toBe(VIEW_SIZE.width)
    expect(height).toBe(VIEW_SIZE.height)
    expect(xml).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(xml).toContain('data-breadboard-holes')
    expect(xml).not.toContain('data-export-hide')
  })
})

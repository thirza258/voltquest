// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CircuitViewport from './CircuitViewport.jsx'
import { makeDoc, place } from '../../engine/components/seeds.js'

vi.mock('../../canvas/three/Circuit3DView.jsx', () => ({ default: ({ doc, simState, active, onSelect }) => <div data-testid="3d" data-active={active}>{simState?.millis}<button onClick={() => onSelect([doc.components[0].id])}>Inspect model</button></div> }))
afterEach(cleanup)

it('keeps the SVG and its viewport for editing/export and disables hidden canvas hotkeys', async () => {
  const doc = makeDoc({ mcu: 'uno' })
  const id = place(doc, 'resistor', 'bb1', 'a10')
  const rotate = vi.fn(), remove = vi.fn(), onSelect = vi.fn()
  const props = { doc, tool: 'select', selectedIds: [id], onRotateComponent: rotate, onRemove: remove, onSelect, onWireColorChange: vi.fn() }
  const view = render(<CircuitViewport allow3D {...props} />)
  const svg = view.container.querySelector('[data-canvas-svg]')
  const transform = svg.querySelector('[data-viewport]').getAttribute('transform')
  expect(screen.queryByTestId('3d')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '3D' }))
  await screen.findByTestId('3d')
  document.activeElement?.blur()
  fireEvent.keyDown(document, { key: 'r' }); fireEvent.keyDown(document, { key: 'Delete' })
  expect(rotate).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled()
  expect(svg.closest('[inert]')).toBeTruthy()
  expect(svg.querySelector('[data-viewport]').getAttribute('transform')).toBe(transform)
  fireEvent.click(screen.getByRole('button', { name: 'Inspect model' }))
  expect(onSelect).toHaveBeenCalledWith(['c_uno'])
  view.rerender(<CircuitViewport allow3D {...props} simState={{ millis: 1234 }} />)
  expect(screen.getByTestId('3d').textContent).toContain('1234')
  fireEvent.click(screen.getByRole('button', { name: '2D' }))
  expect(view.container.querySelector('[data-canvas-svg]')).toBe(svg)
  expect(svg.closest('[inert]')).toBeNull()
  expect(screen.getByTestId('3d').getAttribute('data-active')).toBe('false')
  const root = view.container.querySelector('[data-canvas-root]')
  root.focus(); fireEvent.keyDown(root, { key: 'r' })
  await waitFor(() => expect(rotate).toHaveBeenCalledWith(id))
})

it('offers the 3D switch only where enabled', () => {
  render(<CircuitViewport doc={makeDoc()} selectedIds={[]} onWireColorChange={() => {}} />)
  expect(screen.queryByRole('button', { name: '3D' })).toBeNull()
  expect(screen.getByRole('application', { name: 'Breadboard canvas' })).toBeTruthy()
})

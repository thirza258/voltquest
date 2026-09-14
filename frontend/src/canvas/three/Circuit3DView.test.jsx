// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Circuit3DView from './Circuit3DView.jsx'
import { createCircuitViewer } from './viewer.js'
import { makeDoc } from '../../engine/components/seeds.js'
import { LanguageSelect, LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'

vi.mock('./viewer.js', () => ({ createCircuitViewer: vi.fn() }))
let viewer
beforeEach(() => {
  installMemoryStorage()
  viewer = { update: vi.fn(), setActive: vi.fn(), dispose: vi.fn(), fit: vi.fn(), orbit: vi.fn(), zoom: vi.fn() }
  createCircuitViewer.mockReset().mockReturnValue(viewer)
})
afterEach(cleanup)
it('updates live state, pauses when hidden and releases rendering resources on leaving', () => {
  const doc = makeDoc({ mcu: 'uno' }), onSelect = vi.fn()
  const view = render(<Circuit3DView doc={doc} simState={{ powered: true }} selectedIds={[]} onSelect={onSelect} />)
  expect(createCircuitViewer).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText('Inspect a 3D part'), { target: { value: 'c_uno' } })
  expect(onSelect).toHaveBeenCalledWith(['c_uno'])
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' })
  expect(viewer.orbit).toHaveBeenCalled()
  view.rerender(<Circuit3DView doc={doc} simState={{ powered: false }} selectedIds={['c_uno']} active={false} onSelect={onSelect} />)
  expect(viewer.update).toHaveBeenLastCalledWith(doc, { powered: false }, ['c_uno'])
  expect(viewer.setActive).toHaveBeenLastCalledWith(false)
  expect(createCircuitViewer).toHaveBeenCalledTimes(1)
  view.unmount()
  expect(viewer.dispose).toHaveBeenCalledTimes(1)
})
it('returns to 2D when WebGL is unavailable', () => {
  createCircuitViewer.mockImplementation(() => { throw new Error('No WebGL') })
  const back = vi.fn()
  render(<Circuit3DView doc={makeDoc({ mcu: 'uno' })} selectedIds={[]} onSelect={() => {}} onReturnTo2D={back} />)
  expect(screen.getByRole('status').textContent).toContain('unavailable')
  expect(screen.getByRole('button', { name: 'Orbit left' }).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Return to 2D' }))
  expect(back).toHaveBeenCalledOnce()
})
it('localization keeps the camera instance and selection intact', () => {
  render(<LocaleProvider><LanguageSelect /><Circuit3DView doc={makeDoc({ mcu: 'uno' })} selectedIds={['c_uno']} onSelect={() => {}} /></LocaleProvider>)
  fireEvent.change(screen.getByLabelText('Language / Bahasa'), { target: { value: 'id' } })
  expect(screen.getByRole('application', { name: 'Tampilan rangkaian 3D' })).toBeTruthy()
  expect(screen.getByLabelText('Periksa komponen 3D').value).toBe('c_uno')
  expect(createCircuitViewer).toHaveBeenCalledOnce()
})

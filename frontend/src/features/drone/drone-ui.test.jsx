// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import DroneConfigurator, { addDronePart, DroneInspector } from './DroneConfigurator.jsx'
import DroneCodeTools from './DroneCodeTools.jsx'
import { createDroneDoc } from '../../engine/drone/document.js'
import { useDocumentStore } from '../../store/documentStore.js'
import { ASSISTED_CODE } from '../../engine/drone/examples.js'
import { installMemoryStorage } from '../../test-utils/localStorage.js'

beforeEach(() => { installMemoryStorage(); useDocumentStore.getState().load(createDroneDoc()) })
afterEach(cleanup)
it('commits configuration edits to the existing undo stack', () => {
  render(<DroneConfigurator doc={useDocumentStore.getState().doc} />)
  fireEvent.change(screen.getByLabelText('motors Motor Kv (RPM/V)'), { target: { value: '1850' } })
  expect(useDocumentStore.getState().doc.droneConfig.motors.kv).toBe(1850)
  useDocumentStore.getState().undo(); expect(useDocumentStore.getState().doc.droneConfig.motors.kv).toBe(1750)
})
it('refuses occupied or incompatible drops without mutating the document', () => {
  const doc = createDroneDoc()
  expect(() => addDronePart(doc, 'brushless_motor', 'strap')).toThrow()
  expect(() => addDronePart(doc, 'brushless_motor', 'arm1')).toThrow()
  const next = addDronePart(doc, 'gps', 'gps')
  expect(next.components).toHaveLength(doc.components.length + 1)
  expect(doc.components.some(p => p.type === 'gps')).toBe(false)
})
it('keeps public configuration, prop state and removal controls read-only', () => {
  const doc = createDroneDoc()
  const view = render(<DroneConfigurator doc={doc} readOnly />)
  expect(screen.getByLabelText('motors Motor Kv (RPM/V)').disabled).toBe(true)
  view.rerender(<DroneInspector doc={doc} selectedIds={['c_prop1']} readOnly />)
  expect(screen.getByLabelText('Propeller fitted').disabled).toBe(true)
  expect(screen.getByRole('button', { name: 'Remove part' }).disabled).toBe(true)
})
it('requires confirmation before replacing a sketch and edits real PID code', () => {
  const onCode = vi.fn()
  render(<DroneCodeTools code={ASSISTED_CODE} onCode={onCode} board="esp32" />)
  fireEvent.change(screen.getByLabelText('P'), { target: { value: '.002' } })
  expect(onCode.mock.calls[0][0]).toContain('Flight.setGains(0.002,')
  onCode.mockClear()
  fireEvent.change(screen.getByLabelText('Flight code example'), { target: { value: 'Write a rate PID' } })
  expect(onCode).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Load example' }))
  expect(onCode.mock.calls[0][0]).toContain('PID rollPID')
})

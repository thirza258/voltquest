// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import WorkspacePage from './WorkspacePage.jsx'
import { useDocumentStore } from '../../store/documentStore.js'
import { useWorkspaceStore } from '../../store/workspaceStore.js'
import { useSimStore } from '../../store/simStore.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { LEVELS } from '../../content/index.js'

vi.mock('../code/CodePanel.jsx', () => ({ default: ({ code, onCode, readOnly }) => <textarea aria-label="Test sketch" value={code} readOnly={readOnly} onChange={e => onCode(e.target.value)} /> }))
vi.mock('../../canvas/BreadboardCanvas.jsx', () => ({ BreadboardCanvas: ({ doc, readOnly }) => <div aria-label="Test canvas" data-readonly={readOnly}>{doc.components.map(c => <span key={c.id}>{c.type}</span>)}</div> }))
vi.mock('../../canvas/three/Circuit3DView.jsx', () => ({ default: ({ active }) => <div data-testid="3d-view" data-active={active} /> }))
beforeEach(() => {
  installMemoryStorage()
  usePlayerStore.setState({ token: null, player: null, progress: {}, pendingOps: [], seenLevels: [], seenWorlds: [] })
  useWorkspaceStore.getState().setDraftsEnabled(false)
  useDocumentStore.getState().select([])
  useWorkspaceStore.getState().setLeftTab('parts')
})
afterEach(() => { cleanup(); useSimStore.getState().dispose(); useWorkspaceStore.getState().setDraftsEnabled(false) })
function mount(props, path = '/sandbox') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/sandbox" element={<WorkspacePage mode="sandbox" sessionId="test" seed={{ board: 'uno', starterCode: 'void setup() {}\nvoid loop() {}' }} {...props} />} /><Route path="/play/:levelId" element={<WorkspacePage {...props} />} /></Routes></MemoryRouter>)
}
it('adds parts at valid locations and keeps the simulator running through edits', async () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Add Resistor' }))
  expect(useDocumentStore.getState().doc.components.some(c => c.type === 'resistor')).toBe(true)
  fireEvent.change(screen.getByLabelText('Test sketch'), { target: { value: 'void setup() {Serial.begin(9600); Serial.println(42);}\nvoid loop() {}' } })
  fireEvent.click(screen.getByRole('button', { name: 'Run' }))
  await waitFor(() => expect(useSimStore.getState().state.status).toBe('running'))
  await act(async () => { useSimStore.getState().sim.advance(100) })
  expect(useSimStore.getState().state.serial.map(e => e.text).join('')).toContain('42')
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
  await waitFor(() => expect(useSimStore.getState().state.status).toBe('stopped'))
})
it('switches to a Pi controller with Python text and no block document', () => {
  mount()
  fireEvent.change(screen.getByRole('combobox', { name: 'Board' }), { target: { value: 'raspberrypi5' } })
  expect(useDocumentStore.getState().doc.mcu).toBe('raspberrypi5')
  expect(useWorkspaceStore.getState().editorMode).toBe('text')
  expect(useWorkspaceStore.getState().code).toContain('gpiozero')
  expect(useWorkspaceStore.getState().blocklyXml).toBeNull()
})
it('switches between 2D and 3D without restarting firmware, losing edits or adding undo entries', async () => {
  mount()
  fireEvent.change(screen.getByLabelText('Test sketch'), { target: { value: 'void setup() {Serial.begin(9600);} void loop() {Serial.println(millis()); delay(100);}' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add NTC thermistor (10 kΩ)' }))
  const doc = useDocumentStore.getState().doc
  const history = useDocumentStore.getState().past
  const code = useWorkspaceStore.getState().code
  fireEvent.click(screen.getByRole('button', { name: 'Run' }))
  await waitFor(() => expect(useSimStore.getState().state.status).toBe('running'))
  await act(async () => useSimStore.getState().sim.advance(120))
  const sim = useSimStore.getState().sim, runId = sim.getState().runId, millis = sim.getState().millis
  fireEvent.click(screen.getByRole('button', { name: '3D' }))
  await screen.findByTestId('3d-view')
  await act(async () => sim.advance(120))
  fireEvent.click(screen.getByRole('button', { name: '2D' }))
  expect(useDocumentStore.getState().doc).toBe(doc)
  expect(useDocumentStore.getState().past).toBe(history)
  expect(useWorkspaceStore.getState().code).toBe(code)
  expect(useSimStore.getState().sim).toBe(sim)
  expect(sim.getState().runId).toBe(runId)
  expect(sim.getState().status).toBe('running')
  expect(sim.getState().millis).toBeGreaterThan(millis)
})
it('keeps shared projects read-only while exposing Run', () => {
  mount({ mode: 'showcase' })
  expect(screen.getByRole('button', { name: 'Add Resistor' }).disabled).toBe(true)
  expect(screen.getByLabelText('Test sketch').readOnly).toBe(true)
  expect(screen.getByRole('combobox', { name: 'Board' }).disabled).toBe(true)
  expect(screen.getByRole('button', { name: 'Run' }).disabled).toBe(false)
})
it('awards an idle wiring completion once and opens the success flow', async () => {
  const level = LEVELS['w1-l2']
  mount({ seed: { ...level, starterCircuit: level.solution.circuit, starterCode: level.solution.code } }, '/play/w1-l2')
  await waitFor(() => expect(usePlayerStore.getState().progress['w1-l2']?.stars).toBe(3))
  const xp = usePlayerStore.getState().player.xp
  await act(async () => { useSimStore.getState().sim.advance(100) })
  expect(usePlayerStore.getState().player.xp).toBe(xp)
  expect(screen.getByRole('dialog').textContent).toContain('Quest complete!')
})
it('writes a final draft and disposes the runtime when the workspace closes', () => {
  const { unmount } = mount()
  fireEvent.change(screen.getByLabelText('Test sketch'), { target: { value: '// work in progress' } })
  unmount()
  expect(useWorkspaceStore.getState().peekDraft('sandbox', 'test').code).toBe('// work in progress')
  expect(useSimStore.getState().sim).toBeNull()
})

// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import SandboxPage from './SandboxPage.jsx'
import { api, ApiError } from '../../api/client.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { useWorkspaceStore } from '../../store/workspaceStore.js'
import { useSimStore } from '../../store/simStore.js'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { LEVELS } from '../../content/index.js'
import { projectFile, projectPayload } from './projectFile.js'
import { cacheProject, cachedProject, cachedProjects } from './projectCache.js'

vi.mock('../workspace/WorkspacePage.jsx', async () => {
  const { useLevelSession } = await import('../../hooks/useLevelSession.js')
  return { default: function TestWorkspace({ seed, mode, sessionId, title, actions }) {
    const { code, draftOffer } = useLevelSession({ level: seed, mode, levelId: sessionId })
    return <div>{title}{actions}<pre aria-label="Loaded code">{code}</pre>{draftOffer && <span>Draft offer</span>}<span aria-label="Session ID">{sessionId}</span></div>
  } }
})
beforeEach(() => {
  installMemoryStorage()
  usePlayerStore.setState({ player: { id: 'owner' }, token: 'owner-token', pendingOps: [] })
  vi.spyOn(usePlayerStore.getState(), 'ensureGuest').mockResolvedValue(null)
  useWorkspaceStore.getState().setDraftsEnabled(false)
})
afterEach(() => { cleanup(); useSimStore.getState().dispose(); useWorkspaceStore.getState().setDraftsEnabled(false); vi.restoreAllMocks() })
function Location() { return <span aria-label="Current path">{useLocation().pathname}</span> }
function mount(path = '/sandbox') {
  return render(<MemoryRouter initialEntries={[path]}><Location /><Link to="/elsewhere">Leave workspace</Link><Routes><Route path="/sandbox" element={<SandboxPage />} /><Route path="/sandbox/:projectId" element={<SandboxPage />} /><Route path="/elsewhere" element={<p>Another page</p>} /></Routes></MemoryRouter>)
}
function cachedFixture() {
  const solution = LEVELS['w1-l4'].solution
  return { ...projectPayload(projectFile({ name: 'Offline lamp', circuit: solution.circuit, code: solution.code })), id: 'offline', owner_id: 'owner' }
}
it('opens an owned cached project offline and offers its newer draft', async () => {
  const project = cachedFixture()
  cacheProject(project)
  localStorage.setItem('vq.draft.sandbox.offline', JSON.stringify({ doc: project.circuit, code: '// newer local edit' }))
  vi.spyOn(api.projects, 'get').mockRejectedValue(new ApiError(0, 'Network error'))
  mount('/sandbox/offline')
  expect((await screen.findByLabelText('Project name')).value).toBe('Offline lamp')
  expect(await screen.findByText('Draft offer')).toBeTruthy()
})
it('does not bypass a rejected server authorization using the offline cache', async () => {
  cacheProject(cachedFixture())
  vi.spyOn(api.projects, 'get').mockRejectedValue(new ApiError(401, 'Session expired'))
  mount('/sandbox/offline')
  expect((await screen.findByRole('alert')).textContent).toBe('Session expired')
  expect(screen.queryByLabelText('Loaded code')).toBeNull()
})
it('bounds cached snapshots and separates owners', () => {
  for (let i = 1; i <= 4; i++) cacheProject({ ...cachedFixture(), id: `cache${i}` })
  expect(cachedProjects('owner')).toHaveLength(3)
  expect(cachedProject('cache1', 'owner')).toBeNull()
  expect(cachedProject('cache4', 'another-owner')).toBeNull()
})
it('does not reopen a project if its save finishes after the user leaves', async () => {
  let finish
  vi.spyOn(api.projects, 'create').mockImplementation(body => new Promise(resolve => { finish = () => resolve({ ...body, id: 'late' }) }))
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Save', exact: true }))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('link', { name: 'Leave workspace' }))
  await act(async () => { finish() })
  await waitFor(() => expect(screen.getByLabelText('Current path').textContent).toBe('/elsewhere'))
})
it('saves a new project and opens its server ID with the same code and saved state', async () => {
  vi.spyOn(api.projects, 'create').mockImplementation(async body => ({ ...body, id: 'created', is_public: false }))
  mount()
  const name = await screen.findByLabelText('Project name')
  fireEvent.change(name, { target: { value: 'My saved circuit' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
  await waitFor(() => expect(screen.getByLabelText('Session ID').textContent).toBe('created'))
  expect(screen.getByLabelText('Current path').textContent).toBe('/sandbox/created')
  expect(screen.getByLabelText('Project name').value).toBe('My saved circuit')
  expect(screen.getByText('Saved')).toBeTruthy()
  expect(api.projects.create).toHaveBeenCalledWith(expect.objectContaining({ board: 'uno', editor_mode: 'text' }))
})
it('imports only after confirmation and does not offer an unrelated new-project draft', async () => {
  const solution = LEVELS['w1-l4'].solution
  localStorage.setItem('vq.draft.sandbox', JSON.stringify({ code: '// old draft', doc: solution.circuit }))
  mount()
  await screen.findByLabelText('Project name')
  const file = projectFile({ name: 'Imported blink', circuit: solution.circuit, code: solution.code })
  fireEvent.change(screen.getByLabelText('Import project file'), { target: { files: [{ size: 1000, text: async () => JSON.stringify(file) }] } })
  await screen.findByRole('dialog')
  expect(screen.getByLabelText('Project name').value).not.toBe('Imported blink')
  fireEvent.click(screen.getByRole('button', { name: 'Open imported project' }))
  await waitFor(() => expect(screen.getByLabelText('Project name').value).toBe('Imported blink'))
  expect(screen.getByLabelText('Loaded code').textContent).toBe(solution.code)
  expect(screen.queryByText('Draft offer')).toBeNull()
})
it('leaves the open circuit intact when an imported file is invalid', async () => {
  mount()
  await screen.findByLabelText('Project name')
  const code = screen.getByLabelText('Loaded code').textContent
  fireEvent.change(screen.getByLabelText('Import project file'), { target: { files: [{ size: 10, text: async () => '{invalid' }] } })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByLabelText('Loaded code').textContent).toBe(code)
})

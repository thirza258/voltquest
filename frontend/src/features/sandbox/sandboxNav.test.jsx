// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import matlabReference from '@content/matlab-functions.json'
import { ALL_SANDBOXES, CIRCUIT_PART_TYPES, CYBER_DEFENSES, getSandbox, getSandboxByBench, HPC_LABS, MATLAB_BROWSER_FUNCTIONS } from './sandboxDirectory.js'
import { unsavedBenchWork, useUnsavedBenchWork } from './benchGuard.js'
import { listDefs } from '../../engine/components/registry.js'
import { CONTROLS } from '../../engine/cybersecurity/model.js'
import { LABS as HPC_MODEL_LABS } from '../../engine/hpc/model.js'
import SandboxNavSidebar from './SandboxNavSidebar.jsx'
import SandboxBenchLayout from './SandboxBenchLayout.jsx'
import AllCoursesSection from '../courses/AllCoursesSection.jsx'
import { ALL_COURSES } from '../courses/coursesDirectory.js'
import WorkspacePage from '../workspace/WorkspacePage.jsx'
import { useWorkspaceStore } from '../../store/workspaceStore.js'
import { usePlayerStore } from '../../store/playerStore.js'

vi.mock('../code/CodePanel.jsx', () => ({ default: () => <div data-testid="code-panel">Code Editor</div> }))
vi.mock('../../canvas/BreadboardCanvas.jsx', () => ({ BreadboardCanvas: () => <div data-testid="canvas">Canvas</div> }))
vi.mock('../../canvas/three/Circuit3DView.jsx', () => ({ default: () => <div data-testid="3d-view">3D View</div> }))

beforeEach(() => {
  installMemoryStorage()
  usePlayerStore.setState({ token: null, player: null, progress: {}, pendingOps: [], seenLevels: [], seenWorlds: [] })
  useWorkspaceStore.getState().setDraftsEnabled(false)
  useWorkspaceStore.getState().setLeftTab('parts')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Course catalog consistency', () => {
  it('contains all 16 specialized courses with consistent metadata', () => {
    expect(ALL_COURSES).toHaveLength(16)
    for (const course of ALL_COURSES) {
      expect(course.id).toBeTruthy()
      expect(course.title).toBeTruthy()
      expect(course.category).toBeTruthy()
      expect(course.summary).toBeTruthy()
      expect(course.href).toBeTruthy()
      expect(course.primaryAction).toBeTruthy()
      expect(course.topics.length).toBeGreaterThan(0)
    }
  })

  it('renders AllCoursesSection with all courses and domain filters', () => {
    render(
      <LocaleProvider>
        <MemoryRouter>
          <AllCoursesSection />
        </MemoryRouter>
      </LocaleProvider>
    )

    expect(screen.getByRole('heading', { level: 2, name: 'All Courses & Learning Tracks' })).toBeTruthy()
    // All 16 courses rendered as h4 titles
    const courseHeadings = screen.getAllByRole('heading', { level: 4 })
    expect(courseHeadings.length).toBe(16)

    // Filter by domain button: Desktop & Systems (2 tracks: Qt & WinUI)
    fireEvent.click(screen.getByRole('button', { name: /Desktop & Systems/ }))
    const filteredHeadings = screen.getAllByRole('heading', { level: 4 })
    expect(filteredHeadings.length).toBe(2)
    expect(filteredHeadings.map(h => h.textContent)).toEqual([
      'Qt 6 / C++ Desktop Development',
      'C++ / WinUI 3 Desktop Development',
    ])
  })
})

describe('Sandbox sidebar navigation', () => {
  it('lists ten benches with canonical names and counts checked against the real content', () => {
    expect(ALL_SANDBOXES).toHaveLength(10)
    expect(getSandbox('circuit').name).toBe('Circuit & breadboard')
    expect(getSandboxByBench('avr')).toMatchObject({ name: 'AVR assembler IDE', title: 'AVR assembler sandbox', saving: 'manual' })
    expect(getSandboxByBench('matlab')).toMatchObject({ name: 'MATLAB', title: 'MATLAB sandbox', saving: 'manual' })
    expect(getSandboxByBench('drone').saving).toBe('draft')
    expect(new Set(ALL_SANDBOXES.map(item => item.title)).size).toBe(10)
    expect(CIRCUIT_PART_TYPES).toBe(listDefs().length)
    expect(MATLAB_BROWSER_FUNCTIONS).toBe(matlabReference.functions.filter(item => item.scope === 'browser').length)
    expect(CYBER_DEFENSES).toBe(Object.keys(CONTROLS).length)
    expect(HPC_LABS).toBe(Object.keys(HPC_MODEL_LABS).length)
  })

  it('describes only what each bench executes', () => {
    const text = ALL_SANDBOXES.map(item => item.description).join(' ')
    // Claims the engines do not back: no FFT or ODE solver in the MATLAB subset, no ArUco, no
    // scanning LiDAR and no real threads, processes or trained vision models in the browser.
    for (const claim of [/\bFFT\b/, /ArUco/i, /laser|lidar/i, /multithread/i, /vision transformers?/i, /ODE simulation/i]) expect(text).not.toMatch(claim)
    expect(getSandboxByBench('robotics').description).toContain('one forward range ray')
    expect(getSandboxByBench('ai-agents').description).toContain('scripted model')
  })

  it('renders every bench once, marks the current one and states how work is kept', () => {
    render(<LocaleProvider><MemoryRouter initialEntries={['/sandbox']}><SandboxNavSidebar currentBench="circuit" /></MemoryRouter></LocaleProvider>)
    const rail = screen.getByRole('complementary', { name: 'All available sandboxes' })
    for (const sandbox of ALL_SANDBOXES) expect(within(rail).getByText(sandbox.name)).toBeTruthy()
    expect(within(rail).getByRole('link', { current: 'page' }).textContent).toContain('Circuit & breadboard')
    expect(rail.textContent).toContain('Circuit and drone drafts save automatically')
    expect(rail.textContent).not.toContain('Local work is saved')
  })

  it('keeps one bench navigation in the circuit workspace', () => {
    render(<LocaleProvider><MemoryRouter initialEntries={['/sandbox']}><Routes><Route path="/sandbox" element={<WorkspacePage mode="sandbox" sessionId="test" seed={{ board: 'uno', starterCode: 'void setup() {}' }} />} /></Routes></MemoryRouter></LocaleProvider>)
    expect(screen.getByRole('complementary', { name: 'All available sandboxes' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Sandboxes' })).toBeNull()
  })

  it('titles bench pages from the directory and reports the real save behaviour', () => {
    render(<LocaleProvider><MemoryRouter initialEntries={['/sandbox?bench=computer']}><SandboxBenchLayout bench="computer" description="Test description." courseLink="/computer-architecture" courseLinkLabel="Back to the course"><div data-testid="test-content">Bench Lab Content</div></SandboxBenchLayout></MemoryRouter></LocaleProvider>)
    expect(screen.getByRole('complementary', { name: 'All available sandboxes' })).toBeTruthy()
    expect(screen.getByTestId('test-content')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Computer architecture sandbox' })).toBeTruthy()
    expect(screen.getByText('Back to the course')).toBeTruthy()
    expect(screen.getByText(/Level 1/)).toBeTruthy()
    expect(screen.getByText('Computer architecture · Stored in this browser only when you save')).toBeTruthy()
  })

  it('asks before leaving unsaved bench work and never writes a circuit draft from another bench', () => {
    const saveDraft = vi.spyOn(useWorkspaceStore.getState(), 'saveDraft')
    function Dirty() { useUnsavedBenchWork(true, 'MATLAB notebook'); return null }
    function Where() { const location = useLocation(); return <p data-testid="where">{location.pathname}{location.search}</p> }
    const view = render(<LocaleProvider><MemoryRouter initialEntries={['/sandbox?bench=matlab']}><SandboxNavSidebar currentBench="matlab" /><Dirty /><Where /></MemoryRouter></LocaleProvider>)
    const rail = screen.getByRole('complementary', { name: 'All available sandboxes' })
    fireEvent.click(within(rail).getByText('HPC (C/C++)'))
    expect(screen.getByRole('dialog').textContent).toContain('MATLAB notebook has changes that are not saved in this browser')
    fireEvent.click(screen.getByRole('button', { name: 'Stay on this bench' }))
    expect(screen.getByTestId('where').textContent).toBe('/sandbox?bench=matlab')
    fireEvent.click(within(rail).getByText('HPC (C/C++)'))
    fireEvent.click(screen.getByRole('button', { name: 'Leave without saving' }))
    expect(screen.getByTestId('where').textContent).toBe('/sandbox?bench=hpc')
    expect(saveDraft).not.toHaveBeenCalled()
    view.unmount()
    expect(unsavedBenchWork()).toBeNull()
  })
})

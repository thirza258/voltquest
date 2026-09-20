// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { ALL_SANDBOXES, getSandbox, getSandboxByBench } from './sandboxDirectory.js'
import SandboxNavSidebar from './SandboxNavSidebar.jsx'
import SandboxListPanel from './SandboxListPanel.jsx'
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
  it('contains all 10 specialized courses with consistent metadata', () => {
    expect(ALL_COURSES).toHaveLength(10)
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
    // All 10 courses rendered as h4 titles
    const courseHeadings = screen.getAllByRole('heading', { level: 4 })
    expect(courseHeadings.length).toBe(10)

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
  it('contains all 9 available sandboxes with valid paths', () => {
    expect(ALL_SANDBOXES).toHaveLength(9)
    expect(getSandbox('circuit').name).toBe('Circuit & Breadboard')
    expect(getSandboxByBench('matlab').name).toBe('MATLAB Numerical Lab')
    expect(getSandboxByBench('cybersecurity').name).toBe('Web Security Sandbox')
    expect(getSandboxByBench('hpc').name).toBe('HPC & Parallel Bench')
    expect(getSandboxByBench('ai-agents').name).toBe('AI Agent Workbench')
    expect(getSandboxByBench('computer').name).toBe('Computer Architecture')
  })

  it('renders SandboxNavSidebar with all available sandboxes', () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/sandbox']}>
          <SandboxNavSidebar currentBench="circuit" />
        </MemoryRouter>
      </LocaleProvider>
    )

    // Verify all sandboxes are displayed in the sidebar
    expect(screen.getByRole('complementary', { name: 'All available sandboxes' })).toBeTruthy()
    for (const sandbox of ALL_SANDBOXES) {
      expect(screen.getAllByText(sandbox.name).length).toBeGreaterThan(0)
    }

    // Circuit is active
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
  })

  it('renders SandboxListPanel and switches benches', () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/sandbox']}>
          <SandboxListPanel currentBench="circuit" />
        </MemoryRouter>
      </LocaleProvider>
    )

    expect(screen.getByText('All Available Sandboxes')).toBeTruthy()
    expect(screen.getByText('Current')).toBeTruthy()
    const openButtons = screen.getAllByRole('button', { name: 'Open' })
    expect(openButtons.length).toBe(8) // 9 - 1 current
  })

  it('integrates SandboxNavSidebar and sandboxes tab in WorkspacePage sandbox mode', () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/sandbox']}>
          <Routes>
            <Route
              path="/sandbox"
              element={<WorkspacePage mode="sandbox" sessionId="test" seed={{ board: 'uno', starterCode: 'void setup() {}' }} />}
            />
          </Routes>
        </MemoryRouter>
      </LocaleProvider>
    )

    // Dedicated sandboxes sidebar rail is rendered
    expect(screen.getByRole('complementary', { name: 'All available sandboxes' })).toBeTruthy()

    // Sandboxes tab is available in circuit panel tabs
    const sandboxesTab = screen.getByRole('tab', { name: 'Sandboxes' })
    expect(sandboxesTab).toBeTruthy()

    // Clicking the tab opens the panel
    fireEvent.click(sandboxesTab)
    expect(screen.getByRole('region', { name: 'All available sandboxes' })).toBeTruthy()
  })
})

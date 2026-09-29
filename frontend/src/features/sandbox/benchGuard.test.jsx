// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { unsavedBenchWork } from './benchGuard.js'
import ComputerPage from '../computer/ComputerPage.jsx'
import AgentsPage from '../agents/AgentsPage.jsx'
import MatlabPage from '../matlab/MatlabPage.jsx'
import CybersecurityPage from '../cybersecurity/CybersecurityPage.jsx'
import HpcPage from '../hpc/HpcPage.jsx'
import VisionPage from '../vision/VisionPage.jsx'
import RoboticsPage from '../robotics/RoboticsPage.jsx'

vi.mock('../vision/opencvLoader.js', () => ({ loadOpenCv: vi.fn(async () => ({ cv: {} })) }))
vi.mock('../../engine/vision/opencv.js', () => ({ processOpenCv: vi.fn((_cv, scene) => ({ ...scene, metrics: { count: 517, fraction: 0.03, centroid: { x: 64, y: 64 }, errorX: 0, iou: 1 } })) }))
vi.mock('../vision/VisionIntegration.jsx', () => ({ default: () => <div /> }))

beforeEach(() => installMemoryStorage())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const clickFirst = names => fireEvent.click(names.map(name => screen.queryByRole('button', { name, exact: true })).find(Boolean))
// Each bench: a no-edit action that must not count as unsaved work, and one real edit that must.
const BENCHES = [
  ['computer', ComputerPage, ['computer-gates', 'computer-latches', 'computer-cpu'], () => clickFirst(['Evaluate circuit', 'Apply latch inputs', 'Assemble']), () => change('Experiment notes', 'edited')],
  ['ai-agents', AgentsPage, ['agents-codex', 'agents-mcp'], () => click('Run until pause'), () => change('Experiment notes', 'edited')],
  ['matlab', MatlabPage, ['matlab-ode', 'matlab-capstone'], () => click('Run script'), () => change('Experiment notes', 'edited')],
  ['cybersecurity', CybersecurityPage, ['cyber-sql', 'cyber-capstone'], () => { change('Security terminal command', 'curl /health'); click('Run command') }, () => change('Investigation notes', 'edited')],
  ['hpc', HpcPage, ['hpc-mpi', 'hpc-capstone'], () => click('Run experiment'), () => change('Experiment notes', 'edited')],
  ['vision', VisionPage, ['opencv-drone', 'vision-transformers'], () => {}, () => change('Target horizontal offset (px)', '12')],
  ['robotics', RoboticsPage, ['robot-motion', 'ros2-services'], () => click('Step 0.1 s'), () => change('Robotics project JSON', '{}')],
]

describe('unsaved bench work', () => {
  for (const [bench, Page, lessons, act_, edit] of BENCHES) {
    for (const lesson of [null, ...lessons]) {
      it(`${bench}${lesson ? ` · ${lesson}` : ''} starts clean, stays clean after running and registers a real edit`, async () => {
        const path = `/sandbox?bench=${bench}${lesson ? `&lesson=${lesson}` : ''}`
        render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/sandbox" element={<Page sandbox />} /></Routes></MemoryRouter></LocaleProvider>)
        // A preset id that does not exist renders "Course not found"; every id above must resolve.
        expect(screen.queryByRole('heading', { name: 'Course not found' })).toBeNull()
        await act(async () => {})
        expect(unsavedBenchWork()).toBeNull()
        await act(async () => { act_() })
        expect(unsavedBenchWork()).toBeNull()
        await act(async () => { edit() })
        expect(unsavedBenchWork()).not.toBeNull()
      })
    }
  }
})

// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import RoboticsPage, { ROBOTICS_TUTORIALS } from './RoboticsPage.jsx'
import RoboticsLab, { ROBOT_PROJECT_KEY } from './RoboticsLab.jsx'
import { createSimulation, validateProject } from '../../engine/robotics/model.js'
import { readCourseProgress } from '../courses/progress.js'

beforeEach(() => installMemoryStorage())
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
const lab = () => render(<LocaleProvider><RoboticsLab /></LocaleProvider>)
const pose = () => within(screen.getByLabelText('Robot telemetry')).getByText(/1\.000 \/ 1\.000 m/)
function page(path) { return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/robotics" element={<RoboticsPage />} /><Route path="/robotics/:lessonId" element={<RoboticsPage />} /></Routes></MemoryRouter></LocaleProvider>) }

it('authors exactly five ordered lessons with valid experiments, formulas, assessments and projects', () => {
  expect(ROBOTICS_TUTORIALS).toHaveLength(5)
  expect(ROBOTICS_TUTORIALS.map(l => l.difficulty)).toEqual(['Easy', 'Easy', 'Easy', 'Intermediate', 'Intermediate'])
  for (const [i, lesson] of ROBOTICS_TUTORIALS.entries()) {
    expect(lesson.order).toBe(i + 1); expect(lesson.lessons).toHaveLength(3); expect(lesson.formulas).toHaveLength(2)
    expect(lesson.steps).toHaveLength(4); expect(lesson.practice).toHaveLength(2); expect(lesson.exam.questions).toHaveLength(5)
    expect(createSimulation(lesson.project).time).toBe(0)
    for (const question of [...lesson.practice, ...lesson.exam.questions]) {
      expect(question.options.filter(o => o.id === question.answerId)).toHaveLength(1)
      expect(lesson.lessons.some(s => s.id === question.lessonId)).toBe(true)
    }
  }
})
it('links the five tutorials and freeform sandbox', () => {
  page('/robotics'); expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(5)
  expect(screen.getByRole('link', { name: 'Open robotics sandbox' }).getAttribute('href')).toBe('/sandbox?bench=robotics')
})
it('drives the actual model using publish and step controls and resets through the service', () => {
  lab(); expect(pose()).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'Publish Twist once' }))
  fireEvent.click(screen.getByRole('button', { name: 'Step 0.1 s' }))
  expect(screen.getByText('1.040 / 1.000 m')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Reset pose service' })); expect(pose()).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('success = true')
})
it('shows topic mismatch and refuses invalid parameter changes without resetting pose', () => {
  lab(); fireEvent.change(screen.getByLabelText('Publisher topic'), { target: { value: '/wrong' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply graph' })); fireEvent.click(screen.getByRole('button', { name: 'Publish Twist once' })); fireEvent.click(screen.getByRole('button', { name: 'Step 0.1 s' })); expect(pose()).toBeTruthy()
  expect(screen.getByText('Topic mismatch: the drive receives no new commands')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Maximum speed (m/s)'), { target: { value: '5' } }); fireEvent.click(screen.getByRole('button', { name: 'Apply parameters' }))
  expect(screen.getByRole('alert').textContent).toContain('Parameters:'); expect(pose()).toBeTruthy()
})
it('requires confirmation for edited projects, then saves and reloads the applied geometry', () => {
  lab(); const editor = screen.getByLabelText('Robotics project JSON'); const project = JSON.parse(editor.value)
  project.name = 'Teaching robot'; project.robot.wheelRadius = 0.1
  fireEvent.change(editor, { target: { value: JSON.stringify(project) } }); fireEvent.click(screen.getByRole('button', { name: 'Review project changes' }))
  expect(screen.getByRole('dialog')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Save robot project' })); expect(JSON.parse(localStorage.getItem(ROBOT_PROJECT_KEY)).robot.wheelRadius).toBe(0.05)
  fireEvent.click(screen.getByRole('button', { name: 'Review project changes' })); fireEvent.click(screen.getByRole('button', { name: 'Apply and reset robot' })); fireEvent.click(screen.getByRole('button', { name: 'Save robot project' }))
  expect(validateProject(JSON.parse(localStorage.getItem(ROBOT_PROJECT_KEY)))).toEqual(project)
  cleanup(); lab(); fireEvent.click(screen.getByRole('button', { name: 'Load saved robot' })); fireEvent.click(screen.getByRole('button', { name: 'Apply and reset robot' }))
  expect(JSON.parse(screen.getByLabelText('Robotics project JSON').value)).toEqual(project)
})
it('rejects malformed edits without replacing the world', () => {
  lab(); fireEvent.change(screen.getByLabelText('Robotics project JSON'), { target: { value: '{no' } }); fireEvent.click(screen.getByRole('button', { name: 'Review project changes' }))
  expect(screen.getByRole('alert').textContent).toContain('JSON'); expect(screen.queryByRole('dialog')).toBeNull(); expect(pose()).toBeTruthy()
})
it('runs deterministically, cancels an action, and cleans up timers on blur and unmount', () => {
  vi.useFakeTimers(); const view = lab(); fireEvent.click(screen.getByRole('button', { name: 'Start waypoint action' })); fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }))
  act(() => vi.advanceTimersByTime(1000)); expect(screen.queryByText('1.000 / 1.000 m')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel action' })); expect(screen.getByLabelText('Action result').textContent).toBe('cancelled')
  fireEvent(window, new Event('blur')); expect(screen.getByRole('button', { name: 'Run simulation' })).toBeTruthy()
  view.unmount(); expect(vi.getTimerCount()).toBe(0)
})
it('preserves lesson checks and exam choices across locale changes and stores a passing score', () => {
  page('/robotics/robot-motion'); const lesson = ROBOTICS_TUTORIALS[0]
  fireEvent.click(screen.getAllByRole('checkbox', { name: 'Mark section read' })[0])
  const form = screen.getByRole('form', { name: 'Course exam' })
  for (const [i, question] of lesson.exam.questions.entries()) fireEvent.click(within(within(form).getAllByRole('group')[i]).getByRole('radio', { name: question.options.find(o => o.id === question.answerId).text }))
  fireEvent.change(screen.getByLabelText('Language / Bahasa'), { target: { value: 'id' } }); expect(within(form).getAllByRole('radio').filter(r => r.checked)).toHaveLength(5)
  fireEvent.submit(form); expect(readCourseProgress(lesson)).toMatchObject({ read: ['motion'], attempts: 1, bestPercent: 100 })
})

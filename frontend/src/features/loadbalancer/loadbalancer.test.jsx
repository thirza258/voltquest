// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadText } from '../../lib/download.js'
import { readCourseProgress } from '../courses/progress.js'
import LoadBalancerPage, { LOADBALANCER_COURSES } from './LoadBalancerPage.jsx'

vi.mock('../../lib/download.js', () => ({ downloadText: vi.fn(() => true), downloadJson: vi.fn(() => true), downloadBlob: vi.fn(() => true) }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
function page(path = '/loadbalancer') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/loadbalancer" element={<LoadBalancerPage />} /><Route path="/loadbalancer/:lessonId" element={<LoadBalancerPage />} />
  </Routes></MemoryRouter></LocaleProvider>)
}

describe('Load balancing content', () => {
  it('ships eight load-balancing courses with per-course config types and valid exams', () => {
    expect(LOADBALANCER_COURSES.length).toBe(8)
    expect(new Set(LOADBALANCER_COURSES.map(c => c.id)).size).toBe(8)
    expect(new Set(LOADBALANCER_COURSES.map(c => c.codeExt))).toEqual(new Set(['conf', 'cfg', 'yaml']))
    for (const course of LOADBALANCER_COURSES) {
      expect(typeof course.version).toBe('number')
      expect(course.lessons).toHaveLength(4)
      expect(course.exam.questions).toHaveLength(5)
      expect(course.exam.passPercent).toBe(80)
      expect(course.code.length).toBeGreaterThan(20)
      const questions = [...course.lessons.map(l => l.question), ...course.exam.questions]
      expect(new Set(questions.map(q => q.id)).size).toBe(9)
      for (const q of questions) expect(q.options.some(o => o.id === q.answerId)).toBe(true)
    }
  })
})

describe('Load balancing track page', () => {
  it('lists the courses on the hub', () => {
    page('/loadbalancer')
    expect(screen.getByRole('heading', { name: /Load balancing with NGINX/ })).toBeTruthy()
    expect(screen.getByText(/8 courses found/)).toBeTruthy()
  })
  it('renders a course and downloads its .conf source', () => {
    page('/loadbalancer/lb-fundamentals')
    expect(screen.getByRole('heading', { level: 1, name: LOADBALANCER_COURSES[0].title })).toBeTruthy()
    click('Download lb-fundamentals.conf')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('upstream'), 'lb-fundamentals.conf')
  })
  it('downloads a Kubernetes course as .yaml', () => {
    page('/loadbalancer/lb-capstone')
    click('Download lb-capstone.yaml')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('HorizontalPodAutoscaler'), 'lb-capstone.yaml')
  })
  it('records a passing exam on a load-balancing course', () => {
    page('/loadbalancer/lb-fundamentals')
    const course = LOADBALANCER_COURSES[0], form = screen.getByRole('form', { name: 'Course exam' })
    const groups = within(form).getAllByRole('group')
    course.exam.questions.forEach((question, i) => fireEvent.click(within(groups[i]).getByRole('radio', { name: question.options.find(o => o.id === question.answerId).text })))
    click('Submit exam')
    expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 100 })
  })
  it('rejects an unknown load-balancing course id', () => {
    page('/loadbalancer/nope')
    expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  })
})

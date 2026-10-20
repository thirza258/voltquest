// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadText } from '../../lib/download.js'
import { readCourseProgress } from '../courses/progress.js'
import KubernetesPage, { KUBERNETES_COURSES } from './KubernetesPage.jsx'

vi.mock('../../lib/download.js', () => ({ downloadText: vi.fn(() => true), downloadJson: vi.fn(() => true), downloadBlob: vi.fn(() => true) }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
function page(path = '/kubernetes') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/kubernetes" element={<KubernetesPage />} /><Route path="/kubernetes/:lessonId" element={<KubernetesPage />} />
  </Routes></MemoryRouter></LocaleProvider>)
}

describe('Kubernetes content', () => {
  it('ships ten Kubernetes courses with valid manifests and exams', () => {
    expect(KUBERNETES_COURSES.length).toBe(10)
    expect(new Set(KUBERNETES_COURSES.map(c => c.id)).size).toBe(10)
    for (const course of KUBERNETES_COURSES) {
      expect(typeof course.version).toBe('number')
      expect(course.codeExt).toBe('yaml')
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

describe('Kubernetes track page', () => {
  it('lists the courses on the hub', () => {
    page('/kubernetes')
    expect(screen.getByRole('heading', { name: /Production Kubernetes Architecture/ })).toBeTruthy()
    expect(screen.getByText(/10 courses found/)).toBeTruthy()
  })
  it('renders a course and downloads its .yaml source', () => {
    page('/kubernetes/k8s-architecture')
    expect(screen.getByRole('heading', { level: 1, name: KUBERNETES_COURSES[0].title })).toBeTruthy()
    click('Download k8s-architecture.yaml')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('ResourceQuota'), 'k8s-architecture.yaml')
  })
  it('downloads the production capstone manifest as .yaml', () => {
    page('/kubernetes/k8s-capstone')
    click('Download k8s-capstone.yaml')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('HorizontalPodAutoscaler'), 'k8s-capstone.yaml')
  })
  it('records a passing exam on a Kubernetes course', () => {
    page('/kubernetes/k8s-architecture')
    const course = KUBERNETES_COURSES[0], form = screen.getByRole('form', { name: 'Course exam' })
    const groups = within(form).getAllByRole('group')
    course.exam.questions.forEach((question, i) => fireEvent.click(within(groups[i]).getByRole('radio', { name: question.options.find(o => o.id === question.answerId).text })))
    click('Submit exam')
    expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 100 })
  })
  it('rejects an unknown Kubernetes course id', () => {
    page('/kubernetes/unknown-course')
    expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  })
})

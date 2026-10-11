// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadText } from '../../lib/download.js'
import { readCourseProgress } from '../courses/progress.js'
import PytorchPage, { PYTORCH_COURSES } from './PytorchPage.jsx'

vi.mock('../../lib/download.js', () => ({ downloadText: vi.fn(() => true), downloadJson: vi.fn(() => true), downloadBlob: vi.fn(() => true) }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
function page(path = '/pytorch') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/pytorch" element={<PytorchPage />} /><Route path="/pytorch/:lessonId" element={<PytorchPage />} />
  </Routes></MemoryRouter></LocaleProvider>)
}

describe('PyTorch content', () => {
  it('ships ten PyTorch courses with runnable programs and valid exams', () => {
    expect(PYTORCH_COURSES.length).toBe(10)
    expect(new Set(PYTORCH_COURSES.map(c => c.id)).size).toBe(10)
    for (const course of PYTORCH_COURSES) {
      expect(typeof course.version).toBe('number')
      expect(course.lessons).toHaveLength(4)
      expect(course.exam.questions).toHaveLength(5)
      expect(course.exam.passPercent).toBe(80)
      expect(course.code).toContain('import torch')
      const questions = [...course.lessons.map(l => l.question), ...course.exam.questions]
      expect(new Set(questions.map(q => q.id)).size).toBe(9)
      for (const q of questions) expect(q.options.some(o => o.id === q.answerId)).toBe(true)
    }
  })
})

describe('PyTorch track page', () => {
  it('lists the courses on the hub', () => {
    page('/pytorch')
    expect(screen.getByRole('heading', { name: /Build and train ML models with PyTorch/ })).toBeTruthy()
    expect(screen.getByText(/10 courses found/)).toBeTruthy()
  })
  it('renders a course and downloads its .py source', () => {
    page('/pytorch/torch-tensors')
    expect(screen.getByRole('heading', { level: 1, name: PYTORCH_COURSES[0].title })).toBeTruthy()
    click('Download torch-tensors.py')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('import torch'), 'torch-tensors.py')
  })
  it('records a passing exam on a PyTorch course', () => {
    page('/pytorch/torch-tensors')
    const course = PYTORCH_COURSES[0], form = screen.getByRole('form', { name: 'Course exam' })
    const groups = within(form).getAllByRole('group')
    course.exam.questions.forEach((question, i) => fireEvent.click(within(groups[i]).getByRole('radio', { name: question.options.find(o => o.id === question.answerId).text })))
    click('Submit exam')
    expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 100 })
  })
  it('rejects an unknown PyTorch course id', () => {
    page('/pytorch/nope')
    expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  })
})

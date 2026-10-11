// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadText } from '../../lib/download.js'
import { readCourseProgress } from '../courses/progress.js'
import CudaPage, { CUDA_COURSES } from './CudaPage.jsx'

vi.mock('../../lib/download.js', () => ({ downloadText: vi.fn(() => true), downloadJson: vi.fn(() => true), downloadBlob: vi.fn(() => true) }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
function page(path = '/cuda') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/cuda" element={<CudaPage />} /><Route path="/cuda/:lessonId" element={<CudaPage />} />
  </Routes></MemoryRouter></LocaleProvider>)
}

describe('CUDA content', () => {
  it('ships eight CUDA courses with self-contained programs and valid exams', () => {
    expect(CUDA_COURSES.length).toBe(8)
    expect(new Set(CUDA_COURSES.map(c => c.id)).size).toBe(8)
    for (const course of CUDA_COURSES) {
      expect(typeof course.version).toBe('number')
      expect(course.lessons).toHaveLength(4)
      expect(course.exam.questions).toHaveLength(5)
      expect(course.exam.passPercent).toBe(80)
      expect(course.code).toContain('int main(')
      expect(course.code).toContain('#include')
      const questions = [...course.lessons.map(l => l.question), ...course.exam.questions]
      expect(new Set(questions.map(q => q.id)).size).toBe(9)
      for (const q of questions) expect(q.options.some(o => o.id === q.answerId)).toBe(true)
    }
  })
})

describe('CUDA track page', () => {
  it('lists the courses on the hub', () => {
    page('/cuda')
    expect(screen.getByRole('heading', { name: /Program NVIDIA GPUs with CUDA/ })).toBeTruthy()
    expect(screen.getByText(/8 courses found/)).toBeTruthy()
  })
  it('renders a course and downloads its .cu source', () => {
    page('/cuda/cuda-intro')
    expect(screen.getByRole('heading', { level: 1, name: CUDA_COURSES[0].title })).toBeTruthy()
    click('Download cuda-intro.cu')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('int main('), 'cuda-intro.cu')
  })
  it('records a passing exam on a CUDA course', () => {
    page('/cuda/cuda-intro')
    const course = CUDA_COURSES[0], form = screen.getByRole('form', { name: 'Course exam' })
    const groups = within(form).getAllByRole('group')
    course.exam.questions.forEach((question, i) => fireEvent.click(within(groups[i]).getByRole('radio', { name: question.options.find(o => o.id === question.answerId).text })))
    click('Submit exam')
    expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 100 })
  })
  it('rejects an unknown CUDA course id', () => {
    page('/cuda/nope')
    expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  })
})

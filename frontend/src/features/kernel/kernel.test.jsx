// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadText } from '../../lib/download.js'
import { readCourseProgress } from '../courses/progress.js'
import KernelPage, { KERNEL_COURSES } from './KernelPage.jsx'

vi.mock('../../lib/download.js', () => ({ downloadText: vi.fn(() => true), downloadJson: vi.fn(() => true), downloadBlob: vi.fn(() => true) }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
function page(path = '/kernel') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/kernel" element={<KernelPage />} /><Route path="/kernel/:lessonId" element={<KernelPage />} />
  </Routes></MemoryRouter></LocaleProvider>)
}

describe('Linux kernel content', () => {
  it('ships eight kernel courses with real modules and valid exams', () => {
    expect(KERNEL_COURSES.length).toBe(8)
    expect(new Set(KERNEL_COURSES.map(c => c.id)).size).toBe(8)
    for (const course of KERNEL_COURSES) {
      expect(typeof course.version).toBe('number')
      expect(course.lessons).toHaveLength(4)
      expect(course.exam.questions).toHaveLength(5)
      expect(course.exam.passPercent).toBe(80)
      expect(course.codeExt).toBe('c')
      expect(course.code).toContain('MODULE_LICENSE')
      expect(course.code).toContain('module_init')
      const questions = [...course.lessons.map(l => l.question), ...course.exam.questions]
      expect(new Set(questions.map(q => q.id)).size).toBe(9)
      for (const q of questions) expect(q.options.some(o => o.id === q.answerId)).toBe(true)
    }
  })
})

describe('Linux kernel track page', () => {
  it('lists the courses on the hub', () => {
    page('/kernel')
    expect(screen.getByRole('heading', { name: /Write Linux kernel modules/ })).toBeTruthy()
    expect(screen.getByText(/8 courses found/)).toBeTruthy()
  })
  it('renders a course and downloads its .c source', () => {
    page('/kernel/kern-intro')
    expect(screen.getByRole('heading', { level: 1, name: KERNEL_COURSES[0].title })).toBeTruthy()
    click('Download kern-intro.c')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('MODULE_LICENSE'), 'kern-intro.c')
  })
  it('records a passing exam on a kernel course', () => {
    page('/kernel/kern-intro')
    const course = KERNEL_COURSES[0], form = screen.getByRole('form', { name: 'Course exam' })
    const groups = within(form).getAllByRole('group')
    course.exam.questions.forEach((question, i) => fireEvent.click(within(groups[i]).getByRole('radio', { name: question.options.find(o => o.id === question.answerId).text })))
    click('Submit exam')
    expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 100 })
  })
  it('rejects an unknown kernel course id', () => {
    page('/kernel/nope')
    expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  })
})

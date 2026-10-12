// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadText } from '../../lib/download.js'
import { readCourseProgress } from '../courses/progress.js'
import DistributedPage, { DISTRIBUTED_COURSES } from './DistributedPage.jsx'

vi.mock('../../lib/download.js', () => ({ downloadText: vi.fn(() => true), downloadJson: vi.fn(() => true), downloadBlob: vi.fn(() => true) }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
function page(path = '/distributed') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/distributed" element={<DistributedPage />} /><Route path="/distributed/:lessonId" element={<DistributedPage />} />
  </Routes></MemoryRouter></LocaleProvider>)
}

describe('Distributed systems content', () => {
  it('ships ten distributed-systems courses with runnable Python and valid exams', () => {
    expect(DISTRIBUTED_COURSES.length).toBe(10)
    expect(new Set(DISTRIBUTED_COURSES.map(c => c.id)).size).toBe(10)
    for (const course of DISTRIBUTED_COURSES) {
      expect(typeof course.version).toBe('number')
      expect(course.lessons).toHaveLength(4)
      expect(course.exam.questions).toHaveLength(5)
      expect(course.exam.passPercent).toBe(80)
      expect(course.codeExt).toBe('py')
      expect(course.code.trimEnd().endsWith(')')).toBe(true) // ends on a print(...) line
      const questions = [...course.lessons.map(l => l.question), ...course.exam.questions]
      expect(new Set(questions.map(q => q.id)).size).toBe(9)
      for (const q of questions) expect(q.options.some(o => o.id === q.answerId)).toBe(true)
    }
  })
})

describe('Distributed systems track page', () => {
  it('lists the courses on the hub', () => {
    page('/distributed')
    expect(screen.getByRole('heading', { name: /Build reliable distributed systems/ })).toBeTruthy()
    expect(screen.getByText(/10 courses found/)).toBeTruthy()
  })
  it('renders a course and downloads its .py source', () => {
    page('/distributed/ds-foundations')
    expect(screen.getByRole('heading', { level: 1, name: DISTRIBUTED_COURSES[0].title })).toBeTruthy()
    click('Download ds-foundations.py')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('exactly-once'), 'ds-foundations.py')
  })
  it('records a passing exam on a distributed-systems course', () => {
    page('/distributed/ds-foundations')
    const course = DISTRIBUTED_COURSES[0], form = screen.getByRole('form', { name: 'Course exam' })
    const groups = within(form).getAllByRole('group')
    course.exam.questions.forEach((question, i) => fireEvent.click(within(groups[i]).getByRole('radio', { name: question.options.find(o => o.id === question.answerId).text })))
    click('Submit exam')
    expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 100 })
  })
  it('rejects an unknown distributed-systems course id', () => {
    page('/distributed/nope')
    expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  })
})

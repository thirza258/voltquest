// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadText } from '../../lib/download.js'
import { readCourseProgress } from '../courses/progress.js'
import IotCPage, { IOTC_COURSES } from './IotCPage.jsx'

vi.mock('../../lib/download.js', () => ({ downloadText: vi.fn(() => true), downloadJson: vi.fn(() => true), downloadBlob: vi.fn(() => true) }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
function page(path = '/iot-c') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/iot-c" element={<IotCPage />} /><Route path="/iot-c/:lessonId" element={<IotCPage />} />
  </Routes></MemoryRouter></LocaleProvider>)
}

describe('Embedded IoT in C content', () => {
  it('ships ten Embedded IoT in C courses with valid code and exams', () => {
    expect(IOTC_COURSES.length).toBe(10)
    expect(new Set(IOTC_COURSES.map(c => c.id)).size).toBe(10)
    for (const course of IOTC_COURSES) {
      expect(typeof course.version).toBe('number')
      expect(course.codeExt).toBe('c')
      expect(course.lessons).toHaveLength(4)
      expect(course.exam.questions).toHaveLength(5)
      expect(course.exam.passPercent).toBe(80)
      expect(course.code.length).toBeGreaterThan(50)
      const questions = [...course.lessons.map(l => l.question), ...course.exam.questions]
      expect(new Set(questions.map(q => q.id)).size).toBe(9)
      for (const q of questions) expect(q.options.some(o => o.id === q.answerId)).toBe(true)
    }
  })
})

describe('Embedded IoT in C track page', () => {
  it('lists the courses on the hub', () => {
    page('/iot-c')
    expect(screen.getByRole('heading', { name: /Embedded IoT & Edge Systems in C/ })).toBeTruthy()
    expect(screen.getByText(/10 courses found/)).toBeTruthy()
  })
  it('renders a course and downloads its source as .c', () => {
    page('/iot-c/iot-c-architecture')
    expect(screen.getByRole('heading', { level: 1, name: IOTC_COURSES[0].title })).toBeTruthy()
    click('Download iot-c-architecture.c')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('StaticMemoryPool'), 'iot-c-architecture.c')
  })
  it('downloads the production capstone code as .c', () => {
    page('/iot-c/iot-c-capstone')
    click('Download iot-c-capstone.c')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('TelemetryRingBuffer'), 'iot-c-capstone.c')
  })
  it('records a passing exam on an IoT in C course', () => {
    page('/iot-c/iot-c-architecture')
    const course = IOTC_COURSES[0], form = screen.getByRole('form', { name: 'Course exam' })
    const groups = within(form).getAllByRole('group')
    course.exam.questions.forEach((question, i) => fireEvent.click(within(groups[i]).getByRole('radio', { name: question.options.find(o => o.id === question.answerId).text })))
    click('Submit exam')
    expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 100 })
  })
  it('rejects an unknown IoT in C course id', () => {
    page('/iot-c/not-real')
    expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  })
})

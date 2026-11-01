// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { readCourseProgress } from '../courses/progress.js'
import ExcelPage, { EXCEL_COURSES } from './ExcelPage.jsx'

beforeEach(() => {
  installMemoryStorage()
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const click = (name) => fireEvent.click(screen.getByRole('button', { name, exact: true }))

function page(path = '/excel') {
  return render(
    <LocaleProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/excel" element={<ExcelPage />} />
          <Route path="/excel/:lessonId" element={<ExcelPage />} />
          <Route path="/sandbox" element={<ExcelPage sandbox />} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>
  )
}

describe('Microsoft Excel & Data Analytics Course Content', () => {
  it('ships ten Excel courses with valid datasets, lessons, and exams', () => {
    expect(EXCEL_COURSES.length).toBe(10)
    expect(new Set(EXCEL_COURSES.map((c) => c.id)).size).toBe(10)

    for (const course of EXCEL_COURSES) {
      expect(course.id.startsWith('excel-')).toBe(true)
      expect(typeof course.version).toBe('number')
      expect(course.lessons).toHaveLength(4)
      expect(course.exam.questions).toHaveLength(5)
      expect(course.exam.passPercent).toBe(80)
      expect(course.dataset).toBeInstanceOf(Array)
      expect(course.dataset.length).toBeGreaterThanOrEqual(4)

      const allQuestions = [...course.lessons.map((l) => l.question), ...course.exam.questions]
      expect(allQuestions).toHaveLength(9)
      for (const q of allQuestions) {
        expect(q.options.some((o) => o.id === q.answerId)).toBe(true)
      }
    }
  })
})

describe('Excel Track Hub & Navigation', () => {
  it('lists all courses on the hub with search and filters', () => {
    page('/excel')
    expect(
      screen.getByRole('heading', { level: 1, name: /Microsoft Excel & Data Analytics/i })
    ).toBeTruthy()
    expect(screen.getByText(/10 courses available/)).toBeTruthy()

    // Test Search input
    const searchInput = screen.getByPlaceholderText(/Search Excel courses/i)
    fireEvent.change(searchInput, { target: { value: 'lookups' } })
    expect(screen.getByRole('heading', { name: /3\. Lookup & Reference Mastery/i })).toBeTruthy()

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } })

    // Test Difficulty filter
    const diffSelect = screen.getByLabelText(/Course difficulty/i)
    fireEvent.change(diffSelect, { target: { value: 'Advanced' } })
    expect(screen.getByRole('heading', { name: /9\. Descriptive Statistics/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /10\. Enterprise Data Analytics Capstone/i })).toBeTruthy()
  })

  it('renders a specific course lesson page with interactive simulator and steps', () => {
    page('/excel/excel-foundations')
    expect(
      screen.getByRole('heading', { level: 1, name: EXCEL_COURSES[0].title })
    ).toBeTruthy()

    // Check that lessons and guided steps render
    expect(screen.getAllByText(/Grid Coordinates, Cell Data Types & The Formula Bar/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Interactive Microsoft Excel Simulator Lab/i)).toBeTruthy()

    // Guided step checkbox interaction
    const stepOne = screen.getByText(/Inspect the sales transaction ledger/i)
    expect(stepOne).toBeTruthy()
    fireEvent.click(stepOne)
  })

  it('records an 80% passing exam and saves progress', () => {
    page('/excel/excel-foundations')
    const course = EXCEL_COURSES[0]
    const form = screen.getByRole('form', { name: 'Course exam' })
    const groups = within(form).getAllByRole('group')

    // Answer all 5 questions correctly
    course.exam.questions.forEach((question, i) => {
      const correctOption = question.options.find((o) => o.id === question.answerId)
      fireEvent.click(within(groups[i]).getByRole('radio', { name: correctOption.text }))
    })

    click('Submit exam')
    expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 100 })
  })

  it('rejects an unknown course id with a clean 404 message', () => {
    page('/excel/non-existent-course')
    expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
    expect(screen.getByText(/The requested Excel course does not exist/i)).toBeTruthy()
  })

  it('renders the standalone Excel simulator sandbox', () => {
    page('/sandbox?bench=excel')
    expect(screen.getByText(/Excel Simulator/i)).toBeTruthy()
    expect(screen.getByText(/Number Format:/i)).toBeTruthy()
  })
})

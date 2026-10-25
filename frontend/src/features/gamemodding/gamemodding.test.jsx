// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadText } from '../../lib/download.js'
import { readCourseProgress } from '../courses/progress.js'
import GameModdingPage, { GAMEMODDING_COURSES } from './GameModdingPage.jsx'

vi.mock('../../lib/download.js', () => ({ downloadText: vi.fn(() => true), downloadJson: vi.fn(() => true), downloadBlob: vi.fn(() => true) }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
function page(path = '/game-modding') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/game-modding" element={<GameModdingPage />} /><Route path="/game-modding/:lessonId" element={<GameModdingPage />} />
  </Routes></MemoryRouter></LocaleProvider>)
}

describe('Game Modding content', () => {
  it('ships ten Game Modding courses with valid code and exams', () => {
    expect(GAMEMODDING_COURSES.length).toBe(10)
    expect(new Set(GAMEMODDING_COURSES.map(c => c.id)).size).toBe(10)
    for (const course of GAMEMODDING_COURSES) {
      expect(typeof course.version).toBe('number')
      expect(['cpp', 'cs', 'py']).toContain(course.codeExt)
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

describe('Game Modding track page', () => {
  it('lists the courses on the hub', () => {
    page('/game-modding')
    expect(screen.getByRole('heading', { name: /Game Modding & Reverse Engineering/ })).toBeTruthy()
    expect(screen.getByText(/10 courses found/)).toBeTruthy()
  })
  it('renders a course and downloads its source', () => {
    page('/game-modding/mod-architecture')
    expect(screen.getByRole('heading', { level: 1, name: GAMEMODDING_COURSES[0].title })).toBeTruthy()
    click('Download mod-architecture.cpp')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('ModHookBus'), 'mod-architecture.cpp')
  })
  it('downloads the production capstone code as .cpp', () => {
    page('/game-modding/mod-capstone')
    click('Download mod-capstone.cpp')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('ProductionModSuite'), 'mod-capstone.cpp')
  })
  it('records a passing exam on a Game Modding course', () => {
    page('/game-modding/mod-architecture')
    const course = GAMEMODDING_COURSES[0], form = screen.getByRole('form', { name: 'Course exam' })
    const groups = within(form).getAllByRole('group')
    course.exam.questions.forEach((question, i) => fireEvent.click(within(groups[i]).getByRole('radio', { name: question.options.find(o => o.id === question.answerId).text })))
    click('Submit exam')
    expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 100 })
  })
  it('rejects an unknown Game Modding course id', () => {
    page('/game-modding/unknown-course')
    expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  })
})

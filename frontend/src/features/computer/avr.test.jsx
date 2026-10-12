// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadText } from '../../lib/download.js'
import { readCourseProgress } from '../courses/progress.js'
import { assemble } from '../../engine/avr/assembler.js'
import { createMachine, run } from '../../engine/avr/cpu.js'
import AvrPage from './AvrPage.jsx'
import { AVR_COURSES } from './avrProject.js'

vi.mock('../../lib/download.js', () => ({ downloadJson: vi.fn(), downloadText: vi.fn() }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function page(path = '/avr') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/avr" element={<AvrPage />} /><Route path="/avr/:lessonId" element={<AvrPage />} /></Routes></MemoryRouter></LocaleProvider>)
}
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))

describe('AVR content', () => {
  it('ships eight AVR courses whose starters assemble, run and expose valid exams', () => {
    expect(AVR_COURSES.length).toBe(8)
    expect(new Set(AVR_COURSES.map(c => c.id)).size).toBe(8)
    for (const course of AVR_COURSES) {
      expect(course.mode).toBe('avr')
      expect(course.lessons).toHaveLength(4)
      expect(course.exam.questions).toHaveLength(5)
      expect(course.exam.passPercent).toBe(80)
      const { program } = assemble(course.asm)
      const machine = createMachine(); run(machine, program)
      expect(machine.error).toBeNull()
      const questions = [...course.lessons.map(l => l.question), ...course.exam.questions]
      expect(new Set(questions.map(q => q.id)).size).toBe(9)
      for (const q of questions) expect(q.options.some(o => o.id === q.answerId)).toBe(true)
    }
  })
})

describe('AVR track page', () => {
  it('lists the courses and assembles/runs in the embedded IDE', () => {
    page('/avr/avr-branches')
    expect(screen.getByRole('heading', { name: /AVR comparisons, branches and loops/ })).toBeTruthy()
    click('Assemble & run')
    fireEvent.click(screen.getByRole('tab', { name: 'PORTB output' }))
    expect(screen.getByRole('region', { name: 'PORTB output' }).textContent).toContain('0x0F') // sum 1..5 = 15
    click('Download .asm')
    expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('loop:'), 'avr-branches.asm')
  })
  it('records a passing exam on an AVR course', () => {
    page('/avr/avr-registers')
    const course = AVR_COURSES[0], form = screen.getByRole('form', { name: 'Course exam' })
    const groups = within(form).getAllByRole('group')
    course.exam.questions.forEach((question, i) => fireEvent.click(within(groups[i]).getByRole('radio', { name: question.options.find(o => o.id === question.answerId).text })))
    click('Submit exam')
    expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 100 })
  })
  it('rejects an unknown AVR course id', () => {
    page('/avr/nope')
    expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  })
})

// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider, translate } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { getCourse } from './content.js'
import { COURSE_PROGRESS_KEY, readCourseProgress } from './progress.js'
import CoursesPage from './CoursesPage.jsx'
import CoursePage from './CoursePage.jsx'
import { getTutorialFundamentals } from './fundamentals.js'
import { getFundamentalReading, LEARNING_TUTORIALS } from './learningCatalog.js'

beforeEach(() => installMemoryStorage())
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function page(path = '/courses') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/courses" element={<CoursesPage />} /><Route path="/courses/:courseId" element={<CoursePage />} /></Routes></MemoryRouter></LocaleProvider>)
}
function answerForm(course, count = 5, correct = 5, exam = true) {
  const form = screen.getByRole('form', { name: exam ? 'Course exam' : 'Practice questions' })
  const questions = exam ? course.exam.questions : course.practice
  const groups = within(form).getAllByRole('group')
  questions.slice(0, count).forEach((question, index) => {
    const option = question.options.find(option => index < correct ? option.id === question.answerId : option.id !== question.answerId)
    fireEvent.click(within(groups[index]).getByRole('radio', { name: option.text }))
  })
  return form
}

it('filters both tracks by level and translated topic while preserving URL filters', () => {
  page('/courses?track=iot-parts')
  expect(screen.getByRole('status').textContent).toBe('10 courses found')
  fireEvent.change(screen.getByLabelText('Course level'), { target: { value: 'Intermediate' } })
  expect(screen.getByRole('status').textContent).toBe('5 courses found')
  fireEvent.change(screen.getByLabelText('Language / Bahasa'), { target: { value: 'id' } })
  fireEvent.change(screen.getByLabelText('Cari kursus'), { target: { value: 'tampilan' } })
  expect(screen.getByRole('status').textContent).toBe('1 kursus ditemukan')
  expect(screen.getByRole('heading', { name: 'Modul tampilan LCD dan OLED' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Tingkat kursus'), { target: { value: 'Fundamental' } })
  expect(screen.getByRole('heading', { name: 'Tidak ada kursus yang cocok' })).toBeTruthy()
})

it('shows lessons, worked examples and the real related lab without revealing answers before submission', () => {
  page('/courses/ee-ohms-law')
  const course = getCourse('ee-ohms-law')
  expect(screen.getByText(course.workedExample)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Open related lab in a new tab' }).getAttribute('href')).toBe('/tutorials/uno-first-light')
  expect(screen.queryByText(course.exam.questions[0].explanation)).toBeNull()
  expect(screen.getAllByRole('checkbox')).toHaveLength(3)
})

it('rejects incomplete exams, focuses the missing question and keeps existing choices', () => {
  page('/courses/ee-circuits')
  const course = getCourse('ee-circuits')
  const form = answerForm(course, 1)
  fireEvent.click(within(form).getByRole('button', { name: 'Submit exam' }))
  expect(screen.getByRole('alert').textContent).toContain('Answer every question')
  expect(within(form).getAllByRole('radio').filter(input => input.checked)).toHaveLength(1)
  expect(document.activeElement).toBe(within(form).getAllByRole('group')[1].querySelector('input'))
  expect(readCourseProgress(course).attempts).toBe(0)
})

it('saves 80% as passing, locks submitted choices and does not count duplicate submits', () => {
  page('/courses/ee-circuits')
  const course = getCourse('ee-circuits')
  const form = answerForm(course, 5, 4)
  fireEvent.click(within(form).getByRole('button', { name: 'Submit exam' }))
  expect(within(form).getByRole('status').textContent).toContain('Exam passed')
  expect(within(form).getByRole('status').textContent).toContain('4 of 5 correct · 80%')
  expect(screen.getByText(course.exam.questions[0].explanation)).toBeTruthy()
  const firstGroup = within(form).getAllByRole('group')[0]
  const oldAnswer = within(firstGroup).getAllByRole('radio').find(radio => radio.checked)
  fireEvent.click(within(firstGroup).getAllByRole('radio').find(radio => !radio.checked))
  expect(oldAnswer.checked).toBe(true)
  fireEvent.submit(form)
  expect(readCourseProgress(course)).toMatchObject({ bestPercent: 80, lastPercent: 80, attempts: 1 })
})

it('allows a failed attempt to be retried and keeps the best result across later failures and reloads', () => {
  const view = page('/courses/ee-circuits')
  const course = getCourse('ee-circuits')
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  let form = answerForm(course, 5, 3)
  fireEvent.submit(form)
  expect(within(form).getByRole('status').textContent).toContain('Keep learning')
  fireEvent.click(within(form).getByRole('button', { name: 'Retake exam' }))
  expect(within(form).getAllByRole('radio').some(radio => radio.checked)).toBe(false)
  expect(screen.queryByText(course.exam.questions[0].explanation)).toBeNull()
  form = answerForm(course)
  fireEvent.submit(form)
  fireEvent.click(within(form).getByRole('button', { name: 'Retake exam' }))
  form = answerForm(course, 5, 0)
  fireEvent.submit(form)
  expect(readCourseProgress(course)).toMatchObject({ bestPercent: 100, lastPercent: 0, attempts: 3, read: ['lesson-1'] })
  view.unmount()
  page('/courses/ee-circuits')
  expect(screen.getByLabelText('Mark lesson 1 as read').checked).toBe(true)
  expect(screen.getByText('Best exam score: 100%')).toBeTruthy()
  expect(screen.getByText('Last exam score: 0%')).toBeTruthy()
})

it('keeps practice separate from exam attempts and answers', () => {
  page('/courses/ee-circuits')
  const course = getCourse('ee-circuits')
  const form = answerForm(course, 2, 2, false)
  fireEvent.submit(form)
  expect(within(form).getByRole('status').textContent).toContain('2 of 2 correct')
  expect(readCourseProgress(course).attempts).toBe(0)
  expect(within(screen.getByRole('form', { name: 'Course exam' })).getAllByRole('radio').some(input => input.checked)).toBe(false)
})

it('retains choices and lesson checks while switching languages, including translated grading feedback', () => {
  page('/courses/ee-circuits')
  const course = getCourse('ee-circuits')
  answerForm(course)
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  fireEvent.change(screen.getByLabelText('Language / Bahasa'), { target: { value: 'id' } })
  expect(screen.getByLabelText('Tandai pelajaran 1 sudah dibaca').checked).toBe(true)
  const form = screen.getByRole('form', { name: 'Ujian kursus' })
  expect(within(form).getAllByRole('radio').filter(radio => radio.checked)).toHaveLength(5)
  fireEvent.click(within(form).getByRole('button', { name: 'Kirim ujian' }))
  expect(within(form).getByRole('status').textContent).toContain('Ujian lulus')
  expect(screen.getByText(translate('id', course.exam.questions[0].explanation))).toBeTruthy()
})

it('resets in-progress choices between courses and provides previous/next navigation', () => {
  page('/courses/ee-circuits')
  answerForm(getCourse('ee-circuits'), 1)
  fireEvent.click(screen.getByRole('link', { name: 'Next course' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(getCourse('ee-ohms-law').title)
  expect(screen.getAllByRole('radio').some(radio => radio.checked)).toBe(false)
  expect(screen.getByText('Exam attempts: 0')).toBeTruthy()
  fireEvent.click(screen.getByRole('link', { name: 'Previous course' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(getCourse('ee-circuits').title)
})

it('shows saved passes on the catalog and handles unknown courses', () => {
  let view = page('/courses/ee-circuits')
  fireEvent.submit(answerForm(getCourse('ee-circuits')))
  view.unmount()
  view = page('/courses')
  expect(screen.getByText('1 exams passed')).toBeTruthy()
  expect(screen.getByText('Passed · 100%')).toBeTruthy()
  view.unmount()
  page('/courses/not-real')
  expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Browse courses' }).getAttribute('href')).toBe('/courses')
})

it('ignores malformed or older-version progress and reports unavailable storage without blocking learning', () => {
  const course = getCourse('ee-circuits')
  localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify({ [course.id]: { version: 1, read: ['lesson-1', 'unknown'], attempts: 2, bestPercent: 1000, lastPercent: 1000 } }))
  expect(readCourseProgress(course)).toMatchObject({ read: ['lesson-1'], attempts: 0, bestPercent: null })
  localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify({ [course.id]: { version: 0, read: ['lesson-1'], attempts: 1, bestPercent: 100, lastPercent: 100 } }))
  expect(readCourseProgress(course)).toMatchObject({ read: [], attempts: 0 })
  localStorage.setItem(COURSE_PROGRESS_KEY, 'not json')
  page('/courses/ee-circuits')
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  fireEvent.submit(answerForm(course))
  expect(screen.getByRole('alert').textContent).toContain('could not save progress')
  expect(screen.getByText('Best exam score: 100%')).toBeTruthy()
})

it('offers fundamentals for every tutorial, preserves course filters and translates the selected guide', () => {
  page('/courses?track=iot-parts&difficulty=Intermediate&tutorial=cpp-arrays')
  const select = screen.getByLabelText('Choose a tutorial')
  expect(within(select).getAllByRole('option')).toHaveLength(LEARNING_TUTORIALS.length + 1)
  expect(select.value).toBe('cpp-arrays')
  expect(screen.getByText(getTutorialFundamentals('cpp-arrays').explanation)).toBeTruthy()
  fireEvent.change(select, { target: { value: 'pi-button-dimmer' } })
  expect(screen.getByLabelText('Learning track').value).toBe('iot-parts')
  expect(screen.getByLabelText('Course level').value).toBe('Intermediate')
  expect(screen.getByRole('status').textContent).toBe('5 courses found')
  fireEvent.change(screen.getByLabelText('Language / Bahasa'), { target: { value: 'id' } })
  expect(screen.getByLabelText('Pilih tutorial').value).toBe('pi-button-dimmer')
  expect(screen.getByText(translate('id', getTutorialFundamentals('pi-button-dimmer').explanation))).toBeTruthy()
})

it.each(['uno-first-light', 'cpp-state-machine', 'pi-blink', 'robot-waypoints', 'vision-integration'])('links %s to real theory sections and its own lab in separate tabs', id => {
  page(`/courses?tutorial=${id}#tutorial-fundamentals`)
  const guide = getTutorialFundamentals(id)
  const links = within(screen.getByRole('navigation', { name: 'Read the course sections' })).getAllByRole('link')
  expect(links.map(link => link.getAttribute('href'))).toEqual(guide.readings.map(reading => getFundamentalReading(reading).path))
  for (const link of [...links, screen.getByRole('link', { name: 'Open tutorial in a new tab' })]) {
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  }
  expect(screen.getByRole('link', { name: 'Open tutorial in a new tab' }).getAttribute('href')).toBe(LEARNING_TUTORIALS.find(tutorial => tutorial.id === id).path)
})

it('includes tutorial explanations in course details and preserves answers when opening or translating a guide', () => {
  page('/courses/iot-foundations#fundamentals-cpp-state-machine')
  const details = document.getElementById('fundamentals-cpp-state-machine')
  expect(details.open).toBe(true)
  const guide = getTutorialFundamentals('cpp-state-machine')
  expect(within(details).getByText(guide.explanation)).toBeTruthy()
  expect(within(details).getByRole('link', { name: 'Open tutorial in a new tab' }).getAttribute('href')).toBe('/tutorials/cpp-state-machine')
  answerForm(getCourse('iot-foundations'), 1)
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  fireEvent.change(screen.getByLabelText('Language / Bahasa'), { target: { value: 'id' } })
  expect(details.open).toBe(true)
  expect(within(details).getByText(translate('id', guide.explanation))).toBeTruthy()
  expect(screen.getByLabelText('Tandai pelajaran 1 sudah dibaca').checked).toBe(true)
  expect(within(screen.getByRole('form', { name: 'Ujian kursus' })).getAllByRole('radio').filter(input => input.checked)).toHaveLength(1)
})

it('finds related courses by a tutorial name and handles an invalid tutorial filter', () => {
  page('/courses?tutorial=not-a-tutorial&q=arrays')
  expect(screen.getByLabelText('Choose a tutorial').value).toBe('')
  expect(screen.queryByRole('navigation', { name: 'Read the course sections' })).toBeNull()
  expect(screen.getByRole('status').textContent).toBe('3 courses found')
  expect(screen.getByRole('heading', { name: 'Signal conditioning and a reliable IoT node' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'IoT fundamentals: from Arduino input to a connected device' })).toBeTruthy()
})

it('discovers the ordered programming path and filters its intermediate courses', () => {
  page('/courses?track=programming')
  expect(screen.getByRole('status').textContent).toBe('12 courses found')
  expect(screen.getAllByRole('heading', { level: 3 })[0].textContent).toBe(getCourse('programming-start').title)
  fireEvent.change(screen.getByLabelText('Course level'), { target: { value: 'Intermediate' } })
  expect(screen.getByRole('status').textContent).toBe('7 courses found')
  fireEvent.change(screen.getByLabelText('Search courses'), { target: { value: 'mqtt' } })
  expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(getCourse('programming-mqtt').title)
})

it('copies the exact sketch and keeps the experiment board, code and assessment choices across translation', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  page('/courses/programming-numbers#code-example')
  const course = getCourse('programming-numbers')
  answerForm(course, 1)
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  fireEvent.change(screen.getByLabelText('Example board'), { target: { value: 'esp32s3' } })
  const link = screen.getByRole('link', { name: 'Open experiment lab' })
  expect(link.getAttribute('href')).toBe('/tutorials/cpp-arithmetic?board=esp32s3')
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toContain('noopener')
  fireEvent.click(screen.getByRole('button', { name: 'Copy sketch' }))
  await waitFor(() => expect(screen.getByText(/Sketch copied/)).toBeTruthy())
  expect(writeText).toHaveBeenCalledWith(course.codeExample.code)
  fireEvent.change(screen.getByLabelText('Language / Bahasa'), { target: { value: 'id' } })
  expect(screen.getByLabelText('Board contoh').value).toBe('esp32s3')
  expect(screen.getByLabelText('Kode contoh kursus').textContent).toBe(course.codeExample.code)
  expect(screen.getByLabelText('Tandai pelajaran 1 sudah dibaca').checked).toBe(true)
  expect(within(screen.getByRole('form', { name: 'Ujian kursus' })).getAllByRole('radio').filter(input => input.checked)).toHaveLength(1)
})

it('offers a manual copy fallback and limits connected examples to ESP32 boards', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('unavailable')) } })
  page('/courses/programming-esp32')
  expect(within(screen.getByLabelText('Example board')).getAllByRole('option').map(option => option.value)).toEqual(['esp32', 'esp32s3'])
  fireEvent.click(screen.getByRole('button', { name: 'Copy sketch' }))
  await waitFor(() => expect(screen.getByText(/Copy is unavailable/)).toBeTruthy())
  expect(screen.getByLabelText('Course example code').textContent).toBe(getCourse('programming-esp32').codeExample.code)
})

it('records a programming exam pass and restores it independently of an existing course', () => {
  const course = getCourse('programming-start')
  let view = page('/courses/ee-circuits')
  fireEvent.submit(answerForm(getCourse('ee-circuits')))
  view.unmount()
  view = page('/courses/programming-start')
  fireEvent.submit(answerForm(course, 5, 4))
  expect(readCourseProgress(course)).toMatchObject({ bestPercent: 80, attempts: 1 })
  expect(readCourseProgress(getCourse('ee-circuits'))).toMatchObject({ bestPercent: 100, attempts: 1 })
  view.unmount()
  page('/courses?track=programming')
  expect(screen.getByText('1 of 12 exams passed')).toBeTruthy()
  expect(screen.getByText('Passed · 80%')).toBeTruthy()
})

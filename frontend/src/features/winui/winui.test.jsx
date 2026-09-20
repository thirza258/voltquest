// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider, translate } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadBlob, downloadText } from '../../lib/download.js'
import { readCourseProgress } from '../courses/progress.js'
import { learningSummary, readLearning } from '../courses/learningRewards.js'
import WinuiPage from './WinuiPage.jsx'
import WinuiPromo from './WinuiPromo.jsx'
import { WINUI_COURSES } from './content.js'
import { getWinuiFiles } from './samples.js'

vi.mock('../../lib/download.js', () => ({ downloadBlob: vi.fn(() => true), downloadText: vi.fn(() => true) }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
function page(path = '/winui') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/winui" element={<WinuiPage />} /><Route path="/winui/:lessonId" element={<WinuiPage />} />
  </Routes></MemoryRouter></LocaleProvider>)
}

it('discovers courses and combines URL filters with clear empty state recovery', () => {
  page('/winui?stage=application')
  expect(screen.getByText(/6 courses found/)).toBeTruthy()
  change('Search WinUI courses', 'asynchronous')
  expect(screen.getByRole('heading', { name: WINUI_COURSES[6].title })).toBeTruthy()
  change('Search WinUI courses', 'missing-xyz')
  expect(screen.getByRole('heading', { name: 'No courses match' })).toBeTruthy()
  click('Clear filters')
  expect(screen.getByText(/13 courses found/)).toBeTruthy()
  change('Difficulty', 'Fundamental')
  expect(screen.getByText(/3 courses found/)).toBeTruthy()
  change('Language / Bahasa', 'id')
  expect(screen.getByLabelText(translate('id', 'Difficulty')).value).toBe('Fundamental')
  expect(screen.getByText(translate('id', '{count} courses found', { count: 3 }), { exact: false })).toBeTruthy()
})

it('grades complete exams once and persists reading, scores and learning rewards', () => {
  const course = WINUI_COURSES[0]
  const view = page(`/winui/${course.id}`)
  const form = screen.getByRole('form', { name: 'Course exam' })
  fireEvent.submit(form)
  expect(readCourseProgress(course).attempts).toBe(0)
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  course.exam.questions.forEach((question, index) => fireEvent.click(within(form).getByLabelText(question.options.find(option => index === 4 ? option.id !== question.answerId : option.id === question.answerId).text)))
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 80, lastPercent: 80, read: [course.lessons[0].id] })
  expect(learningSummary(readLearning())).toMatchObject({ xp: 60, todayActions: 2 })
  expect(screen.getByText('Exam passed')).toBeTruthy()
  view.unmount()
  page(`/winui/${course.id}`)
  expect(screen.getByLabelText('Mark lesson 1 as read').checked).toBe(true)
  expect(screen.getByText('Best exam score: 80%')).toBeTruthy()
  expect(screen.getByText('Exam attempts: 1')).toBeTruthy()
})

it('keeps section answers independent from exam attempts and retains working state on locale switch', () => {
  const course = WINUI_COURSES[5]
  page(`/winui/${course.id}`)
  const section = document.getElementById(course.lessons[0].id)
  const checkpoint = within(section).getByRole('form', { name: 'Practice questions', hidden: true })
  const question = course.lessons[0].question
  fireEvent.click(within(checkpoint).getByLabelText(question.options.find(option => option.id === question.answerId).text))
  fireEvent.submit(checkpoint)
  expect(readCourseProgress(course).attempts).toBe(0)
  expect(learningSummary(readLearning()).xp).toBe(5)
  const exam = screen.getByRole('form', { name: 'Course exam' })
  fireEvent.click(within(exam).getByLabelText(course.exam.questions[0].options[1].text))
  fireEvent.click(screen.getByLabelText('Windows lab step 1'))
  change('Lesson source file', 'MainWindow.xaml.cpp')
  change('Language / Bahasa', 'id')
  expect(screen.getByLabelText(translate('id', 'Windows lab step {number}', { number: 1 })).checked).toBe(true)
  expect(screen.getByLabelText(translate('id', 'Lesson source file')).value).toBe('MainWindow.xaml.cpp')
  expect(within(screen.getByRole('form', { name: translate('id', 'Course exam') })).getByLabelText(course.exam.questions[0].options[1].text).checked).toBe(true)
  expect(readCourseProgress(course).attempts).toBe(0)
})

it('downloads the displayed native file exactly and offers a complete source ZIP', () => {
  const course = WINUI_COURSES.find(course => course.id === 'winui-capstone'), files = getWinuiFiles(course)
  page(`/winui/${course.id}`)
  change('Lesson source file', 'MainWindow.xaml.cpp')
  expect(screen.getByLabelText('Native lesson source').textContent).toBe(files['MainWindow.xaml.cpp'])
  click('Download file')
  expect(downloadText).toHaveBeenLastCalledWith(files['MainWindow.xaml.cpp'], 'MainWindow.xaml.cpp')
  change('Lesson source file', 'README.md')
  click('Download file')
  expect(downloadText).toHaveBeenLastCalledWith(files['README.md'], 'README.md')
  click('Download lesson ZIP')
  expect(downloadBlob).toHaveBeenLastCalledWith(expect.any(Blob), 'winui-capstone-source.zip')
  expect(downloadBlob.mock.calls.at(-1)[0].type).toBe('application/zip')
  expect(screen.queryByRole('button', { name: 'Run' })).toBeNull()
})

it('provides a manual clipboard fallback without losing source', async () => {
  page('/winui/winui-start')
  const source = screen.getByLabelText('Native lesson source').textContent
  click('Copy source')
  await screen.findByText('Copy is unavailable. Select the source text or download the file.')
  expect(screen.getByLabelText('Native lesson source').textContent).toBe(source)
})

it('offers the real C++ request helper, local API and fetch comparison as exact lesson downloads', () => {
  const course = WINUI_COURSES.find(item => item.id === 'winui-api'), files = getWinuiFiles(course)
  page('/winui/winui-api')
  expect(screen.getByRole('heading', { name: course.title })).toBeTruthy()
  for (const filename of ['ApiClient.h', 'api_server.py', 'test_api_server.py', 'fetch-demo.mjs']) {
    change('Lesson source file', filename)
    expect(screen.getByLabelText('Native lesson source').textContent).toBe(files[filename])
    click('Download file')
    expect(downloadText).toHaveBeenLastCalledWith(files[filename], filename)
  }
  change('Language / Bahasa', 'id')
  expect(screen.getByLabelText(translate('id', 'Lesson source file')).value).toBe('fetch-demo.mjs')
  expect(screen.getByRole('heading', { name: course.title })).toBeTruthy()
})

it('retakes exams without losing the best score and resets course-specific state on navigation', () => {
  const course = WINUI_COURSES[0]
  page(`/winui/${course.id}`)
  const form = screen.getByRole('form', { name: 'Course exam' })
  for (const question of course.exam.questions) fireEvent.click(within(form).getByLabelText(question.options.find(option => option.id === question.answerId).text))
  fireEvent.submit(form)
  click('Retake exam')
  expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 100 })
  expect(within(form).queryAllByRole('radio').every(input => !input.checked)).toBe(true)
  change('Lesson source file', 'README.md')
  fireEvent.click(screen.getByLabelText('Windows lab step 1'))
  fireEvent.click(screen.getByRole('link', { name: 'Next course' }))
  expect(screen.getByRole('heading', { name: WINUI_COURSES[1].title })).toBeTruthy()
  expect(screen.getByLabelText('Lesson source file').value).toBe('MainWindow.xaml')
  expect(screen.getByLabelText('Windows lab step 1').checked).toBe(false)
  expect(screen.getByText('Exam attempts: 0')).toBeTruthy()
})

it('handles unknown courses and exposes canonical entry links', () => {
  const view = page('/winui/missing')
  expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'All C++ / WinUI courses' }).getAttribute('href')).toBe('/winui')
  view.unmount()
  render(<LocaleProvider><MemoryRouter><WinuiPromo /></MemoryRouter></LocaleProvider>)
  expect(screen.getByRole('link', { name: 'Explore C++ / WinUI courses' }).getAttribute('href')).toBe('/winui')
  expect(screen.getByRole('link', { name: 'Create your first WinUI window' }).getAttribute('href')).toBe('/winui/winui-start')
})

it('keeps a course usable when progress storage fails', () => {
  page('/winui/winui-start')
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Full') })
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  expect(screen.getByRole('alert').textContent).toContain('Browser storage is unavailable')
  expect(screen.getByLabelText('Mark lesson 1 as read').checked).toBe(true)
})

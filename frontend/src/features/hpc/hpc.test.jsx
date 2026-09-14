// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import HpcPage, { HPC_COURSES } from './HpcPage.jsx'
import { HPC_STORAGE_PREFIX, createHpcProject } from './project.js'
import { readCourseProgress, COURSE_PROGRESS_KEY } from '../courses/progress.js'
import { downloadJson, downloadText } from '../../lib/download.js'

vi.mock('../../lib/download.js', () => ({ downloadJson: vi.fn(), downloadText: vi.fn() }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function page(path = '/hpc') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/hpc" element={<HpcPage />} /><Route path="/hpc/:lessonId" element={<HpcPage />} /><Route path="/sandbox" element={<HpcPage sandbox />} /></Routes></MemoryRouter></LocaleProvider>)
}
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
const change = (name, value) => fireEvent.change(screen.getByLabelText(name), { target: { value } })

it('offers an ordered open learning path with search, difficulty and valid course links', () => {
  page()
  expect(screen.getAllByRole('link').filter(link => /\/hpc\/hpc-/.test(link.getAttribute('href')))).toHaveLength(11)
  change('Search HPC courses', 'halo')
  expect(screen.getByRole('status').textContent).toContain('1 courses found')
  expect(screen.getByRole('heading', { name: /10\. Capstone/ })).toBeTruthy()
  change('Course level', 'Fundamental')
  expect(screen.getByRole('heading', { name: 'No courses match' })).toBeTruthy()
  click('Clear filters')
  expect(screen.getByRole('status').textContent).toContain('10 courses found')
})

it('keeps a failed demonstration inspectable and invalidates results after settings change', async () => {
  page('/sandbox?bench=hpc')
  click('Run experiment')
  expect(await screen.findByText('FAIL: Matches reference')).toBeTruthy()
  change('Accumulator precision', 'float64')
  expect(screen.queryByLabelText('Experiment results')).toBeNull()
  expect(screen.getByRole('button', { name: 'Export results' }).disabled).toBe(true)
  click('Run experiment')
  expect(await screen.findByText('PASS: Matches reference')).toBeTruthy()
  click('Export results')
  expect(downloadJson.mock.calls.at(-1)[0].result.parameters.precision).toBe('float64')
  change('Small values to sum', '999999999')
  click('Run experiment')
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Small values to sum: use a value from 1 to 4096.')
})

it('preserves both language drafts and downloads the exact edited source', async () => {
  page('/sandbox?bench=hpc&lesson=hpc-simd')
  change('Editable native source', '// edited C++\nint main() { return 0; }')
  change('Source language', 'c')
  change('Editable native source', '/* edited C */\nint main(void) { return 0; }')
  click('Download source')
  expect(downloadText).toHaveBeenLastCalledWith('/* edited C */\nint main(void) { return 0; }', 'simd.c')
  change('Source language', 'cpp')
  expect(screen.getByLabelText('Editable native source').value).toContain('// edited C++')
  // Running a browser experiment evaluates its bounded algorithm, not these edits.
  click('Run experiment')
  expect(await screen.findByText('PASS: All outputs match')).toBeTruthy()
})

it('saves and restores exact settings, notes and sources only after replacement confirmation', async () => {
  page('/sandbox?bench=hpc&lesson=hpc-mpi')
  change('Global elements', '19'); change('Experiment notes', 'N=19, expected sum 190')
  change('Editable native source', '// my MPI source')
  click('Save experiment')
  const saved = JSON.parse(localStorage.getItem(HPC_STORAGE_PREFIX + 'mpi'))
  expect(saved.parameters.n).toBe(19)
  expect(saved.sources.cpp).toBe('// my MPI source')
  change('Experiment notes', 'new unsaved note')
  click('Load saved experiment')
  expect(screen.getByRole('dialog')).toBeTruthy()
  click('Cancel')
  expect(screen.getByLabelText('Experiment notes').value).toBe('new unsaved note')
  click('Load saved experiment'); click('Replace experiment')
  expect(screen.getByLabelText('Experiment notes').value).toBe(saved.notes)
  expect(screen.getByLabelText('Editable native source').value).toBe(saved.sources.cpp)
  click('Run experiment')
  await screen.findByText('PASS: Global result matches')
  click('Export experiment')
  expect(downloadJson).toHaveBeenLastCalledWith(saved, 'hpc-mpi.json')
})

it('requires import confirmation, rejects invalid files and leaves current work intact', async () => {
  page('/sandbox?bench=hpc')
  change('Experiment notes', 'keep me')
  const imported = createHpcProject('stencil'); imported.parameters.n = 19; imported.notes = 'imported'
  const input = screen.getByLabelText('Import HPC JSON file')
  fireEvent.change(input, { target: { files: [{ size: 100, text: async () => JSON.stringify(imported) }] } })
  await screen.findByRole('dialog')
  expect(screen.getByLabelText('Experiment notes').value).toBe('keep me')
  click('Replace experiment')
  expect(screen.getByLabelText('Interior cells').value).toBe('19')
  fireEvent.change(input, { target: { files: [{ size: 2, text: async () => '{}' }] } })
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Experiment notes').value).toBe('imported')
})

it('protects changed experiments when choosing another lab or resetting', () => {
  page('/sandbox?bench=hpc')
  change('Experiment notes', 'preserve before switching')
  change('Choose an HPC experiment', 'mpi')
  click('Cancel')
  expect(screen.getByLabelText('Choose an HPC experiment').value).toBe('correctness')
  click('Reset experiment'); click('Cancel')
  expect(screen.getByLabelText('Experiment notes').value).toBe('preserve before switching')
  change('Choose an HPC experiment', 'mpi'); click('Replace experiment')
  expect(screen.getByLabelText('Choose an HPC experiment').value).toBe('mpi')
})

it('keeps an exam’s incomplete answers, counts only submitted attempts and persists the best result', () => {
  page('/hpc/hpc-mpi')
  const course = HPC_COURSES.find(course => course.id === 'hpc-mpi')
  const form = screen.getByRole('form', { name: 'Course exam' })
  const groups = within(form).getAllByRole('group')
  function answer(index, correct = true) {
    const question = course.exam.questions[index]
    const choice = question.options.find(option => correct ? option.id === question.answerId : option.id !== question.answerId)
    fireEvent.click(within(groups[index]).getByRole('radio', { name: choice.text }))
  }
  answer(0); click('Submit exam')
  expect(within(form).getByRole('alert')).toBeTruthy()
  expect(readCourseProgress(course).attempts).toBe(0)
  for (let i = 1; i < 5; i++) answer(i, i < 4)
  click('Submit exam')
  expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 80, lastPercent: 80 })
  fireEvent.submit(form)
  expect(readCourseProgress(course).attempts).toBe(1)
  click('Retake exam')
  for (let i = 0; i < 5; i++) answer(i, false)
  click('Submit exam')
  expect(readCourseProgress(course)).toMatchObject({ attempts: 2, bestPercent: 80, lastPercent: 0 })
  expect(localStorage.getItem('vq.player')).toBeNull()
})

it('retains answers, section checks, source and model results through a locale change', async () => {
  page('/hpc/hpc-simd')
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  const form = screen.getByRole('form', { name: 'Course exam' })
  fireEvent.click(within(form).getAllByRole('radio')[0])
  change('Editable native source', '// preserved across locale')
  click('Run experiment'); await screen.findByText('PASS: All outputs match')
  change('Language / Bahasa', 'id')
  expect(screen.getByLabelText('Kode native yang dapat diedit').value).toBe('// preserved across locale')
  expect(screen.getByLabelText('Tandai pelajaran 1 sudah dibaca').checked).toBe(true)
  expect(within(screen.getByRole('form', { name: 'Ujian kursus' })).getAllByRole('radio').filter(input => input.checked)).toHaveLength(1)
  expect(screen.getByLabelText('Hasil eksperimen')).toBeTruthy()
})

it('reports storage failure without discarding edits or section checks', () => {
  page('/hpc/hpc-correctness')
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  change('Experiment notes', 'retained')
  click('Save experiment')
  expect(screen.getByRole('alert').textContent).toContain('Export your experiment')
  expect(screen.getByLabelText('Experiment notes').value).toBe('retained')
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  expect(screen.getByLabelText('Mark lesson 1 as read').checked).toBe(true)
})

it('resets course identity, supports real fragments and opens a separate lab tab', () => {
  const scroll = vi.fn(); const previous = Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = scroll
  try {
    page('/hpc/hpc-simd#tails-and-alias')
    expect(scroll).toHaveBeenCalled()
    const link = screen.getByRole('link', { name: 'Open a sandbox copy in a new tab' })
    expect(link.getAttribute('href')).toBe('/sandbox?bench=hpc&lesson=hpc-simd')
    expect(link.target).toBe('_blank')
    fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
    fireEvent.click(screen.getByRole('link', { name: 'Next course' }))
    expect(screen.getByRole('heading', { name: /6\. OpenMP/ })).toBeTruthy()
    expect(screen.getByLabelText('Mark lesson 1 as read').checked).toBe(false)
    expect(JSON.parse(localStorage.getItem(COURSE_PROGRESS_KEY))['hpc-simd'].read).toEqual(['simd-independence'])
  } finally { Element.prototype.scrollIntoView = previous }
})

it('rejects unknown courses and unknown sandbox presets', () => {
  const view = page('/hpc/missing')
  expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  view.unmount(); page('/sandbox?bench=hpc&lesson=missing')
  expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
})

it('ignores late worker output after parameters change and terminates on disposal', async () => {
  const workers = []
  class MockWorker {
    constructor() { this.terminate = vi.fn(); workers.push(this) }
    postMessage() {}
  }
  vi.stubGlobal('Worker', MockWorker)
  const view = page('/sandbox?bench=hpc')
  click('Run experiment')
  change('Small values to sum', '17')
  expect(workers[0].terminate).toHaveBeenCalled()
  await act(async () => workers[0].onmessage({ data: { result: { metrics: [], checks: [], rows: [], columns: [] } } }))
  expect(screen.queryByLabelText('Experiment results')).toBeNull()
  click('Run experiment')
  view.unmount()
  expect(workers[1].terminate).toHaveBeenCalled()
  await waitFor(() => expect(workers).toHaveLength(2))
})

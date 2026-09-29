// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LocaleProvider, translate } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadJson, downloadText } from '../../lib/download.js'
import { readCourseProgress } from '../courses/progress.js'
import MatlabPage from './MatlabPage.jsx'
import { MATLAB_COURSES, MATLAB_STORAGE_PREFIX, createMatlabProject } from './project.js'
import { runMatlab } from '../../engine/matlab/model.js'

vi.mock('../../lib/download.js', () => ({ downloadJson: vi.fn(), downloadText: vi.fn() }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
function page(path = '/matlab') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/matlab" element={<MatlabPage />} /><Route path="/matlab/:lessonId" element={<MatlabPage />} /><Route path="/sandbox" element={<MatlabPage sandbox />} /></Routes></MemoryRouter></LocaleProvider>)
}

it('offers searchable course stages and a reference with explicit browser and desktop scopes', () => {
  page()
  expect(screen.getByRole('heading', { name: 'MATLAB: compute, model and simulate' })).toBeTruthy()
  change('Search MATLAB courses', 'parallel')
  expect(screen.getByRole('heading', { name: /16\. Parallel/ })).toBeTruthy()
  change('Course level', 'Fundamental')
  expect(screen.getByRole('heading', { name: 'No courses match' })).toBeTruthy()
  click('Clear filters')
  change('Search MATLAB functions', 'gpuArray')
  const region = screen.getByRole('region', { name: 'Function reference results' })
  expect(region.textContent).toContain('Parallel Computing Toolbox')
  change('Execution environment', 'browser')
  expect(region.textContent).toContain('No functions match')
  change('Search MATLAB functions', 'interp1')
  expect(region.textContent).toContain('interp1(x,y,xq)')
  expect(region.textContent).toContain('Runs in this sandbox')
})

it('executes exact edited source in the desktop, fills the workspace and figure and exports real results', async () => {
  page('/sandbox?bench=matlab')
  const code = 't=0:2;\ny=t.^2;\nplot(t,y);\ndisp(sum(y));'
  change('Editable MATLAB script', code); click('Run script')
  const log = screen.getByRole('log', { name: 'Command Window output' })
  await waitFor(() => expect(log.textContent).toContain('>> matlab_start'))
  await waitFor(() => expect(within(log).getByText('5')).toBeTruthy())
  const variables = screen.getByRole('region', { name: 'Workspace variables' })
  expect(within(variables).getByText('[0,1,4]')).toBeTruthy()
  expect(screen.getByRole('img', { name: 'Script plot' })).toBeTruthy()
  click('Export computed results')
  expect(downloadJson.mock.calls.at(-1)[0].result).toMatchObject({ source: code, output: ['5'], plots: [{ x: [0, 1, 2], y: [0, 1, 4] }] })
  click('Download .m script')
  expect(downloadText).toHaveBeenLastCalledWith(code, 'matlab_start.m')
  change('Editable MATLAB script', 'disp(9);')
  expect(within(variables).queryByText('[0,1,4]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Export computed results' }).disabled).toBe(true)
  expect(log.textContent).toContain('Workspace cleared: the script changed')
  click('Run script'); await waitFor(() => expect(screen.getByRole('button', { name: 'Export computed results' }).disabled).toBe(false))
  click('Export computed results')
  expect(downloadJson.mock.calls.at(-1)[0].result.output).toEqual(['9'])
})

it('runs Command Window entries against the last run by replaying only successful commands', async () => {
  page('/sandbox?bench=matlab')
  const log = screen.getByRole('log', { name: 'Command Window output' })
  const enter = async text => { change('MATLAB command', text); fireEvent.submit(screen.getByLabelText('MATLAB command').closest('form')); await waitFor(() => expect(screen.getByLabelText('MATLAB command').disabled).toBe(false)) }
  change('Editable MATLAB script', 'a = 2;'); click('Run script')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export computed results' }).disabled).toBe(false))
  await enter('b = a * 3')
  expect(log.textContent).toContain('b =')
  expect(within(log).getByText(/^b =/).textContent).toContain('6')
  await enter('missing + 1')
  const failure = within(log).getByText(/Unknown variable missing/)
  expect(failure.textContent).not.toMatch(/^Line \d+/)
  await enter('disp(a + b)')
  expect(within(log).getByText('8')).toBeTruthy()
  click('Export computed results')
  expect(downloadJson.mock.calls.at(-1)[0].result.source).toBe('a = 2;\nb = a * 3\ndisp(a + b)')
  const input = screen.getByLabelText('MATLAB command')
  fireEvent.keyDown(input, { key: 'ArrowUp' })
  expect(input.value).toBe('disp(a + b)')
  await enter('clc')
  expect(log.textContent).toBe('')
})

it('plots selected workspace vectors through the Command Window and explains other files in the folder', async () => {
  page('/sandbox?bench=matlab&lesson=matlab-ode')
  click('Run script')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export computed results' }).disabled).toBe(false))
  fireEvent.click(screen.getByRole('tab', { name: 'Plots' }))
  expect(screen.getByRole('button', { name: 'Plot selected variables' }).disabled).toBe(true)
  fireEvent.click(screen.getByLabelText('Select t')); fireEvent.click(screen.getByLabelText('Select reference'))
  click('Plot selected variables')
  const log = screen.getByRole('log', { name: 'Command Window output' })
  await waitFor(() => expect(log.textContent).toContain('>> plot(t,reference)'))
  // The preset leaves hold("on") set, so the replayed session adds a third series, as MATLAB would.
  await waitFor(() => expect(within(screen.getByLabelText('Plot series')).getAllByRole('option')).toHaveLength(3))
  fireEvent.keyDown(screen.getByRole('button', { name: /matlab_ode_desktop\.m/ }), { key: 'Enter' })
  expect(screen.getByLabelText('Desktop MATLAB companion source').value).toContain('ode45')
  click('Download desktop example')
  expect(downloadText).toHaveBeenLastCalledWith(expect.stringContaining('ode45'), 'matlab_ode_desktop.m')
  fireEvent.click(screen.getByRole('button', { name: /12_control/ }))
  expect(screen.getByRole('dialog')).toBeTruthy(); click('Cancel')
  expect(screen.getByLabelText('Choose a MATLAB experiment').value).toBe('matlab-ode')
})

it('checks code with the browser parser, marks desktop-only calls and edits selected lines', () => {
  page('/sandbox?bench=matlab')
  change('Editable MATLAB script', 'x = (1;')
  expect(screen.getByRole('button', { name: /Code check: 1 error$/ })).toBeTruthy()
  change('Editable MATLAB script', 'y = fft(1:4);\nz = 1;')
  expect(screen.getByRole('button', { name: /Code check: 1 warning$/ }).title).toContain('fft needs desktop MATLAB')
  const editor = screen.getByLabelText('Editable MATLAB script')
  editor.setSelectionRange(0, editor.value.length)
  click('Comment selected lines')
  expect(editor.value).toBe('% y = fft(1:4);\n% z = 1;')
  editor.setSelectionRange(0, editor.value.length)
  click('Uncomment selected lines')
  editor.setSelectionRange(0, 3)
  click('Indent selected lines')
  expect(editor.value).toBe('    y = fft(1:4);\nz = 1;')
})

it('exposes code errors without reusing results or losing the editor', async () => {
  page('/sandbox?bench=matlab')
  change('Editable MATLAB script', 'a=[1 2];\ndisp(a(0));'); click('Run script')
  expect((await screen.findByRole('alert')).textContent).toContain('Line 2')
  expect(screen.getByLabelText('Editable MATLAB script').value).toContain('a(0)')
  expect(screen.queryByRole('region', { name: 'MATLAB results' })).toBeNull()
  change('Editable MATLAB script', 'disp(fft([1 2]));'); click('Run script')
  expect((await screen.findByRole('alert')).textContent).toContain('not supported')
})

it('saves unfinished code, loads only after confirmation and exports the exact notebook', () => {
  page('/sandbox?bench=matlab&lesson=matlab-ode')
  const code = '% unfinished\ny = '
  change('Editable MATLAB script', code); change('Experiment notes', 'Predict error before completing code'); click('Save notebook')
  const saved = JSON.parse(localStorage.getItem(MATLAB_STORAGE_PREFIX + 'matlab-ode'))
  expect(saved.code).toBe(code)
  change('Editable MATLAB script', 'disp(9);'); click('Load saved notebook'); click('Cancel')
  expect(screen.getByLabelText('Editable MATLAB script').value).toBe('disp(9);')
  click('Load saved notebook'); click('Replace notebook')
  expect(screen.getByLabelText('Editable MATLAB script').value).toBe(code)
  click('Export notebook'); expect(downloadJson).toHaveBeenLastCalledWith(saved, 'matlab-ode.json')
})

it('confirms imports, strips claimed results and rejects wrong-course or invalid files atomically', async () => {
  page('/sandbox?bench=matlab')
  change('Experiment notes', 'Keep this')
  const imported = { ...createMatlabProject('matlab-capstone'), result: { output: ['fake'] } }
  const input = screen.getByLabelText('Import MATLAB notebook file')
  fireEvent.change(input, { target: { files: [{ size: 100, text: async () => JSON.stringify(imported) }] } })
  await screen.findByRole('dialog')
  expect(screen.getByLabelText('Experiment notes').value).toBe('Keep this')
  click('Replace notebook')
  expect(screen.getByLabelText('Choose a MATLAB experiment').value).toBe('matlab-capstone')
  expect(screen.queryByRole('region', { name: 'MATLAB results' })).toBeNull()
  fireEvent.change(input, { target: { files: [{ size: 2, text: async () => '{}' }] } })
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Editable MATLAB script').value).toBe(imported.code)
})

it('protects drafts when resetting and switching presets', () => {
  page('/sandbox?bench=matlab')
  change('Experiment notes', 'Keep this note')
  change('Choose a MATLAB experiment', 'matlab-ode'); click('Cancel')
  expect(screen.getByLabelText('Choose a MATLAB experiment').value).toBe('matlab-start')
  click('Reset notebook'); click('Cancel')
  expect(screen.getByLabelText('Experiment notes').value).toBe('Keep this note')
  change('Choose a MATLAB experiment', 'matlab-ode'); click('Replace notebook')
  expect(screen.getByLabelText('Choose a MATLAB experiment').value).toBe('matlab-ode')
})

it('grades each section independently without adding exam attempts', () => {
  page('/matlab/matlab-start')
  const course = MATLAB_COURSES[0], section = screen.getByRole('region', { name: course.lessons[0].title })
  fireEvent.click(within(section).getByText('Check this section'))
  const q = course.lessons[0].question
  fireEvent.click(within(section).getByRole('radio', { name: q.options.find(o => o.id === q.answerId).text }))
  fireEvent.click(within(section).getByRole('button', { name: 'Check practice answers' }))
  expect(within(section).getByText('1 of 1 correct · 100%')).toBeTruthy()
  expect(readCourseProgress(course).attempts).toBe(0)
})

it('rejects incomplete exams, counts complete attempts once and retains the best score after retry and reload', () => {
  const view = page('/matlab/matlab-start'), course = MATLAB_COURSES[0]
  const form = screen.getByRole('form', { name: 'Course exam' })
  const groups = within(form).getAllByRole('group')
  function answer(i, correct = true) {
    const q = course.exam.questions[i], choice = q.options.find(o => correct ? o.id === q.answerId : o.id !== q.answerId)
    fireEvent.click(within(groups[i]).getByRole('radio', { name: choice.text }))
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
  view.unmount(); page('/matlab/matlab-start')
  expect(screen.getByText('Best exam score: 80%')).toBeTruthy()
  expect(localStorage.getItem('vq.player')).toBeNull()
})

it('preserves source, results, notes, section checks and answers across language changes', async () => {
  page('/matlab/matlab-start')
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  const form = screen.getByRole('form', { name: 'Course exam' })
  fireEvent.click(within(form).getAllByRole('radio')[0])
  change('Editable MATLAB script', 'answer=21*2; disp(answer);')
  change('Experiment notes', 'Retain me'); click('Run script')
  await screen.findByRole('region', { name: 'MATLAB results' })
  change('Language / Bahasa', 'id')
  expect(screen.getByLabelText('Skrip MATLAB yang dapat diedit').value).toContain('21*2')
  expect(screen.getByRole('region', { name: 'Hasil MATLAB' })).toBeTruthy()
  expect(screen.getByLabelText('Tandai pelajaran 1 sudah dibaca').checked).toBe(true)
  expect(within(screen.getByRole('form', { name: 'Ujian kursus' })).getAllByRole('radio').filter(el => el.checked)).toHaveLength(1)
  expect(screen.getByDisplayValue('Retain me')).toBeTruthy()
})

it('reports storage failure while preserving the visit and supports a separate lab tab', () => {
  page('/matlab/matlab-start')
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  change('Experiment notes', 'retain'); click('Save notebook')
  expect(screen.getByRole('alert').textContent).toContain('Export your notebook')
  expect(screen.getByLabelText('Experiment notes').value).toBe('retain')
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  expect(screen.getByLabelText('Mark lesson 1 as read').checked).toBe(true)
  const link = screen.getByRole('link', { name: 'Open a sandbox copy in a new tab' })
  expect(link.target).toBe('_blank'); expect(link.getAttribute('href')).toBe('/sandbox?bench=matlab&lesson=matlab-start')
})

it('ignores late worker results after edits, cancels on Stop and releases workers on disposal', async () => {
  const workers = []
  vi.stubGlobal('Worker', class { constructor() { workers.push(this); this.terminate = vi.fn() } postMessage() {} })
  const view = page('/sandbox?bench=matlab')
  click('Run script'); change('Editable MATLAB script', 'disp(7);')
  expect(workers[0].terminate).toHaveBeenCalled()
  await act(async () => workers[0].onmessage({ data: { result: runMatlab('disp(5)') } }))
  expect(screen.queryByRole('region', { name: 'MATLAB results' })).toBeNull()
  click('Run script'); click('Stop script')
  expect(workers[1].terminate).toHaveBeenCalled()
  click('Run script'); view.unmount()
  expect(workers[2].terminate).toHaveBeenCalled()
})

it('resets transient state on course changes and rejects unknown presets', () => {
  const view = page('/matlab/matlab-start')
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  fireEvent.click(screen.getByRole('link', { name: 'Next course' }))
  expect(screen.getByRole('heading', { name: /2\. Vectors/ })).toBeTruthy()
  expect(screen.getByLabelText('Mark lesson 1 as read').checked).toBe(false)
  view.unmount(); page('/sandbox?bench=matlab&lesson=unknown')
  expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
})

it('keeps the desktop script, Command Window session and open documents across a language change', async () => {
  page('/sandbox?bench=matlab')
  change('Editable MATLAB script', 'k = 6;'); click('Run script')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export computed results' }).disabled).toBe(false))
  change('MATLAB command', 'k * 7'); fireEvent.submit(screen.getByLabelText('MATLAB command').closest('form'))
  await waitFor(() => expect(screen.getByRole('log', { name: 'Command Window output' }).textContent).toContain('42'))
  fireEvent.click(screen.getByRole('tab', { name: 'notes.txt' }))
  change('Language / Bahasa', 'id')
  expect(screen.getByLabelText('Skrip MATLAB yang dapat diedit').value).toBe('k = 6;')
  expect(screen.getByRole('log', { name: translate('id', 'Command Window output') }).textContent).toContain('42')
  expect(screen.getByRole('tab', { name: 'notes.txt' }).getAttribute('aria-selected')).toBe('true')
})

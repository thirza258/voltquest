// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadJson } from '../../lib/download.js'
import { readCourseProgress, COURSE_PROGRESS_KEY } from '../courses/progress.js'
import { navSectionFor } from '../workspace/AppHeader.jsx'
import CybersecurityPage, { CYBER_COURSES } from './CybersecurityPage.jsx'
import CybersecurityPromo from './CybersecurityPromo.jsx'
import { CYBER_STORAGE_PREFIX, createCyberProject } from './project.js'

vi.mock('../../lib/download.js', () => ({ downloadJson: vi.fn() }))
beforeEach(() => { installMemoryStorage(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function page(path = '/cybersecurity') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/cybersecurity" element={<CybersecurityPage />} /><Route path="/cybersecurity/:lessonId" element={<CybersecurityPage />} /><Route path="/sandbox" element={<CybersecurityPage sandbox />} /></Routes></MemoryRouter></LocaleProvider>)
}
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
const change = (name, value) => fireEvent.change(screen.getByLabelText(name), { target: { value } })
const response = () => screen.getByLabelText('Response body').textContent

it('offers all ten courses with progressive levels, URL filters and navigation', () => {
  page()
  expect(screen.getAllByRole('link').filter(link => /\/cybersecurity\/cyber-/.test(link.getAttribute('href')))).toHaveLength(11)
  change('Search cybersecurity courses', 'SQL')
  expect(screen.getByRole('status').textContent).toContain('1 courses found')
  expect(screen.getByRole('heading', { name: /04\. Find and repair SQL injection/ })).toBeTruthy()
  change('Course level', 'Fundamental')
  expect(screen.getByRole('heading', { name: 'No courses match' })).toBeTruthy()
  click('Clear filters')
  expect(screen.getByRole('status').textContent).toContain('10 courses found')
  expect(navSectionFor('/cybersecurity/cyber-sql')).toBe('tutorials')
})

it('makes the path and sandbox discoverable from the reusable hub card', () => {
  render(<MemoryRouter><CybersecurityPromo /></MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Explore cybersecurity courses' }).getAttribute('href')).toBe('/cybersecurity')
  expect(screen.getByRole('link', { name: 'Open cybersecurity sandbox' }).getAttribute('href')).toBe('/sandbox?bench=cybersecurity')
})

it('executes editable requests, shows actual leaked data and invalidates stale response/verification', () => {
  page('/sandbox?bench=cybersecurity&lesson=cyber-idor')
  click('Send local request')
  expect(response()).toContain('Alice — demo address')
  change('Request path', '/orders/1002')
  expect(screen.queryByLabelText('Response body')).toBeNull()
  click('Send local request')
  expect(response()).toContain('Bob — demo address')
  click('Run regression checks')
  expect(screen.getByText('Some regression checks failed · 2/4')).toBeTruthy()
  fireEvent.click(screen.getByLabelText('Check order ownership'))
  expect(screen.queryByLabelText('Verification results')).toBeNull()
  click('Send local request')
  expect(response()).not.toContain('demo address')
  expect(screen.getByText(/^HTTP 403/)).toBeTruthy()
  click('Run regression checks')
  expect(screen.getByText('All regression checks passed · 4/4')).toBeTruthy()
  click('Export investigation report')
  const report = downloadJson.mock.calls.at(-1)[0]
  expect(report.history).toHaveLength(3)
  expect(report.history[1].controls.ownership).toBe(false)
  expect(report.currentControls.ownership).toBe(true)
  expect(report.verification.passed).toBe(true)
  expect(report.historyTruncated).toBe(false)
})

it('applies a stateful privilege change and resets it when a defense changes', () => {
  page('/sandbox?bench=cybersecurity&lesson=cyber-mass')
  click('Load guided probe'); click('Send local request')
  expect(response()).toContain('"role": "admin"')
  change('Method', 'GET'); change('Request path', '/admin'); change('Request body (JSON)', '{}')
  click('Send local request')
  expect(response()).toContain('DEMO_ADMIN')
  fireEvent.click(screen.getByLabelText('Allow only editable profile fields'))
  click('Send local request')
  expect(screen.getByText(/^HTTP 403/)).toBeTruthy()
  expect(screen.getByLabelText('Fixture account state').textContent).toContain('"role": "customer"')
})

it('renders probes and imported notes as inert text without creating injected elements', () => {
  page('/sandbox?bench=cybersecurity&lesson=cyber-xss')
  click('Load guided probe'); click('Send local request')
  expect(response()).toContain('<img src=x')
  const result = screen.getByLabelText('Current response')
  expect(result.querySelector('img')).toBeNull()
  expect(result.querySelector('script')).toBeNull()
  fireEvent.click(screen.getByLabelText('Encode HTML text output'))
  click('Send local request')
  expect(response()).toContain('&lt;img')
  expect(result.querySelector('img')).toBeNull()
})

it('keeps unfinished drafts saveable while rejecting malformed requests without mutating the shop', () => {
  page('/sandbox?bench=cybersecurity')
  change('Request headers (JSON)', '{')
  click('Send local request')
  expect(screen.getByRole('alert').textContent).toContain('headers are not valid JSON')
  expect(screen.queryByLabelText('Response body')).toBeNull()
  click('Save notebook')
  expect(JSON.parse(localStorage.getItem(CYBER_STORAGE_PREFIX + 'http')).request.headers).toBe('{')
  click('Load normal request'); change('Request path', 'https://example.test')
  click('Send local request')
  expect(screen.getByRole('alert').textContent).toContain('local path')
})

it('saves and restores exact request drafts, defenses and notes only after confirmation', () => {
  page('/sandbox?bench=cybersecurity&lesson=cyber-sql')
  click('Load guided probe')
  change('Investigation notes', 'The unpublished row was visible. Preserve this exact notebook.')
  fireEvent.click(screen.getByLabelText('Bind SQL parameters'))
  click('Save notebook')
  const saved = JSON.parse(localStorage.getItem(CYBER_STORAGE_PREFIX + 'sql'))
  change('Investigation notes', 'new unsaved work')
  click('Load saved notebook'); click('Cancel')
  expect(screen.getByLabelText('Investigation notes').value).toBe('new unsaved work')
  click('Load saved notebook'); click('Replace notebook')
  expect(screen.getByLabelText('Investigation notes').value).toBe(saved.notes)
  expect(screen.getByLabelText('Request path').value).toBe(saved.request.path)
  expect(screen.getByLabelText('Bind SQL parameters').checked).toBe(true)
  expect(screen.queryByLabelText('Response body')).toBeNull()
  click('Export notebook')
  expect(downloadJson).toHaveBeenLastCalledWith(saved, 'cybersecurity-sql.json')
})

it('requires import confirmation, rejects malformed/foreign imports and ignores imported proof', async () => {
  page('/sandbox?bench=cybersecurity')
  const imported = createCyberProject('csrf'); imported.notes = 'Imported notes'; imported.verification = { passed: true }
  change('Investigation notes', 'Keep current work')
  const input = screen.getByLabelText('Import cybersecurity JSON file')
  fireEvent.change(input, { target: { files: [{ size: 100, text: async () => JSON.stringify(imported) }] } })
  await screen.findByRole('dialog')
  expect(screen.getByLabelText('Investigation notes').value).toBe('Keep current work')
  click('Replace notebook')
  expect(screen.getByLabelText('Choose a cybersecurity lab').value).toBe('csrf')
  expect(screen.getByLabelText('Investigation notes').value).toBe('Imported notes')
  expect(screen.queryByLabelText('Verification results')).toBeNull()
  expect(screen.getByRole('button', { name: 'Export investigation report' }).disabled).toBe(true)
  fireEvent.change(input, { target: { files: [{ size: 2, text: async () => '{}' }] } })
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Investigation notes').value).toBe('Imported notes')
  cleanup()
  page('/cybersecurity/cyber-http')
  fireEvent.change(screen.getByLabelText('Import cybersecurity JSON file'), { target: { files: [{ size: 100, text: async () => JSON.stringify(imported) }] } })
  expect((await screen.findByRole('alert')).textContent).toContain('another lab')
})

it('protects the current notebook when changing labs or resetting', () => {
  page('/sandbox?bench=cybersecurity')
  change('Investigation notes', 'Keep my draft')
  change('Choose a cybersecurity lab', 'mass'); click('Cancel')
  expect(screen.getByLabelText('Choose a cybersecurity lab').value).toBe('http')
  click('Reset lab'); click('Cancel')
  expect(screen.getByLabelText('Investigation notes').value).toBe('Keep my draft')
  change('Choose a cybersecurity lab', 'mass'); click('Replace notebook')
  expect(screen.getByLabelText('Choose a cybersecurity lab').value).toBe('mass')
  expect(screen.getByLabelText('Investigation notes').value).toBe('')
})

it('requires complete exams, persists an 80% pass and keeps practice separate', () => {
  page('/cybersecurity/cyber-idor')
  const course = CYBER_COURSES.find(item => item.id === 'cyber-idor')
  const form = screen.getByRole('form', { name: 'Course exam' })
  const groups = within(form).getAllByRole('group')
  const answer = (index, correct) => {
    const question = course.exam.questions[index]
    const option = question.options.find(item => correct ? item.id === question.answerId : item.id !== question.answerId)
    fireEvent.click(within(groups[index]).getByRole('radio', { name: option.text }))
  }
  answer(0, true); click('Submit exam')
  expect(within(form).getByRole('alert')).toBeTruthy()
  expect(readCourseProgress(course).attempts).toBe(0)
  expect(document.activeElement).toBe(within(groups[1]).getAllByRole('radio')[0])
  for (let i = 1; i < 5; i++) answer(i, i < 4)
  click('Submit exam')
  expect(readCourseProgress(course)).toMatchObject({ attempts: 1, bestPercent: 80, lastPercent: 80 })
  fireEvent.submit(form)
  expect(readCourseProgress(course).attempts).toBe(1)
  expect(within(form).getAllByRole('link', { name: 'Review related lesson' }).every(link => document.getElementById(link.hash.slice(1)))).toBe(true)
  click('Retake exam')
  for (let i = 0; i < 5; i++) answer(i, false)
  click('Submit exam')
  expect(readCourseProgress(course)).toMatchObject({ attempts: 2, bestPercent: 80, lastPercent: 0 })
  const practice = screen.getByRole('form', { name: 'Practice questions' })
  for (const group of within(practice).getAllByRole('group')) fireEvent.click(within(group).getAllByRole('radio')[0])
  click('Check practice answers')
  expect(readCourseProgress(course).attempts).toBe(2)
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  cleanup(); page('/cybersecurity/cyber-idor')
  expect(screen.getByLabelText('Mark lesson 1 as read').checked).toBe(true)
  expect(screen.getByText('Best exam score: 80%')).toBeTruthy()
  expect(localStorage.getItem(COURSE_PROGRESS_KEY)).toContain('cyber-idor')
})

it('preserves the current request, notes, response, section checks and exam choices across language changes', () => {
  page('/cybersecurity/cyber-http')
  change('Investigation notes', 'My exact note stays in English.')
  click('Load guided probe'); click('Send local request')
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  const form = screen.getByRole('form', { name: 'Course exam' })
  const radio = within(form).getAllByRole('radio')[0]
  fireEvent.click(radio)
  const before = response()
  change('Language / Bahasa', 'id')
  expect(screen.getByLabelText('Jalur permintaan').value).toBe('/debug')
  expect(screen.getByLabelText('Catatan penyelidikan').value).toBe('My exact note stays in English.')
  expect(screen.getByLabelText('Isi respons').textContent).toBe(before)
  expect(radio.checked).toBe(true)
  expect(document.documentElement.lang).toBe('id')
  expect(screen.getByText(/Narasi kursus keamanan siber/)).toBeTruthy()
  change('Language / Bahasa', 'en')
  expect(screen.getByLabelText('Mark lesson 1 as read').checked).toBe(true)
  const copyLink = screen.getByRole('link', { name: 'Open a sandbox copy in a new tab' })
  expect(copyLink.target).toBe('_blank')
  expect(copyLink.href).toContain('/sandbox?bench=cybersecurity&lesson=cyber-http')
})

it('keeps the sandbox usable when browser storage fails', () => {
  page('/sandbox?bench=cybersecurity')
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  click('Save notebook')
  expect(screen.getByRole('alert').textContent).toContain('Export your notebook')
  click('Send local request')
  expect(response()).toContain('VoltShop')
  click('Export notebook')
  expect(downloadJson).toHaveBeenCalled()
})

it('keeps the last 30 captured requests and marks truncated reports', () => {
  page('/sandbox?bench=cybersecurity')
  for (let i = 0; i < 32; i++) click('Send local request')
  click('Export investigation report')
  const report = downloadJson.mock.calls.at(-1)[0]
  expect(report.history).toHaveLength(30)
  expect(report.totalRequests).toBe(32)
  expect(report.historyTruncated).toBe(true)
  expect(report.history[0].number).toBe(3)
})

it('handles unknown course ids without opening a misleading default lab', () => {
  page('/sandbox?bench=cybersecurity&lesson=unknown')
  expect(screen.getByRole('heading', { name: 'Course not found' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Send local request' })).toBeNull()
})

it('routes the real application to the lazy cybersecurity sandbox', async () => {
  const { usePlayerStore } = await import('../../store/playerStore.js')
  vi.spyOn(usePlayerStore.getState(), 'ensureGuest').mockResolvedValue(null)
  const { default: App } = await import('../../App.jsx')
  render(<LocaleProvider><MemoryRouter initialEntries={['/sandbox?bench=cybersecurity&lesson=cyber-ssrf']}><App /></MemoryRouter></LocaleProvider>)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Cybersecurity sandbox' })).toBeTruthy())
  expect(screen.getByLabelText('Choose a cybersecurity lab').value).toBe('ssrf')
  click('Load guided probe'); click('Send local request')
  expect(response()).toContain('DEMO_INTERNAL')
})

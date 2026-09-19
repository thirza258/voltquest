// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { api } from '../../api/client.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadBlob } from '../../lib/download.js'
import { COMPUTER_COURSES } from '../computer/project.js'
import CourseCertificate from './CourseCertificate.jsx'
import CertificateDetails, { matchesCertificateFile } from './CertificateDetails.jsx'
import CertificatesPage from './CertificatesPage.jsx'
import Assessment from './Assessment.jsx'

vi.mock('../../lib/download.js', () => ({ downloadBlob: vi.fn(() => true) }))
const course = COMPUTER_COURSES[0]
const answers = Object.fromEntries(course.exam.questions.map(q => [q.id, q.answerId]))
const record = { id: 'fbd780ab-7423-4cd1-8a02-481496f38c22', course_id: course.id, course_version: 1,
  course_title: course.title, course_path: `/computer-architecture/${course.id}`, learner_name: 'Dewi García',
  percent: 80, issued_at: '2026-09-20T10:00:00+00:00', pdf_sha256: 'a'.repeat(64) }
const originalPlayer = usePlayerStore.getState().player
const shell = children => render(<LocaleProvider><MemoryRouter>{children}</MemoryRouter></LocaleProvider>)
const file = (text, size) => { const bytes = new TextEncoder().encode(text); return { size: size ?? bytes.length, arrayBuffer: async () => bytes.buffer } }
const page = path => render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/certificates" element={<CertificatesPage />} /><Route path="/certificates/:certificateId" element={<CertificatesPage />} /></Routes></MemoryRouter></LocaleProvider>)

beforeEach(() => {
  installMemoryStorage(); vi.stubGlobal('crypto', webcrypto)
  usePlayerStore.setState({ player: { id: 'test-learner', display_name: 'Learner', username: null } })
  vi.spyOn(api.certificates, 'mine').mockResolvedValue({ certificates: [] })
  vi.spyOn(api.certificates, 'issue').mockResolvedValue(record)
  vi.spyOn(api.certificates, 'verify').mockResolvedValue(record)
  vi.spyOn(api.certificates, 'pdf').mockResolvedValue(new Blob(['%PDF-1.4 original'], { type: 'application/pdf' }))
  vi.mocked(downloadBlob).mockClear()
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); usePlayerStore.setState({ player: originalPlayer }) })

it('only offers issuance after a complete passing exam and sends chosen answers after explicit name/consent', async () => {
  shell(<Assessment exam course={course} questions={course.exam.questions} />)
  const form = screen.getByRole('form', { name: 'Course exam' })
  fireEvent.submit(form)
  expect(api.certificates.issue).not.toHaveBeenCalled()
  expect(screen.queryByRole('form', { name: 'Issue course certificate' })).toBeNull()
  for (const [i, question] of course.exam.questions.entries()) {
    const option = question.options.find(o => i === 4 ? o.id !== question.answerId : o.id === question.answerId)
    fireEvent.click(within(within(form).getAllByRole('group')[i]).getByRole('radio', { name: option.text }))
  }
  fireEvent.submit(form)
  const issue = await screen.findByRole('form', { name: 'Issue course certificate' })
  expect(form.contains(issue)).toBe(false)
  expect(screen.getByRole('button', { name: 'Issue certificate' }).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Name on certificate'), { target: { value: '  Dewi García  ' } })
  fireEvent.click(within(issue).getByRole('checkbox')); fireEvent.submit(issue)
  await screen.findByText('Verified issuance record')
  expect(api.certificates.issue).toHaveBeenCalledTimes(1)
  expect(api.certificates.issue.mock.calls[0][0]).toMatchObject({ course_id: course.id, course_version: 1, learner_name: 'Dewi García', share_consent: true })
  expect(Object.keys(api.certificates.issue.mock.calls[0][0].answers)).toHaveLength(5)
  expect(api.certificates.issue.mock.calls[0][0]).not.toHaveProperty('percent')
  fireEvent.click(screen.getByRole('button', { name: 'Download certificate PDF' }))
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), `voltquest-certificate-${record.id}.pdf`))
})

it('recovers an issued certificate after remount without needing local answers', async () => {
  api.certificates.mine.mockResolvedValue({ certificates: [record] })
  shell(<CourseCertificate course={course} answers={null} />)
  await screen.findByText('Dewi García')
  expect(screen.getByRole('link', { name: 'Open public verifier' }).getAttribute('href')).toBe(`/certificates/${record.id}`)
  expect(screen.queryByLabelText('Name on certificate')).toBeNull()
  expect(api.certificates.issue).not.toHaveBeenCalled()
})

it('keeps name and consent through locale changes and reports an issuance failure without a fabricated record', async () => {
  api.certificates.issue.mockRejectedValue(new Error('Network error'))
  page('/certificates'); cleanup()
  shell(<><CertificatesPage /><CourseCertificate course={course} answers={answers} /></>)
  const input = await screen.findByLabelText('Name on certificate')
  fireEvent.change(input, { target: { value: 'Ayu' } }); fireEvent.click(screen.getByRole('form', { name: 'Issue course certificate' }).querySelector('input[type=checkbox]'))
  fireEvent.change(screen.getByLabelText('Language / Bahasa'), { target: { value: 'id' } })
  expect(screen.getByLabelText('Nama pada sertifikat').value).toBe('Ayu')
  fireEvent.submit(screen.getByRole('form', { name: 'Terbitkan sertifikat kursus' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('Catatan penerbitan terverifikasi')).toBeNull()
})

it('clears an old player certificate when the account changes and ignores its late response', async () => {
  let resolve
  api.certificates.mine.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  shell(<CourseCertificate course={course} answers={null} />)
  act(() => usePlayerStore.setState({ player: { id: 'different', display_name: 'Different' } }))
  await screen.findByText('Complete a passing exam in this visit to issue a new certificate. Older local scores have no submitted answers to verify.')
  await act(async () => resolve({ certificates: [record] }))
  expect(screen.queryByText('Dewi García')).toBeNull()
})

it('looks up pasted verification links without requiring a logged-in player', async () => {
  usePlayerStore.setState({ player: null }); page('/certificates')
  fireEvent.change(screen.getByLabelText('Certificate ID or verification link'), { target: { value: `https://learn.example.test/certificates/${record.id}` } })
  fireEvent.submit(screen.getByRole('form', { name: 'Find a certificate' }))
  await screen.findByText('Verified issuance record')
  expect(api.certificates.verify).toHaveBeenCalledWith(record.id, expect.objectContaining({ signal: expect.any(AbortSignal) }))
  expect(api.certificates.mine).not.toHaveBeenCalled()
})

it('distinguishes unknown codes from an unavailable verifier and allows retry', async () => {
  api.certificates.verify.mockRejectedValueOnce({ status: 404 }).mockRejectedValueOnce({ status: 0 })
  page(`/certificates/${record.id}`)
  expect((await screen.findByRole('alert')).textContent).toContain('No issued certificate')
  fireEvent.click(screen.getByRole('button', { name: 'Try verification again' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('could not reach the server'))
  fireEvent.click(screen.getByRole('button', { name: 'Try verification again' }))
  await screen.findByText('Verified issuance record')
})

it('compares actual PDF bytes, detects modifications, and bounds files before reading', async () => {
  const original = file('%PDF-1.4\noriginal')
  const digest = Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', await original.arrayBuffer())), n => n.toString(16).padStart(2, '0')).join('')
  await expect(matchesCertificateFile(original, digest)).resolves.toBe(true)
  await expect(matchesCertificateFile(file('%PDF-1.4\nmodified'), digest)).resolves.toBe(false)
  await expect(matchesCertificateFile(file('not a pdf'), digest)).rejects.toThrow('Choose a PDF file')
  const large = { size: 3000000, arrayBuffer: vi.fn() }
  await expect(matchesCertificateFile(large, digest)).rejects.toThrow('2 MiB')
  expect(large.arrayBuffer).not.toHaveBeenCalled()
  shell(<CertificateDetails certificate={{ ...record, pdf_sha256: digest }} verifyFile />)
  fireEvent.change(screen.getByLabelText('Certificate PDF to check'), { target: { files: [original] } })
  await screen.findByText('This PDF matches the original issued file.')
  fireEvent.change(screen.getByLabelText('Certificate PDF to check'), { target: { files: [file('%PDF-1.4\nmodified')] } })
  await screen.findByText('This PDF does not match the original issued file. Download the original to compare.')
})

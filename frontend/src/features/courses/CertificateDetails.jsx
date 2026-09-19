import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { downloadBlob } from '../../lib/download.js'
import { useI18n } from '../../i18n/index.jsx'
import { Button } from '../../ui/index.js'

export async function matchesCertificateFile(file, expectedHash) {
  if (!file || file.size > 2 * 1024 * 1024) throw new Error('Choose a PDF smaller than 2 MiB.')
  const bytes = await file.arrayBuffer()
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Choose a PDF file.')
  if (!globalThis.crypto?.subtle) throw new Error('PDF checking requires HTTPS or localhost.')
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('') === expectedHash
}

export default function CertificateDetails({ certificate, verifyFile = false }) {
  const { t } = useI18n(), [busy, setBusy] = useState(false), [error, setError] = useState(''), [fileResult, setFileResult] = useState('')
  const generation = useRef(0)
  async function download() {
    setBusy(true); setError('')
    try {
      const blob = await api.certificates.pdf(certificate.id)
      if (!downloadBlob(blob, `voltquest-certificate-${certificate.id}.pdf`)) throw new Error('The PDF could not be downloaded. Please try again.')
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  async function checkFile(event) {
    const file = event.target.files?.[0], id = ++generation.current
    setFileResult(''); setError('')
    if (!file) return
    try {
      const matches = await matchesCertificateFile(file, certificate.pdf_sha256)
      if (id === generation.current) setFileResult(matches ? 'This PDF matches the original issued file.' : 'This PDF does not match the original issued file. Download the original to compare.')
    } catch (failure) { if (id === generation.current) setError(failure.message) }
  }
  return <div className="min-w-0 space-y-4">
    <div className="rounded-md border border-teal-200 bg-teal-50 p-4"><p className="font-semibold text-teal-900">{t('Verified issuance record')}</p><p className="mt-2 break-words text-lg font-semibold">{certificate.learner_name}</p><p className="mt-2 break-words">{certificate.course_title}</p><p className="mt-2 text-sm text-slate-600">{t('Score: {percent}%', { percent: certificate.percent })} · {t('Course version {version}', { version: certificate.course_version })} · {t('Issued {date}', { date: certificate.issued_at.slice(0, 10) })} UTC</p><p className="mt-3 break-all font-mono text-xs">{t('Certificate ID')}: {certificate.id}</p></div>
    <p className="text-sm leading-6 text-slate-600">{t('This verifies a saved VoltQuest self-study exam pass. The exam was unproctored and the learner name is self-declared. This is not an accredited qualification.')}</p>
    <div className="flex flex-wrap items-center gap-3"><Button type="button" disabled={busy} onClick={download}>{t(busy ? 'Downloading PDF…' : 'Download certificate PDF')}</Button><Link className="text-sm font-medium text-brand-700 underline" to={`/certificates/${certificate.id}`}>{t('Open public verifier')}</Link><Link className="text-sm text-brand-700 underline" to={certificate.course_path}>{t('Open course')}</Link></div>
    {verifyFile && <section className="rounded-md border border-line p-4"><h2 className="font-semibold">{t('Check a certificate PDF')}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t('Compare your PDF with the original issued file. The fingerprint is calculated in your browser; the file is not uploaded.')}</p><label className="mt-3 block text-sm">{t('Certificate PDF to check')}<input className="mt-2 block w-full min-w-0 text-sm" type="file" accept=".pdf,application/pdf" onChange={checkFile} /></label><p aria-live="polite" className="mt-3 text-sm font-medium">{t(fileResult)}</p><details className="mt-3 text-xs"><summary className="cursor-pointer text-slate-600">{t('Original PDF fingerprint (SHA-256)')}</summary><p className="mt-2 break-all font-mono">{certificate.pdf_sha256}</p></details></section>}
    {error && <p role="alert" className="break-words text-sm text-rose-700">{t(error)}</p>}
  </div>
}

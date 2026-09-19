import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { usePlayerStore } from '../../store/playerStore.js'
import { useI18n } from '../../i18n/index.jsx'
import { Button } from '../../ui/index.js'
import CertificateDetails from './CertificateDetails.jsx'

function Verifier({ code }) {
  const { t } = useI18n(), [record, setRecord] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setRecord(null); setError('')
    api.certificates.verify(code, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setRecord(value) }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.status === 404 ? 'No issued certificate matches this code. Check the code and try again.' : 'The verifier could not reach the server. Please try again.')
    })
    return () => controller.abort()
  }, [code, retry])
  return <section className="mt-6 rounded-lg border border-line bg-white p-5 sm:p-7" aria-label={t('Certificate verification')}>
    {record ? <CertificateDetails key={record.id} certificate={record} verifyFile /> : error ? <><p role="alert" className="text-sm text-rose-700">{t(error)}</p><Button className="mt-4" variant="secondary" onClick={() => setRetry(value => value + 1)}>{t('Try verification again')}</Button></> : <p role="status">{t('Verifying certificate…')}</p>}
  </section>
}

function MyCertificates({ player }) {
  const { t } = useI18n(), [items, setItems] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!player?.id) return
    const controller = new AbortController()
    setItems(null); setError('')
    api.certificates.mine(undefined, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setItems(data.certificates) }).catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [player?.id, retry])
  return <section className="mt-7 rounded-lg border border-line bg-white p-5"><h2 className="text-xl font-semibold">{t('My certificates')}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{t('Certificates belong to your current player. Claim an account to recover them on another device. Keep your verification link to access the public record and PDF.')}</p>
    {!player?.id ? <p className="mt-3 text-sm">{t('Connect to the server to issue or recover certificates. Your course remains available offline.')}</p> : error ? <><p role="alert" className="mt-3 text-sm text-rose-700">{t(error)}</p><Button className="mt-3" variant="secondary" onClick={() => setRetry(value => value + 1)}>{t('Check certificates again')}</Button></> : items === null ? <p className="mt-4 text-sm">{t('Checking issued certificates…')}</p> : items.length ? <ul className="mt-4 space-y-3">{items.map(item => <li key={item.id}><Link className="block rounded-md border border-line p-4 hover:border-brand-600" to={`/certificates/${item.id}`}><p className="font-semibold text-brand-700">{item.course_title}</p><p className="mt-2 break-words text-sm text-slate-600">{item.learner_name} · {item.percent}% · {item.issued_at.slice(0, 10)}</p></Link></li>)}</ul> : <p className="mt-4 text-sm">{t('No certificates issued yet. Pass a course exam, then use its certificate form.')}</p>}
    {!player?.username && <Link className="mt-4 inline-block text-sm text-brand-700 underline" to="/profile#account">{t('Claim account')}</Link>}
  </section>
}

export default function CertificatesPage() {
  const { t } = useI18n(), { certificateId } = useParams(), navigate = useNavigate(), player = usePlayerStore(state => state.player)
  const [input, setInput] = useState(''), [error, setError] = useState('')
  function submit(event) {
    event.preventDefault()
    let code = input.trim().toLowerCase()
    try { if (code.includes('://')) code = new URL(code).pathname.split('/').filter(Boolean).at(-1) } catch { code = '' }
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(code)) { setError('Enter the certificate ID or its verification link.'); return }
    setError(''); navigate(`/certificates/${code}`)
  }
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-3xl px-4 py-8 sm:px-8"><Link to="/courses" className="text-sm text-brand-700 underline">{t('All courses')}</Link><h1 className="mt-5 text-3xl font-semibold">{t('Certificates & verification')}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{t('Look up an issued certificate and compare its original PDF. Verification is public and does not require an account.')}</p>
    <form className="mt-5 space-y-3" aria-label={t('Find a certificate')} onSubmit={submit}><label className="block text-sm font-medium">{t('Certificate ID or verification link')}<input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={input} onChange={event => setInput(event.target.value)} maxLength={300} required /></label><Button type="submit">{t('Verify certificate')}</Button>{error && <p role="alert" className="text-sm text-rose-700">{t(error)}</p>}</form>
    {certificateId ? <Verifier key={certificateId} code={certificateId} /> : <MyCertificates key={player?.id ?? 'offline'} player={player} />}
    {certificateId && <Link className="mt-5 inline-block text-sm text-brand-700 underline" to="/certificates">{t('My certificates and verifier')}</Link>}
  </main></div>
}

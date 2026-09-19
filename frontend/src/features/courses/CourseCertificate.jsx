import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { useI18n } from '../../i18n/index.jsx'
import { Button } from '../../ui/index.js'
import CertificateDetails from './CertificateDetails.jsx'

function CertificateSession({ course, answers, player }) {
  const { t } = useI18n(), [name, setName] = useState(player?.display_name ?? ''), [consent, setConsent] = useState(false)
  const [certificate, setCertificate] = useState(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(Boolean(player?.id)), [error, setError] = useState(''), [refresh, setRefresh] = useState(0)
  useEffect(() => {
    if (!player?.id) return
    const controller = new AbortController()
    setLoading(true); setError('')
    api.certificates.mine(course.id, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setCertificate(data.certificates.find(item => item.course_version === course.version) ?? null)
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [course.id, course.version, player?.id, refresh])
  async function issue(event) {
    event.preventDefault()
    if (!answers || busy || !consent) return
    setBusy(true); setError('')
    try {
      setCertificate(await api.certificates.issue({ course_id: course.id, course_version: course.version, learner_name: name.trim(), answers, share_consent: true }))
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <section className="mt-6 min-w-0 rounded-lg border border-teal-200 bg-white p-4" aria-label={t('Course certificate')}>
    <h3 className="text-lg font-semibold">{t('Course certificate')}</h3>
    <p className="my-3 text-sm leading-6 text-slate-600">{t('Pass this course exam with at least 80% to issue a PDF certificate with a QR code and public verification link. The server checks your submitted answers.')}</p>
    {certificate ? <CertificateDetails key={certificate.id} certificate={certificate} /> : loading ? <p className="text-sm text-slate-600">{t('Checking issued certificates…')}</p> : !player?.id ? <p className="text-sm text-slate-600">{t('Connect to the server to issue or recover certificates. Your course remains available offline.')}</p> : !answers ? <p className="text-sm text-slate-600">{t('Complete a passing exam in this visit to issue a new certificate. Older local scores have no submitted answers to verify.')}</p> : <form className="space-y-4" onSubmit={issue} aria-label={t('Issue course certificate')}>
      <label className="block text-sm font-medium">{t('Name on certificate')}<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} disabled={busy} autoComplete="name" /></label>
      <p className="text-xs leading-5 text-slate-600">{t('Check the name before issuing. One certificate is issued per learner and course version; its original name and score are kept.')}</p>
      <label className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} disabled={busy} className="mt-1.5 shrink-0 accent-teal-700" /><span>{t('I agree to show my certificate name, course, score and issue date to anyone with its verification link.')}</span></label>
      <Button type="submit" disabled={busy || !consent || name.trim().length < 2}>{t(busy ? 'Issuing certificate…' : 'Issue certificate')}</Button>
    </form>}
    {error && <div className="mt-3 text-sm"><p role="alert" className="break-words text-rose-700">{t(error)}</p><Button type="button" variant="ghost" className="mt-2" disabled={busy || loading} onClick={() => setRefresh(value => value + 1)}>{t('Check certificates again')}</Button></div>}
    <Link className="mt-4 inline-block text-sm text-brand-700 underline" to="/certificates">{t('My certificates and verifier')}</Link>
  </section>
}

export default function CourseCertificate(props) {
  const player = usePlayerStore(state => state.player)
  return <CertificateSession key={`${props.course.id}:${props.course.version}:${player?.id ?? 'offline'}`} {...props} player={player} />
}

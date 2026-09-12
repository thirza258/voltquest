import { useI18n } from '../../i18n/index.jsx'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { COSMETICS, LEVEL_ORDER, getLevel } from '../../content/index.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { Badge, Button, ProgressBar, Stars, Switch, TextInput, useToast } from '../../ui/index.js'
import { AppHeader } from '../workspace/AppHeader.jsx'

export default function ProfilePage() {
  const { t } = useI18n()
  const { player, progress, settings, online, authExpired, pendingOps } = usePlayerStore()
  const toast = useToast()
  const [displayName, setDisplayName] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [accountAction, setAccountAction] = useState('claim')
  const completed = LEVEL_ORDER.filter(id => progress[id]?.stars > 0)
  const stars = completed.reduce((sum, id) => sum + progress[id].stars, 0)
  async function authenticate(event) {
    event.preventDefault(); setError(null); setBusy(true)
    try {
      const result = await usePlayerStore.getState()[accountAction](username, password)
      if (!result.ok) throw result.error
      setPassword(''); setDisplayName(null); toast.push({ tone: 'success', message: accountAction === 'claim' ? 'Account claimed. Your progress is linked to your username.' : 'Logged in.' })
    } catch (error) { setError(error?.message ?? 'Unable to sign in.') } finally { setBusy(false) }
  }
  async function rename(event) {
    event.preventDefault(); setBusy(true)
    try { await usePlayerStore.getState().ensureGuest(); await api.players.update({ display_name: displayName ?? player?.display_name ?? 'Cadet' }); await usePlayerStore.getState().refresh(); toast.push({ message: 'Display name saved.' }) } catch (error) { toast.push({ tone: 'danger', message: error.message }) } finally { setBusy(false) }
  }
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-5xl space-y-7 px-4 py-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">{player?.display_name ?? t("Your profile")}</h1><p className="mt-2 text-slate-600">{t("Level ")}{player?.level ?? 1} · {player?.xp ?? 0}{t(" XP · ")}{stars}/{LEVEL_ORDER.length * 3}{t(" stars")}</p><ProgressBar className="mt-3 w-64" value={player?.xp_into_level ?? 0} max={player?.xp_for_next ?? 100} label={t("XP toward next level")} /></div><Link className="text-brand-700 underline" to="/leaderboard">{t("View leaderboard")}</Link></div>
    {(!online || pendingOps.length > 0) && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">{online ? t('{count} changes waiting to sync.', { count: pendingOps.length }) : t("Offline. Campaign progress and settings are saved on this device.")}<Button className="ml-3" size="sm" variant="secondary" onClick={() => usePlayerStore.getState().ensureGuest().then(() => usePlayerStore.getState().refresh())}>{t("Retry sync")}</Button></div>}
    <section className="rounded-xl border border-line bg-white p-5"><h2 className="text-lg font-semibold">{t("Profile settings")}</h2><form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={rename}><TextInput label={t("Display name")} value={displayName ?? player?.display_name ?? 'Cadet'} onChange={e => setDisplayName(e.target.value)} minLength={2} maxLength={24} required /><Button type="submit" disabled={busy}>{t("Save name")}</Button></form><div className="mt-4"><Switch label={t("Audio effects")} checked={settings.audio} onChange={audio => usePlayerStore.getState().setSettings({ audio })} /></div></section>
    <section className="rounded-xl border border-line bg-white p-5"><h2 className="text-lg font-semibold">{t("Workbench cosmetics")}</h2>{[{ label: 'Breadboard skin', key: 'skin', choices: COSMETICS.skins }, { label: 'Wire palette', key: 'wirePalette', choices: COSMETICS.wirePalettes }].map(group => <fieldset key={group.key} className="mt-4"><legend className="mb-2 text-sm font-medium">{t(group.label)}</legend><div className="grid gap-3 sm:grid-cols-3">{group.choices.map(item => { const locked = (player?.level ?? 1) < item.unlockLevel; return <button key={item.id} disabled={locked} aria-pressed={settings[group.key] === item.id} onClick={() => usePlayerStore.getState().setSettings({ [group.key]: item.id })} className={`rounded-lg border p-3 text-left disabled:opacity-60 ${settings[group.key] === item.id ? 'border-brand-600 bg-brand-50' : 'border-line'}`}><span className="font-medium">{t(item.name)}</span><p className="my-2 text-xs text-slate-600">{t(item.description)}</p><Badge tone={locked ? 'neutral' : 'success'}>{locked ? t('Unlock at level {level}', { level: item.unlockLevel }) : settings[group.key] === item.id ? t("Selected") : t("Available")}</Badge></button> })}</div></fieldset>)}</section>
    <section className="rounded-xl border border-line bg-white p-5"><h2 className="text-lg font-semibold">{t("Campaign progress · ")}{completed.length}/{LEVEL_ORDER.length}</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{LEVEL_ORDER.map(id => <li key={id} className="flex items-center justify-between gap-3"><Link className="text-sm text-brand-700 underline" to={`/play/${id}`}>{t(getLevel(id).title)}</Link><Stars value={progress[id]?.stars ?? 0} size="sm" /></li>)}</ul></section>
    <section id="account" className="scroll-mt-4 rounded-xl border border-line bg-white p-5"><h2 className="text-lg font-semibold">{t("Account")}</h2>{authExpired && <p role="alert" className="mt-2 text-amber-700">{t("Your session expired. Log in again to sync this account.")}</p>}<p className="mt-2 text-sm text-slate-600">{player?.username ? t('Signed in as {name}.', { name: player.username }) : t("Claim your guest account to access saved projects and progress on another device.")}{t(" Logging into another account loads that account’s progress.")}</p><form onSubmit={authenticate} className="mt-4 max-w-sm space-y-4"><div className="flex gap-3"><Button variant={accountAction === 'claim' ? 'primary' : 'secondary'} disabled={!!player?.username} onClick={() => setAccountAction('claim')}>{t("Claim guest")}</Button><Button variant={accountAction === 'login' ? 'primary' : 'secondary'} onClick={() => setAccountAction('login')}>{t("Log in")}</Button></div><TextInput label={t("Username")} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" /><TextInput label={t("Password")} type="password" autoComplete={accountAction === 'claim' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={accountAction === 'claim' ? 8 : 1} maxLength={128} /><p className="text-xs text-slate-500">{t("Username: 3–24 letters, numbers or underscores. New passwords: at least 8 characters.")}</p>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<Button type="submit" disabled={busy || (accountAction === 'claim' && !!player?.username)}>{busy ? t("Please wait…") : accountAction === 'claim' ? t("Create account") : t("Log in")}</Button>{player?.username && <Button className="ml-3" variant="secondary" onClick={() => { usePlayerStore.getState().logout(); setAccountAction('login') }}>{t("Log out")}</Button>}</form></section>
  </main></div>
}

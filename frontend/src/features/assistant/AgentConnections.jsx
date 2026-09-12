import { useEffect, useRef, useState } from 'react'
import { api, mcpUrl } from '../../api/client.js'
import { useI18n } from '../../i18n/index.jsx'
import { usePlayerStore } from '../../store/playerStore.js'
import { Button } from '../../ui/index.js'

export function agentConfigs(url) {
  return {
    claude: JSON.stringify({ mcpServers: { voltquest: { type: 'http', url, headers: { Authorization: 'Bearer ${VOLTQUEST_MCP_TOKEN}' } } } }, null, 2),
    codex: `[mcp_servers.voltquest]\nurl = ${JSON.stringify(url)}\nbearer_token_env_var = "VOLTQUEST_MCP_TOKEN"\n`,
  }
}

export default function AgentConnections({ getContext }) {
  const { t } = useI18n()
  const playerId = usePlayerStore(s => s.player?.id)
  const [token, setToken] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const active = useRef(null)
  const revision = useRef(0)
  const configs = agentConfigs(mcpUrl())
  useEffect(() => {
    let live = true
    const version = revision.current
    setToken(''); setEnabled(false); setMessage(''); setError('')
    if (playerId) api.assistant.mcpAccess().then(result => { if (live && version === revision.current && !active.current) setEnabled(result.enabled) }).catch(() => {})
    return () => { live = false }
  }, [playerId])
  useEffect(() => {
    const unsubscribe = usePlayerStore.subscribe((state, previous) => {
      if ((previous.player?.id && state.player?.id !== previous.player.id) || (previous.token && !state.token)) {
        active.current = null; revision.current++
        setBusy(false); setToken(''); setEnabled(false); setMessage(''); setError('')
      }
    })
    return () => { active.current = null; unsubscribe() }
  }, [])

  async function perform(action) {
    if (active.current) return
    const operation = {}
    active.current = operation; revision.current++
    setBusy(true); setError(''); setMessage('')
    try {
      if (!usePlayerStore.getState().token) await usePlayerStore.getState().ensureGuest()
      if (active.current !== operation) return
      if (!usePlayerStore.getState().token) throw new Error('No session')
      const identity = usePlayerStore.getState().player?.id
      const result = await action()
      if (active.current !== operation || identity !== usePlayerStore.getState().player?.id) return
      revision.current++
      if (result?.token) { setToken(result.token); setEnabled(true); setMessage('Token created. It expires in 30 days; creating another replaces it.') }
      else if (result?.shared_at) setMessage('Current context shared. Share again after editing; snapshots expire after 24 hours.')
      else { setToken(''); setEnabled(false); setMessage('Agent access revoked.') }
    } catch { if (active.current === operation) setError('Could not update the agent connection. Check your connection and try again.') }
    finally { if (active.current === operation) { active.current = null; setBusy(false) } }
  }
  async function copy(value) {
    try { await navigator.clipboard.writeText(value); setMessage('Copied.'); setError('') }
    catch { setError('Clipboard is unavailable. Select and copy the text manually.') }
  }
  return <details className="min-w-0 border-t border-line pt-3">
    <summary className="cursor-pointer font-semibold text-brand-700">{t('Connect Claude Code / Codex')}</summary>
    <div className="mt-3 space-y-3 text-xs text-slate-600">
      <p>{t('Let your coding agent inspect shared context and create or edit private projects in your account. Open its saved results from My projects.')}</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => perform(api.assistant.mcpToken)}>{t(enabled ? 'Replace MCP token' : 'Create MCP token')}</Button>{enabled && <Button size="sm" variant="secondary" disabled={busy} onClick={() => perform(api.assistant.revokeMcp)}>{t('Revoke access')}</Button>}</div>
      {token && <div className="space-y-2"><label className="block">{t('MCP access token')}<input aria-label={t('MCP access token')} type="password" autoComplete="off" readOnly value={token} className="mt-1 w-full rounded border border-line-strong p-2 font-mono" onFocus={event => event.target.select()} /></label><button type="button" onClick={() => copy(token)} className="text-brand-700 underline">{t('Copy token')}</button></div>}
      <p>{t('Set VOLTQUEST_MCP_TOKEN in the environment that starts your coding agent. Keep the token private; it grants project access. It cannot log in to your account or use the paid AI assistant.')}</p>
      {enabled && <Button size="sm" variant="secondary" disabled={busy} onClick={() => perform(() => api.assistant.shareContext(getContext()))}>{t('Share current context')}</Button>}
      <p>{t('Shared context includes the current code, circuit, selected part, lesson and simulation output. Agent changes are saved to projects; they do not overwrite unsaved work in this tab.')}</p>
      {[['Claude Code · .mcp.json', configs.claude], ['Codex · ~/.codex/config.toml', configs.codex]].map(([label, config]) => <div key={label}><div className="mb-1 flex flex-wrap items-center justify-between gap-1"><h3 className="font-semibold">{label}</h3><button type="button" aria-label={`${t('Copy')} ${label}`} onClick={() => copy(config)} className="text-brand-700 underline">{t('Copy configuration')}</button></div><pre className="max-w-full overflow-x-auto rounded border border-line bg-surface-sunken p-2 text-[11px]"><code>{config}</code></pre></div>)}
      <p>{t('Restart your coding agent, check /mcp, then ask: “Read my VoltQuest context and create a project that helps me finish this circuit.”')}</p>
      <p>{t('MCP works independently of OpenRouter. Your coding agent uses its own model connection.')}</p>
      {message && <p role="status" className="text-brand-700">{t(message)}</p>}{error && <p role="alert" className="text-rose-700">{t(error)}</p>}
    </div>
  </details>
}

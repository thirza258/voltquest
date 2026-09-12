import { useI18n } from '../../i18n/index.jsx'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import { useAsyncResource } from '../../hooks/useAsyncResource.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { Button, useToast } from '../../ui/index.js'
import { seedFromProject } from '../sandbox/projectFile.js'
import WorkspacePage from '../workspace/WorkspacePage.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'

export default function ShowcaseProjectPage() {
  const { t } = useI18n()
  const { slug } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const fetcher = useCallback(async () => {
    const project = await api.showcase.get(slug)
    return { project, seed: seedFromProject(project) }
  }, [slug])
  const { data, loading, error, reload } = useAsyncResource(fetcher)
  async function fork() {
    setBusy(true)
    try { await usePlayerStore.getState().ensureGuest(); const project = await api.showcase.fork(slug); navigate(`/sandbox/${project.id}`, { state: { project } }) } catch (error) { toast.push({ tone: 'danger', message: error.message }) } finally { setBusy(false) }
  }
  if (loading || error) return <div><AppHeader /><main className="p-8">{loading ? <p role="status">{t("Opening shared circuit…")}</p> : <><p role="alert">{error.message}</p><Button onClick={reload}>{t("Try again")}</Button><Link className="ml-4 underline" to="/showcase">{t("Back to showcase")}</Link></>}</main></div>
  return <WorkspacePage mode="showcase" projectName={data.project.name} sessionId={slug} seed={data.seed} title={<div className="min-w-0"><p className="truncate text-sm font-semibold">{data.project.name}</p><p className="truncate text-xs text-slate-500">{t("By ")}{data.project.owner_name} · {data.project.views}{t(" views · ")}{data.project.forks}{t(" forks")}</p></div>} actions={<Button size="sm" onClick={fork} disabled={busy}>{busy ? t("Forking…") : t("Fork project")}</Button>} />
}

import { useI18n } from '../../i18n/index.jsx'
import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import { BOARD_IDS, getBoard } from '../../engine/boards/index.js'
import { useAsyncResource } from '../../hooks/useAsyncResource.js'
import { Badge, Button, Select, TextInput } from '../../ui/index.js'
import { AppHeader } from '../workspace/AppHeader.jsx'

export default function ShowcasePage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const board = params.get('board') ?? ''
  const sort = params.get('sort') === 'popular' ? 'popular' : 'recent'
  const offset = Math.max(0, Number(params.get('offset')) || 0)
  const [search, setSearch] = useState(q)
  const fetcher = useCallback(() => api.showcase.list({ q, board, sort, offset, limit: 24 }), [q, board, sort, offset])
  const { data, loading, error, reload } = useAsyncResource(fetcher)
  function filter(patch) { setParams({ q, board, sort, offset: '0', ...patch }) }
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
    <div><h1 className="text-2xl font-semibold">{t("Community showcase")}</h1><p className="mt-2 text-slate-600">{t("Run a shared circuit, explore its code, and fork it into your own workbench.")}</p></div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); filter({ q: search }) }}><TextInput className="min-w-48 flex-1" label={t("Search projects")} value={search} onChange={e => setSearch(e.target.value)} /><Button type="submit">{t("Search")}</Button><Select label={t("Board filter")} value={board} onChange={board => filter({ board })} options={[{ value: '', label: 'All boards' }, ...BOARD_IDS.map(value => ({ value, label: getBoard(value).name }))]} /><Select label={t("Sort projects")} value={sort} onChange={sort => filter({ sort })} options={[{ value: 'recent', label: 'Newest' }, { value: 'popular', label: 'Popular' }]} /></form>
    {loading ? <p role="status">{t("Loading shared circuits…")}</p> : error ? <div><p role="alert">{error.message}</p><Button className="mt-3" onClick={reload}>{t("Try again")}</Button></div> : !data?.items.length ? <div className="rounded-xl border border-line bg-white p-8"><h2 className="font-semibold">{t("No projects found")}</h2><p className="mt-2 text-slate-600">{t("Try another filter, or publish your own circuit from the sandbox.")}</p><Link className="mt-4 inline-block text-brand-700 underline" to="/sandbox">{t("Open sandbox")}</Link></div> : <>
      <p className="text-sm text-slate-500">{data.total}{t(" shared projects")}</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.items.map(project => <Link key={project.id} to={`/showcase/${project.share_slug}`} className="overflow-hidden rounded-xl border border-line bg-white transition-shadow hover:shadow-panel focus:outline-none focus:ring-2 focus:ring-brand-500">
        <div className="flex h-36 items-center justify-center bg-brand-50">{project.thumbnail?.startsWith('data:image/png;base64,') ? <img src={project.thumbnail} alt="" className="h-full w-full object-contain" /> : <span className="text-3xl font-bold text-brand-700">{project.board.toUpperCase()}</span>}</div><div className="space-y-2 p-4"><h2 className="font-semibold">{project.name}</h2><p className="line-clamp-2 text-sm text-slate-600">{project.description || t("An interactive circuit ready to explore.")}</p><Badge>{getBoard(project.board)?.name ?? project.board}</Badge><p className="text-xs text-slate-500">{t("By ")}{project.owner_name} · {project.views}{t(" views · ")}{project.forks}{t(" forks")}</p></div>
      </Link>)}</div><div className="flex items-center justify-between"><Button variant="secondary" disabled={!offset} onClick={() => filter({ offset: String(Math.max(0, offset - 24)) })}>{t("Previous")}</Button><span className="text-sm">{t("Page ")}{Math.floor(offset / 24) + 1}{t(" of ")}{Math.ceil(data.total / 24)}</span><Button variant="secondary" disabled={offset + 24 >= data.total} onClick={() => filter({ offset: String(offset + 24) })}>{t("Next")}</Button></div>
    </>}
  </main></div>
}

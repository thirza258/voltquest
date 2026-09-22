import { useI18n } from '../../i18n/index.jsx'
import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, MessageSquare, Plus } from 'lucide-react'
import { api } from '../../api/client.js'
import { BOARD_IDS, getBoard } from '../../engine/boards/index.js'
import { useAsyncResource } from '../../hooks/useAsyncResource.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { Badge, Button, Callout, Select, TextInput, useToast } from '../../ui/index.js'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { timeAgo } from './timeAgo.js'

const PAGE_SIZE = 20
/** Mirrors `app/domain/community.py`; the server rejects anything else. */
export const CATEGORY_LABELS = {
  help: 'Get help',
  builds: 'Show your build',
  hardware: 'Hardware and wiring',
  firmware: 'Code and firmware',
  courses: 'Courses and tutorials',
  ideas: 'Ideas and feedback',
}

/** The compose form. Kept separate so the list does not re-render on every keystroke. */
function NewThread({ defaultCategory, projectSlug, onPosted, onCancel }) {
  const { t } = useI18n()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState(defaultCategory || (projectSlug ? 'builds' : 'help'))
  const [board, setBoard] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await usePlayerStore.getState().ensureGuest()
      const thread = await api.community.create({ title, body, category, board: board || null, project_slug: projectSlug || null })
      onPosted(thread)
    } catch (error) {
      toast.push({ tone: 'danger', message: error.message })
    } finally {
      setBusy(false)
    }
  }

  return <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-white p-4">
    <h2 className="font-semibold">{t("Start a discussion")}</h2>
    {projectSlug && <p className="text-xs text-slate-500">{t("Linked to the showcase project ")}<code className="font-mono">{projectSlug}</code></p>}
    <TextInput label={t("Discussion title")} value={title} maxLength={120} required onChange={event => setTitle(event.target.value)} placeholder={t("What are you stuck on?")} />
    <div className="flex flex-wrap gap-3">
      <Select label={t("Discussion section")} value={category} onChange={setCategory} options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
      <Select label={t("Board (optional)")} value={board} onChange={setBoard} options={[{ value: '', label: 'No specific board' }, ...BOARD_IDS.map(value => ({ value, label: getBoard(value).name }))]} />
    </div>
    <label className="flex flex-col gap-1">
      <span className="text-xxs font-medium uppercase tracking-wide text-slate-500">{t("Your question or update")}</span>
      <textarea
        className="min-h-40 w-full rounded-md border border-line-strong bg-surface-panel p-2 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
        value={body} required maxLength={8000} onChange={event => setBody(event.target.value)}
        placeholder={t("Describe what you built, what you expected and what happened. Wrap code in triple backticks.")}
      />
    </label>
    <div className="flex items-center gap-2">
      <Button type="submit" disabled={busy}>{busy ? t("Posting…") : t("Post discussion")}</Button>
      <Button type="button" variant="secondary" onClick={onCancel}>{t("Cancel")}</Button>
      <span className="text-xxs text-slate-500">{body.length}{t(" / 8000 characters")}</span>
    </div>
  </form>
}

export default function CommunityPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const board = params.get('board') ?? ''
  const project = params.get('project') ?? ''
  const q = params.get('q') ?? ''
  const sort = ['active', 'recent', 'popular'].includes(params.get('sort')) ? params.get('sort') : 'active'
  const offset = Math.max(0, Number(params.get('offset')) || 0)
  const [search, setSearch] = useState(q)
  const [composing, setComposing] = useState(false)

  const fetcher = useCallback(
    () => api.community.list({ category, board, project, q, sort, offset, limit: PAGE_SIZE }),
    [category, board, project, q, sort, offset],
  )
  const { data, loading, error, reload } = useAsyncResource(fetcher)

  function filter(patch) {
    const next = { category, board, project, q, sort, offset: '0', ...patch }
    setParams(Object.fromEntries(Object.entries(next).filter(([, value]) => value !== '' && value != null)))
  }

  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{t("Community discussions")}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">{t("Ask about a circuit that will not behave, share a build, or compare notes on a course. Everyone can read; posting uses your VoltQuest player.")}</p>
      </div>
      {!composing && <Button icon={<Plus size={14} />} onClick={() => setComposing(true)}>{t("New discussion")}</Button>}
    </div>

    {composing && <NewThread
      defaultCategory={category}
      projectSlug={project}
      onCancel={() => setComposing(false)}
      onPosted={() => { setComposing(false); reload() }}
    />}

    {project && <Callout tone="info" title={t("Filtered to one project")} action={<Button size="sm" variant="secondary" onClick={() => filter({ project: '' })}>{t("Show all discussions")}</Button>}>
      {t("Showing discussions about the showcase project ")}<code className="font-mono">{project}</code>.
    </Callout>}

    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => filter({ category: '' })} aria-pressed={!category}
        className={`rounded-full border px-3 py-1 text-xs font-medium ${category ? 'border-line text-ink-secondary hover:bg-surface-sunken' : 'border-brand-600 bg-brand-50 text-brand-700'}`}>
        {t("All sections")}
      </button>
      {(data?.categories ?? []).map(item => <button key={item.id} type="button" onClick={() => filter({ category: item.id })} aria-pressed={category === item.id}
        className={`rounded-full border px-3 py-1 text-xs font-medium ${category === item.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line text-ink-secondary hover:bg-surface-sunken'}`}>
        {t(item.label)} <span className="tabular text-slate-500">{item.threads}</span>
      </button>)}
    </div>

    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); filter({ q: search }) }}>
      <TextInput className="min-w-48 flex-1" label={t("Search discussions")} value={search} onChange={event => setSearch(event.target.value)} />
      <Button type="submit">{t("Search")}</Button>
      <Select label={t("Board filter")} value={board} onChange={board => filter({ board })} options={[{ value: '', label: 'All boards' }, ...BOARD_IDS.map(value => ({ value, label: getBoard(value).name }))]} />
      <Select label={t("Sort discussions")} value={sort} onChange={sort => filter({ sort })} options={[{ value: 'active', label: 'Recently active' }, { value: 'recent', label: 'Newest' }, { value: 'popular', label: 'Most replies' }]} />
    </form>

    {loading ? <p role="status">{t("Loading discussions…")}</p>
      : error ? <div><p role="alert">{error.message}</p><Button className="mt-3" onClick={reload}>{t("Try again")}</Button></div>
      : !data?.items.length ? <div className="rounded-xl border border-line bg-white p-8">
          <h2 className="font-semibold">{t("No discussions yet")}</h2>
          <p className="mt-2 text-slate-600">{t("Nothing matches this filter. Start the first discussion, or widen the search.")}</p>
        </div>
      : <>
        <p className="text-sm text-slate-500">{data.total}{t(" discussions")}</p>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {data.items.map(thread => <li key={thread.id} className="p-4 hover:bg-surface-sunken">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{t(CATEGORY_LABELS[thread.category] ?? thread.category)}</Badge>
              {thread.board && <Badge tone="info">{getBoard(thread.board)?.name ?? thread.board}</Badge>}
              {thread.is_solved && <Badge tone="success"><CheckCircle2 size={11} className="mr-1 inline" />{t("Answered")}</Badge>}
            </div>
            <h2 className="mt-1.5 font-semibold"><Link className="hover:text-brand-700 hover:underline" to={`/community/${thread.id}`}>{thread.title}</Link></h2>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{thread.excerpt || t("This post was withdrawn by its author.")}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span>{t("By ")}{thread.author.display_name}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1"><MessageSquare size={12} />{thread.reply_count}{t(" replies")}</span>
              <span aria-hidden="true">·</span>
              <span>{thread.views}{t(" views")}</span>
              <span aria-hidden="true">·</span>
              <span>{t("active ")}{timeAgo(thread.last_activity_at, t)}</span>
            </p>
          </li>)}
        </ul>
        <div className="flex items-center justify-between">
          <Button variant="secondary" disabled={!offset} onClick={() => filter({ offset: String(Math.max(0, offset - PAGE_SIZE)) })}>{t("Previous")}</Button>
          <span className="text-sm">{t("Page ")}{Math.floor(offset / PAGE_SIZE) + 1}{t(" of ")}{Math.max(1, Math.ceil(data.total / PAGE_SIZE))}</span>
          <Button variant="secondary" disabled={offset + PAGE_SIZE >= data.total} onClick={() => filter({ offset: String(offset + PAGE_SIZE) })}>{t("Next")}</Button>
        </div>
      </>}
  </main></div>
}

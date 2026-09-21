import { useI18n } from '../../i18n/index.jsx'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { api } from '../../api/client.js'
import { getBoard } from '../../engine/boards/index.js'
import { useAsyncResource } from '../../hooks/useAsyncResource.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { Badge, Button, Callout, useToast } from '../../ui/index.js'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { CATEGORY_LABELS } from './CommunityPage.jsx'
import { PostBody } from './PostBody.jsx'
import { timeAgo } from './timeAgo.js'

/** A plain textarea with Post/Cancel, used for replies and for every edit. */
function Composer({ initial = '', label, submitLabel, busyLabel, onSubmit, onCancel }) {
  const { t } = useI18n()
  const toast = useToast()
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await usePlayerStore.getState().ensureGuest()
      await onSubmit(value)
      setValue('')
    } catch (error) {
      toast.push({ tone: 'danger', message: error.message })
    } finally {
      setBusy(false)
    }
  }
  return <form onSubmit={submit} className="space-y-2">
    <label className="flex flex-col gap-1">
      <span className="text-xxs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <textarea
        className="min-h-28 w-full rounded-md border border-line-strong bg-surface-panel p-2 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
        value={value} required maxLength={8000} onChange={event => setValue(event.target.value)}
        placeholder={t("Wrap code in triple backticks so it keeps its formatting.")}
      />
    </label>
    <div className="flex items-center gap-2">
      <Button type="submit" size="sm" disabled={busy}>{busy ? busyLabel : submitLabel}</Button>
      {onCancel && <Button type="button" size="sm" variant="secondary" onClick={onCancel}>{t("Cancel")}</Button>}
    </div>
  </form>
}

/** Author line shared by the opening post and every reply. */
function Byline({ author, at, edited }) {
  const { t } = useI18n()
  return <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
    <span className="font-medium text-ink-secondary">{author.display_name}</span>
    <Badge tone="volt">{t("Lv ")}{author.level}</Badge>
    <span aria-hidden="true">·</span>
    <span>{timeAgo(at, t)}</span>
    {edited && <span className="italic">{t("(edited)")}</span>}
  </p>
}

function Reply({ post, thread, isMine, canAccept, onChanged }) {
  const { t } = useI18n()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const run = async (action) => { try { await action() ; await onChanged() } catch (error) { toast.push({ tone: 'danger', message: error.message }) } }

  if (post.is_deleted) return <li className="rounded-xl border border-dashed border-line bg-white p-4 text-sm italic text-slate-500">{t("This reply was withdrawn by its author.")}</li>
  return <li className={`rounded-xl border bg-white p-4 ${post.is_answer ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-line'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Byline author={post.author} at={post.created_at} edited={post.edited_at} />
      {post.is_answer && <Badge tone="success"><CheckCircle2 size={11} className="mr-1 inline" />{t("Accepted answer")}</Badge>}
    </div>
    {editing
      ? <div className="mt-3"><Composer initial={post.body} label={t("Edit your reply")} submitLabel={t("Save reply")} busyLabel={t("Saving…")}
          onCancel={() => setEditing(false)}
          onSubmit={async value => { await api.community.updateReply(post.id, value); setEditing(false); await onChanged() }} /></div>
      : <PostBody className="mt-3" body={post.body} />}
    {!editing && (isMine || canAccept) && <div className="mt-3 flex flex-wrap gap-2">
      {canAccept && <Button size="sm" variant="secondary" icon={<CheckCircle2 size={13} />}
        onClick={() => run(() => api.community.markAnswer(thread.id, post.id, !post.is_answer))}>
        {post.is_answer ? t("Remove the answer mark") : t("Accept as answer")}
      </Button>}
      {isMine && <Button size="sm" variant="secondary" icon={<Pencil size={13} />} onClick={() => setEditing(true)}>{t("Edit")}</Button>}
      {isMine && <Button size="sm" variant="secondary" icon={<Trash2 size={13} />}
        onClick={() => { if (window.confirm(t("Withdraw this reply? Its text is removed but its place in the conversation stays."))) run(() => api.community.removeReply(post.id)) }}>
        {t("Withdraw")}
      </Button>}
    </div>}
  </li>
}

export default function ThreadPage() {
  const { t } = useI18n()
  const { threadId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const player = usePlayerStore(state => state.player)
  const [editing, setEditing] = useState(false)
  const fetcher = useCallback(() => api.community.get(threadId), [threadId])
  const { data: thread, loading, error, reload } = useAsyncResource(fetcher)

  if (loading || error) return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="p-8">
    {loading ? <p role="status">{t("Opening discussion…")}</p> : <>
      <p role="alert">{error.message}</p>
      <Button className="mt-3" onClick={reload}>{t("Try again")}</Button>
      <Link className="ml-4 underline" to="/community">{t("Back to discussions")}</Link>
    </>}
  </main></div>

  const isAuthor = !!player && player.id === thread.author.id
  const refresh = async () => reload()

  async function withdraw() {
    if (!window.confirm(t("Withdraw this discussion? Replies from other people stay readable."))) return
    try {
      await api.community.remove(thread.id)
      if (thread.reply_count > 0) await refresh()
      else navigate('/community')
    } catch (err) {
      toast.push({ tone: 'danger', message: err.message })
    }
  }

  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
    <Link className="text-sm text-brand-700 underline" to={`/community?category=${thread.category}`}>{t("← Back to ")}{t(CATEGORY_LABELS[thread.category] ?? thread.category)}</Link>

    <article className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t(CATEGORY_LABELS[thread.category] ?? thread.category)}</Badge>
        {thread.board && <Badge tone="info">{getBoard(thread.board)?.name ?? thread.board}</Badge>}
        {thread.is_solved && <Badge tone="success"><CheckCircle2 size={11} className="mr-1 inline" />{t("Answered")}</Badge>}
      </div>
      <h1 className="mt-2 text-xl font-semibold">{thread.title}</h1>
      <div className="mt-1"><Byline author={thread.author} at={thread.created_at} edited={thread.edited_at} /></div>
      {thread.project_slug && <p className="mt-3 text-sm"><Link className="text-brand-700 underline" to={`/showcase/${thread.project_slug}`}>{t("Open the showcase project this discussion is about")}</Link></p>}

      {thread.is_deleted
        ? <Callout className="mt-4" tone="neutral" title={t("Withdrawn")}>{t("The author removed this post. The replies below are kept because they are other people's work.")}</Callout>
        : editing
          ? <div className="mt-4"><Composer initial={thread.body} label={t("Edit your discussion")} submitLabel={t("Save discussion")} busyLabel={t("Saving…")}
              onCancel={() => setEditing(false)}
              onSubmit={async value => { await api.community.update(thread.id, { body: value }); setEditing(false); await refresh() }} /></div>
          : <PostBody className="mt-4" body={thread.body} />}

      {isAuthor && !thread.is_deleted && !editing && <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={<Pencil size={13} />} onClick={() => setEditing(true)}>{t("Edit")}</Button>
        <Button size="sm" variant="secondary" icon={<Trash2 size={13} />} onClick={withdraw}>{t("Withdraw")}</Button>
      </div>}
    </article>

    <h2 className="flex items-center gap-2 text-lg font-semibold"><MessageSquare size={16} />{thread.reply_count}{t(" replies")}</h2>
    {thread.posts.length > 0 && <ul className="space-y-3">
      {thread.posts.map(post => <Reply key={post.id} post={post} thread={thread} onChanged={refresh}
        isMine={!!player && player.id === post.author.id}
        canAccept={isAuthor && !post.is_deleted && !thread.is_deleted} />)}
    </ul>}

    {thread.is_deleted
      ? <p className="text-sm text-slate-500">{t("This discussion is closed to new replies.")}</p>
      : <div className="rounded-xl border border-line bg-white p-4">
          <Composer label={t("Your reply")} submitLabel={t("Post reply")} busyLabel={t("Posting…")}
            onSubmit={async value => { await api.community.reply(thread.id, value); await refresh() }} />
        </div>}
  </main></div>
}

/**
 * Renders a community post.
 *
 * Post bodies are other people's text, so nothing here ever becomes markup: no
 * `dangerouslySetInnerHTML`, no Markdown engine. Three affordances are recognised and rebuilt as
 * React elements — triple-backtick code fences, inline backticks and bare http(s) links — and
 * everything else is printed verbatim with its line breaks preserved.
 */
const FENCE = /```([a-zA-Z0-9+#-]*)\n?([\s\S]*?)```/g
const INLINE_CODE = /`([^`\n]+)`/g
const LINK = /\bhttps?:\/\/[^\s<>()[\]"']+/g

/** Only absolute http(s) URLs become links; anything else stays plain text. */
export function safeHref(raw) {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

/** Split plain prose into text, `inline code` and link nodes. */
function inlineNodes(text, keyPrefix) {
  const nodes = []
  let cursor = 0
  INLINE_CODE.lastIndex = 0
  for (const match of text.matchAll(INLINE_CODE)) {
    if (match.index > cursor) nodes.push(...linkNodes(text.slice(cursor, match.index), `${keyPrefix}-t${cursor}`))
    nodes.push(<code key={`${keyPrefix}-c${match.index}`} className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[0.9em]">{match[1]}</code>)
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) nodes.push(...linkNodes(text.slice(cursor), `${keyPrefix}-t${cursor}`))
  return nodes
}

/** Turn bare http(s) URLs into rel-protected links, leaving the rest as text. */
function linkNodes(text, keyPrefix) {
  const nodes = []
  let cursor = 0
  LINK.lastIndex = 0
  for (const match of text.matchAll(LINK)) {
    const href = safeHref(match[0])
    if (!href) continue
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index))
    nodes.push(<a key={`${keyPrefix}-l${match.index}`} href={href} target="_blank" rel="nofollow noopener noreferrer" className="break-all text-brand-700 underline">{match[0]}</a>)
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

/** The post body as alternating prose and fenced-code blocks. */
export function PostBody({ body = '', className = '' }) {
  const blocks = []
  let cursor = 0
  FENCE.lastIndex = 0
  for (const match of body.matchAll(FENCE)) {
    if (match.index > cursor) blocks.push({ kind: 'text', value: body.slice(cursor, match.index) })
    blocks.push({ kind: 'code', value: match[2].replace(/\n$/, ''), language: match[1] })
    cursor = match.index + match[0].length
  }
  if (cursor < body.length) blocks.push({ kind: 'text', value: body.slice(cursor) })

  return <div className={`space-y-3 text-sm leading-relaxed text-ink ${className}`}>
    {blocks.map((block, index) => block.kind === 'code'
      ? <pre key={index} className="overflow-x-auto rounded-lg border border-line bg-surface-sunken p-3 font-mono text-xs" data-language={block.language || undefined}><code>{block.value}</code></pre>
      : block.value.trim() ? <p key={index} className="whitespace-pre-wrap break-words">{inlineNodes(block.value.replace(/^\n+|\n+$/g, ''), `b${index}`)}</p> : null)}
  </div>
}

export default PostBody

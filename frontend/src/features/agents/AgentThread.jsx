import { Ban, Check, CheckCheck, CircleDashed, CirclePause, CircleX, Download, Hand, MessageCircleQuestion, Play, Plus, Sparkles, Square, StepForward, Wand2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { contextTokens, estimateTokens, initialState } from '../../engine/agents/model.js'

const clip = (text, size) => text.length > size ? `${text.slice(0, size - 1)}…` : text
const argsText = args => Object.entries(args ?? {}).map(([key, value]) => typeof value === 'string' ? `${key}: “${clip(value, 32)}”` : `${key}: ${clip(JSON.stringify(value), 32)}`).join(', ')
export function proposalText(proposal) {
  if (!proposal) return ''
  if (proposal.type === 'tool') return proposal.name === 'mcp' ? `mcp(${proposal.args?.request?.method ?? '?'})` : `${proposal.name}(${argsText(proposal.args)})`
  if (proposal.type === 'ask') return `ask(“${clip(proposal.text, 48)}”)`
  if (proposal.type === 'compact') return 'compact(summary)'
  if (proposal.type === 'finish') return 'finish(answer)'
  return proposal.type
}
/** Past-tense title for an executed tool, from its actual result. */
export function toolTitle(name, result) {
  if (name === 'read_file') return `Read ${result.path}`
  if (name === 'write_file') return `Wrote ${result.path} · ${result.bytes} bytes`
  if (name === 'search_docs') return `Searched the handbook · ${result.length} result${result.length === 1 ? '' : 's'}`
  if (name === 'list_issues') return `Listed issues · ${result.length}`
  if (name === 'create_issue') return result.replayed ? `Replayed issue #${result.id} (same idempotency key)` : `Created issue #${result.id}`
  if (name === 'lint_skill') return `Linted SKILL.md · ${result.valid ? 'valid' : `${result.findings.length} finding(s)`}`
  if (name === 'load_skill') return `Loaded skill ${result.name}`
  if (name === 'mcp') return result?.error ? `MCP error ${result.error.code}` : result?.notification ? 'MCP notification accepted' : 'MCP response'
  if (name === 'inspect_page') return `Inspected ${result.url}`
  return `${name} returned`
}

/** Status of each scripted turn, derived only from the trace the harness produced. */
export function planStates(run, config) {
  const turns = (run?.config ?? config)?.turns ?? [], maxTurns = (run?.config ?? config)?.maxTurns ?? turns.length
  return turns.map((turn, index) => {
    const events = run?.trace.filter(event => event.turn === index + 1) ?? []
    const kinds = new Set(events.map(event => event.type))
    let state = 'pending'
    if (kinds.has('tool_error')) state = 'error'
    else if (kinds.has('tool_denied')) state = 'denied'
    else if (['tool_result', 'compacted', 'final', 'user_answer'].some(kind => kinds.has(kind))) state = 'done'
    else if (run && run.cursor === index && run.status === 'approval') state = 'approval'
    else if (run && run.cursor === index && run.status === 'question') state = 'question'
    else if (index >= maxTurns) state = 'limit'
    else if (run && ['stopped', 'completed'].includes(run.status) && index >= run.cursor) state = 'not-run'
    return { turn, index, state }
  })
}
const PLAN_ICONS = { done: [CheckCheck, 'var(--wb-success)'], error: [CircleX, 'var(--wb-danger)'], denied: [Ban, 'var(--wb-warning)'], approval: [CirclePause, 'var(--wb-warning)'], question: [MessageCircleQuestion, 'var(--wb-warning)'], limit: [Ban, 'var(--wb-faint)'], 'not-run': [CircleDashed, 'var(--wb-faint)'], pending: [CircleDashed, 'var(--wb-muted)'] }
const PLAN_LABELS = { done: 'done', error: 'tool error', denied: 'denied', approval: 'waiting for approval', question: 'waiting for your answer', limit: 'beyond the turn limit', 'not-run': 'not run', pending: 'pending' }

export function PlanList({ run, config }) {
  const { t } = useI18n()
  const rows = planStates(run, config)
  if (!rows.length) return <p className="wb-note">{t('Finish valid harness JSON to see its scripted turns.')}</p>
  return <ol className="wb-plan">{rows.map(({ turn, index, state }) => {
    const [Icon, color] = PLAN_ICONS[state]
    return <li key={index}><Icon size={15} className="wb-plan-state" style={{ color }} aria-hidden="true" /><span className="min-w-0 flex-1"><span className="wb-mono text-xs">{index + 1}. {proposalText(turn)}</span><span className="block text-xs" style={{ color: 'var(--wb-muted)' }}>{t(PLAN_LABELS[state])}</span></span></li>
  })}</ol>
}

function Step({ event, ledger }) {
  const { t } = useI18n()
  const detail = event.detail
  let tone = 'muted', Icon = Sparkles, title = '', meta = ''
  if (event.type === 'model_proposal') {
    const row = ledger.find(item => item.turn === event.turn)
    title = `${t('Scripted proposal')} · ${proposalText(detail.proposal)}`
    meta = row ? `${row.input} ${t('in')} · ${row.output} ${t('out')} · $${row.costUsd.toFixed(6)}` : ''
  } else if (event.type === 'tool_result') { tone = 'ok'; Icon = Check; title = toolTitle(detail.name, detail.result) }
  else if (event.type === 'tool_error') { tone = 'error'; Icon = CircleX; title = `${t('Tool error')} · ${detail.name}: ${detail.error}` }
  else if (event.type === 'tool_denied') { tone = 'warn'; Icon = Ban; title = `${t('Denied')} · ${detail.name}` }
  else if (event.type === 'approval_requested') { tone = 'warn'; Icon = Hand; title = `${t('Review required')} · ${proposalText({ type: 'tool', ...detail })}` }
  else if (event.type === 'approved') { tone = 'ok'; Icon = Check; title = `${t('You approved')} · ${detail.name}` }
  else if (event.type === 'denied') { tone = 'warn'; Icon = Ban; title = `${t('You denied')} · ${detail.name}` }
  else if (event.type === 'compacted') { tone = 'ok'; Icon = Wand2; title = `${t('Context compacted')} · ${detail.before} → ${detail.after} ${t('tokens')}` }
  else if (event.type === 'stopped') { tone = 'error'; Icon = Square; title = `${t('Stopped')} · ${t(detail.reason)}` }
  else { title = event.type }
  return <details className={`wb-step is-${tone}`}>
    <summary><Icon size={15} className="wb-step-icon shrink-0" aria-hidden="true" /><span className="wb-step-title">{title}<span className="wb-step-meta block">{t('Turn')} {event.turn}{meta ? ` · ${meta}` : ''}</span></span></summary>
    <div className="wb-step-body"><pre className="wb-pre" tabIndex={0}>{JSON.stringify(detail, null, 2)}</pre></div>
  </details>
}

/**
 * The agent conversation: task, observed steps, approvals, questions and the scripted-run controls.
 * Everything shown comes from the harness state; there is no live model and nothing is invented.
 */
export default function AgentThread({ nb, title, showPlan = true, onOpenPlan }) {
  const { t } = useI18n()
  const { run, config, project } = nb
  const thread = useRef(null)
  // Follow the conversation like a chat: new steps, approvals and answers scroll into view.
  useEffect(() => { const node = thread.current; if (node) node.scrollTop = node.scrollHeight }, [run?.trace.length, run?.status])
  const source = run?.config ?? config
  const goal = source?.context?.find(item => item.id === 'goal')?.text
  let usage = null
  try { usage = run ? contextTokens(run) : config ? contextTokens(initialState(config, project.skill)) : null } catch { usage = null }
  const windowSize = source?.contextWindow ?? null, budget = source?.budgetUsd ?? null
  const status = run?.status ?? 'ready'
  const tone = { approval: 'is-warning', question: 'is-warning', stopped: 'is-danger', completed: 'is-success' }[status] ?? 'is-accent'
  const statusLabel = { ready: run ? 'Ready for the next turn' : 'Not started', approval: 'Waiting for approval', question: 'Waiting for your answer', completed: 'Completed', stopped: 'Stopped' }[status] ?? status
  return <section className="wb-agent h-full" aria-labelledby={`wb-thread-title-${title}`}>
    <header className="wb-agent-head">
      <h2 id={`wb-thread-title-${title}`}>{t(title)}</h2>
      <span className={`wb-chip ${tone}`}>{t(statusLabel)}</span>
      {run && <button type="button" className="wb-icon-button" aria-label={t('Export run trace')} title={t('Export run trace')} onClick={nb.exportTrace}><Download size={15} /></button>}
      <button type="button" className="wb-icon-button" aria-label={t('New run')} title={t('New run')} onClick={nb.newRun}><Plus size={15} /></button>
    </header>
    <div className="wb-thread" tabIndex={-1} ref={thread}>
      <div className="wb-thread-inner">
        <div className="wb-bubble is-user"><p className="wb-bubble-label">{t('Task')}</p><p>{goal ?? t('Finish valid harness JSON to see the task.')}</p>
          {source?.instructions && <details className="mt-2 text-xs"><summary className="cursor-pointer" style={{ color: 'var(--wb-muted)' }}>{t('Harness instructions')}</summary><p className="mt-1">{source.instructions}</p></details>}
        </div>
        {showPlan && <details className="wb-card" open={!run}>
          <summary className="flex cursor-pointer items-center gap-2"><h3 className="flex-1">{t('Plan')} · {t('{count} scripted turns', { count: source?.turns?.length ?? 0 })}</h3>{onOpenPlan && <button type="button" className="wb-icon-button" onClick={event => { event.preventDefault(); onOpenPlan() }}>{t('Open harness.json')}</button>}</summary>
          <div className="mt-2"><PlanList run={run} config={config} /></div>
          {!run && config && <div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" className="wb-button is-primary" onClick={() => nb.execute(true)}><Play size={13} />{t('Proceed')}</button><span className="wb-note">{t('Runs the scripted turns until a turn needs you.')}</span></div>}
        </details>}
        {!run && <p className="wb-note">{t('The model is a scripted fixture: its proposals are the turns in harness.json. Tools act on a fictional workspace and issue tracker. Edit the JSON, then run it and review every write.')}</p>}
        {run && <div className="flex flex-col gap-2" role="region" aria-label={t('Agent run results')}>
          {run.trace.map(event => event.type === 'question' ? <div key={event.index} className="wb-bubble"><p className="wb-bubble-label">{t('Agent question')} · {t('Turn')} {event.turn}</p><p>{event.detail.text}</p></div>
            : event.type === 'user_answer' ? <div key={event.index} className="wb-bubble is-user"><p className="wb-bubble-label">{t('Your answer')}</p><p>{event.detail.text}</p></div>
              : event.type === 'final' ? <div key={event.index} className="wb-bubble"><p className="wb-bubble-label">{t('Agent')} · {t('final answer')}</p><p>{event.detail.text}</p><p className="mt-2 text-xs" style={{ color: 'var(--wb-muted)' }}>{t(event.detail.source)}</p></div>
                : <Step key={event.index} event={event} ledger={run.ledger} />)}
          {run.stopReason && <p role="status" className="wb-banner">{t(run.stopReason)}</p>}
          {run.status === 'approval' && <div className="wb-card is-attention" role="region" aria-label={t('Pending tool approval')}>
            <h3>{t('Review this exact local write')}</h3>
            <p className="wb-note mt-1">{t('The call runs only after you approve it. Denying records the decision and continues with the next scripted turn.')}</p>
            <pre className="wb-pre my-3" tabIndex={0}>{JSON.stringify(run.pending, null, 2)}</pre>
            <div className="flex flex-wrap gap-2"><button type="button" className="wb-button is-primary" onClick={() => nb.decision({ approve: true })}><Check size={13} />{t('Approve this call')}</button><button type="button" className="wb-button" onClick={() => nb.decision({ approve: false })}><Ban size={13} />{t('Deny this call')}</button></div>
          </div>}
        </div>}
      </div>
    </div>
    <div className="wb-composer">
      {nb.error && <p role="alert" className="wb-banner is-danger mb-2 whitespace-pre-wrap break-words">{t(nb.error)}</p>}
      <p role="status" className="wb-note mb-2 empty:m-0">{nb.message ? t(nb.message) : null}</p>
      <div className="wb-composer-box">
        {run?.status === 'question' ? <form className="flex flex-col gap-2" onSubmit={event => { event.preventDefault(); nb.decision({ answer: nb.answer }) }}>
          <label className="wb-field">{t('Agent question')}<span style={{ color: 'var(--wb-text)', fontSize: 13 }}>{run.pending.text}</span>
            <input className="wb-input" aria-label={t('Your answer to the agent')} value={nb.answer} maxLength={2000} onChange={event => nb.setAnswer(event.target.value)} />
          </label>
          <div><button type="submit" className="wb-button is-primary" disabled={!nb.answer.trim()}>{t('Submit answer')}</button></div>
        </form> : <p className="wb-note">{t(run?.status === 'approval' ? 'Approve or deny the pending write above to continue.' : 'Scripted turns from harness.json. Writes pause for your approval.')}</p>}
        <div className="wb-composer-row justify-end">
          {nb.active && <button type="button" className="wb-button is-danger" onClick={nb.stopRun}><Square size={12} />{t('Stop run')}</button>}
          <button type="button" className="wb-button" onClick={() => nb.execute(false)} disabled={Boolean(nb.waiting || (run && !nb.active))}><StepForward size={13} />{t('Step one turn')}</button>
          <button type="button" className="wb-button is-primary" onClick={() => nb.execute(true)} disabled={Boolean(nb.waiting || (run && !nb.active))}><Play size={13} />{t('Run until pause')}</button>
        </div>
        {usage !== null && windowSize && <div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--wb-muted)' }} title={t('Estimated context tokens and hypothetical cost; rates are editable in Harness settings.')}>
          <div className="flex flex-wrap justify-between gap-x-3"><span>{t('Context')} {usage.toLocaleString()} / {windowSize.toLocaleString()}</span><span>${(run?.totalUsd ?? 0).toFixed(6)}{budget !== null ? ` / $${budget}` : ''} {t('hypothetical')}</span></div>
          <div className="wb-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, 100 * usage / windowSize)}%` }} /></div>
        </div>}
      </div>
    </div>
  </section>
}

export const contextRows = run => run?.context.map(item => ({ ...item, tokens: estimateTokens(item.text) })) ?? []

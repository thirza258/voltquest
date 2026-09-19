import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'

/** Navigation only: keep the curriculum, harness and native sources lazy. */
export default function AgentPromo() {
  const { t } = useI18n()
  return <section className="mb-7 rounded-lg border border-teal-200 bg-teal-50 p-5" aria-label={t('AI agent learning path')}><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('AI agent learning path')}</p><h2 className="mt-2 text-xl font-semibold">{t('Understand agents. Build your own.')}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{t('20 courses and guided tutorials about Codex, Claude Code, Google Antigravity, context, tokens, cost, skills, MCP and app integrations. Includes exams, a local sandbox and a JavaScript + Python CLI capstone.')}</p><div className="mt-4 flex flex-wrap gap-3">{[['/ai-agents', 'Explore AI agent courses'], ['/ai-agents?view=tutorials', 'Guided tutorials'], ['/sandbox?bench=ai-agents', 'Open AI agent sandbox']].map(([to, label]) => <Link key={to} to={to} className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500">{t(label)}</Link>)}</div></section>
}

import { CheckCircle2, Circle, XCircle } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'

const buttonClass = 'rounded-md bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1'
const secondaryClass = 'rounded-md border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500'

/** A readable line for one solution step: CLI lines per device, host settings, or desktop commands. */
function solutionLines(step) {
  if (step.cli) return step.cli
  if (step.desktop) return step.desktop.map(line => `C:\\> ${line}`)
  const host = step.host ?? {}
  return [host.ipMode === 'dhcp' ? 'IP Configuration: DHCP' : `IP Configuration: ${host.ip ?? ''} ${host.mask ?? ''}${host.gateway ? ` gateway ${host.gateway}` : ''}${host.dns ? ` DNS ${host.dns}` : ''}`]
}

/** Lab goals with a manual check, the score, a reset, and a reference solution behind a disclosure. */
export default function GoalsPanel({ goals, results, onCheck, onReset, solution }) {
  const { t } = useI18n()
  const passed = results ? results.results.filter(item => item.passed).length : null
  return <section aria-labelledby="network-goals-title" className="rounded-lg border border-line bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="network-goals-title" className="font-semibold text-ink">{t('Lab goals')}</h3>
      <p role="status" className="text-sm font-semibold text-brand-700">{passed === null ? t('Not checked yet') : t('{passed} of {total} goals met', { passed, total: goals.length })}</p>
    </div>
    <ul className="mt-3 space-y-2 text-sm">{goals.map((goal, index) => {
      const result = results?.results[index]
      const Icon = !result ? Circle : result.passed ? CheckCircle2 : XCircle
      return <li key={goal.label} className="flex gap-2">
        <Icon size={18} aria-hidden="true" className={`mt-0.5 shrink-0 ${!result ? 'text-slate-400' : result.passed ? 'text-emerald-600' : 'text-rose-600'}`} />
        <div className="min-w-0"><p className="font-medium text-ink">{goal.label}<span className="sr-only">{result ? (result.passed ? `: ${t('met')}` : `: ${t('not met')}`) : ''}</span></p>{result && <p className="text-xs text-slate-600">{result.detail}</p>}</div>
      </li>
    })}</ul>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" className={buttonClass} onClick={onCheck}>{t('Check results')}</button>
      <button type="button" className={secondaryClass} onClick={onReset}>{t('Reset lab')}</button>
    </div>
    <p className="mt-2 text-xs text-slate-600">{t('Checks run pings and web requests on a copy of the network, so your ARP and MAC tables stay as they are.')}</p>
    {solution?.length > 0 && <details className="mt-4 rounded-md border border-line p-3">
      <summary className="cursor-pointer text-sm font-semibold text-brand-700">{t('Show a reference solution')}</summary>
      <p className="mt-2 text-xs text-slate-600">{t('Other correct answers exist. Try the lab first; use this to compare.')}</p>
      <div className="mt-2 space-y-3">{solution.map((step, index) => <div key={index}><p className="text-xs font-semibold text-ink">{step.device}</p>
        <pre className="mt-1 overflow-x-auto rounded bg-slate-950 p-2 font-mono text-xs leading-5 text-slate-100">{solutionLines(step).join('\n')}</pre></div>)}</div>
    </details>}
  </section>
}

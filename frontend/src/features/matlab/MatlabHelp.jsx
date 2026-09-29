import reference from '@content/matlab-functions.json'
import { useI18n } from '../../i18n/index.jsx'

const LIMIT = 40
/** Joins a multi-line reference example into one Command Window entry. */
export function commandFromExample(example) {
  const lines = example.split('\n').map(line => line.trim()).filter(Boolean)
  // A comma keeps statement boundaries (and displays results) where a newline separated them.
  return lines.map((line, i) => i < lines.length - 1 && !/[;,]$/.test(line) ? `${line},` : line).join(' ')
}

/**
 * Help document for the MATLAB desktop: the same curated 244-entry reference as /matlab, filtered
 * by the toolstrip search. Browser examples can be sent to the Command Window; desktop entries
 * name their required products and link to MathWorks documentation.
 */
export default function MatlabHelp({ query, onQuery, onTry, busy }) {
  const { t } = useI18n()
  const needle = query.trim().toLowerCase()
  const matches = reference.functions.filter(item => !needle || [item.name, item.description, item.category, item.product].join(' ').toLowerCase().includes(needle))
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex flex-wrap items-end gap-3 border-b border-[var(--ml-soft-line)] p-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-[var(--ml-muted)]">{t('Search function reference')}
        <input type="search" className="h-7 rounded border border-[var(--ml-line)] px-2 text-sm text-ink" value={query} onChange={event => onQuery(event.target.value)} />
      </label>
      <p className="text-xs text-[var(--ml-muted)]" role="status">{t('{count} functions found', { count: matches.length })}{matches.length > LIMIT ? ` · ${t('showing the first {count}', { count: LIMIT })}` : ''}</p>
    </div>
    <ul className="min-h-0 flex-1 divide-y divide-[var(--ml-soft-line)] overflow-auto" aria-label={t('Function reference results')}>
      {matches.slice(0, LIMIT).map(item => <li key={item.name} className="space-y-1.5 p-3 text-sm">
        <p><span className="font-mono font-semibold text-[var(--ml-accent)]">{item.name}</span><span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${item.scope === 'browser' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{t(item.scope === 'browser' ? 'Runs in this sandbox' : 'Desktop MATLAB')}</span><span className="ml-2 text-xs text-[var(--ml-muted)]">{item.category}</span></p>
        <p className="font-mono text-xs">{item.signature}</p>
        <p className="text-ink-secondary">{item.description}</p>
        <p className="text-xs text-[var(--ml-muted)]">{item.product}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {item.scope === 'browser' && item.example && <button type="button" className="ml-address-button" disabled={busy} onClick={() => onTry(commandFromExample(item.example))}>{t('Try in Command Window')}</button>}
          <a className="font-medium text-[var(--ml-accent)] underline underline-offset-2" href={item.url} target="_blank" rel="noopener noreferrer">{t('Official documentation')}</a>
        </div>
      </li>)}
      {!matches.length && <li className="p-3 text-sm text-[var(--ml-muted)]">{t('No functions match. Try another name or clear the filters.')}</li>}
    </ul>
  </div>
}

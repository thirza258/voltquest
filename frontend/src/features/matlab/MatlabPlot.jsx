import { useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { formatNumber } from '../../engine/matlab/model.js'
import { fieldClass } from './styles.js'

const colors = ['#0f766e', '#b45309', '#7e22ce', '#0369a1', '#be123c', '#374151', '#4d7c0f', '#a21caf']
export default function MatlabPlot({ result }) {
  const { t } = useI18n()
  const [series, setSeries] = useState(0), [index, setIndex] = useState(0), [page, setPage] = useState(0)
  const plots = result.plots, selected = plots[series]
  const allX = plots.flatMap(p => p.x), allY = plots.flatMap(p => p.y)
  const scaleX = Math.max(1, ...allX.map(Math.abs)), scaleY = Math.max(1, ...allY.map(Math.abs))
  const minX = Math.min(...allX) / scaleX, maxX = Math.max(...allX) / scaleX
  const minY = Math.min(...allY) / scaleY, maxY = Math.max(...allY) / scaleY
  const x = v => 64 + (maxX === minX ? 0.5 : (v / scaleX - minX) / (maxX - minX)) * 620
  const y = v => 270 - (maxY === minY ? 0.5 : (v / scaleY - minY) / (maxY - minY)) * 225
  function choose(value) { setSeries(Number(value)); setIndex(0); setPage(0) }
  return <section className="min-w-0 space-y-3" aria-label={t('Script plot')}>
    <h3 className="font-semibold">{result.labels.title || t('Script plot')}</h3>
    <svg viewBox="0 0 740 330" role="img" aria-label={result.labels.title || t('Script plot')} className="w-full rounded border border-line bg-slate-50">
      <path d="M64 40V270H690" stroke="#64748b" fill="none" />
      {[0, 0.5, 1].map(fraction => <g key={fraction}><path d={`M64 ${270 - 225 * fraction}H690`} stroke="#e2e8f0" /><text x="59" y={274 - 225 * fraction} textAnchor="end" fontSize="10" fill="#475569">{formatNumber((minY + (maxY - minY) * fraction) * scaleY)}</text><text x={64 + 620 * fraction} y="287" textAnchor="middle" fontSize="10" fill="#475569">{formatNumber((minX + (maxX - minX) * fraction) * scaleX)}</text></g>)}
      {plots.map((plot, i) => <path key={i} d={plot.x.map((v, k) => `${k ? 'L' : 'M'}${x(v).toFixed(2)},${y(plot.y[k]).toFixed(2)}`).join(' ')} stroke={colors[i]} strokeWidth="2" fill="none" />)}
      <circle cx={x(selected.x[index])} cy={y(selected.y[index])} r="5" fill={colors[series]} stroke="white" />
      <text x="375" y="316" textAnchor="middle" fontSize="12" fill="#334155">{result.labels.xlabel || 'x'}</text>
      <text x="65" y="23" fontSize="12" fill="#334155">{result.labels.ylabel || 'y'}</text>
    </svg>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{t('Plot series')}<select className={`${fieldClass} mt-1`} value={series} onChange={event => choose(event.target.value)}>{plots.map((_plot, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label><label className="text-sm">{t('Inspect sample')} · {index + 1}<input className="mt-3 block w-full accent-teal-700" type="range" min={0} max={selected.x.length - 1} value={index} onChange={event => setIndex(Number(event.target.value))} /></label></div>
    <p className="break-words font-mono text-xs" aria-live="polite">x = {formatNumber(selected.x[index])}, y = {formatNumber(selected.y[index])}</p>
    <details><summary className="cursor-pointer text-sm font-medium text-brand-700">{t('Plot data table')}</summary><div className="mt-3 max-h-72 overflow-auto rounded border border-line" tabIndex={0} role="region" aria-label={t('Plot data table')}><table className="w-full text-left text-xs"><thead><tr>{['#', 'x', 'y'].map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead><tbody>{selected.x.slice(page * 100, (page + 1) * 100).map((value, i) => <tr key={i} className="border-t border-line"><td className="p-2">{page * 100 + i + 1}</td><td className="p-2 font-mono">{formatNumber(value)}</td><td className="p-2 font-mono">{formatNumber(selected.y[page * 100 + i])}</td></tr>)}</tbody></table></div><div className="mt-2 flex items-center gap-3 text-sm"><button className="rounded border p-2 disabled:opacity-40" disabled={!page} onClick={() => setPage(page - 1)}>{t('Previous')}</button><span>{page + 1} / {Math.ceil(selected.x.length / 100)}</span><button className="rounded border p-2 disabled:opacity-40" disabled={(page + 1) * 100 >= selected.x.length} onClick={() => setPage(page + 1)}>{t('Next')}</button></div></details>
  </section>
}

import { useId, useRef, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { formatNumber } from '../../engine/matlab/model.js'
import { useElementSize } from '../sandbox/ide/useElementWidth.js'

/** MATLAB's default line colour order (R2014b and later). */
export const MATLAB_COLORS = ['#0072BD', '#D95319', '#EDB120', '#7E2F8E', '#77AC30', '#4DBEEE', '#A2142F']
const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
/**
 * Axes box in real pixels for a figure of the given size: MATLAB's default normalized position
 * [0.13 0.11 0.775 0.815], widened only where tick, axis and title text would otherwise clip.
 */
export function axesBox(width, height, labels = {}) {
  return {
    left: Math.max(0.13 * width, labels.ylabel ? 54 : 42),
    right: width - Math.max(0.095 * width, 14),
    top: Math.max(0.075 * height, labels.title ? 28 : 12),
    bottom: height - Math.max(0.11 * height, labels.xlabel ? 42 : 26),
  }
}

/** Tick positions and limits that enclose [min, max] with 1/2/2.5/5 × 10^k steps. */
export function niceScale(min, max, target = 6) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 1, ticks: [0, 0.5, 1] }
  if (min === max) { const pad = min === 0 ? 1 : Math.abs(min) * 0.1; min -= pad; max += pad }
  const raw = (max - min) / target, magnitude = 10 ** Math.floor(Math.log10(raw)), normalized = raw / magnitude
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude
  const lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step
  const ticks = []
  for (let k = 0; k <= Math.round((hi - lo) / step) && k < 40; k++) ticks.push(Number((lo + k * step).toPrecision(12)))
  return { lo, hi, ticks }
}

/**
 * The single figure a browser run can produce: series from plot(), labels from title/xlabel/ylabel.
 * Click the axes (or use the sample controls) to place a data tip on an actual sample.
 */
export default function MatlabFigure({ result }) {
  const { t } = useI18n(), clip = `ml-axes-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  const canvas = useRef(null), size = useElementSize(canvas, { width: 560, height: 420 })
  const W = clamp(size.width, 240, 1600), H = clamp(size.height, 170, 1200), AX = axesBox(W, H, result.labels)
  const [series, setSeries] = useState(0), [index, setIndex] = useState(0), [page, setPage] = useState(0), [table, setTable] = useState(false)
  const plots = result.plots
  const safeSeries = Math.min(series, plots.length - 1), selected = plots[safeSeries], safeIndex = Math.min(index, selected.x.length - 1)
  const xs = plots.flatMap(plot => plot.x), ys = plots.flatMap(plot => plot.y)
  const sx = niceScale(Math.min(...xs), Math.max(...xs), clamp(Math.round((AX.right - AX.left) / 70), 3, 8))
  const sy = niceScale(Math.min(...ys), Math.max(...ys), clamp(Math.round((AX.bottom - AX.top) / 45), 3, 8))
  const px = value => AX.left + (value - sx.lo) / (sx.hi - sx.lo) * (AX.right - AX.left)
  const py = value => AX.bottom - (value - sy.lo) / (sy.hi - sy.lo) * (AX.bottom - AX.top)
  const tipX = px(selected.x[safeIndex]), tipY = py(selected.y[safeIndex])
  const tipText = [`X ${formatNumber(selected.x[safeIndex])}`, `Y ${formatNumber(selected.y[safeIndex])}`]
  const tipWidth = 16 + 7 * Math.max(...tipText.map(text => text.length))
  const tipLeft = tipX + 10 + tipWidth > AX.right ? tipX - 10 - tipWidth : tipX + 10, tipTop = Math.max(AX.top + 2, tipY - 40)
  function choose(value) { setSeries(Number(value)); setIndex(0); setPage(0) }
  function pick(event) {
    const svg = event.currentTarget, matrix = svg.getScreenCTM?.()
    if (!matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    let best = null
    plots.forEach((plot, s) => plot.x.forEach((x, i) => {
      const distance = Math.hypot(px(x) - point.x, py(plot.y[i]) - point.y)
      if (!best || distance < best.distance) best = { distance, s, i }
    }))
    if (best && best.distance < 40) { setSeries(best.s); setIndex(best.i); setPage(Math.floor(best.i / 100)) }
  }
  const title = result.labels.title
  return <div className="ml-figure">
    <div ref={canvas} className="ml-figure-canvas"><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={title || t('Script plot')} onClick={pick}>
      <rect x={AX.left} y={AX.top} width={AX.right - AX.left} height={AX.bottom - AX.top} fill="#ffffff" />
      <clipPath id={clip}><rect x={AX.left} y={AX.top} width={AX.right - AX.left} height={AX.bottom - AX.top} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        {plots.map((plot, i) => <path key={i} d={plot.x.map((x, k) => `${k ? 'L' : 'M'}${px(x).toFixed(2)},${py(plot.y[k]).toFixed(2)}`).join(' ')} stroke={MATLAB_COLORS[i % MATLAB_COLORS.length]} strokeWidth="1.25" fill="none" strokeLinejoin="round" />)}
      </g>
      <g stroke="#262626" strokeWidth="0.75" fill="none">
        <rect x={AX.left} y={AX.top} width={AX.right - AX.left} height={AX.bottom - AX.top} />
        {sx.ticks.map(tick => <path key={`x${tick}`} d={`M${px(tick)} ${AX.bottom}v-5M${px(tick)} ${AX.top}v5`} />)}
        {sy.ticks.map(tick => <path key={`y${tick}`} d={`M${AX.left} ${py(tick)}h5M${AX.right} ${py(tick)}h-5`} />)}
      </g>
      <g fill="#262626" fontSize="10" fontFamily="Helvetica, Arial, sans-serif">
        {sx.ticks.map(tick => <text key={`xl${tick}`} x={px(tick)} y={AX.bottom + 14} textAnchor="middle">{formatNumber(tick)}</text>)}
        {sy.ticks.map(tick => <text key={`yl${tick}`} x={AX.left - 5} y={py(tick) + 3.5} textAnchor="end">{formatNumber(tick)}</text>)}
      </g>
      {title && <text x={(AX.left + AX.right) / 2} y={AX.top - 10} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#000000" fontFamily="Helvetica, Arial, sans-serif">{title}</text>}
      {result.labels.xlabel && <text x={(AX.left + AX.right) / 2} y={AX.bottom + 33} textAnchor="middle" fontSize="11" fill="#262626" fontFamily="Helvetica, Arial, sans-serif">{result.labels.xlabel}</text>}
      {result.labels.ylabel && <text transform={`translate(${AX.left - 40} ${(AX.top + AX.bottom) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#262626" fontFamily="Helvetica, Arial, sans-serif">{result.labels.ylabel}</text>}
      <g className="ml-datatip" pointerEvents="none">
        <rect x={tipX - 3} y={tipY - 3} width="6" height="6" fill={MATLAB_COLORS[safeSeries % MATLAB_COLORS.length]} stroke="#000000" strokeWidth="0.75" />
        <rect x={tipLeft} y={tipTop} width={tipWidth} height="34" rx="2" fill="#ffffff" stroke="#404040" strokeWidth="0.75" />
        {tipText.map((text, i) => <text key={text} x={tipLeft + 7} y={tipTop + 14 + i * 13} fontSize="10.5" fill="#000000">{text}</text>)}
      </g>
    </svg></div>
    <div className="ml-figure-controls">
      <label>{t('Plot series')}<select value={safeSeries} onChange={event => choose(event.target.value)}>{plots.map((_plot, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label>
      <label>{t('Inspect sample')} · {safeIndex + 1}/{selected.x.length}<input type="range" min={0} max={selected.x.length - 1} value={safeIndex} onChange={event => setIndex(Number(event.target.value))} /></label>
      <p className="font-mono text-xs text-ink" aria-live="polite">x = {formatNumber(selected.x[safeIndex])}, y = {formatNumber(selected.y[safeIndex])}</p>
      <button type="button" className="ml-address-button justify-self-start" aria-expanded={table} onClick={() => setTable(value => !value)}>{t('Plot data table')}</button>
    </div>
    {table && <div className="max-h-56 overflow-auto rounded border border-[var(--ml-line)] bg-white" tabIndex={0} role="region" aria-label={t('Plot data table')}>
      <table className="ml-table"><thead><tr>{['#', 'x', 'y'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{selected.x.slice(page * 100, (page + 1) * 100).map((value, i) => <tr key={i} aria-selected={page * 100 + i === safeIndex || undefined}><td>{page * 100 + i + 1}</td><td className="ml-mono">{formatNumber(value)}</td><td className="ml-mono">{formatNumber(selected.y[page * 100 + i])}</td></tr>)}</tbody></table>
      <div className="flex items-center gap-3 p-2 text-xs"><button type="button" className="ml-address-button" disabled={!page} onClick={() => setPage(page - 1)}>{t('Previous')}</button><span>{page + 1} / {Math.ceil(selected.x.length / 100)}</span><button type="button" className="ml-address-button" disabled={(page + 1) * 100 >= selected.x.length} onClick={() => setPage(page + 1)}>{t('Next')}</button></div>
    </div>}
  </div>
}

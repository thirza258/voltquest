import { useState, useMemo } from 'react'
import { X, Table as TableIcon } from 'lucide-react'

export default function ExcelPivotModal({ isOpen, onClose, sheet, defaultRangeStr = 'A1:H7' }) {
  const [rangeStr, setRangeStr] = useState(defaultRangeStr)
  const [rowColIndex, setRowColIndex] = useState(0)
  const [valColIndex, setValColIndex] = useState(1)
  const [aggFn, setAggFn] = useState('SUM')

  // Extract headers from first row of range
  const headers = useMemo(() => {
    if (!sheet) return []
    const matrix = sheet.getRangeMatrix(rangeStr)
    if (matrix.length === 0) return []
    return matrix[0].map((h, i) => (h ? String(h) : `Column ${i + 1}`))
  }, [sheet, rangeStr])

  // Compute pivot summary
  const pivotData = useMemo(() => {
    if (!sheet || headers.length === 0) return null
    try {
      return sheet.computePivotTable({
        rangeStr,
        rowFieldCol: rowColIndex,
        valFieldCol: valColIndex,
        aggFunction: aggFn,
      })
    } catch {
      return null
    }
  }, [sheet, rangeStr, rowColIndex, valColIndex, aggFn, headers])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">Pivot Table Builder & Summarizer</h2>
              <p className="text-xs text-slate-400">Multidimensional grouping and aggregated metrics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="grid grid-cols-4 gap-3 border-b border-slate-800 bg-slate-950/70 p-4 text-xs">
          <div>
            <label className="mb-1 block font-medium text-slate-400">Source Range</label>
            <input
              type="text"
              value={rangeStr}
              onChange={(e) => setRangeStr(e.target.value.toUpperCase())}
              className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-emerald-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-400">Row Grouping</label>
            <select
              value={rowColIndex}
              onChange={(e) => setRowColIndex(Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-400">Value Field</label>
            <select
              value={valColIndex}
              onChange={(e) => setValColIndex(Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-400">Aggregation</label>
            <select
              value={aggFn}
              onChange={(e) => setAggFn(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="SUM">SUM</option>
              <option value="AVERAGE">AVERAGE</option>
              <option value="COUNT">COUNT</option>
              <option value="MIN">MIN</option>
              <option value="MAX">MAX</option>
            </select>
          </div>
        </div>

        {/* Pivot Table Result View */}
        <div className="max-h-80 overflow-y-auto p-6">
          {!pivotData || pivotData.rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Select a valid range and numeric value column to generate a Pivot Table summary.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950 font-semibold text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5">{pivotData.rowHeader}</th>
                    <th className="px-4 py-2.5 text-right">{pivotData.valHeader}</th>
                    <th className="px-4 py-2.5 text-right">% of Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-mono">
                  {pivotData.rows.map((row) => {
                    const pct =
                      pivotData.grandTotal > 0 && typeof row.value === 'number'
                        ? ((row.value / pivotData.grandTotal) * 100).toFixed(1) + '%'
                        : '-'
                    return (
                      <tr key={row.rowKey} className="hover:bg-slate-800/40">
                        <td className="px-4 py-2 font-sans font-medium text-slate-200">{row.rowKey}</td>
                        <td className="px-4 py-2 text-right text-emerald-400 font-semibold">
                          {typeof row.value === 'number' ? row.value.toLocaleString() : row.value}
                        </td>
                        <td className="px-4 py-2 text-right text-sky-400">{pct}</td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-slate-700 bg-slate-950 font-bold">
                    <td className="px-4 py-2.5 font-sans text-slate-100">Grand Total</td>
                    <td className="px-4 py-2.5 text-right text-emerald-300">
                      {pivotData.grandTotal.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sky-300">100.0%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/80 px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Apply to Worksheet
          </button>
        </div>
      </div>
    </div>
  )
}

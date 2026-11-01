import { useState, useMemo } from 'react'
import { X, BarChart2, LineChart as LineIcon, PieChart as PieIcon } from 'lucide-react'

export default function ExcelChartModal({ isOpen, onClose, sheet, defaultRangeStr = 'A1:H7' }) {
  const [chartType, setChartType] = useState('column') // 'column', 'line', 'pie', 'bar'
  const rangeStr = defaultRangeStr
  const [labelColIndex, setLabelColIndex] = useState(0)
  const [valColIndex, setValColIndex] = useState(1)

  // Extract headers
  const headers = useMemo(() => {
    if (!sheet) return []
    const matrix = sheet.getRangeMatrix(rangeStr)
    if (matrix.length === 0) return []
    return matrix[0].map((h, i) => (h ? String(h) : `Col ${i + 1}`))
  }, [sheet, rangeStr])

  // Extract data series
  const series = useMemo(() => {
    if (!sheet) return []
    const matrix = sheet.getRangeMatrix(rangeStr)
    if (matrix.length < 2) return []

    // Skip header row
    const dataRows = matrix.slice(1)
    const points = []

    for (const row of dataRows) {
      const label = row[labelColIndex] !== null && row[labelColIndex] !== undefined ? String(row[labelColIndex]) : ''
      const rawVal = row[valColIndex]
      const val = Number(rawVal)
      if (label && !isNaN(val)) {
        points.push({ label, value: val })
      }
    }
    return points
  }, [sheet, rangeStr, labelColIndex, valColIndex])

  if (!isOpen) return null

  const maxVal = series.length > 0 ? Math.max(...series.map((p) => p.value), 1) : 1
  const totalVal = series.reduce((acc, p) => acc + p.value, 0)

  const colors = [
    '#10b981', // emerald
    '#38bdf8', // sky
    '#f59e0b', // amber
    '#a855f7', // purple
    '#ec4899', // pink
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#f97316', // orange
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-3xl flex-col rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">Excel Chart Visualizer</h2>
              <p className="text-xs text-slate-400">Dynamic SVG charts rendered from worksheet cells</p>
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

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/70 p-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-400">Chart Type:</span>
            <button
              onClick={() => setChartType('column')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                chartType === 'column' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <BarChart2 className="h-4 w-4" />
              Column
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                chartType === 'line' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <LineIcon className="h-4 w-4" />
              Line
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                chartType === 'pie' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <PieIcon className="h-4 w-4" />
              Pie
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div>
              <label className="mr-2 text-slate-400">Categories (X):</label>
              <select
                value={labelColIndex}
                onChange={(e) => setLabelColIndex(Number(e.target.value))}
                className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-200"
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mr-2 text-slate-400">Values (Y):</label>
              <select
                value={valColIndex}
                onChange={(e) => setValColIndex(Number(e.target.value))}
                className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-200"
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Chart Canvas Area */}
        <div className="flex min-h-[340px] items-center justify-center p-6">
          {series.length === 0 ? (
            <div className="text-center text-sm text-slate-400">
              No numeric data points found. Select valid category and value columns from the source range.
            </div>
          ) : (
            <div className="w-full">
              {/* Column Chart */}
              {chartType === 'column' && (
                <div className="relative h-64 w-full">
                  <svg className="h-full w-full" viewBox="0 0 600 240">
                    {/* Gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                      <g key={i}>
                        <line
                          x1="50"
                          y1={200 - pct * 170}
                          x2="580"
                          y2={200 - pct * 170}
                          stroke="#334155"
                          strokeDasharray="3 3"
                        />
                        <text x="45" y={204 - pct * 170} fill="#94a3b8" fontSize="10" textAnchor="end">
                          {Math.round(pct * maxVal).toLocaleString()}
                        </text>
                      </g>
                    ))}

                    {/* Bars */}
                    {series.map((p, i) => {
                      const barWidth = Math.min(40, (500 / series.length) * 0.7)
                      const gap = (500 - series.length * barWidth) / (series.length + 1)
                      const x = 60 + gap + i * (barWidth + gap)
                      const barHeight = (p.value / maxVal) * 170
                      const y = 200 - barHeight
                      const color = colors[i % colors.length]

                      return (
                        <g key={i}>
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={color}
                            rx="4"
                            className="transition-all hover:opacity-80"
                          />
                          <text
                            x={x + barWidth / 2}
                            y={y - 6}
                            fill="#f8fafc"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {p.value.toLocaleString()}
                          </text>
                          <text
                            x={x + barWidth / 2}
                            y="218"
                            fill="#cbd5e1"
                            fontSize="10"
                            textAnchor="middle"
                          >
                            {p.label.length > 9 ? p.label.slice(0, 9) + '…' : p.label}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
              )}

              {/* Line Chart */}
              {chartType === 'line' && (
                <div className="relative h-64 w-full">
                  <svg className="h-full w-full" viewBox="0 0 600 240">
                    {/* Gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                      <g key={i}>
                        <line
                          x1="50"
                          y1={200 - pct * 170}
                          x2="580"
                          y2={200 - pct * 170}
                          stroke="#334155"
                          strokeDasharray="3 3"
                        />
                        <text x="45" y={204 - pct * 170} fill="#94a3b8" fontSize="10" textAnchor="end">
                          {Math.round(pct * maxVal).toLocaleString()}
                        </text>
                      </g>
                    ))}

                    {/* Polyline */}
                    {(() => {
                      const points = series.map((p, i) => {
                        const step = series.length > 1 ? 500 / (series.length - 1) : 250
                        const x = 70 + i * step
                        const y = 200 - (p.value / maxVal) * 170
                        return `${x},${y}`
                      })

                      return (
                        <>
                          <polyline
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3"
                            points={points.join(' ')}
                          />
                          {series.map((p, i) => {
                            const step = series.length > 1 ? 500 / (series.length - 1) : 250
                            const x = 70 + i * step
                            const y = 200 - (p.value / maxVal) * 170
                            return (
                              <g key={i}>
                                <circle cx={x} cy={y} r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
                                <text x={x} y={y - 8} fill="#f8fafc" fontSize="10" textAnchor="middle" fontWeight="bold">
                                  {p.value.toLocaleString()}
                                </text>
                                <text x={x} y="218" fill="#cbd5e1" fontSize="10" textAnchor="middle">
                                  {p.label.length > 9 ? p.label.slice(0, 9) + '…' : p.label}
                                </text>
                              </g>
                            )
                          })}
                        </>
                      )
                    })()}
                  </svg>
                </div>
              )}

              {/* Pie Chart */}
              {chartType === 'pie' && (
                <div className="flex items-center justify-center gap-8">
                  <svg className="h-56 w-56" viewBox="0 0 100 100">
                    {(() => {
                      let accumulatedAngle = 0
                      return series.map((p, i) => {
                        const sliceAngle = totalVal > 0 ? (p.value / totalVal) * 2 * Math.PI : 0
                        const startAngle = accumulatedAngle
                        accumulatedAngle += sliceAngle
                        const endAngle = accumulatedAngle

                        const x1 = 50 + 40 * Math.sin(startAngle)
                        const y1 = 50 - 40 * Math.cos(startAngle)
                        const x2 = 50 + 40 * Math.sin(endAngle)
                        const y2 = 50 - 40 * Math.cos(endAngle)
                        const largeArc = sliceAngle > Math.PI ? 1 : 0

                        const pathData =
                          series.length === 1
                            ? 'M 50 10 A 40 40 0 1 1 49.99 10 Z'
                            : `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`

                        return (
                          <path
                            key={i}
                            d={pathData}
                            fill={colors[i % colors.length]}
                            className="transition-all hover:opacity-80"
                          />
                        )
                      })
                    })()}
                  </svg>

                  {/* Legend */}
                  <div className="max-h-56 overflow-y-auto space-y-1.5 text-xs">
                    {series.map((p, i) => {
                      const pct = totalVal > 0 ? ((p.value / totalVal) * 100).toFixed(1) + '%' : '0%'
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: colors[i % colors.length] }}
                          />
                          <span className="font-medium text-slate-200">{p.label}:</span>
                          <span className="font-mono text-emerald-400 font-semibold">{p.value.toLocaleString()}</span>
                          <span className="text-slate-400">({pct})</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/80 px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            Close Chart
          </button>
        </div>
      </div>
    </div>
  )
}

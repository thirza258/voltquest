import { X, Activity } from 'lucide-react'

export default function ExcelStatsModal({ isOpen, onClose, stats, rangeStr }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-xl flex-col rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">Descriptive Statistics Profile</h2>
              <p className="text-xs text-slate-400">Target Range: <span className="font-mono text-emerald-400 font-semibold">{rangeStr || 'Selected Range'}</span></p>
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

        {/* Content */}
        <div className="p-6">
          {!stats ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No numerical data found in range {rangeStr}. Select a range containing numbers.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400">Observations (Count)</span>
                <p className="font-mono text-lg font-bold text-slate-100">{stats.count}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400">Sum Total</span>
                <p className="font-mono text-lg font-bold text-emerald-400">{stats.sum.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400">Arithmetic Mean (Average)</span>
                <p className="font-mono text-base font-bold text-sky-400">{stats.mean}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400">Median (50th Percentile)</span>
                <p className="font-mono text-base font-bold text-sky-400">{stats.median}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400">Mode</span>
                <p className="font-mono text-base font-bold text-slate-200">{stats.mode}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400">Sample Std Deviation</span>
                <p className="font-mono text-base font-bold text-amber-400">{stats.stdev}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400">Sample Variance</span>
                <p className="font-mono text-base font-bold text-amber-400">{stats.variance}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400">Range (Max - Min)</span>
                <p className="font-mono text-base font-bold text-slate-200">{stats.range}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400">Minimum Value</span>
                <p className="font-mono text-base font-bold text-rose-400">{stats.min}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400">Maximum Value</span>
                <p className="font-mono text-base font-bold text-emerald-400">{stats.max}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400">First Quartile Q1 (25%)</span>
                <p className="font-mono text-base font-bold text-indigo-400">{stats.q1}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400">Third Quartile Q3 (75%)</span>
                <p className="font-mono text-base font-bold text-indigo-400">{stats.q3}</p>
              </div>
              <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Interquartile Range (IQR = Q3 - Q1)</span>
                  <span className="font-mono text-sm font-bold text-indigo-300">{stats.iqr}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Tukey Outlier Fences: Lower &lt; {(stats.q1 - 1.5 * stats.iqr).toFixed(2)}, Upper &gt; {(stats.q3 + 1.5 * stats.iqr).toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/80 px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

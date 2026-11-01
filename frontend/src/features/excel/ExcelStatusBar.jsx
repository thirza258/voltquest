export default function ExcelStatusBar({
  activeCellCoord,
  isEditing,
  selectionMetrics,
}) {
  return (
    <div className="flex items-center justify-between border-t border-slate-700 bg-slate-950 px-4 py-1 text-[11px] text-slate-400">
      <div className="flex items-center gap-3">
        <span className={`font-semibold ${isEditing ? 'text-amber-400' : 'text-emerald-400'}`}>
          {isEditing ? 'Edit' : 'Ready'}
        </span>
        <span className="text-slate-600">|</span>
        <span className="font-mono text-slate-300">Cell: {activeCellCoord}</span>
      </div>

      <div className="flex items-center gap-4 font-mono">
        {selectionMetrics && selectionMetrics.count > 0 && (
          <>
            {selectionMetrics.avg !== null && (
              <span>
                Average: <strong className="text-slate-200">{selectionMetrics.avg}</strong>
              </span>
            )}
            <span>
              Count: <strong className="text-slate-200">{selectionMetrics.count}</strong>
            </span>
            {selectionMetrics.sum !== null && (
              <span>
                Sum: <strong className="text-emerald-400">{selectionMetrics.sum.toLocaleString()}</strong>
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

import { Check, X } from 'lucide-react'

export default function ExcelFormulaBar({
  activeCellCoord,
  formulaValue,
  onFormulaChange,
  onFormulaCommit,
  onFormulaCancel,
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onFormulaCommit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onFormulaCancel()
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200">
      {/* Name Box */}
      <div className="flex h-7 w-20 items-center justify-center rounded border border-slate-700 bg-slate-900 font-mono text-xs font-bold text-emerald-400">
        {activeCellCoord || 'A1'}
      </div>

      {/* Action buttons (Commit / Cancel) */}
      <div className="flex items-center gap-1">
        <button
          onClick={onFormulaCancel}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-400"
          title="Cancel (Esc)"
          aria-label="Cancel formula"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onFormulaCommit}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-emerald-400"
          title="Commit (Enter)"
          aria-label="Commit formula"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* fx symbol */}
      <div className="flex h-6 w-6 items-center justify-center font-serif text-sm font-bold italic text-slate-400">
        fx
      </div>

      {/* Formula Input */}
      <div className="flex-1">
        <input
          type="text"
          value={formulaValue}
          onChange={(e) => onFormulaChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a formula (e.g. =SUM(A1:B5)) or value"
          className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-1 font-mono text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:bg-slate-900/90 focus:outline-none"
        />
      </div>
    </div>
  )
}

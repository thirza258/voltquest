import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sigma,
  Table as TableIcon,
  BarChart2,
  Activity,
  BookOpen,
  ArrowUpDown,
  Download,
  Upload,
  RotateCcw,
} from 'lucide-react'

export default function ExcelRibbon({
  activeTab,
  setActiveTab,
  onFormatChange,
  onStyleToggle,
  onAutoSum,
  onClearCell,
  onSort,
  onOpenPivot,
  onOpenStats,
  onOpenChart,
  onOpenFunctionDirectory,
  onResetStarter,
  onExportCsv,
  onImportCsv,
  cellStyle = {},
  cellFormat = 'general',
}) {
  const tabs = ['Home', 'Insert', 'Formulas', 'Data', 'Analytics']

  return (
    <div className="border-b border-slate-700 bg-slate-900 text-slate-200">
      {/* Top Tab Headers */}
      <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-950 px-3 py-1">
        <span className="mr-3 flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider text-emerald-400">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-600 font-black text-white text-[10px]">
            X
          </span>
          Excel Simulator
        </span>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-t px-3 py-1.5 text-xs font-medium transition ${
              activeTab === tab
                ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Body Toolbar */}
      <div className="flex h-14 items-center gap-3 px-4 py-2 text-xs">
        {activeTab === 'Home' && (
          <div className="flex items-center gap-4">
            {/* Font Styling */}
            <div className="flex items-center gap-1 border-r border-slate-800 pr-3">
              <button
                onClick={() => onStyleToggle('bold')}
                className={`rounded p-1.5 transition ${
                  cellStyle.bold ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Bold (Ctrl+B)"
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                onClick={() => onStyleToggle('italic')}
                className={`rounded p-1.5 transition ${
                  cellStyle.italic ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Italic (Ctrl+I)"
              >
                <Italic className="h-4 w-4" />
              </button>
            </div>

            {/* Alignment */}
            <div className="flex items-center gap-1 border-r border-slate-800 pr-3">
              <button
                onClick={() => onStyleToggle('align', 'left')}
                className={`rounded p-1.5 transition ${
                  cellStyle.align === 'left' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Align Left"
              >
                <AlignLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => onStyleToggle('align', 'center')}
                className={`rounded p-1.5 transition ${
                  cellStyle.align === 'center' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Align Center"
              >
                <AlignCenter className="h-4 w-4" />
              </button>
              <button
                onClick={() => onStyleToggle('align', 'right')}
                className={`rounded p-1.5 transition ${
                  cellStyle.align === 'right' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Align Right"
              >
                <AlignRight className="h-4 w-4" />
              </button>
            </div>

            {/* Number Formatting */}
            <div className="flex items-center gap-2 border-r border-slate-800 pr-3">
              <span className="text-[11px] text-slate-400">Number Format:</span>
              <select
                value={cellFormat}
                onChange={(e) => onFormatChange(e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="general">General</option>
                <option value="currency">Currency ($1,234.56)</option>
                <option value="percent">Percentage (12.3%)</option>
                <option value="number">Number (1,234.56)</option>
                <option value="integer">Integer (1,235)</option>
              </select>
            </div>

            {/* Quick AutoSum */}
            <div className="flex items-center gap-2">
              <button
                onClick={onAutoSum}
                className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white transition hover:bg-emerald-500"
                title="Automatically insert =SUM() for adjacent cells"
              >
                <Sigma className="h-4 w-4" />
                AutoSum
              </button>
              <button
                onClick={onClearCell}
                className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-slate-300 hover:bg-slate-700"
              >
                Clear Cell
              </button>
            </div>
          </div>
        )}

        {activeTab === 'Insert' && (
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenPivot}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 font-medium text-slate-200 transition hover:border-emerald-500 hover:text-white"
            >
              <TableIcon className="h-4 w-4 text-emerald-400" />
              Pivot Table
            </button>
            <button
              onClick={onOpenChart}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 font-medium text-slate-200 transition hover:border-emerald-500 hover:text-white"
            >
              <BarChart2 className="h-4 w-4 text-sky-400" />
              Insert Chart
            </button>
            <button
              onClick={onOpenStats}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 font-medium text-slate-200 transition hover:border-emerald-500 hover:text-white"
            >
              <Activity className="h-4 w-4 text-amber-400" />
              Summary Statistics
            </button>
          </div>
        )}

        {activeTab === 'Formulas' && (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenFunctionDirectory}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white transition hover:bg-emerald-500"
            >
              <BookOpen className="h-4 w-4" />
              Function Library (fx)
            </button>
            <div className="h-6 w-px bg-slate-800" />
            <span className="text-[11px] text-slate-400">Quick Insert:</span>
            {['=SUM()', '=AVERAGE()', '=COUNTIF()', '=SUMIFS()', '=VLOOKUP()', '=XLOOKUP()', '=IF()'].map((chip) => (
              <button
                key={chip}
                onClick={() => onAutoSum(chip)}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-emerald-500 hover:text-emerald-400"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'Data' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 border-r border-slate-800 pr-3">
              <button
                onClick={() => onSort(true)}
                className="flex items-center gap-1 rounded bg-slate-800 px-3 py-1.5 text-slate-200 hover:bg-slate-700"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-emerald-400" />
                Sort Ascending (A-Z)
              </button>
              <button
                onClick={() => onSort(false)}
                className="flex items-center gap-1 rounded bg-slate-800 px-3 py-1.5 text-slate-200 hover:bg-slate-700"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-rose-400" />
                Sort Descending (Z-A)
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onExportCsv}
                className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 hover:bg-slate-700"
              >
                <Download className="h-3.5 w-3.5 text-sky-400" />
                Export CSV
              </button>
              <label className="flex cursor-pointer items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 hover:bg-slate-700">
                <Upload className="h-3.5 w-3.5 text-amber-400" />
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={onImportCsv}
                  className="hidden"
                />
              </label>
              <button
                onClick={onResetStarter}
                className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
                Reset Starter
              </button>
            </div>
          </div>
        )}

        {activeTab === 'Analytics' && (
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenStats}
              className="flex items-center gap-1.5 rounded bg-amber-600/30 px-3 py-1.5 font-semibold text-amber-300 hover:bg-amber-600 hover:text-white"
            >
              <Activity className="h-4 w-4" />
              Exploratory Data Analysis (EDA)
            </button>
            <button
              onClick={onOpenPivot}
              className="flex items-center gap-1.5 rounded bg-emerald-600/30 px-3 py-1.5 font-semibold text-emerald-300 hover:bg-emerald-600 hover:text-white"
            >
              <TableIcon className="h-4 w-4" />
              Pivot Cross-Tabulation
            </button>
            <button
              onClick={onOpenChart}
              className="flex items-center gap-1.5 rounded bg-sky-600/30 px-3 py-1.5 font-semibold text-sky-300 hover:bg-sky-600 hover:text-white"
            >
              <BarChart2 className="h-4 w-4" />
              Visual Analytics Chart
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

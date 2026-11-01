import { useState, useEffect, useMemo, useCallback } from 'react'
import { SheetModel } from '../../engine/excel/sheetModel'
import {
  formatCellAddress,
  colIndexToLetter,
} from '../../engine/excel/formulaParser'
import ExcelRibbon from './ExcelRibbon'
import ExcelFormulaBar from './ExcelFormulaBar'
import ExcelGrid from './ExcelGrid'
import ExcelStatusBar from './ExcelStatusBar'
import ExcelStatsModal from './ExcelStatsModal'
import ExcelPivotModal from './ExcelPivotModal'
import ExcelChartModal from './ExcelChartModal'
import ExcelFunctionDirectoryModal from './ExcelFunctionDirectoryModal'

export default function ExcelSimulator({
  initialDataset = null,
  initialCsv = null,
  onStateChange = null,
  height = '620px',
}) {
  const [sheet, setSheet] = useState(() => {
    const s = new SheetModel()
    if (initialDataset) {
      s.loadData(initialDataset)
    } else if (initialCsv) {
      s.importCsv(initialCsv)
    }
    return s
  })

  // Synchronize when initialDataset changes (e.g. switching courses)
  useEffect(() => {
    if (initialDataset) {
      const s = new SheetModel()
      s.loadData(initialDataset)
      setSheet(s)
    } else if (initialCsv) {
      const s = new SheetModel()
      s.importCsv(initialCsv)
      setSheet(s)
    }
  }, [initialDataset, initialCsv])

  const [activeTab, setActiveTab] = useState('Home')
  const [activeCell, setActiveCell] = useState({ col: 0, row: 0 }) // { col, row }
  const [selectionRange, setSelectionRange] = useState({
    startCol: 0,
    startRow: 0,
    endCol: 0,
    endRow: 0,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [formulaValue, setFormulaValue] = useState('')

  // Modals state
  const [isStatsOpen, setIsStatsOpen] = useState(false)
  const [isPivotOpen, setIsPivotOpen] = useState(false)
  const [isChartOpen, setIsChartOpen] = useState(false)
  const [isFuncDirOpen, setIsFuncDirOpen] = useState(false)

  // Sync formula bar when active cell changes
  useEffect(() => {
    const cell = sheet.getCell(activeCell.col, activeCell.row)
    if (cell) {
      setFormulaValue(cell.formula || (cell.raw !== null && cell.raw !== undefined ? String(cell.raw) : ''))
    } else {
      setFormulaValue('')
    }
  }, [activeCell, sheet])

  const activeCellCoord = useMemo(() => {
    return formatCellAddress(activeCell.col, activeCell.row)
  }, [activeCell])

  const currentSelectionRangeStr = useMemo(() => {
    const minC = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxC = Math.max(selectionRange.startCol, selectionRange.endCol)
    const minR = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxR = Math.max(selectionRange.startRow, selectionRange.endRow)
    if (minC === maxC && minR === maxR) {
      return formatCellAddress(minC, minR)
    }
    return `${formatCellAddress(minC, minR)}:${formatCellAddress(maxC, maxR)}`
  }, [selectionRange])

  // Calculate selection metrics for the status bar
  const selectionMetrics = useMemo(() => {
    const minC = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxC = Math.max(selectionRange.startCol, selectionRange.endCol)
    const minR = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxR = Math.max(selectionRange.startRow, selectionRange.endRow)

    const nums = []
    let totalCells = 0

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        totalCells++
        const cell = sheet.getCell(c, r)
        if (cell && typeof cell.value === 'number') {
          nums.push(cell.value)
        }
      }
    }

    if (nums.length === 0) {
      return { count: totalCells, sum: null, avg: null }
    }

    const sum = nums.reduce((a, b) => a + b, 0)
    const avg = Number((sum / nums.length).toFixed(2))

    return { count: totalCells, sum: Number(sum.toFixed(2)), avg }
  }, [sheet, selectionRange])

  // Active cell format & style
  const activeCellObj = useMemo(() => {
    return sheet.getCell(activeCell.col, activeCell.row) || {}
  }, [sheet, activeCell])

  const commitActiveCell = useCallback(
    (newVal = null) => {
      const valToCommit = newVal !== null ? newVal : formulaValue
      sheet.setCellValue(activeCell.col, activeCell.row, valToCommit)
      setIsEditing(false)
      // Force re-render of sheet state
      setSheet(sheet)
      if (onStateChange) {
        onStateChange(sheet)
      }
    },
    [formulaValue, activeCell, sheet, onStateChange]
  )

  const handleFormatChange = (fmt) => {
    const cell = sheet.getCell(activeCell.col, activeCell.row)
    sheet.setCellValue(activeCell.col, activeCell.row, cell ? (cell.formula || cell.raw) : '', fmt)
    setSheet(sheet)
  }

  const handleStyleToggle = (styleProp, value = null) => {
    const cell = sheet.getCell(activeCell.col, activeCell.row)
    const curStyle = cell ? cell.style || {} : {}
    let newStyle = { ...curStyle }

    if (styleProp === 'bold') {
      newStyle.bold = !curStyle.bold
    } else if (styleProp === 'italic') {
      newStyle.italic = !curStyle.italic
    } else if (styleProp === 'align') {
      newStyle.align = value
    }

    sheet.setCellValue(activeCell.col, activeCell.row, cell ? (cell.formula || cell.raw) : '', null, newStyle)
    setSheet(sheet)
  }

  // AutoSum feature
  const handleAutoSum = (customFormula = null) => {
    if (typeof customFormula === 'string' && customFormula !== '=SUM()') {
      setFormulaValue(customFormula)
      commitActiveCell(customFormula)
      return
    }

    // Inspect cells above active cell to detect numeric range
    let startR = activeCell.row - 1
    while (startR >= 0) {
      const prev = sheet.getCell(activeCell.col, startR)
      if (!prev || typeof prev.value !== 'number') break
      startR--
    }
    startR = Math.max(0, startR + 1)
    const endR = Math.max(0, activeCell.row - 1)

    const colLetter = colIndexToLetter(activeCell.col)
    const formulaStr = `=SUM(${colLetter}${startR + 1}:${colLetter}${endR + 1})`
    setFormulaValue(formulaStr)
    commitActiveCell(formulaStr)
  }

  const handleClearCell = () => {
    sheet.clearCell(activeCell.col, activeCell.row)
    setFormulaValue('')
    setSheet(sheet)
  }

  const handleSort = (ascending = true) => {
    // Sort entire table below header based on active column
    const matrix = sheet.getRangeMatrix('A1:Z50')
    if (matrix.length < 2) return

    const headers = matrix[0]
    const dataRows = matrix.slice(1).filter((r) => r.some((v) => v !== null && v !== ''))

    dataRows.sort((rowA, rowB) => {
      const valA = rowA[activeCell.col]
      const valB = rowB[activeCell.col]
      if (valA === valB) return 0
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1
      const nA = Number(valA)
      const nB = Number(valB)
      if (!isNaN(nA) && !isNaN(nB)) {
        return ascending ? nA - nB : nB - nA
      }
      return ascending
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA))
    })

    const newMatrix = [headers, ...dataRows]
    sheet.loadData(newMatrix)
    setSheet(sheet)
  }

  const handleResetStarter = () => {
    if (initialDataset) {
      const s = new SheetModel()
      s.loadData(initialDataset)
      setSheet(s)
      setActiveCell({ col: 0, row: 0 })
    }
  }

  const handleExportCsv = () => {
    const csv = sheet.exportCsv()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'workbook_export.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImportCsv = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result
      if (typeof text === 'string') {
        const s = new SheetModel()
        s.importCsv(text)
        setSheet(s)
      }
    }
    reader.readAsText(file)
  }

  // Compute stats for modal
  const descriptiveStats = useMemo(() => {
    if (!isStatsOpen) return null
    return sheet.computeDescriptiveStats(currentSelectionRangeStr)
  }, [sheet, currentSelectionRangeStr, isStatsOpen])

  return (
    <div
      style={{ height }}
      className="flex flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-xl overflow-hidden font-sans"
    >
      {/* Ribbon Bar */}
      <ExcelRibbon
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onFormatChange={handleFormatChange}
        onStyleToggle={handleStyleToggle}
        onAutoSum={handleAutoSum}
        onClearCell={handleClearCell}
        onSort={handleSort}
        onOpenPivot={() => setIsPivotOpen(true)}
        onOpenStats={() => setIsStatsOpen(true)}
        onOpenChart={() => setIsChartOpen(true)}
        onOpenFunctionDirectory={() => setIsFuncDirOpen(true)}
        onResetStarter={handleResetStarter}
        onExportCsv={handleExportCsv}
        onImportCsv={handleImportCsv}
        cellStyle={activeCellObj.style || {}}
        cellFormat={activeCellObj.format || 'general'}
      />

      {/* Formula Bar */}
      <ExcelFormulaBar
        activeCellCoord={activeCellCoord}
        formulaValue={formulaValue}
        onFormulaChange={setFormulaValue}
        onFormulaCommit={() => commitActiveCell()}
        onFormulaCancel={() => {
          const cell = sheet.getCell(activeCell.col, activeCell.row)
          setFormulaValue(cell ? (cell.formula || cell.raw || '') : '')
          setIsEditing(false)
        }}
      />

      {/* Grid Canvas */}
      <ExcelGrid
        sheet={sheet}
        activeCell={activeCell}
        setActiveCell={setActiveCell}
        selectionRange={selectionRange}
        setSelectionRange={setSelectionRange}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        editValue={formulaValue}
        setEditValue={setFormulaValue}
        onCommitCell={() => commitActiveCell()}
        numCols={12}
        numRows={30}
      />

      {/* Status Bar */}
      <ExcelStatusBar
        activeCellCoord={activeCellCoord}
        isEditing={isEditing}
        selectionMetrics={selectionMetrics}
      />

      {/* Analytics Modals */}
      <ExcelStatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        stats={descriptiveStats}
        rangeStr={currentSelectionRangeStr}
      />

      <ExcelPivotModal
        isOpen={isPivotOpen}
        onClose={() => setIsPivotOpen(false)}
        sheet={sheet}
        defaultRangeStr="A1:H7"
      />

      <ExcelChartModal
        isOpen={isChartOpen}
        onClose={() => setIsChartOpen(false)}
        sheet={sheet}
        defaultRangeStr="A1:H7"
      />

      <ExcelFunctionDirectoryModal
        isOpen={isFuncDirOpen}
        onClose={() => setIsFuncDirOpen(false)}
        onSelectFunction={(fn) => {
          const prefix = fn.example.startsWith('=') ? fn.example : `=${fn.example}`
          setFormulaValue(prefix)
          commitActiveCell(prefix)
        }}
      />
    </div>
  )
}

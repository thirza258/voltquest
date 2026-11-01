import { useRef, useEffect } from 'react'
import { colIndexToLetter } from '../../engine/excel/formulaParser'

export default function ExcelGrid({
  sheet,
  activeCell, // { col, row }
  setActiveCell,
  selectionRange, // { startCol, startRow, endCol, endRow }
  setSelectionRange,
  isEditing,
  setIsEditing,
  editValue,
  setEditValue,
  onCommitCell,
  numCols = 10,
  numRows = 25,
}) {
  const gridContainerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const isCellSelected = (c, r) => {
    if (!selectionRange) return c === activeCell.col && r === activeCell.row
    const minC = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxC = Math.max(selectionRange.startCol, selectionRange.endCol)
    const minR = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxR = Math.max(selectionRange.startRow, selectionRange.endRow)
    return c >= minC && c <= maxC && r >= minR && r <= maxR
  }

  const handleCellClick = (c, r, e) => {
    if (isEditing) {
      onCommitCell()
    }
    setActiveCell({ col: c, row: r })
    if (e.shiftKey) {
      setSelectionRange({
        startCol: activeCell.col,
        startRow: activeCell.row,
        endCol: c,
        endRow: r,
      })
    } else {
      setSelectionRange({ startCol: c, startRow: r, endCol: c, endRow: r })
    }
  }

  const handleCellDoubleClick = (c, r) => {
    setActiveCell({ col: c, row: r })
    const cell = sheet ? sheet.getCell(c, r) : null
    setEditValue(cell ? (cell.formula || cell.raw || '') : '')
    setIsEditing(true)
  }

  const handleKeyDown = (e) => {
    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault()
        onCommitCell()
        if (activeCell.row + 1 < numRows) {
          setActiveCell({ col: activeCell.col, row: activeCell.row + 1 })
          setSelectionRange({
            startCol: activeCell.col,
            startRow: activeCell.row + 1,
            endCol: activeCell.col,
            endRow: activeCell.row + 1,
          })
        }
      } else if (e.key === 'Tab') {
        e.preventDefault()
        onCommitCell()
        if (activeCell.col + 1 < numCols) {
          setActiveCell({ col: activeCell.col + 1, row: activeCell.row })
          setSelectionRange({
            startCol: activeCell.col + 1,
            startRow: activeCell.row,
            endCol: activeCell.col + 1,
            endRow: activeCell.row,
          })
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setIsEditing(false)
      }
      return
    }

    // Grid navigation keys
    if (e.key === 'ArrowUp' && activeCell.row > 0) {
      e.preventDefault()
      const newR = activeCell.row - 1
      setActiveCell({ col: activeCell.col, row: newR })
      setSelectionRange({ startCol: activeCell.col, startRow: newR, endCol: activeCell.col, endRow: newR })
    } else if (e.key === 'ArrowDown' && activeCell.row < numRows - 1) {
      e.preventDefault()
      const newR = activeCell.row + 1
      setActiveCell({ col: activeCell.col, row: newR })
      setSelectionRange({ startCol: activeCell.col, startRow: newR, endCol: activeCell.col, endRow: newR })
    } else if (e.key === 'ArrowLeft' && activeCell.col > 0) {
      e.preventDefault()
      const newC = activeCell.col - 1
      setActiveCell({ col: newC, row: activeCell.row })
      setSelectionRange({ startCol: newC, startRow: activeCell.row, endCol: newC, endRow: activeCell.row })
    } else if (e.key === 'ArrowRight' && activeCell.col < numCols - 1) {
      e.preventDefault()
      const newC = activeCell.col + 1
      setActiveCell({ col: newC, row: activeCell.row })
      setSelectionRange({ startCol: newC, startRow: activeCell.row, endCol: newC, endRow: activeCell.row })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cell = sheet ? sheet.getCell(activeCell.col, activeCell.row) : null
      setEditValue(cell ? (cell.formula || cell.raw || '') : '')
      setIsEditing(true)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (activeCell.col + 1 < numCols) {
        const newC = activeCell.col + 1
        setActiveCell({ col: newC, row: activeCell.row })
        setSelectionRange({ startCol: newC, startRow: activeCell.row, endCol: newC, endRow: activeCell.row })
      }
    }
  }

  return (
    <div
      ref={gridContainerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex-1 overflow-auto bg-slate-900 font-mono text-xs focus:outline-none select-none"
    >
      <table className="border-collapse table-fixed w-full">
        {/* Column Headers (Sticky Top) */}
        <thead>
          <tr className="sticky top-0 z-20 bg-slate-950 shadow-sm">
            {/* Top-left corner */}
            <th className="sticky left-0 z-30 h-7 w-12 border-b border-r border-slate-700 bg-slate-950 text-slate-500 font-normal" />
            {Array.from({ length: numCols }).map((_, c) => {
              const isColActive = activeCell.col === c
              return (
                <th
                  key={c}
                  className={`h-7 min-w-[110px] max-w-[180px] border-b border-r border-slate-700 text-center font-sans font-semibold transition ${
                    isColActive ? 'bg-emerald-950/60 text-emerald-400' : 'bg-slate-950 text-slate-400'
                  }`}
                >
                  {colIndexToLetter(c)}
                </th>
              )
            })}
          </tr>
        </thead>

        {/* Rows */}
        <tbody>
          {Array.from({ length: numRows }).map((_, r) => {
            const isRowActive = activeCell.row === r
            return (
              <tr key={r}>
                {/* Row Header (Sticky Left) */}
                <th
                  className={`sticky left-0 z-10 h-7 w-12 border-b border-r border-slate-700 text-center font-sans font-medium transition ${
                    isRowActive ? 'bg-emerald-950/60 text-emerald-400' : 'bg-slate-950 text-slate-400'
                  }`}
                >
                  {r + 1}
                </th>

                {/* Cells */}
                {Array.from({ length: numCols }).map((_, c) => {
                  const isActive = activeCell.col === c && activeCell.row === r
                  const isSelected = isCellSelected(c, r)
                  const cell = sheet ? sheet.getCell(c, r) : null
                  const displayVal = cell ? (cell.formatted || (cell.value !== null && cell.value !== undefined ? String(cell.value) : '')) : ''
                  const style = cell ? cell.style || {} : {}

                  return (
                    <td
                      key={c}
                      onClick={(e) => handleCellClick(c, r, e)}
                      onDoubleClick={() => handleCellDoubleClick(c, r)}
                      className={`relative h-7 border-b border-r border-slate-800 px-2 py-0.5 overflow-hidden text-ellipsis whitespace-nowrap cursor-cell transition-colors ${
                        isActive
                          ? 'border-emerald-500 ring-2 ring-emerald-500 z-10 bg-slate-800/80'
                          : isSelected
                          ? 'bg-emerald-900/20'
                          : 'bg-slate-900/90 hover:bg-slate-800/40'
                      }`}
                      style={{
                        fontWeight: style.bold ? 'bold' : 'normal',
                        fontStyle: style.italic ? 'italic' : 'normal',
                        textAlign: style.align || (typeof cell?.value === 'number' ? 'right' : 'left'),
                      }}
                    >
                      {isActive && isEditing ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="absolute inset-0 h-full w-full bg-slate-950 px-2 font-mono text-xs text-white focus:outline-none"
                        />
                      ) : (
                        <span
                          className={
                            typeof displayVal === 'string' && displayVal.startsWith('#')
                              ? 'text-rose-400 font-bold'
                              : typeof cell?.value === 'number'
                              ? 'text-emerald-300'
                              : 'text-slate-200'
                          }
                        >
                          {displayVal}
                        </span>
                      )}

                      {/* Active cell handle dot */}
                      {isActive && !isEditing && (
                        <div className="absolute bottom-0 right-0 h-1.5 w-1.5 bg-emerald-500" />
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

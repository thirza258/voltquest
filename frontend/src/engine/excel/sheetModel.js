/**
 * Microsoft Excel Worksheet Data Model & Calculation Manager
 */

import {
  FormulaEvaluator,
  parseCellReference,
  parseRangeReference,
  formatCellAddress,
} from './formulaParser'

export class SheetModel {
  constructor(options = {}) {
    this.name = options.name || 'Sheet1'
    this.maxCols = options.maxCols || 26 // Columns A to Z
    this.maxRows = options.maxRows || 100 // Rows 1 to 100
    this.cells = new Map() // key: 'A1', value: { raw, formula, value, formatted, format, style }
    this.evaluator = new FormulaEvaluator((col, row) => this.getRawOrEvaluatedValue(col, row))
  }

  getCellKey(col, row) {
    return formatCellAddress(col, row)
  }

  getCell(col, row) {
    const key = typeof col === 'string' ? col.toUpperCase() : this.getCellKey(col, row)
    return this.cells.get(key) || null
  }

  getRawOrEvaluatedValue(col, row, cellKey = null) {
    const key = cellKey || (typeof col === 'string' ? col.toUpperCase() : this.getCellKey(col, row))
    const cell = this.cells.get(key)
    if (!cell) return null
    if (cell.formula) {
      return this.evaluator.evaluate(cell.formula, key)
    }
    return cell.value !== undefined ? cell.value : cell.raw
  }

  setCellValue(col, row, rawValue, format = null, style = null) {
    const key = typeof col === 'string' ? col.toUpperCase() : this.getCellKey(col, row)
    const existing = this.cells.get(key) || {
      raw: '',
      formula: null,
      value: null,
      formatted: '',
      format: 'general',
      style: {},
    }

    const rawStr = rawValue === null || rawValue === undefined ? '' : String(rawValue)
    const isFormula = rawStr.startsWith('=')

    const newFormat = format || existing.format || 'general'
    const newStyle = style ? { ...existing.style, ...style } : existing.style

    const cellObj = {
      ...existing,
      raw: rawValue,
      formula: isFormula ? rawStr : null,
      format: newFormat,
      style: newStyle,
    }

    if (!isFormula) {
      // Determine value from literal
      if (rawValue === '' || rawValue === null || rawValue === undefined) {
        cellObj.value = ''
      } else if (!isNaN(Number(rawValue)) && typeof rawValue !== 'boolean' && String(rawValue).trim() !== '') {
        cellObj.value = Number(rawValue)
      } else if (String(rawValue).toUpperCase() === 'TRUE') {
        cellObj.value = true
      } else if (String(rawValue).toUpperCase() === 'FALSE') {
        cellObj.value = false
      } else {
        cellObj.value = rawValue
      }
      cellObj.formatted = this.formatValue(cellObj.value, newFormat)
    }

    this.cells.set(key, cellObj)
    this.recalculateAll()
    return cellObj
  }

  recalculateAll() {
    // Two-pass recalculation:
    // Pass 1: reset formula cell values to evaluate
    // Pass 2: evaluate each formula cell
    for (const [key, cell] of this.cells.entries()) {
      if (cell.formula) {
        cell.value = this.evaluator.evaluate(cell.formula, key)
        cell.formatted = this.formatValue(cell.value, cell.format)
      }
    }
  }

  formatValue(val, format) {
    if (val === null || val === undefined || val === '') return ''
    if (typeof val === 'string' && val.startsWith('#')) return val // Error code
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'

    const num = Number(val)
    if (!isNaN(num) && typeof val !== 'boolean') {
      switch (format) {
        case 'currency':
          return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        case 'percent':
          return (num * 100).toFixed(1) + '%'
        case 'number':
          return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        case 'integer':
          return Math.round(num).toLocaleString('en-US')
        default:
          return String(val)
      }
    }
    return String(val)
  }

  clearCell(col, row) {
    const key = typeof col === 'string' ? col.toUpperCase() : this.getCellKey(col, row)
    this.cells.delete(key)
    this.recalculateAll()
  }

  // Load a 2D array of data (rows of arrays) starting at A1 or specified coordinate
  loadData(data2D, startCol = 0, startRow = 0) {
    for (let r = 0; r < data2D.length; r++) {
      const rowData = data2D[r]
      for (let c = 0; c < rowData.length; c++) {
        const val = rowData[c]
        if (val !== null && val !== undefined) {
          const colIdx = startCol + c
          const rowIdx = startRow + r
          const key = this.getCellKey(colIdx, rowIdx)
          const rawStr = String(val)
          const isFormula = rawStr.startsWith('=')
          let parsedVal = val
          if (!isFormula && !isNaN(Number(val)) && typeof val !== 'boolean' && rawStr.trim() !== '') {
            parsedVal = Number(val)
          }
          this.cells.set(key, {
            raw: val,
            formula: isFormula ? rawStr : null,
            value: parsedVal,
            formatted: this.formatValue(parsedVal, 'general'),
            format: 'general',
            style: {},
          })
        }
      }
    }
    this.recalculateAll()
  }

  /**
   * Data Analytics & Statistical Capabilities
   */

  // Extract tabular array from range (e.g. 'A1:D10')
  getRangeMatrix(rangeStr) {
    const box = parseRangeReference(rangeStr)
    if (!box) return []
    const matrix = []
    for (let r = box.startRow; r <= box.endRow; r++) {
      const row = []
      for (let c = box.startCol; c <= box.endCol; c++) {
        const cell = this.getCell(c, r)
        row.push(cell ? cell.value : null)
      }
      matrix.push(row)
    }
    return matrix
  }

  // Calculate descriptive statistics for a range of numeric values
  computeDescriptiveStats(rangeStr) {
    const matrix = this.getRangeMatrix(rangeStr)
    const values = []
    for (const row of matrix) {
      for (const v of row) {
        if (v !== null && v !== undefined && v !== '' && !isNaN(Number(v))) {
          values.push(Number(v))
        }
      }
    }

    if (values.length === 0) {
      return null
    }

    values.sort((a, b) => a - b)
    const count = values.length
    const sum = values.reduce((acc, v) => acc + v, 0)
    const mean = sum / count
    const min = values[0]
    const max = values[count - 1]
    const range = max - min

    // Median
    const mid = Math.floor(count / 2)
    const median = count % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2

    // Mode
    const freq = {}
    let maxFreq = 0
    let mode = null
    for (const n of values) {
      freq[n] = (freq[n] || 0) + 1
      if (freq[n] > maxFreq) {
        maxFreq = freq[n]
        mode = n
      }
    }
    const finalMode = maxFreq > 1 ? mode : 'No unique mode'

    // Variance & StdDev
    const sumSqDiff = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0)
    const variance = count > 1 ? sumSqDiff / (count - 1) : 0
    const stdev = Math.sqrt(variance)

    // Quartiles (Q1 = 25th percentile, Q3 = 75th percentile)
    const getPercentile = (p) => {
      const idx = p * (count - 1)
      const low = Math.floor(idx)
      const high = Math.ceil(idx)
      const weight = idx - low
      return values[low] * (1 - weight) + values[high] * weight
    }
    const q1 = getPercentile(0.25)
    const q3 = getPercentile(0.75)
    const iqr = q3 - q1

    return {
      count,
      sum,
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      mode: typeof finalMode === 'number' ? Number(finalMode.toFixed(2)) : finalMode,
      stdev: Number(stdev.toFixed(2)),
      variance: Number(variance.toFixed(2)),
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      range: Number(range.toFixed(2)),
      q1: Number(q1.toFixed(2)),
      q3: Number(q3.toFixed(2)),
      iqr: Number(iqr.toFixed(2)),
    }
  }

  // Pivot Table Generation
  computePivotTable({ rangeStr, rowFieldCol, valFieldCol, aggFunction = 'SUM' }) {
    const matrix = this.getRangeMatrix(rangeStr)
    if (matrix.length < 2) return null // Need at least header + 1 data row

    const headers = matrix[0]
    const dataRows = matrix.slice(1)

    const groups = new Map()

    for (const row of dataRows) {
      const rowKey = row[rowFieldCol] !== null && row[rowFieldCol] !== undefined ? String(row[rowFieldCol]) : '(Blank)'
      const val = Number(row[valFieldCol])

      if (!groups.has(rowKey)) {
        groups.set(rowKey, [])
      }
      if (!isNaN(val)) {
        groups.get(rowKey).push(val)
      }
    }

    const resultRows = []
    let grandTotal = 0
    let allVals = []

    for (const [key, vals] of groups.entries()) {
      let aggVal = 0
      switch (aggFunction.toUpperCase()) {
        case 'SUM':
          aggVal = vals.reduce((a, b) => a + b, 0)
          break
        case 'AVERAGE':
          aggVal = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
          break
        case 'COUNT':
          aggVal = vals.length
          break
        case 'MIN':
          aggVal = vals.length > 0 ? Math.min(...vals) : 0
          break
        case 'MAX':
          aggVal = vals.length > 0 ? Math.max(...vals) : 0
          break
        default:
          aggVal = vals.reduce((a, b) => a + b, 0)
      }
      resultRows.push({
        rowKey: key,
        value: Number(aggVal.toFixed(2)),
        count: vals.length,
      })
      allVals = allVals.concat(vals)
    }

    if (aggFunction.toUpperCase() === 'SUM') {
      grandTotal = allVals.reduce((a, b) => a + b, 0)
    } else if (aggFunction.toUpperCase() === 'AVERAGE') {
      grandTotal = allVals.length > 0 ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 0
    } else if (aggFunction.toUpperCase() === 'COUNT') {
      grandTotal = allVals.length
    }

    return {
      rowHeader: headers[rowFieldCol] || `Column ${rowFieldCol + 1}`,
      valHeader: `${aggFunction} of ${headers[valFieldCol] || `Column ${valFieldCol + 1}`}`,
      rows: resultRows,
      grandTotal: Number(grandTotal.toFixed(2)),
      aggFunction: aggFunction.toUpperCase(),
    }
  }

  // CSV Export & Import
  exportCsv() {
    let maxRow = 0
    let maxCol = 0

    for (const key of this.cells.keys()) {
      const ref = parseCellReference(key)
      if (ref) {
        if (ref.row > maxRow) maxRow = ref.row
        if (ref.col > maxCol) maxCol = ref.col
      }
    }

    const lines = []
    for (let r = 0; r <= maxRow; r++) {
      const rowVals = []
      for (let c = 0; c <= maxCol; c++) {
        const cell = this.getCell(c, r)
        let v = cell ? (cell.formula || cell.formatted || cell.raw || '') : ''
        v = String(v)
        if (v.includes(',') || v.includes('"') || v.includes('\n')) {
          v = `"${v.replace(/"/g, '""')}"`
        }
        rowVals.push(v)
      }
      lines.push(rowVals.join(','))
    }
    return lines.join('\n')
  }

  importCsv(csvText) {
    this.cells.clear()
    const lines = csvText.split(/\r?\n/)
    const data2D = []
    for (const line of lines) {
      if (line.trim() === '') continue
      const row = []
      let inQuote = false
      let curVal = ''
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuote && i + 1 < line.length && line[i + 1] === '"') {
            curVal += '"'
            i++
          } else {
            inQuote = !inQuote
          }
        } else if (ch === ',' && !inQuote) {
          row.push(curVal.trim())
          curVal = ''
        } else {
          curVal += ch
        }
      }
      row.push(curVal.trim())
      data2D.push(row)
    }
    this.loadData(data2D)
  }
}

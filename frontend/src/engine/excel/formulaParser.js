/**
 * Microsoft Excel Formula Lexer, Parser & Evaluation Engine.
 *
 * Implements standard Excel formula syntax:
 * - Literals: Numbers, Strings ("hello"), Booleans (TRUE, FALSE), Errors
 * - References: A1, $A$1, B2:D10, multi-column and multi-row ranges
 * - Operators: +, -, *, /, ^, %, &, =, <>, <, >, <=, >=
 * - Built-in Excel functions for Math, Statistics, Logic, Lookup, Text, Date/Time, and Data Analytics.
 */

export const EXCEL_ERRORS = {
  DIV_ZERO: '#DIV/0!',
  VALUE: '#VALUE!',
  REF: '#REF!',
  NAME: '#NAME?',
  NUM: '#NUM!',
  NA: '#N/A!',
  CIRCULAR: '#CIRCULAR!',
}

// Convert column letter to 0-based index (e.g., 'A' -> 0, 'Z' -> 25, 'AA' -> 26)
export function colLetterToIndex(colStr) {
  let idx = 0
  const upper = colStr.toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    idx = idx * 26 + (upper.charCodeAt(i) - 64)
  }
  return idx - 1
}

// Convert 0-based column index to letter (e.g., 0 -> 'A', 25 -> 'Z', 26 -> 'AA')
export function colIndexToLetter(idx) {
  let temp = idx + 1
  let letter = ''
  while (temp > 0) {
    const rem = (temp - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    temp = Math.floor((temp - 1) / 26)
  }
  return letter
}

// Parse 'A1' or '$B$5' into { col: number, row: number, absCol: boolean, absRow: boolean }
export function parseCellReference(ref) {
  const match = ref.match(/^(\$?)([A-Za-z]+)(\$?)([0-9]+)$/)
  if (!match) return null
  const absCol = match[1] === '$'
  const col = colLetterToIndex(match[2])
  const absRow = match[3] === '$'
  const row = parseInt(match[4], 10) - 1 // 0-based row
  return { col, row, absCol, absRow }
}

// Parse 'A1:C10' into range bounding box { startCol, startRow, endCol, endRow }
export function parseRangeReference(rangeStr) {
  const parts = rangeStr.split(':')
  if (parts.length === 1) {
    const cell = parseCellReference(parts[0])
    if (!cell) return null
    return { startCol: cell.col, startRow: cell.row, endCol: cell.col, endRow: cell.row }
  }
  if (parts.length === 2) {
    const start = parseCellReference(parts[0])
    const end = parseCellReference(parts[1])
    if (!start || !end) return null
    return {
      startCol: Math.min(start.col, end.col),
      startRow: Math.min(start.row, end.row),
      endCol: Math.max(start.col, end.col),
      endRow: Math.max(start.row, end.row),
    }
  }
  return null
}

// Format coordinates to standard cell name (e.g. 0, 0 -> 'A1')
export function formatCellAddress(col, row, absCol = false, absRow = false) {
  return `${absCol ? '$' : ''}${colIndexToLetter(col)}${absRow ? '$' : ''}${row + 1}`
}

/**
 * Tokenizer for Excel formulas
 */
export function tokenizeFormula(expr) {
  const tokens = []
  let i = 0
  const s = expr.trim().startsWith('=') ? expr.trim().slice(1) : expr.trim()

  while (i < s.length) {
    const ch = s[i]

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++
      continue
    }

    // String literal
    if (ch === '"') {
      let str = ''
      i++
      while (i < s.length) {
        if (s[i] === '"') {
          if (i + 1 < s.length && s[i + 1] === '"') {
            str += '"'
            i += 2
          } else {
            i++
            break
          }
        } else {
          str += s[i]
          i++
        }
      }
      tokens.push({ type: 'STRING', value: str })
      continue
    }

    // Number
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < s.length && /[0-9]/.test(s[i + 1]))) {
      let numStr = ''
      while (i < s.length && /[0-9.]/.test(s[i])) {
        numStr += s[i]
        i++
      }
      // Check for scientific notation e.g. 1e5
      if (i < s.length && (s[i] === 'e' || s[i] === 'E')) {
        numStr += s[i]
        i++
        if (i < s.length && (s[i] === '+' || s[i] === '-')) {
          numStr += s[i]
          i++
        }
        while (i < s.length && /[0-9]/.test(s[i])) {
          numStr += s[i]
          i++
        }
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) })
      continue
    }

    // Range operator ':'
    if (ch === ':') {
      tokens.push({ type: 'COLON', value: ':' })
      i++
      continue
    }

    // Comparison operators (<=, >=, <>, <, >, =)
    if (ch === '<') {
      if (i + 1 < s.length && s[i + 1] === '=') {
        tokens.push({ type: 'OPERATOR', value: '<=' })
        i += 2
      } else if (i + 1 < s.length && s[i + 1] === '>') {
        tokens.push({ type: 'OPERATOR', value: '<>' })
        i += 2
      } else {
        tokens.push({ type: 'OPERATOR', value: '<' })
        i++
      }
      continue
    }
    if (ch === '>') {
      if (i + 1 < s.length && s[i + 1] === '=') {
        tokens.push({ type: 'OPERATOR', value: '>=' })
        i += 2
      } else {
        tokens.push({ type: 'OPERATOR', value: '>' })
        i++
      }
      continue
    }
    if (ch === '=') {
      tokens.push({ type: 'OPERATOR', value: '=' })
      i++
      continue
    }

    // Arithmetic & string operators: +, -, *, /, ^, %, &
    if ('+-*/^%&'.includes(ch)) {
      tokens.push({ type: 'OPERATOR', value: ch })
      i++
      continue
    }

    // Parentheses & commas / semicolons
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' })
      i++
      continue
    }
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'COMMA', value: ',' })
      i++
      continue
    }

    // Identifiers: Functions (SUM, IF, etc.) or Cell references (A1, $A$1) or Booleans (TRUE, FALSE)
    if (/[A-Za-z_$]/.test(ch)) {
      let id = ''
      while (i < s.length && /[A-Za-z0-9_$.]/.test(s[i])) {
        id += s[i]
        i++
      }
      const upper = id.toUpperCase()
      if (upper === 'TRUE') {
        tokens.push({ type: 'BOOLEAN', value: true })
      } else if (upper === 'FALSE') {
        tokens.push({ type: 'BOOLEAN', value: false })
      } else {
        tokens.push({ type: 'IDENTIFIER', value: id })
      }
      continue
    }

    // Unknown character
    tokens.push({ type: 'UNKNOWN', value: ch })
    i++
  }

  // Second pass: stitch IDENTIFIER + COLON + IDENTIFIER into RANGE tokens (e.g. A1:B10)
  const merged = []
  for (let j = 0; j < tokens.length; j++) {
    const cur = tokens[j]
    if (cur.type === 'IDENTIFIER' && j + 2 < tokens.length && tokens[j + 1].type === 'COLON' && tokens[j + 2].type === 'IDENTIFIER') {
      const startRef = parseCellReference(cur.value)
      const endRef = parseCellReference(tokens[j + 2].value)
      if (startRef && endRef) {
        merged.push({ type: 'RANGE', value: `${cur.value}:${tokens[j + 2].value}` })
        j += 2
        continue
      }
    }
    merged.push(cur)
  }

  return merged
}

/**
 * Formula Evaluator
 */
export class FormulaEvaluator {
  constructor(cellLookup) {
    // cellLookup is a callback (col, row) => cellValue
    // rangeLookup is (rangeStr) => array of cellValues
    this.cellLookup = cellLookup
    this.evalStack = new Set() // For circular reference detection
  }

  evaluate(formulaStr, currentCellId = null) {
    if (!formulaStr || typeof formulaStr !== 'string' || !formulaStr.startsWith('=')) {
      return formulaStr
    }

    if (currentCellId) {
      if (this.evalStack.has(currentCellId)) {
        return EXCEL_ERRORS.CIRCULAR
      }
      this.evalStack.add(currentCellId)
    }

    try {
      const tokens = tokenizeFormula(formulaStr)
      if (tokens.length === 0) return ''
      let pos = 0

      const peek = () => tokens[pos]
      const consume = (expectedType = null) => {
        const t = tokens[pos++]
        if (expectedType && (!t || t.type !== expectedType)) {
          throw new Error(`Expected ${expectedType}`)
        }
        return t
      }

      // Expression parser with precedence:
      // 1. Comparison: =, <>, <, >, <=, >=
      // 2. Concatenation: &
      // 3. Additive: +, -
      // 4. Multiplicative: *, /
      // 5. Exponentiation: ^
      // 6. Unary: +, -
      // 7. Primary: literal, cell ref, range, function call, (expr)

      const parsePrimary = () => {
        const token = peek()
        if (!token) throw new Error('Unexpected end of expression')

        // Unary +/-
        if (token.type === 'OPERATOR' && (token.value === '+' || token.value === '-')) {
          consume()
          const operand = parsePrimary()
          const num = typeof operand === 'number' ? operand : parseFloat(operand)
          if (isNaN(num)) return EXCEL_ERRORS.VALUE
          return token.value === '-' ? -num : num
        }

        if (token.type === 'NUMBER') {
          consume()
          return token.value
        }
        if (token.type === 'STRING') {
          consume()
          return token.value
        }
        if (token.type === 'BOOLEAN') {
          consume()
          return token.value
        }
        if (token.type === 'RANGE') {
          consume()
          return token.value // Returns range reference string, consumed by functions like SUM
        }
        if (token.type === 'LPAREN') {
          consume('LPAREN')
          const val = parseExpression()
          consume('RPAREN')
          return val
        }
        if (token.type === 'IDENTIFIER') {
          const id = consume().value
          // Check if function call
          if (peek() && peek().type === 'LPAREN') {
            consume('LPAREN')
            const args = []
            if (peek() && peek().type !== 'RPAREN') {
              while (true) {
                args.push(parseExpression())
                if (peek() && peek().type === 'COMMA') {
                  consume('COMMA')
                } else {
                  break
                }
              }
            }
            consume('RPAREN')
            return this.executeFunction(id.toUpperCase(), args)
          }

          // Single cell reference (e.g. A1, $B$4)
          const cell = parseCellReference(id)
          if (cell) {
            const cellRefStr = formatCellAddress(cell.col, cell.row)
            return this.cellLookup(cell.col, cell.row, cellRefStr)
          }

          // Named constant or unknown
          const upper = id.toUpperCase()
          if (upper === 'PI') return Math.PI
          if (upper === 'TRUE') return true
          if (upper === 'FALSE') return false

          return EXCEL_ERRORS.NAME
        }

        throw new Error(`Unexpected token ${token.value}`)
      }

      const parsePower = () => {
        let left = parsePrimary()
        while (peek() && peek().type === 'OPERATOR' && peek().value === '^') {
          consume()
          const right = parsePrimary()
          if (typeof left !== 'number' || typeof right !== 'number') {
            left = EXCEL_ERRORS.VALUE
          } else {
            left = Math.pow(left, right)
          }
        }
        return left
      }

      const parseMultiplicative = () => {
        let left = parsePower()
        while (peek() && peek().type === 'OPERATOR' && (peek().value === '*' || peek().value === '/')) {
          const op = consume().value
          const right = parsePower()
          if (typeof left === 'string' && left.startsWith('#')) return left
          if (typeof right === 'string' && right.startsWith('#')) return right
          const nLeft = Number(left)
          const nRight = Number(right)
          if (isNaN(nLeft) || isNaN(nRight)) return EXCEL_ERRORS.VALUE
          if (op === '/') {
            if (nRight === 0) return EXCEL_ERRORS.DIV_ZERO
            left = nLeft / nRight
          } else {
            left = nLeft * nRight
          }
        }
        return left
      }

      const parseAdditive = () => {
        let left = parseMultiplicative()
        while (peek() && peek().type === 'OPERATOR' && (peek().value === '+' || peek().value === '-')) {
          const op = consume().value
          const right = parseMultiplicative()
          if (typeof left === 'string' && left.startsWith('#')) return left
          if (typeof right === 'string' && right.startsWith('#')) return right
          const nLeft = Number(left)
          const nRight = Number(right)
          if (isNaN(nLeft) || isNaN(nRight)) return EXCEL_ERRORS.VALUE
          left = op === '+' ? nLeft + nRight : nLeft - nRight
        }
        return left
      }

      const parseConcat = () => {
        let left = parseAdditive()
        while (peek() && peek().type === 'OPERATOR' && peek().value === '&') {
          consume()
          const right = parseAdditive()
          const strLeft = left === null || left === undefined ? '' : String(left)
          const strRight = right === null || right === undefined ? '' : String(right)
          left = strLeft + strRight
        }
        return left
      }

      const parseComparison = () => {
        let left = parseConcat()
        while (peek() && peek().type === 'OPERATOR' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().value)) {
          const op = consume().value
          const right = parseConcat()
          left = this.compareValues(left, right, op)
        }
        return left
      }

      const parseExpression = () => {
        return parseComparison()
      }

      const result = parseExpression()
      return result
    } catch {
      return EXCEL_ERRORS.VALUE
    } finally {
      if (currentCellId) {
        this.evalStack.delete(currentCellId)
      }
    }
  }

  compareValues(left, right, op) {
    if (typeof left === 'string' && left.startsWith('#')) return left
    if (typeof right === 'string' && right.startsWith('#')) return right

    let cmp = 0
    if (typeof left === 'number' && typeof right === 'number') {
      cmp = left - right
    } else {
      const strL = String(left).toLowerCase()
      const strR = String(right).toLowerCase()
      if (strL < strR) cmp = -1
      else if (strL > strR) cmp = 1
      else cmp = 0
    }

    switch (op) {
      case '=': return cmp === 0
      case '<>': return cmp !== 0
      case '<': return cmp < 0
      case '>': return cmp > 0
      case '<=': return cmp <= 0
      case '>=': return cmp >= 0
      default: return false
    }
  }

  // Resolve a function argument that might be a range (e.g. 'A1:C5') or a scalar
  resolveArgumentValues(arg) {
    if (typeof arg === 'string' && arg.includes(':')) {
      const box = parseRangeReference(arg)
      if (box) {
        const values = []
        for (let r = box.startRow; r <= box.endRow; r++) {
          for (let c = box.startCol; c <= box.endCol; c++) {
            values.push(this.cellLookup(c, r, formatCellAddress(c, r)))
          }
        }
        return values
      }
    }
    if (Array.isArray(arg)) {
      return arg.flatMap(x => this.resolveArgumentValues(x))
    }
    return [arg]
  }

  resolve2DMatrix(rangeStr) {
    const box = parseRangeReference(rangeStr)
    if (!box) return []
    const matrix = []
    for (let r = box.startRow; r <= box.endRow; r++) {
      const row = []
      for (let c = box.startCol; c <= box.endCol; c++) {
        row.push(this.cellLookup(c, r, formatCellAddress(c, r)))
      }
      matrix.push(row)
    }
    return matrix
  }

  executeFunction(fnName, args) {
    const toNumbers = (arr) => {
      const nums = []
      for (const val of arr) {
        if (typeof val === 'number') nums.push(val)
        else if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) {
          nums.push(Number(val))
        }
      }
      return nums
    }

    switch (fnName) {
      // 1. Math & Statistics
      case 'SUM': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        const nums = toNumbers(values)
        return nums.reduce((acc, v) => acc + v, 0)
      }
      case 'AVERAGE': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        const nums = toNumbers(values)
        if (nums.length === 0) return EXCEL_ERRORS.DIV_ZERO
        return nums.reduce((acc, v) => acc + v, 0) / nums.length
      }
      case 'COUNT': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        return toNumbers(values).length
      }
      case 'COUNTA': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        return values.filter(v => v !== null && v !== undefined && v !== '').length
      }
      case 'COUNTBLANK': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        return values.filter(v => v === null || v === undefined || v === '').length
      }
      case 'MIN': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        const nums = toNumbers(values)
        if (nums.length === 0) return 0
        return Math.min(...nums)
      }
      case 'MAX': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        const nums = toNumbers(values)
        if (nums.length === 0) return 0
        return Math.max(...nums)
      }
      case 'MEDIAN': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        const nums = toNumbers(values).sort((a, b) => a - b)
        if (nums.length === 0) return EXCEL_ERRORS.NUM
        const mid = Math.floor(nums.length / 2)
        return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2
      }
      case 'MODE':
      case 'MODE.SNGL': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        const nums = toNumbers(values)
        if (nums.length === 0) return EXCEL_ERRORS.NA
        const counts = {}
        let maxCount = 0
        let mode = null
        for (const n of nums) {
          counts[n] = (counts[n] || 0) + 1
          if (counts[n] > maxCount) {
            maxCount = counts[n]
            mode = n
          }
        }
        if (maxCount <= 1) return EXCEL_ERRORS.NA
        return mode
      }
      case 'STDEV':
      case 'STDEV.S': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        const nums = toNumbers(values)
        if (nums.length <= 1) return EXCEL_ERRORS.DIV_ZERO
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length
        const sumSq = nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0)
        return Math.sqrt(sumSq / (nums.length - 1))
      }
      case 'STDEV.P': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        const nums = toNumbers(values)
        if (nums.length === 0) return EXCEL_ERRORS.DIV_ZERO
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length
        const sumSq = nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0)
        return Math.sqrt(sumSq / nums.length)
      }
      case 'VAR.S': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        const nums = toNumbers(values)
        if (nums.length <= 1) return EXCEL_ERRORS.DIV_ZERO
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length
        return nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (nums.length - 1)
      }
      case 'PRODUCT': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        const nums = toNumbers(values)
        if (nums.length === 0) return 0
        return nums.reduce((a, b) => a * b, 1)
      }
      case 'SUMPRODUCT': {
        if (args.length < 2) return EXCEL_ERRORS.VALUE
        const arrays = args.map(a => this.resolveArgumentValues(a))
        const len = arrays[0].length
        if (arrays.some(a => a.length !== len)) return EXCEL_ERRORS.VALUE
        let total = 0
        for (let i = 0; i < len; i++) {
          let prod = 1
          for (const arr of arrays) {
            const n = Number(arr[i])
            if (isNaN(n)) { prod = 0; break }
            prod *= n
          }
          total += prod
        }
        return total
      }
      case 'ROUND': {
        const num = Number(args[0])
        const dec = Number(args[1] ?? 0)
        if (isNaN(num) || isNaN(dec)) return EXCEL_ERRORS.VALUE
        const factor = Math.pow(10, dec)
        return Math.round(num * factor) / factor
      }
      case 'ROUNDUP': {
        const num = Number(args[0])
        const dec = Number(args[1] ?? 0)
        if (isNaN(num) || isNaN(dec)) return EXCEL_ERRORS.VALUE
        const factor = Math.pow(10, dec)
        return Math.ceil(num * factor) / factor
      }
      case 'ROUNDDOWN': {
        const num = Number(args[0])
        const dec = Number(args[1] ?? 0)
        if (isNaN(num) || isNaN(dec)) return EXCEL_ERRORS.VALUE
        const factor = Math.pow(10, dec)
        return Math.floor(num * factor) / factor
      }
      case 'ABS': {
        const num = Number(args[0])
        return isNaN(num) ? EXCEL_ERRORS.VALUE : Math.abs(num)
      }
      case 'SQRT': {
        const num = Number(args[0])
        if (isNaN(num) || num < 0) return EXCEL_ERRORS.NUM
        return Math.sqrt(num)
      }
      case 'POWER': {
        const base = Number(args[0])
        const exp = Number(args[1])
        if (isNaN(base) || isNaN(exp)) return EXCEL_ERRORS.VALUE
        return Math.pow(base, exp)
      }
      case 'MOD': {
        const n = Number(args[0])
        const d = Number(args[1])
        if (isNaN(n) || isNaN(d)) return EXCEL_ERRORS.VALUE
        if (d === 0) return EXCEL_ERRORS.DIV_ZERO
        return ((n % d) + d) % d
      }
      case 'INT': {
        const n = Number(args[0])
        return isNaN(n) ? EXCEL_ERRORS.VALUE : Math.floor(n)
      }

      // 2. Conditional Math (SUMIF, COUNTIF, AVERAGEIF, SUMIFS, COUNTIFS, AVERAGEIFS)
      case 'COUNTIF': {
        if (args.length < 2) return EXCEL_ERRORS.VALUE
        const range = this.resolveArgumentValues(args[0])
        const criterion = args[1]
        return range.filter(v => this.matchesCriterion(v, criterion)).length
      }
      case 'SUMIF': {
        if (args.length < 2) return EXCEL_ERRORS.VALUE
        const range = this.resolveArgumentValues(args[0])
        const criterion = args[1]
        const sumRange = args.length >= 3 ? this.resolveArgumentValues(args[2]) : range
        let total = 0
        for (let i = 0; i < range.length; i++) {
          if (this.matchesCriterion(range[i], criterion)) {
            const val = Number(sumRange[i])
            if (!isNaN(val)) total += val
          }
        }
        return total
      }
      case 'AVERAGEIF': {
        if (args.length < 2) return EXCEL_ERRORS.VALUE
        const range = this.resolveArgumentValues(args[0])
        const criterion = args[1]
        const avgRange = args.length >= 3 ? this.resolveArgumentValues(args[2]) : range
        let total = 0
        let count = 0
        for (let i = 0; i < range.length; i++) {
          if (this.matchesCriterion(range[i], criterion)) {
            const val = Number(avgRange[i])
            if (!isNaN(val)) {
              total += val
              count++
            }
          }
        }
        return count === 0 ? EXCEL_ERRORS.DIV_ZERO : total / count
      }
      case 'COUNTIFS': {
        if (args.length < 2 || args.length % 2 !== 0) return EXCEL_ERRORS.VALUE
        const ranges = []
        const criteria = []
        for (let i = 0; i < args.length; i += 2) {
          ranges.push(this.resolveArgumentValues(args[i]))
          criteria.push(args[i + 1])
        }
        const len = ranges[0].length
        let count = 0
        for (let idx = 0; idx < len; idx++) {
          let matchAll = true
          for (let k = 0; k < ranges.length; k++) {
            if (!this.matchesCriterion(ranges[k][idx], criteria[k])) {
              matchAll = false
              break
            }
          }
          if (matchAll) count++
        }
        return count
      }
      case 'SUMIFS': {
        if (args.length < 3 || (args.length - 1) % 2 !== 0) return EXCEL_ERRORS.VALUE
        const sumRange = this.resolveArgumentValues(args[0])
        const ranges = []
        const criteria = []
        for (let i = 1; i < args.length; i += 2) {
          ranges.push(this.resolveArgumentValues(args[i]))
          criteria.push(args[i + 1])
        }
        const len = sumRange.length
        let total = 0
        for (let idx = 0; idx < len; idx++) {
          let matchAll = true
          for (let k = 0; k < ranges.length; k++) {
            if (!this.matchesCriterion(ranges[k][idx], criteria[k])) {
              matchAll = false
              break
            }
          }
          if (matchAll) {
            const n = Number(sumRange[idx])
            if (!isNaN(n)) total += n
          }
        }
        return total
      }
      case 'AVERAGEIFS': {
        if (args.length < 3 || (args.length - 1) % 2 !== 0) return EXCEL_ERRORS.VALUE
        const avgRange = this.resolveArgumentValues(args[0])
        const ranges = []
        const criteria = []
        for (let i = 1; i < args.length; i += 2) {
          ranges.push(this.resolveArgumentValues(args[i]))
          criteria.push(args[i + 1])
        }
        const len = avgRange.length
        let total = 0
        let count = 0
        for (let idx = 0; idx < len; idx++) {
          let matchAll = true
          for (let k = 0; k < ranges.length; k++) {
            if (!this.matchesCriterion(ranges[k][idx], criteria[k])) {
              matchAll = false
              break
            }
          }
          if (matchAll) {
            const n = Number(avgRange[idx])
            if (!isNaN(n)) {
              total += n
              count++
            }
          }
        }
        return count === 0 ? EXCEL_ERRORS.DIV_ZERO : total / count
      }

      // 3. Logical Functions
      case 'IF': {
        if (args.length < 2) return EXCEL_ERRORS.VALUE
        const condition = Boolean(args[0])
        if (condition) return args[1]
        return args.length >= 3 ? args[2] : false
      }
      case 'IFS': {
        if (args.length < 2 || args.length % 2 !== 0) return EXCEL_ERRORS.VALUE
        for (let i = 0; i < args.length; i += 2) {
          if (args[i]) return args[i + 1]
        }
        return EXCEL_ERRORS.NA
      }
      case 'AND': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        return values.every(v => Boolean(v))
      }
      case 'OR': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        return values.some(v => Boolean(v))
      }
      case 'NOT': {
        return !args[0]
      }
      case 'XOR': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        const trueCount = values.filter(Boolean).length
        return trueCount % 2 === 1
      }
      case 'IFERROR': {
        if (args.length < 2) return EXCEL_ERRORS.VALUE
        const val = args[0]
        if (typeof val === 'string' && val.startsWith('#')) {
          return args[1]
        }
        return val
      }
      case 'SWITCH': {
        if (args.length < 3) return EXCEL_ERRORS.VALUE
        const target = args[0]
        let i = 1
        while (i < args.length - 1) {
          if (String(args[i]).toLowerCase() === String(target).toLowerCase()) {
            return args[i + 1]
          }
          i += 2
        }
        // If odd number of args left, last one is default
        if (i < args.length) return args[i]
        return EXCEL_ERRORS.NA
      }

      // 4. Lookup & Reference
      case 'VLOOKUP': {
        // VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])
        if (args.length < 3) return EXCEL_ERRORS.VALUE
        const lookupVal = args[0]
        const tableStr = args[1]
        const colIdx = Number(args[2])
        const exactMatch = args.length >= 4 ? !args[3] : false // Default in Excel is TRUE (approx match)

        if (isNaN(colIdx) || colIdx < 1) return EXCEL_ERRORS.VALUE
        const matrix = this.resolve2DMatrix(tableStr)
        if (matrix.length === 0 || colIdx > matrix[0].length) return EXCEL_ERRORS.REF

        for (let r = 0; r < matrix.length; r++) {
          const rowKey = matrix[r][0]
          if (this.equalsOrMatches(rowKey, lookupVal, exactMatch)) {
            return matrix[r][colIdx - 1]
          }
        }
        return EXCEL_ERRORS.NA
      }
      case 'HLOOKUP': {
        // HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])
        if (args.length < 3) return EXCEL_ERRORS.VALUE
        const lookupVal = args[0]
        const tableStr = args[1]
        const rowIdx = Number(args[2])
        const exactMatch = args.length >= 4 ? !args[3] : false

        if (isNaN(rowIdx) || rowIdx < 1) return EXCEL_ERRORS.VALUE
        const matrix = this.resolve2DMatrix(tableStr)
        if (matrix.length === 0 || rowIdx > matrix.length) return EXCEL_ERRORS.REF

        const numCols = matrix[0].length
        for (let c = 0; c < numCols; c++) {
          const colKey = matrix[0][c]
          if (this.equalsOrMatches(colKey, lookupVal, exactMatch)) {
            return matrix[rowIdx - 1][c]
          }
        }
        return EXCEL_ERRORS.NA
      }
      case 'INDEX': {
        // INDEX(array, row_num, [col_num])
        if (args.length < 2) return EXCEL_ERRORS.VALUE
        const matrix = this.resolve2DMatrix(args[0])
        if (matrix.length === 0) return EXCEL_ERRORS.REF
        const rowNum = Number(args[1])
        const colNum = args.length >= 3 ? Number(args[2]) : 1

        if (isNaN(rowNum) || rowNum < 1 || rowNum > matrix.length) return EXCEL_ERRORS.REF
        if (isNaN(colNum) || colNum < 1 || colNum > matrix[0].length) return EXCEL_ERRORS.REF

        return matrix[rowNum - 1][colNum - 1]
      }
      case 'MATCH': {
        // MATCH(lookup_value, lookup_array, [match_type])
        // match_type: 0 exact, 1 less than (sorted), -1 greater than
        if (args.length < 2) return EXCEL_ERRORS.VALUE
        const lookupVal = args[0]
        const arr = this.resolveArgumentValues(args[1])
        const matchType = args.length >= 3 ? Number(args[2]) : 1

        for (let i = 0; i < arr.length; i++) {
          if (matchType === 0) {
            if (this.equalsOrMatches(arr[i], lookupVal, true)) return i + 1
          } else {
            if (String(arr[i]).toLowerCase() === String(lookupVal).toLowerCase()) return i + 1
          }
        }
        return EXCEL_ERRORS.NA
      }
      case 'XLOOKUP': {
        // XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])
        if (args.length < 3) return EXCEL_ERRORS.VALUE
        const lookupVal = args[0]
        const lookupArr = this.resolveArgumentValues(args[1])
        const returnArr = this.resolveArgumentValues(args[2])
        const ifNotFound = args.length >= 4 ? args[3] : EXCEL_ERRORS.NA

        for (let i = 0; i < lookupArr.length; i++) {
          if (this.equalsOrMatches(lookupArr[i], lookupVal, true)) {
            return i < returnArr.length ? returnArr[i] : EXCEL_ERRORS.REF
          }
        }
        return ifNotFound
      }

      // 5. Text Functions
      case 'CONCAT':
      case 'CONCATENATE': {
        const values = args.flatMap(a => this.resolveArgumentValues(a))
        return values.map(v => (v === null || v === undefined ? '' : String(v))).join('')
      }
      case 'TEXTJOIN': {
        // TEXTJOIN(delimiter, ignore_empty, text1, ...)
        if (args.length < 3) return EXCEL_ERRORS.VALUE
        const delimiter = String(args[0])
        const ignoreEmpty = Boolean(args[1])
        const textArgs = args.slice(2).flatMap(a => this.resolveArgumentValues(a))
        const filtered = textArgs.filter(t => !ignoreEmpty || (t !== null && t !== undefined && String(t).trim() !== ''))
        return filtered.join(delimiter)
      }
      case 'LEFT': {
        const str = String(args[0] ?? '')
        const len = args.length >= 2 ? Number(args[1]) : 1
        if (isNaN(len) || len < 0) return EXCEL_ERRORS.VALUE
        return str.slice(0, len)
      }
      case 'RIGHT': {
        const str = String(args[0] ?? '')
        const len = args.length >= 2 ? Number(args[1]) : 1
        if (isNaN(len) || len < 0) return EXCEL_ERRORS.VALUE
        return len >= str.length ? str : str.slice(str.length - len)
      }
      case 'MID': {
        const str = String(args[0] ?? '')
        const start = Number(args[1])
        const len = Number(args[2])
        if (isNaN(start) || isNaN(len) || start < 1 || len < 0) return EXCEL_ERRORS.VALUE
        return str.substr(start - 1, len)
      }
      case 'LEN': {
        return String(args[0] ?? '').length
      }
      case 'TRIM': {
        return String(args[0] ?? '').trim().replace(/\s+/g, ' ')
      }
      case 'UPPER': {
        return String(args[0] ?? '').toUpperCase()
      }
      case 'LOWER': {
        return String(args[0] ?? '').toLowerCase()
      }
      case 'PROPER': {
        return String(args[0] ?? '')
          .toLowerCase()
          .replace(/(?:^|\s)\S/g, a => a.toUpperCase())
      }
      case 'FIND': {
        // Case sensitive: FIND(find_text, within_text, [start_num])
        const findText = String(args[0] ?? '')
        const withinText = String(args[1] ?? '')
        const start = args.length >= 3 ? Number(args[2]) : 1
        const idx = withinText.indexOf(findText, start - 1)
        return idx === -1 ? EXCEL_ERRORS.VALUE : idx + 1
      }
      case 'SEARCH': {
        // Case-insensitive: SEARCH(find_text, within_text, [start_num])
        const findText = String(args[0] ?? '').toLowerCase()
        const withinText = String(args[1] ?? '').toLowerCase()
        const start = args.length >= 3 ? Number(args[2]) : 1
        const idx = withinText.indexOf(findText, start - 1)
        return idx === -1 ? EXCEL_ERRORS.VALUE : idx + 1
      }
      case 'SUBSTITUTE': {
        // SUBSTITUTE(text, old_text, new_text, [instance_num])
        const str = String(args[0] ?? '')
        const oldText = String(args[1] ?? '')
        const newText = String(args[2] ?? '')
        if (args.length >= 4) {
          const inst = Number(args[3])
          let count = 0
          return str.replace(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), (match) => {
            count++
            return count === inst ? newText : match
          })
        }
        return str.split(oldText).join(newText)
      }
      case 'VALUE': {
        const n = Number(String(args[0] ?? '').replace(/[$,]/g, ''))
        return isNaN(n) ? EXCEL_ERRORS.VALUE : n
      }
      case 'TEXT': {
        const val = args[0]
        const format = String(args[1] ?? '')
        return this.formatNumberByPattern(val, format)
      }

      // 6. Date & Time Functions
      case 'TODAY': {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      case 'NOW': {
        return new Date().toISOString()
      }
      case 'DATE': {
        const year = Number(args[0])
        const month = Number(args[1])
        const day = Number(args[2])
        if (isNaN(year) || isNaN(month) || isNaN(day)) return EXCEL_ERRORS.VALUE
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
      case 'YEAR': {
        const d = new Date(args[0])
        return isNaN(d.getTime()) ? EXCEL_ERRORS.VALUE : d.getFullYear()
      }
      case 'MONTH': {
        const d = new Date(args[0])
        return isNaN(d.getTime()) ? EXCEL_ERRORS.VALUE : d.getMonth() + 1
      }
      case 'DAY': {
        const d = new Date(args[0])
        return isNaN(d.getTime()) ? EXCEL_ERRORS.VALUE : d.getDate()
      }
      case 'DAYS': {
        const d1 = new Date(args[0])
        const d2 = new Date(args[1])
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return EXCEL_ERRORS.VALUE
        const diffMs = d1.getTime() - d2.getTime()
        return Math.round(diffMs / (1000 * 60 * 60 * 24))
      }
      case 'DATEDIF': {
        const start = new Date(args[0])
        const end = new Date(args[1])
        const unit = String(args[2] ?? 'D').toUpperCase()
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return EXCEL_ERRORS.NUM
        if (unit === 'D') return Math.round((end - start) / (1000 * 60 * 60 * 24))
        if (unit === 'Y') return end.getFullYear() - start.getFullYear()
        if (unit === 'M') return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
        return EXCEL_ERRORS.VALUE
      }
      case 'EDATE': {
        const d = new Date(args[0])
        const months = Number(args[1])
        if (isNaN(d.getTime()) || isNaN(months)) return EXCEL_ERRORS.VALUE
        d.setMonth(d.getMonth() + months)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      case 'EOMONTH': {
        const d = new Date(args[0])
        const months = Number(args[1])
        if (isNaN(d.getTime()) || isNaN(months)) return EXCEL_ERRORS.VALUE
        // Setting day to 0 of the next month gets end of month
        const target = new Date(d.getFullYear(), d.getMonth() + months + 1, 0)
        return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
      }
      case 'WEEKDAY': {
        const d = new Date(args[0])
        if (isNaN(d.getTime())) return EXCEL_ERRORS.VALUE
        // 1 = Sunday, 7 = Saturday
        return d.getDay() + 1
      }

      // 7. Advanced Analytics (CORREL, PERCENTILE, QUARTILE)
      case 'CORREL': {
        const arr1 = toNumbers(this.resolveArgumentValues(args[0]))
        const arr2 = toNumbers(this.resolveArgumentValues(args[1]))
        if (arr1.length === 0 || arr1.length !== arr2.length) return EXCEL_ERRORS.DIV_ZERO
        const n = arr1.length
        const mean1 = arr1.reduce((a, b) => a + b, 0) / n
        const mean2 = arr2.reduce((a, b) => a + b, 0) / n
        let num = 0
        let den1 = 0
        let den2 = 0
        for (let i = 0; i < n; i++) {
          const d1 = arr1[i] - mean1
          const d2 = arr2[i] - mean2
          num += d1 * d2
          den1 += d1 * d1
          den2 += d2 * d2
        }
        if (den1 === 0 || den2 === 0) return EXCEL_ERRORS.DIV_ZERO
        return num / Math.sqrt(den1 * den2)
      }
      case 'PERCENTILE':
      case 'PERCENTILE.INC': {
        const nums = toNumbers(this.resolveArgumentValues(args[0])).sort((a, b) => a - b)
        const k = Number(args[1])
        if (nums.length === 0 || isNaN(k) || k < 0 || k > 1) return EXCEL_ERRORS.NUM
        const index = k * (nums.length - 1)
        const lower = Math.floor(index)
        const upper = Math.ceil(index)
        const weight = index - lower
        return nums[lower] * (1 - weight) + nums[upper] * weight
      }
      case 'QUARTILE':
      case 'QUARTILE.INC': {
        const nums = toNumbers(this.resolveArgumentValues(args[0])).sort((a, b) => a - b)
        const quart = Number(args[1])
        if (nums.length === 0 || isNaN(quart) || quart < 0 || quart > 4) return EXCEL_ERRORS.NUM
        const k = quart / 4
        const index = k * (nums.length - 1)
        const lower = Math.floor(index)
        const upper = Math.ceil(index)
        const weight = index - lower
        return nums[lower] * (1 - weight) + nums[upper] * weight
      }

      default:
        return EXCEL_ERRORS.NAME
    }
  }

  matchesCriterion(val, criterion) {
    if (criterion === undefined || criterion === null) return false
    const critStr = String(criterion).trim()

    // Operator prefix: >=, <=, <>, >, <, =
    const opMatch = critStr.match(/^([><]=?|<>|=)(.*)$/)
    if (opMatch) {
      const op = opMatch[1]
      const targetStr = opMatch[2].trim()
      const nVal = Number(val)
      const nTarget = Number(targetStr)
      if (!isNaN(nVal) && !isNaN(nTarget)) {
        return this.compareValues(nVal, nTarget, op)
      }
      return this.compareValues(String(val), targetStr, op)
    }

    // Wildcard matching with * or ?
    if (critStr.includes('*') || critStr.includes('?')) {
      const regexStr = '^' + critStr.replace(/([.+^${}()|[\]\\])/g, '\\$1')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') + '$'
      const re = new RegExp(regexStr, 'i')
      return re.test(String(val))
    }

    // Exact equality (case-insensitive for strings)
    const nVal = Number(val)
    const nCrit = Number(critStr)
    if (!isNaN(nVal) && !isNaN(nCrit) && critStr !== '') {
      return nVal === nCrit
    }
    return String(val).toLowerCase() === critStr.toLowerCase()
  }

  equalsOrMatches(val1, val2, _exact = true) {
    if (val1 === val2) return true
    if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) return false

    const n1 = Number(val1)
    const n2 = Number(val2)
    if (!isNaN(n1) && !isNaN(n2)) return n1 === n2

    const s1 = String(val1).trim().toLowerCase()
    const s2 = String(val2).trim().toLowerCase()
    return s1 === s2
  }

  formatNumberByPattern(value, pattern) {
    const num = Number(value)
    if (isNaN(num)) return String(value)
    if (pattern.includes('%')) {
      return (num * 100).toFixed(1) + '%'
    }
    if (pattern.includes('$')) {
      return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    if (pattern.includes('.')) {
      const decimals = pattern.split('.')[1].length
      return num.toFixed(decimals)
    }
    return String(Math.round(num))
  }
}

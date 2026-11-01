import { describe, it, expect } from 'vitest'
import { SheetModel } from './sheetModel'
import { colLetterToIndex, colIndexToLetter, parseCellReference, parseRangeReference } from './formulaParser'

describe('Excel Formula Parser & Reference Helpers', () => {
  it('converts column letters and indices accurately', () => {
    expect(colLetterToIndex('A')).toBe(0)
    expect(colLetterToIndex('Z')).toBe(25)
    expect(colLetterToIndex('AA')).toBe(26)
    expect(colLetterToIndex('AB')).toBe(27)

    expect(colIndexToLetter(0)).toBe('A')
    expect(colIndexToLetter(25)).toBe('Z')
    expect(colIndexToLetter(26)).toBe('AA')
    expect(colIndexToLetter(27)).toBe('AB')
  })

  it('parses single cell references and absolute dollar signs', () => {
    expect(parseCellReference('A1')).toEqual({ col: 0, row: 0, absCol: false, absRow: false })
    expect(parseCellReference('$B$10')).toEqual({ col: 1, row: 9, absCol: true, absRow: true })
    expect(parseCellReference('C$5')).toEqual({ col: 2, row: 4, absCol: false, absRow: true })
    expect(parseCellReference('$D8')).toEqual({ col: 3, row: 7, absCol: true, absRow: false })
    expect(parseCellReference('invalid')).toBeNull()
  })

  it('parses range references', () => {
    expect(parseRangeReference('A1:C5')).toEqual({
      startCol: 0,
      startRow: 0,
      endCol: 2,
      endRow: 4,
    })
    expect(parseRangeReference('B10:A2')).toEqual({
      startCol: 0,
      startRow: 1,
      endCol: 1,
      endRow: 9,
    })
  })
})

describe('SheetModel Formula Execution', () => {
  it('evaluates basic arithmetic and cell references', () => {
    const sheet = new SheetModel()
    sheet.setCellValue(0, 0, 10) // A1 = 10
    sheet.setCellValue(0, 1, 25) // A2 = 25
    sheet.setCellValue(0, 2, '=A1 + A2 * 2') // A3 = 10 + 25 * 2 = 60

    expect(sheet.getCell(0, 2).value).toBe(60)
  })

  it('evaluates mathematical & statistical functions SUM, AVERAGE, MIN, MAX, COUNT', () => {
    const sheet = new SheetModel()
    sheet.loadData([
      [10, 20, 30],
      [40, 50, 60],
    ]) // A1:C2

    sheet.setCellValue(0, 2, '=SUM(A1:C2)')
    expect(sheet.getCell(0, 2).value).toBe(210)

    sheet.setCellValue(1, 2, '=AVERAGE(A1:C2)')
    expect(sheet.getCell(1, 2).value).toBe(35)

    sheet.setCellValue(2, 2, '=MAX(A1:C2)')
    expect(sheet.getCell(2, 2).value).toBe(60)

    sheet.setCellValue(3, 2, '=MIN(A1:C2)')
    expect(sheet.getCell(3, 2).value).toBe(10)

    sheet.setCellValue(4, 2, '=COUNT(A1:C2)')
    expect(sheet.getCell(4, 2).value).toBe(6)
  })

  it('evaluates conditional aggregations SUMIF, COUNTIF, and SUMIFS', () => {
    const sheet = new SheetModel()
    sheet.loadData([
      ['Category', 'Amount'],
      ['Apples', 100],
      ['Oranges', 50],
      ['Apples', 200],
      ['Bananas', 75],
    ])

    sheet.setCellValue(2, 1, '=SUMIF(A2:A5, "Apples", B2:B5)')
    expect(sheet.getCell(2, 1).value).toBe(300)

    sheet.setCellValue(2, 2, '=COUNTIF(B2:B5, ">70")')
    expect(sheet.getCell(2, 2).value).toBe(3) // 100, 200, 75

    sheet.setCellValue(2, 3, '=SUMIFS(B2:B5, A2:A5, "Apples", B2:B5, ">150")')
    expect(sheet.getCell(2, 3).value).toBe(200)
  })

  it('evaluates logical functions IF, IFS, AND, OR, IFERROR', () => {
    const sheet = new SheetModel()
    sheet.setCellValue(0, 0, 85) // A1 = 85

    sheet.setCellValue(0, 1, '=IF(A1 >= 80, "Pass", "Fail")')
    expect(sheet.getCell(0, 1).value).toBe('Pass')

    sheet.setCellValue(0, 2, '=IFS(A1 >= 90, "A", A1 >= 80, "B", A1 >= 70, "C")')
    expect(sheet.getCell(0, 2).value).toBe('B')

    sheet.setCellValue(0, 3, '=IFERROR(10 / 0, "Safe")')
    expect(sheet.getCell(0, 3).value).toBe('Safe')
  })

  it('evaluates VLOOKUP and XLOOKUP', () => {
    const sheet = new SheetModel()
    sheet.loadData([
      ['SKU', 'Product', 'Price'],
      ['A101', 'Widget', 15.5],
      ['B202', 'Gadget', 42.0],
      ['C303', 'Doohickey', 9.99],
    ])

    sheet.setCellValue(3, 1, '=VLOOKUP("B202", A2:C4, 2, FALSE)')
    expect(sheet.getCell(3, 1).value).toBe('Gadget')

    sheet.setCellValue(3, 2, '=VLOOKUP("B202", A2:C4, 3, FALSE)')
    expect(sheet.getCell(3, 2).value).toBe(42.0)

    sheet.setCellValue(3, 3, '=XLOOKUP("C303", A2:A4, B2:B4, "Not Found")')
    expect(sheet.getCell(3, 3).value).toBe('Doohickey')

    sheet.setCellValue(3, 4, '=XLOOKUP("Z999", A2:A4, B2:B4, "Not Found")')
    expect(sheet.getCell(3, 4).value).toBe('Not Found')
  })

  it('evaluates two-way INDEX and MATCH', () => {
    const sheet = new SheetModel()
    sheet.loadData([
      ['Dept', 'Q1', 'Q2'],
      ['Sales', 100, 120],
      ['Marketing', 50, 80],
    ])

    // MATCH row for Marketing:
    sheet.setCellValue(3, 0, '=MATCH("Marketing", A1:A3, 0)')
    expect(sheet.getCell(3, 0).value).toBe(3)

    // INDEX row 3, col 2 = 50
    sheet.setCellValue(3, 1, '=INDEX(A1:C3, MATCH("Marketing", A1:A3, 0), 2)')
    expect(sheet.getCell(3, 1).value).toBe(50)
  })

  it('evaluates text cleaning functions TRIM, UPPER, CONCAT, TEXTJOIN', () => {
    const sheet = new SheetModel()
    sheet.setCellValue(0, 0, '  data  analytics  ')
    sheet.setCellValue(0, 1, '=TRIM(A1)')
    expect(sheet.getCell(0, 1).value).toBe('data analytics')

    sheet.setCellValue(0, 2, '=UPPER(A2)')
    expect(sheet.getCell(0, 2).value).toBe('DATA ANALYTICS')

    sheet.setCellValue(0, 3, '=TEXTJOIN("-", TRUE, "2026", "Q3", "Report")')
    expect(sheet.getCell(0, 3).value).toBe('2026-Q3-Report')
  })

  it('evaluates date calculations DATEDIF and EDATE', () => {
    const sheet = new SheetModel()
    sheet.setCellValue(0, 0, '2026-01-01')
    sheet.setCellValue(0, 1, '2026-01-15')
    sheet.setCellValue(0, 2, '=DATEDIF(A1, A2, "D")')
    expect(sheet.getCell(0, 2).value).toBe(14)
  })

  it('handles circular references gracefully without stack overflow', () => {
    const sheet = new SheetModel()
    sheet.setCellValue(0, 0, '=B1') // A1 = B1
    sheet.setCellValue(1, 0, '=A1') // B1 = A1
    expect(sheet.getCell(0, 0).value).toBe('#CIRCULAR!')
  })
})

describe('SheetModel Data Analytics & Pivot Tables', () => {
  it('computes descriptive statistics accurately', () => {
    const sheet = new SheetModel()
    sheet.loadData([
      [10], [20], [30], [40], [50]
    ])

    const stats = sheet.computeDescriptiveStats('A1:A5')
    expect(stats).not.toBeNull()
    expect(stats.count).toBe(5)
    expect(stats.sum).toBe(150)
    expect(stats.mean).toBe(30)
    expect(stats.median).toBe(30)
    expect(stats.min).toBe(10)
    expect(stats.max).toBe(50)
    expect(stats.range).toBe(40)
  })

  it('computes pivot table aggregations accurately', () => {
    const sheet = new SheetModel()
    sheet.loadData([
      ['Region', 'Sales'],
      ['North', 100],
      ['South', 200],
      ['North', 150],
      ['South', 300],
      ['East', 50],
    ])

    const pivot = sheet.computePivotTable({
      rangeStr: 'A1:B6',
      rowFieldCol: 0,
      valFieldCol: 1,
      aggFunction: 'SUM',
    })

    expect(pivot).not.toBeNull()
    expect(pivot.rows.find(r => r.rowKey === 'North').value).toBe(250)
    expect(pivot.rows.find(r => r.rowKey === 'South').value).toBe(500)
    expect(pivot.rows.find(r => r.rowKey === 'East').value).toBe(50)
    expect(pivot.grandTotal).toBe(800)
  })

  it('supports CSV import and export', () => {
    const sheet = new SheetModel()
    const csv = `Item,Price,Qty\nApples,2.5,10\nOranges,3.0,5`
    sheet.importCsv(csv)

    expect(sheet.getCell(0, 0).value).toBe('Item')
    expect(sheet.getCell(1, 1).value).toBe(2.5)
    expect(sheet.getCell(2, 2).value).toBe(5)

    const exported = sheet.exportCsv()
    expect(exported).toContain('Item,Price,Qty')
    expect(exported).toContain('Apples,2.5,10')
  })
})

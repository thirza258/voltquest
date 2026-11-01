import { useState } from 'react'
import { Search, X, BookOpen } from 'lucide-react'

export const FUNCTION_CATALOG = [
  // Math & Statistics
  {
    name: 'SUM',
    category: 'Math & Statistics',
    syntax: 'SUM(number1, [number2], ...)',
    desc: 'Adds all numbers in a range of cells, ignoring text values.',
    example: '=SUM(D2:D10)',
  },
  {
    name: 'AVERAGE',
    category: 'Math & Statistics',
    syntax: 'AVERAGE(number1, [number2], ...)',
    desc: 'Calculates the arithmetic mean of numeric cells in a range.',
    example: '=AVERAGE(E2:E20)',
  },
  {
    name: 'COUNT',
    category: 'Math & Statistics',
    syntax: 'COUNT(value1, [value2], ...)',
    desc: 'Tallies the number of cells in a range containing numeric or date values.',
    example: '=COUNT(B2:B50)',
  },
  {
    name: 'COUNTA',
    category: 'Math & Statistics',
    syntax: 'COUNTA(value1, [value2], ...)',
    desc: 'Tallies all non-empty cells in a range (text, numbers, booleans, errors).',
    example: '=COUNTA(A2:A100)',
  },
  {
    name: 'MIN',
    category: 'Math & Statistics',
    syntax: 'MIN(number1, [number2], ...)',
    desc: 'Returns the smallest numeric value in a dataset.',
    example: '=MIN(C2:C50)',
  },
  {
    name: 'MAX',
    category: 'Math & Statistics',
    syntax: 'MAX(number1, [number2], ...)',
    desc: 'Returns the largest numeric value in a dataset.',
    example: '=MAX(C2:C50)',
  },
  {
    name: 'ROUND',
    category: 'Math & Statistics',
    syntax: 'ROUND(number, num_digits)',
    desc: 'Rounds a number to a specified number of decimal places.',
    example: '=ROUND(A1 * 1.0825, 2)',
  },
  {
    name: 'PRODUCT',
    category: 'Math & Statistics',
    syntax: 'PRODUCT(number1, [number2], ...)',
    desc: 'Multiplies all numerical values supplied in the range.',
    example: '=PRODUCT(B2:D2)',
  },
  {
    name: 'SUMPRODUCT',
    category: 'Math & Statistics',
    syntax: 'SUMPRODUCT(array1, array2, ...)',
    desc: 'Multiplies corresponding components in given arrays and returns the sum of products.',
    example: '=SUMPRODUCT(D2:D10, E2:E10)',
  },

  // Conditional Aggregations
  {
    name: 'SUMIF',
    category: 'Conditional Math',
    syntax: 'SUMIF(range, criteria, [sum_range])',
    desc: 'Adds the cells specified by a condition or criterion.',
    example: '=SUMIF(A2:A50, "Engineering", E2:E50)',
  },
  {
    name: 'COUNTIF',
    category: 'Conditional Math',
    syntax: 'COUNTIF(range, criteria)',
    desc: 'Counts the number of cells within a range that meet the given criterion.',
    example: '=COUNTIF(Status_Range, "Active")',
  },
  {
    name: 'AVERAGEIF',
    category: 'Conditional Math',
    syntax: 'AVERAGEIF(range, criteria, [average_range])',
    desc: 'Calculates the average (arithmetic mean) for cells that satisfy a criterion.',
    example: '=AVERAGEIF(Region_Col, "West", Revenue_Col)',
  },
  {
    name: 'SUMIFS',
    category: 'Conditional Math',
    syntax: 'SUMIFS(sum_range, criteria_range1, criteria1, [criteria_range2, criteria2], ...)',
    desc: 'Adds cells in a range that meet multiple criteria across multiple ranges.',
    example: '=SUMIFS(Sales, Region, "West", Year, 2026)',
  },
  {
    name: 'COUNTIFS',
    category: 'Conditional Math',
    syntax: 'COUNTIFS(criteria_range1, criteria1, [criteria_range2, criteria2], ...)',
    desc: 'Counts the number of rows that satisfy multiple conditions simultaneously.',
    example: '=COUNTIFS(Department, "Sales", Overtime, ">10000")',
  },
  {
    name: 'AVERAGEIFS',
    category: 'Conditional Math',
    syntax: 'AVERAGEIFS(avg_range, criteria_range1, criteria1, ...)',
    desc: 'Calculates the average for cells that satisfy multiple conditions.',
    example: '=AVERAGEIFS(Salary, Dept, "Sales", Status, "Active")',
  },

  // Lookup & Reference
  {
    name: 'VLOOKUP',
    category: 'Lookup & Reference',
    syntax: 'VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])',
    desc: 'Searches down the 1st column of a table and returns a value from the specified column.',
    example: '=VLOOKUP(A2, Catalog!A2:E100, 3, FALSE)',
  },
  {
    name: 'HLOOKUP',
    category: 'Lookup & Reference',
    syntax: 'HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])',
    desc: 'Searches across the 1st row of a table and returns a value from the specified row.',
    example: '=HLOOKUP("Q3", Table!A1:Z5, 4, FALSE)',
  },
  {
    name: 'INDEX',
    category: 'Lookup & Reference',
    syntax: 'INDEX(array, row_num, [col_num])',
    desc: 'Returns a value or reference of the cell at the intersection of a row and column.',
    example: '=INDEX(Prices, 4, 1)',
  },
  {
    name: 'MATCH',
    category: 'Lookup & Reference',
    syntax: 'MATCH(lookup_value, lookup_array, [match_type])',
    desc: 'Returns the relative position of an item in an array that matches a specified value.',
    example: '=MATCH(Target_SKU, SKU_Col, 0)',
  },
  {
    name: 'XLOOKUP',
    category: 'Lookup & Reference',
    syntax: 'XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode])',
    desc: 'Modern lookup function: searches a range and returns corresponding item from another range.',
    example: '=XLOOKUP(B2, SKU_List, Price_List, "Not Found")',
  },

  // Logical Functions
  {
    name: 'IF',
    category: 'Logic & Control',
    syntax: 'IF(logical_test, value_if_true, [value_if_false])',
    desc: 'Checks whether a condition is met, and returns one value if TRUE, and another if FALSE.',
    example: '=IF(B2 >= 100, "Bonus", "Standard")',
  },
  {
    name: 'IFS',
    category: 'Logic & Control',
    syntax: 'IFS(logical_test1, value1, [logical_test2, value2], ...)',
    desc: 'Checks multiple conditions and returns the value corresponding to the first TRUE condition.',
    example: '=IFS(A1>=90, "A", A1>=80, "B", A1>=70, "C", TRUE, "D")',
  },
  {
    name: 'AND',
    category: 'Logic & Control',
    syntax: 'AND(logical1, [logical2], ...)',
    desc: 'Returns TRUE if all arguments evaluate to TRUE.',
    example: '=AND(Score >= 70, Attendance >= 0.85)',
  },
  {
    name: 'OR',
    category: 'Logic & Control',
    syntax: 'OR(logical1, [logical2], ...)',
    desc: 'Returns TRUE if any argument evaluates to TRUE.',
    example: '=OR(VIP_Status = TRUE, Total_Spend > 1000)',
  },
  {
    name: 'IFERROR',
    category: 'Logic & Control',
    syntax: 'IFERROR(value, value_if_error)',
    desc: 'Returns value_if_error if formula evaluates to an error; otherwise returns the formula result.',
    example: '=IFERROR(VLOOKUP(...), "Not Found")',
  },

  // Text & Cleaning
  {
    name: 'TRIM',
    category: 'Text & Cleaning',
    syntax: 'TRIM(text)',
    desc: 'Removes all spaces from text string except for single spaces between words.',
    example: '=TRIM(A2)',
  },
  {
    name: 'PROPER',
    category: 'Text & Cleaning',
    syntax: 'PROPER(text)',
    desc: 'Capitalizes the first letter in each word of a text value.',
    example: '=PROPER(B2)',
  },
  {
    name: 'CONCAT',
    category: 'Text & Cleaning',
    syntax: 'CONCAT(text1, [text2], ...)',
    desc: 'Combines the text from multiple ranges and/or strings.',
    example: '=CONCAT(A2, "-", B2)',
  },
  {
    name: 'TEXTJOIN',
    category: 'Text & Cleaning',
    syntax: 'TEXTJOIN(delimiter, ignore_empty, text1, ...)',
    desc: 'Combines multiple text strings with a custom separator, optionally ignoring blanks.',
    example: '=TEXTJOIN(", ", TRUE, A2:A10)',
  },
  {
    name: 'LEFT',
    category: 'Text & Cleaning',
    syntax: 'LEFT(text, [num_chars])',
    desc: 'Returns the first character or characters in a text string.',
    example: '=LEFT(SKU_Cell, 3)',
  },
  {
    name: 'MID',
    category: 'Text & Cleaning',
    syntax: 'MID(text, start_num, num_chars)',
    desc: 'Returns a specific number of characters from a text string, starting at the position specified.',
    example: '=MID(Order_ID, 5, 4)',
  },

  // Date & Time
  {
    name: 'TODAY',
    category: 'Date & Time',
    syntax: 'TODAY()',
    desc: 'Returns the current computer date as a serial date.',
    example: '=TODAY()',
  },
  {
    name: 'DATE',
    category: 'Date & Time',
    syntax: 'DATE(year, month, day)',
    desc: 'Constructs a valid serial date from numerical year, month, and day components.',
    example: '=DATE(2026, 6, 15)',
  },
  {
    name: 'DATEDIF',
    category: 'Date & Time',
    syntax: 'DATEDIF(start_date, end_date, unit)',
    desc: 'Calculates the number of days ("D"), months ("M"), or years ("Y") between two dates.',
    example: '=DATEDIF(Invoice_Date, Paid_Date, "D")',
  },
  {
    name: 'EDATE',
    category: 'Date & Time',
    syntax: 'EDATE(start_date, months)',
    desc: 'Returns the serial number of the date that is the indicated number of months before or after start_date.',
    example: '=EDATE(A1, 3)',
  },
  {
    name: 'EOMONTH',
    category: 'Date & Time',
    syntax: 'EOMONTH(start_date, months)',
    desc: 'Returns the serial number for the last day of the month that is the indicated number of months away.',
    example: '=EOMONTH(A1, 0)',
  },

  // Exploratory Analytics
  {
    name: 'MEDIAN',
    category: 'Exploratory Analytics',
    syntax: 'MEDIAN(number1, [number2], ...)',
    desc: 'Returns the median or middle value of the numbers in a set.',
    example: '=MEDIAN(Salary_Range)',
  },
  {
    name: 'STDEV.S',
    category: 'Exploratory Analytics',
    syntax: 'STDEV.S(number1, [number2], ...)',
    desc: 'Estimates standard deviation based on a sample (sample variance square root).',
    example: '=STDEV.S(Revenue_Col)',
  },
  {
    name: 'CORREL',
    category: 'Exploratory Analytics',
    syntax: 'CORREL(array1, array2)',
    desc: 'Returns the Pearson correlation coefficient between two measurement ranges.',
    example: '=CORREL(Ad_Spend, Sales_Revenue)',
  },
  {
    name: 'PERCENTILE.INC',
    category: 'Exploratory Analytics',
    syntax: 'PERCENTILE.INC(array, k)',
    desc: 'Returns the k-th percentile of values in a range, where k is in the range 0..1 inclusive.',
    example: '=PERCENTILE.INC(Response_Times, 0.90)',
  },
  {
    name: 'QUARTILE.INC',
    category: 'Exploratory Analytics',
    syntax: 'QUARTILE.INC(array, quart)',
    desc: 'Returns the quartile of a data set (1 = 25th percentile, 3 = 75th percentile).',
    example: '=QUARTILE.INC(Revenue_Col, 3)',
  },
]

export default function ExcelFunctionDirectoryModal({ isOpen, onClose, onSelectFunction }) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  if (!isOpen) return null

  const categories = ['All', ...new Set(FUNCTION_CATALOG.map((f) => f.category))]

  const filtered = FUNCTION_CATALOG.filter((fn) => {
    const matchesSearch =
      fn.name.toLowerCase().includes(search.toLowerCase()) ||
      fn.desc.toLowerCase().includes(search.toLowerCase()) ||
      fn.syntax.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || fn.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-slate-100">Excel Function Library & Reference</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="border-b border-slate-800 bg-slate-950/60 p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search functions (e.g. SUM, VLOOKUP, XLOOKUP, IF)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-4 text-sm text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Function List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No functions matching your query.</p>
          ) : (
            filtered.map((fn) => (
              <div
                key={fn.name}
                className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 transition hover:border-slate-700 hover:bg-slate-800/60"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-emerald-400">{fn.name}</span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        {fn.category}
                      </span>
                    </div>
                    <code className="mt-1 block font-mono text-xs text-sky-300">{fn.syntax}</code>
                  </div>
                  {onSelectFunction && (
                    <button
                      onClick={() => {
                        onSelectFunction(fn)
                        onClose()
                      }}
                      className="rounded bg-emerald-600/30 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-600 hover:text-white"
                    >
                      Insert fx
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-300">{fn.desc}</p>
                <div className="mt-2 rounded bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-400">
                  <span className="text-slate-500">Example: </span>
                  <span className="text-amber-300">{fn.example}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/80 px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  )
}

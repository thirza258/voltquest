# Microsoft Excel & Data Analytics Curriculum and Simulator

`/excel` and `/excel/:lessonId` provide ten comprehensive courses in Microsoft Excel and Data Analytics.
Each course features four detailed theory checkpoints with embedded practice checks, a guided business
dataset lab, an applied challenge, and a five-question 80% certification exam issuing verifiable,
server-signed PDF certificates.

`/sandbox?bench=excel` opens the standalone Microsoft Excel spreadsheet simulator IDE.

## 1. Curriculum Architecture

1. **`excel-foundations`**: **Excel Foundations, Grid Coordinates & Core Formulas**
   - Grid coordinates, cell data types (text, numbers, booleans, dates), and the Formula Bar.
   - Relative vs. absolute (`$A$1`) referencing mechanics and mixed references (`$A1`, `A$1`).
   - Essential math and aggregations: `SUM`, `AVERAGE`, `COUNT`, `COUNTA`, `MIN`, `MAX`.
   - Number formatting, Currency (`$`), Percentage (`%`), and Accounting layouts.
   - Guided Lab: Sales Ledger Initialization & AutoSum Revenue Aggregation.

2. **`excel-logical-text`**: **Logical Decision-Making & Text Data Cleaning**
   - Logical testing with `IF` and comparison operators (`=`, `<>`, `>`, `<`, `>=`, `<=`).
   - Compound multi-condition logic with `AND`, `OR`, `NOT`, and `IFS`.
   - Error trapping and graceful fallbacks with `IFERROR`.
   - Text cleansing and manipulation: `TRIM`, `PROPER`, `CONCAT`, `TEXTJOIN`, `LEFT`, `RIGHT`, `MID`, `SUBSTITUTE`.
   - Guided Lab: CRM Lead Hygiene & Priority Tiering.

3. **`excel-lookups`**: **Lookup & Reference Mastery: VLOOKUP to XLOOKUP**
   - `VLOOKUP` mechanics, exact match (`FALSE`) vs approximate match (`TRUE`), and column index fragility.
   - Horizontal table lookups with `HLOOKUP` and range locking.
   - Dynamic two-way lookups with `INDEX` and `MATCH` (left-lookups, immunity to inserted columns).
   - Modern `XLOOKUP`: exact match defaults, reverse lookups, and missing value handling.
   - Guided Lab: Product Catalog Reconciliation & Order Price Extraction.

4. **`excel-conditional-aggregation`**: **Conditional Math, Statistics & Summary Modeling**
   - Single-criteria conditional math: `SUMIF` and `COUNTIF`.
   - Multi-criteria powerhouses: `SUMIFS`, `COUNTIFS`, and `AVERAGEIFS`.
   - Text wildcards and pattern matching with `*` (multi-character) and `?` (single character).
   - Date-bounded conditional aggregations and financial KPI cards.
   - Guided Lab: Departmental Compensation & Overtime KPI Summary.

5. **`excel-dates-times`**: **Date, Time & Temporal Financial Analytics**
   - Excel serial date-time architecture (integer days since Jan 1, 1900 and fractional times).
   - Date extraction and assembly: `DATE`, `YEAR`, `MONTH`, `DAY`, `WEEKDAY`, `TODAY`, `NOW`.
   - Date arithmetic and duration analytics: `DATEDIF`, `EDATE`, `EOMONTH`, and aging buckets.
   - Business day calculations: `NETWORKDAYS`, `WORKDAY`, and turnaround SLAs.
   - Guided Lab: Accounts Receivable Aging Schedule & Customer Invoicing Cohorts.

6. **`excel-data-wrangling`**: **Data Wrangling, Validation & Deduplication**
   - Tidy tabular data principles, header hygiene, and avoiding destructive merged cells.
   - Deduplication workflows and modern dynamic arrays (`UNIQUE`, `SORT`).
   - Data Validation: In-cell dropdown lists, numeric constraints, and Stop error alerts.
   - Conditional Formatting: Top 10%, data bars, and row-level formula triggers.
   - Guided Lab: E-Commerce Inventory Quarantine & Data Cleansing Pipeline.

7. **`excel-pivot-tables`**: **Pivot Tables, Slicers & Multidimensional Summaries**
   - Pivot table architecture, source data ranges, and the in-memory Pivot Cache.
   - Field placement: Rows, Columns, Values, and Filter zones.
   - Custom value field summaries: `% of Grand Total`, `% of Column Total`, and Running Totals.
   - Interactive Slicers, Report Connections, and multi-table synchronization.
   - Guided Lab: Global Omnichannel Retail Transaction Performance Matrix.

8. **`excel-charts-visualization`**: **Data Visualization & Business Dashboards**
   - Visual communication taxonomy: Matching chart types to empirical data shapes.
   - Column and Bar charts: Comparisons, clustered bars, and zero-baseline integrity.
   - Time-series trends: Line charts, markers, and trendlines.
   - Executive dashboard architecture: Edward Tufte's data-ink ratio, visual hierarchy, and grid alignment.
   - Guided Lab: SaaS Monthly Recurring Revenue (MRR) & Churn Visual Dashboard.

9. **`excel-statistical-analysis`**: **Descriptive Statistics & Exploratory Data Analysis (EDA)**
   - Central tendency: Arithmetic Mean, Median, Mode, and skewness implications.
   - Dispersion and variability: Sample Standard Deviation (`STDEV.S`) and Variance (`VAR.S`).
   - Percentiles, Quartiles, and Tukey's Interquartile Range (IQR) outlier detection fences.
   - Bivariate association: Pearson correlation coefficient (`CORREL`) and scatter plots.
   - Guided Lab: Advertising Campaign Conversion Rate & Spend Statistical Profiling.

10. **`excel-analytics-capstone`**: **Enterprise Data Analytics Capstone**
    - Production analytics pipeline: Ingestion, staging hygiene, and transparent audit trails.
    - Relational data modeling: Star schema fact tables and dimension lookup tables.
    - Financial unit economics: Gross Profit, Gross Margin %, CAC, and Cohort LTV.
    - Decision-grade executive reporting: Synthesis, KPI cards, visual trends, and actionable recommendations.
    - Guided Lab: Enterprise Omnichannel Commercial Analytics Suite.

---

## 2. Spreadsheet Simulator Engine

The in-browser Excel simulation engine lives in `frontend/src/engine/excel/`:

- **Formula Lexer & Parser (`formulaParser.js`)**:
  - Tokenizes string literals, numbers, scientific notation, ranges (`A1:C10`), operators, parentheses, and identifiers.
  - Recursive-descent expression parser with operator precedence:
    `Comparison (=, <>, <, >, <=, >=)` < `Concat (&)` < `Additive (+, -)` < `Multiplicative (*, /)` < `Exponentiation (^)` < `Unary (+, -)`.
  - Dependency tracking and cycle detection returning `#CIRCULAR!` error without stack overflow.
  - Standard error taxonomy: `#DIV/0!`, `#VALUE!`, `#REF!`, `#NAME?`, `#NUM!`, `#N/A!`, `#CIRCULAR!`.

- **Worksheet Data Model (`sheetModel.js`)**:
  - Manages 2D sparse grid of cells with raw input, formula string, evaluated value, formatted display string, number formats, and styling.
  - Number formatters: `general`, `currency` (`$1,234.56`), `percent` (`12.3%`), `number` (`1,234.56`), `integer` (`1,235`).
  - Dynamic array and analytics methods:
    * `computeDescriptiveStats(rangeStr)`: Count, Sum, Mean, Median, Mode, StdDev, Variance, Min, Max, Range, Q1, Q3, IQR.
    * `computePivotTable({ rangeStr, rowFieldCol, valFieldCol, aggFunction })`: Dynamic cross-tabulation with `% of Grand Total`.
    * `exportCsv()`, `importCsv(csvText)`.

- **UI & Analytics Tools (`frontend/src/features/excel/`)**:
  - `ExcelRibbon.jsx`: Microsoft Excel-style ribbon with tabs: Home, Insert, Formulas, Data, Analytics.
  - `ExcelFormulaBar.jsx`: Name Box with coordinate display, Cancel/Commit buttons, `fx` symbol, and formula editor.
  - `ExcelGrid.jsx`: 2D interactive spreadsheet canvas with sticky headers, inline cell editing, range selection, and keyboard navigation.
  - `ExcelStatusBar.jsx`: Ready/Edit status, cell selection address, and real-time Average/Count/Sum of selected numbers.
  - `ExcelPivotModal.jsx`: Interactive cross-tabulation table generator.
  - `ExcelStatsModal.jsx`: Full descriptive statistics profile inspector.
  - `ExcelChartModal.jsx`: Interactive SVG charting engine supporting Column, Line, and Pie charts with legends and data labels.
  - `ExcelFunctionDirectoryModal.jsx`: Searchable library of all supported functions with syntax, explanations, and copyable examples.

---

## 3. Verification Boundaries

- **In-Browser Execution**: All formula calculations, statistics, pivot summaries, and chart renderings run entirely in the browser. There is no external Python runtime, backend spreadsheet server, or Microsoft Office dependency.
- **Certification**: Passing the 5-question exam with an 80% threshold enables certificate issuance via `/api/certificates`. Certificates are server-graded and produce immutable, cryptographically hashed PDFs.
- **Localization**: Technical formulas and course datasets follow standard English Excel conventions; interface chrome and rewards support Indonesian.

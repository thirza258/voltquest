#!/usr/bin/env python3
"""Generate and validate content/excel.json with 10 comprehensive Microsoft Excel & Data Analytics courses."""

import json
from pathlib import Path

CONTENT_DIR = Path(__file__).resolve().parents[1] / "content"

COURSES = [
    {
        "id": "excel-foundations",
        "version": 1,
        "order": 1,
        "title": "1. Excel Foundations, Grid Coordinates & Core Formulas",
        "summary": "Master the Excel workbook interface, 2D cell coordinate referencing, relative versus absolute ($A$1) addressing, number formatting styles, and foundational aggregation functions like SUM, AVERAGE, and COUNT.",
        "difficulty": "Fundamental",
        "minutes": 35,
        "codeExt": "csv",
        "code": """Region,Representative,Product,Units_Sold,Unit_Price,Gross_Sales,Discount_Pct,Net_Sales
North,Sarah Jenkins,Standard Laptop,42,850.00,=D2*E2,0.05,=F2*(1-G2)
South,Marcus Vance,Mechanical Keyboard,115,95.00,=D3*E3,0.10,=F3*(1-G3)
East,Elena Rostova,Ultra HD Monitor,68,320.00,=D4*E4,0.00,=F4*(1-G4)
West,David Kim,Wireless Mouse,210,35.00,=D5*E5,0.15,=F5*(1-G5)
North,Sarah Jenkins,USB-C Docking Station,54,160.00,=D6*E6,0.05,=F6*(1-G6)
Total,,Summary,=SUM(D2:D6),,=SUM(F2:F6),,=SUM(H2:H6)""",
        "dataset": [
            ["Region", "Representative", "Product", "Units_Sold", "Unit_Price", "Gross_Sales", "Discount_Pct", "Net_Sales"],
            ["North", "Sarah Jenkins", "Standard Laptop", 42, 850.00, "=D2*E2", 0.05, "=F2*(1-G2)"],
            ["South", "Marcus Vance", "Mechanical Keyboard", 115, 95.00, "=D3*E3", 0.10, "=F3*(1-G3)"],
            ["East", "Elena Rostova", "Ultra HD Monitor", 68, 320.00, "=D4*E4", 0.00, "=F4*(1-G4)"],
            ["West", "David Kim", "Wireless Mouse", 210, 35.00, "=D5*E5", 0.15, "=F5*(1-G5)"],
            ["North", "Sarah Jenkins", "USB-C Docking Station", 54, 160.00, "=D6*E6", 0.05, "=F6*(1-G6)"],
            ["Total", "", "Summary", "=SUM(D2:D6)", "", "=SUM(F2:F6)", "", "=SUM(H2:H6)"]
        ],
        "steps": [
            "Inspect the sales transaction ledger in cells A1:H7. Notice how each column contains a distinct data type.",
            "Click on cell F2 to inspect its formula in the Formula Bar: =D2*E2 calculates Gross Sales by multiplying Units Sold by Unit Price.",
            "Observe the formula in H2: =F2*(1-G2) calculates Net Sales after applying the Discount Percentage.",
            "Click cell D7 to review the aggregation formula =SUM(D2:D6), which dynamically calculates total unit volume.",
            "Use the Home tab to format column E, F, and H as Currency ($), and column G as Percentage (%)."
        ],
        "expected": "The workbook models individual transaction revenue and volume with dynamic SUM aggregations in row 7, formatted cleanly with currency symbols and two decimal places.",
        "challenge": "Add row 8 with AVERAGE formulas for Units Sold (=AVERAGE(D2:D6)), Gross Sales (=AVERAGE(F2:F6)), and Net Sales (=AVERAGE(H2:H6)).",
        "lessons": [
            {
                "id": "excel-foundations-s1",
                "title": "Grid Coordinates, Cell Data Types & The Formula Bar",
                "paragraphs": [
                    "Microsoft Excel organizes quantitative and qualitative business information across a two-dimensional grid of cells structured by letters for columns (A, B, C … Z, AA, AB …) and numbers for rows (1, 2, 3 …). The intersection of column C and row 4 forms cell coordinate C4. Every cell can store one of five fundamental primitives: text strings (labels), numeric values (integers and floating-point decimals), booleans (TRUE or FALSE), date/time serial numbers, or formulas that evaluate dynamically.",
                    "The Formula Bar sits directly above the grid headers. When you select a cell, the Name Box on the left displays its coordinate (e.g., C4), while the Formula Bar displays the underlying formula or literal expression stored in that cell. While the grid may display a formatted currency string such as '$1,250.00', the Formula Bar displays the raw unformatted value 1250 or the formula =A4*B4. Understanding the distinction between a cell's stored value and its formatted visual presentation is the primary prerequisite for analytical accuracy in spreadsheets."
                ],
                "pitfall": "Typing currency symbols or commas directly into raw data cells (e.g. typing '$1,200' rather than '1200') forces Excel to treat the entry as text, which breaks downstream mathematical aggregations.",
                "question": {
                    "id": "excel-foundations-q1",
                    "lessonId": "excel-foundations-s1",
                    "prompt": "If cell D5 displays '$4,500.00' but the formula bar displays '=B5*C5', what is the actual stored content of the cell?",
                    "options": [
                        {"id": "a", "text": "The text string '$4,500.00'"},
                        {"id": "b", "text": "The dynamic formula '=B5*C5' whose numerical result is visually formatted as currency"},
                        {"id": "c", "text": "A static snapshot image of a currency card"}
                    ],
                    "answerId": "b",
                    "explanation": "Excel separates underlying formulas and numerical values from visual cell formatting rules like currency masks."
                }
            },
            {
                "id": "excel-foundations-s2",
                "title": "Relative vs. Absolute ($A$1) Referencing Mechanics",
                "paragraphs": [
                    "When authoring formulas, cell coordinates default to relative referencing. A formula in cell C2 written as =A2*B2 instructs Excel to 'multiply the value two columns to my left by the value one column to my left'. If you copy or drag that formula down into cell C3, Excel automatically shifts the coordinates relative to the new position, generating =A3*B3. This behavior is ideal when calculating row-by-row transactional metrics across an entire table.",
                    "However, analytical models frequently require referencing a fixed parameter—such as a tax rate in cell $B$1, a currency exchange multiplier, or an annual inflation target. In these scenarios, relative movement must be locked using absolute referencing indicated by the dollar sign prefix ($). Writing =$B$1 locks both column B and row 1. Mixed references lock only one dimension: $B1 locks column B while allowing rows to change, whereas B$1 locks row 1 while allowing columns to shift."
                ],
                "pitfall": "Failing to add dollar signs ($) when referencing a single parameter cell causes the formula to drift to empty cells when copied down a table, resulting in zeroes or #VALUE! errors.",
                "question": {
                    "id": "excel-foundations-q2",
                    "lessonId": "excel-foundations-s2",
                    "prompt": "When copying the formula '=A2*$C$1' from row 2 down to row 3, what does the formula in row 3 become?",
                    "options": [
                        {"id": "a", "text": "=A3*$C$2"},
                        {"id": "b", "text": "=A3*$C$1"},
                        {"id": "c", "text": "=A2*$C$1"}
                    ],
                    "answerId": "b",
                    "explanation": "The relative reference A2 increments to A3, while the absolute reference $C$1 remains anchored to cell C1."
                }
            },
            {
                "id": "excel-foundations-s3",
                "title": "Essential Math & Aggregations: SUM, AVERAGE, COUNT, COUNTA",
                "paragraphs": [
                    "Excel provides a rich library of prebuilt aggregation functions that operate across contiguous cell ranges defined by colon notation (e.g., A1:A10). The SUM function computes the arithmetic total of all numeric values within the target range: =SUM(D2:D50). If non-numeric strings or blank cells exist within that range, SUM ignores them automatically without producing an error, making it far superior to chained addition (=D2+D3+D4), which fails if any cell contains text.",
                    "Similarly, =AVERAGE(range) calculates the arithmetic mean by dividing the sum of numeric cells by the count of numeric cells. Excel distinguishes between two counting functions: =COUNT(range) tallies only cells containing numbers or dates, while =COUNTA(range) counts all non-empty cells regardless of whether they contain numbers, text, or errors. To find extreme values, =MIN(range) and =MAX(range) return the lowest and highest numerical entries."
                ],
                "pitfall": "Using =AVERAGE() on cells containing zeroes will lower the mean, whereas blank cells are ignored. Do not enter zeroes in place of missing data unless zero is a true measurement.",
                "question": {
                    "id": "excel-foundations-q3",
                    "lessonId": "excel-foundations-s3",
                    "prompt": "What is the key difference between the COUNT and COUNTA functions in Excel?",
                    "options": [
                        {"id": "a", "text": "COUNT sums numbers, while COUNTA computes averages"},
                        {"id": "b", "text": "COUNT counts only cells with numeric values, while COUNTA counts all non-empty cells including text"},
                        {"id": "c", "text": "COUNT operates only on columns, while COUNTA operates only on rows"}
                    ],
                    "answerId": "b",
                    "explanation": "COUNT only tallies numeric and date entries, whereas COUNTA counts all non-blank cells."
                }
            },
            {
                "id": "excel-foundations-s4",
                "title": "Cell Formatting, Currency, Percentage & Accounting Layouts",
                "paragraphs": [
                    "Formatting transforms raw numbers into professional, readable financial and operational dashboards without altering the underlying precision. For example, a computed profit margin of 0.1482 can be formatted as 14.8% using Percentage formatting. Under the hood, Excel retains all 15 digits of floating-point precision in memory for downstream calculations, ensuring rounding errors do not accumulate.",
                    "The two primary financial formats in Excel are Currency and Accounting. Currency aligns the dollar sign directly next to the first digit ($120.00), whereas Accounting pins the currency symbol flush to the far left border of the cell and aligns decimal points vertically down the column. In Accounting style, a value of zero is displayed as a clean horizontal dash (-), visually clearing clutter from dense financial ledgers."
                ],
                "pitfall": "Manually rounding numbers in intermediate formula cells rather than using formatting can lead to cumulative discrepancy errors in final balance sheets.",
                "question": {
                    "id": "excel-foundations-q4",
                    "lessonId": "excel-foundations-s4",
                    "prompt": "How does the Accounting number format represent a cell with an exact value of zero?",
                    "options": [
                        {"id": "a", "text": "As an empty blank cell"},
                        {"id": "b", "text": "As a clean horizontal dash (-) with the currency symbol aligned flush left"},
                        {"id": "c", "text": "As '$0.00' highlighted in red text"}
                    ],
                    "answerId": "b",
                    "explanation": "Accounting format displays zeroes as dashes to reduce visual noise in financial statements."
                }
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "excel-foundations-eq1",
                    "prompt": "Which cell reference format keeps row 5 locked while allowing the column to shift when copied horizontally?",
                    "options": [
                        {"id": "a", "text": "$A5"},
                        {"id": "b", "text": "A$5"},
                        {"id": "c", "text": "$A$5"}
                    ],
                    "answerId": "b",
                    "explanation": "A$5 locks row 5 with the dollar sign preceding the 5, while column A remains relative."
                },
                {
                    "id": "excel-foundations-eq2",
                    "prompt": "What happens if you evaluate '=SUM(A1:A5)' when cell A3 contains the text 'Pending'?",
                    "options": [
                        {"id": "a", "text": "Excel returns a #VALUE! error"},
                        {"id": "b", "text": "SUM ignores cell A3 and adds the remaining numeric cells"},
                        {"id": "c", "text": "SUM converts 'Pending' to 0 and stops execution"}
                    ],
                    "answerId": "b",
                    "explanation": "Excel's SUM function automatically ignores non-numeric text values within referenced ranges."
                },
                {
                    "id": "excel-foundations-eq3",
                    "prompt": "Why is '=SUM(B2:B10)' preferable to '=B2+B3+B4+B5+B6+B7+B8+B9+B10'?",
                    "options": [
                        {"id": "a", "text": "SUM is concise, automatically handles inserted rows, and ignores text cells gracefully"},
                        {"id": "b", "text": "Direct addition with '+' runs 10x slower on 64-bit processors"},
                        {"id": "c", "text": "Direct addition cannot calculate floating-point decimals"}
                    ],
                    "answerId": "a",
                    "explanation": "Range functions are maintainable, dynamically expand when rows are inserted, and ignore text without throwing errors."
                },
                {
                    "id": "excel-foundations-eq4",
                    "prompt": "What does a cell display if it contains '###' across its width?",
                    "options": [
                        {"id": "a", "text": "A syntax error in the formula"},
                        {"id": "b", "text": "The column width is too narrow to display the formatted number or date"},
                        {"id": "c", "text": "A circular reference warning"}
                    ],
                    "answerId": "b",
                    "explanation": "Hash symbols indicate the column width must be expanded to display the full formatted value."
                },
                {
                    "id": "excel-foundations-eq5",
                    "prompt": "If cell C1 contains 0.25 and is formatted as Percentage with 1 decimal place, what is displayed?",
                    "options": [
                        {"id": "a", "text": "0.25%"},
                        {"id": "b", "text": "25.0%"},
                        {"id": "c", "text": "250.0%"}
                    ],
                    "answerId": "b",
                    "explanation": "0.25 multiplied by 100 with one decimal place formats as 25.0%."
                }
            ]
        }
    },
    {
        "id": "excel-logical-text",
        "version": 1,
        "order": 2,
        "title": "2. Logical Decision-Making & Text Data Cleaning",
        "summary": "Build dynamic conditional logic with IF, IFS, AND, OR, suppress runtime errors with IFERROR, and clean unstandardized strings using TRIM, CLEAN, CONCAT, and TEXTJOIN.",
        "difficulty": "Fundamental",
        "minutes": 40,
        "codeExt": "csv",
        "code": """Lead_ID,Raw_Customer_Name,Region,Lead_Score,Deal_Size,Status,Clean_Name,Priority_Tier
L-101,   acme industrial supply   ,North,88,45000,Open,=PROPER(TRIM(B2)),=IF(D2>=80,"Tier 1 VIP","Standard")
L-102,vertex robotics,South,62,12000,Lost,=PROPER(TRIM(B3)),=IF(D3>=80,"Tier 1 VIP","Standard")
L-103,  GLOBAL LOGISTICS CORP  ,West,94,85000,Open,=PROPER(TRIM(B4)),=IF(D4>=80,"Tier 1 VIP","Standard")
L-104,nexus biotech,East,71,28000,Open,=PROPER(TRIM(B5)),=IF(D5>=80,"Tier 1 VIP","Standard")
L-105,   PACIFIC ENERGY   ,West,49,9500,Lost,=PROPER(TRIM(B6)),=IF(D6>=80,"Tier 1 VIP","Standard")""",
        "dataset": [
            ["Lead_ID", "Raw_Customer_Name", "Region", "Lead_Score", "Deal_Size", "Status", "Clean_Name", "Priority_Tier"],
            ["L-101", "   acme industrial supply   ", "North", 88, 45000, "Open", "=PROPER(TRIM(B2))", "=IF(D2>=80,\"Tier 1 VIP\",\"Standard\")"],
            ["L-102", "vertex robotics", "South", 62, 12000, "Lost", "=PROPER(TRIM(B3))", "=IF(D3>=80,\"Tier 1 VIP\",\"Standard\")"],
            ["L-103", "  GLOBAL LOGISTICS CORP  ", "West", 94, 85000, "Open", "=PROPER(TRIM(B4))", "=IF(D4>=80,\"Tier 1 VIP\",\"Standard\")"],
            ["L-104", "nexus biotech", "East", 71, 28000, "Open", "=PROPER(TRIM(B5))", "=IF(D5>=80,\"Tier 1 VIP\",\"Standard\")"],
            ["L-105", "   PACIFIC ENERGY   ", "West", 49, 9500, "Lost", "=PROPER(TRIM(B6))", "=IF(D6>=80,\"Tier 1 VIP\",\"Standard\")"]
        ],
        "steps": [
            "Review the uncleaned CRM lead table in A1:H6. Notice irregular leading/trailing spaces and inconsistent capitalization in column B.",
            "Inspect column G: the formula =PROPER(TRIM(B2)) strips excess whitespace and formats each word in title case.",
            "Inspect column H: the formula =IF(D2>=80,\"Tier 1 VIP\",\"Standard\") automatically assigns a VIP priority label if the lead score is at least 80.",
            "Select cell G2 and notice how TRIM removes outer and repeated internal spaces.",
            "Test modifying cell D2 to 75; observe cell H2 immediately update from 'Tier 1 VIP' to 'Standard'."
        ],
        "expected": "Text strings are standardized into proper case without whitespace, and logical rules dynamically categorize accounts based on numerical scores.",
        "challenge": "Extend column H using nested logic or IFS to assign 'Tier 1' for score >= 85, 'Tier 2' for score >= 70, and 'Tier 3' for all others.",
        "lessons": [
            {
                "id": "excel-logical-text-s1",
                "title": "Logical Testing with IF and Comparison Operators",
                "paragraphs": [
                    "The IF function is the cornerstone of conditional decision-making in Excel. It takes three arguments: a logical test that evaluates to TRUE or FALSE, a value to return if TRUE, and a value to return if FALSE: =IF(logical_test, value_if_true, value_if_false). Comparison operators form the basis of the test: = (equal), <> (not equal), > (greater than), < (less than), >= (greater than or equal to), and <= (less than or equal to).",
                    "For example, =IF(E2>=50000, 'Enterprise', 'SMB') categorizes sales leads according to deal value. If the value in E2 meets or exceeds 50,000, Excel outputs 'Enterprise'; otherwise, it outputs 'SMB'. When returning text strings, always wrap the text in double quotes ('text'). Omission of quotes causes Excel to search for a named range or function with that name, triggering a #NAME? error."
                ],
                "pitfall": "Using single quotes ('text') instead of double quotes (\"text\") in Excel formulas will cause a formula parsing error.",
                "question": {
                    "id": "excel-logical-text-q1",
                    "lessonId": "excel-logical-text-s1",
                    "prompt": "What will '=IF(B2>100, \"Bonus\", \"Standard\")' return if cell B2 contains exactly 100?",
                    "options": [
                        {"id": "a", "text": "\"Bonus\""},
                        {"id": "b", "text": "\"Standard\""},
                        {"id": "c", "text": "#VALUE!"}
                    ],
                    "answerId": "b",
                    "explanation": "Because 100 is not strictly greater than 100, the condition evaluates to FALSE, returning 'Standard'."
                }
            },
            {
                "id": "excel-logical-text-s2",
                "title": "Compound Multi-Condition Logic with AND, OR, and Nested IFs",
                "paragraphs": [
                    "Real-world business rules rarely depend on a single variable. Excel supports multi-variable conditions through the AND and OR helper functions. The AND function returns TRUE only if every supplied argument evaluates to TRUE: =AND(A2='North', B2>10000). In contrast, the OR function returns TRUE if at least one argument is TRUE: =OR(Status='Urgent', Overdue_Days>30).",
                    "By embedding AND or OR inside the logical test of an IF function, you build powerful conditional branches: =IF(AND(Region='West', Revenue>=50000), 'Strategic Account', 'Standard Account'). When multiple tiers exist, modern Excel provides the IFS function: =IFS(Score>=90, 'A', Score>=80, 'B', Score>=70, 'C', TRUE, 'Needs Improvement'). IFS eliminates deeply nested parentheses by evaluating pairs of conditions and return values in sequence."
                ],
                "pitfall": "In IFS, earlier conditions that evaluate to TRUE immediately short-circuit subsequent tests. Always order conditions from most restrictive to least restrictive.",
                "question": {
                    "id": "excel-logical-text-q2",
                    "lessonId": "excel-logical-text-s2",
                    "prompt": "Which formula correctly tests whether a customer is in the 'West' region AND has spent over $1,000?",
                    "options": [
                        {"id": "a", "text": "=IF(Region='West' + Spend>1000, \"VIP\", \"Regular\")"},
                        {"id": "b", "text": "=IF(AND(Region=\"West\", Spend>1000), \"VIP\", \"Regular\")"},
                        {"id": "c", "text": "=IF(OR(Region=\"West\", Spend>1000), \"VIP\", \"Regular\")"}
                    ],
                    "answerId": "b",
                    "explanation": "AND requires both conditions to be TRUE before returning the VIP tier."
                }
            },
            {
                "id": "excel-logical-text-s3",
                "title": "Error Trapping & Graceful Fallbacks with IFERROR",
                "paragraphs": [
                    "Spreadsheets often encounter runtime errors when formulas divide by zero (#DIV/0!), fail to find a lookup key (#N/A), or encounter incompatible data types (#VALUE!). If left unhandled, an error in one cell cascades through every dependent formula, breaking summaries and dashboards across the entire organization.",
                    "The IFERROR function prevents this by evaluating an expression and returning an alternative value if an error occurs: =IFERROR(value, value_if_error). For example, calculating price per unit with =IFERROR(Revenue/Units, 0) returns 0 instead of #DIV/0! if Units is zero or blank. Similarly, wrapping lookups in =IFERROR(VLOOKUP(...), 'Not Found') supplies clean status feedback for operational staff."
                ],
                "pitfall": "Overusing IFERROR without caution can mask genuine formula typos and misspellings that would otherwise alert you to modeling bugs.",
                "question": {
                    "id": "excel-logical-text-q3",
                    "lessonId": "excel-logical-text-s3",
                    "prompt": "What does '=IFERROR(100 / 0, \"N/A\")' evaluate to?",
                    "options": [
                        {"id": "a", "text": "#DIV/0!"},
                        {"id": "b", "text": "\"N/A\""},
                        {"id": "c", "text": "0"}
                    ],
                    "answerId": "b",
                    "explanation": "IFERROR catches the division by zero error and returns the fallback string 'N/A'."
                }
            },
            {
                "id": "excel-logical-text-s4",
                "title": "Text Cleansing & Splitting: TRIM, LEFT, RIGHT, MID, SUBSTITUTE",
                "paragraphs": [
                    "Raw tabular data exported from ERPs and databases frequently contains invisible formatting defects: irregular leading or trailing spaces, non-breaking whitespace, and inconsistent capitalization. The TRIM function strips all leading and trailing spaces while collapsing multiple consecutive internal spaces into a single space: =TRIM(A2). To standardize casing, =PROPER(text) capitalizes the first letter of each word, =UPPER(text) forces uppercase, and =LOWER(text) converts to lowercase.",
                    "To extract substrings, =LEFT(text, num_chars) grabs characters from the beginning of a string, =RIGHT(text, num_chars) extracts from the end, and =MID(text, start_num, num_chars) extracts from the middle. To join strings, =TEXTJOIN(delimiter, ignore_empty, text1, text2 …) joins multiple cells separated by a designated delimiter, offering far greater convenience than repeated ampersand (&) concatenation."
                ],
                "pitfall": "VLOOKUP will fail to match 'Product ' (with a trailing space) against 'Product' (without a space). Always run TRIM across key columns before joining tables.",
                "question": {
                    "id": "excel-logical-text-q4",
                    "lessonId": "excel-logical-text-s4",
                    "prompt": "What does '=TRIM(\"  Acme   Corp  \")' produce?",
                    "options": [
                        {"id": "a", "text": "\"AcmeCorp\""},
                        {"id": "b", "text": "\"Acme Corp\""},
                        {"id": "c", "text": "\"  Acme Corp  \""}
                    ],
                    "answerId": "b",
                    "explanation": "TRIM removes outer spaces and collapses multiple internal spaces into a single space."
                }
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "excel-logical-text-eq1",
                    "prompt": "Which function allows testing multiple conditions in sequence without deeply nesting IF statements?",
                    "options": [
                        {"id": "a", "text": "IFS"},
                        {"id": "b", "text": "CHOOSE"},
                        {"id": "c", "text": "SUMPRODUCT"}
                    ],
                    "answerId": "a",
                    "explanation": "IFS evaluates multiple condition/value pairs sequentially without nested IF syntax."
                },
                {
                    "id": "excel-logical-text-eq2",
                    "prompt": "What is the return value of '=OR(5>10, 8<3, 12=12)'?",
                    "options": [
                        {"id": "a", "text": "FALSE"},
                        {"id": "b", "text": "TRUE"},
                        {"id": "c", "text": "#VALUE!"}
                    ],
                    "answerId": "b",
                    "explanation": "OR evaluates to TRUE as long as at least one argument (here, 12=12) is TRUE."
                },
                {
                    "id": "excel-logical-text-eq3",
                    "prompt": "What function joins cells A1:A3 with a hyphen delimiter and ignores empty cells?",
                    "options": [
                        {"id": "a", "text": "=CONCAT(A1:A3, \"-\")"},
                        {"id": "b", "text": "=TEXTJOIN(\"-\", TRUE, A1:A3)"},
                        {"id": "c", "text": "=JOIN(\"-\", A1:A3)"}
                    ],
                    "answerId": "b",
                    "explanation": "TEXTJOIN takes delimiter, ignore_empty boolean, and ranges or strings to concatenate."
                },
                {
                    "id": "excel-logical-text-eq4",
                    "prompt": "If cell A1 contains 'SKU-9824-US', what does '=MID(A1, 5, 4)' return?",
                    "options": [
                        {"id": "a", "text": "\"9824\""},
                        {"id": "b", "text": "\"SKU-\""},
                        {"id": "c", "text": "\"-US\""}
                    ],
                    "answerId": "a",
                    "explanation": "MID starts at character index 5 ('9') and extracts 4 characters ('9824')."
                },
                {
                    "id": "excel-logical-text-eq5",
                    "prompt": "Why is '=IFERROR(VLOOKUP(A2, Catalog!A:B, 2, FALSE), \"Not Found\")' considered a best practice?",
                    "options": [
                        {"id": "a", "text": "It speeds up calculation on large datasets"},
                        {"id": "b", "text": "It suppresses #N/A errors when a lookup key is missing and returns a friendly message"},
                        {"id": "c", "text": "It forces Excel to perform an approximate match"}
                    ],
                    "answerId": "b",
                    "explanation": "IFERROR catches lookup failure errors and presents a readable message for end users."
                }
            ]
        }
    },
    {
        "id": "excel-lookups",
        "version": 1,
        "order": 3,
        "title": "3. Lookup & Reference Mastery: VLOOKUP to XLOOKUP",
        "summary": "Connect relational data across tables, understand exact vs approximate matching, solve column index fragility using INDEX and MATCH, and leverage modern XLOOKUP for reverse and multi-column lookups.",
        "difficulty": "Intermediate",
        "minutes": 45,
        "codeExt": "csv",
        "code": """SKU,Product_Name,Category,Unit_Cost,Selling_Price,Inventory_Qty
SKU-1001,Ergonomic Chair,Furniture,120.00,249.99,45
SKU-1002,Standing Desk,Furniture,210.00,450.00,28
SKU-2001,Noise-Cancel Headset,Audio,45.00,129.99,84
SKU-2002,Studio Microphone,Audio,65.00,159.00,32
SKU-3001,Mechanical Numpad,Peripherals,18.00,49.99,110
,,,,,
Order_ID,Lookup_SKU,Matched_Product,Unit_Cost_Index,Selling_Price_XLookup
ORD-501,SKU-2001,=VLOOKUP(B8,A2:E6,2,FALSE),=INDEX(D2:D6,MATCH(B8,A2:A6,0)),=XLOOKUP(B8,A2:A6,E2:E6,"Not Found")
ORD-502,SKU-1002,=VLOOKUP(B9,A2:E6,2,FALSE),=INDEX(D2:D6,MATCH(B9,A2:A6,0)),=XLOOKUP(B9,A2:A6,E2:E6,"Not Found")
ORD-503,SKU-3001,=VLOOKUP(B10,A2:E6,2,FALSE),=INDEX(D2:D6,MATCH(B10,A2:A6,0)),=XLOOKUP(B10,A2:A6,E2:E6,"Not Found")""",
        "dataset": [
            ["SKU", "Product_Name", "Category", "Unit_Cost", "Selling_Price", "Inventory_Qty"],
            ["SKU-1001", "Ergonomic Chair", "Furniture", 120.00, 249.99, 45],
            ["SKU-1002", "Standing Desk", "Furniture", 210.00, 450.00, 28],
            ["SKU-2001", "Noise-Cancel Headset", "Audio", 45.00, 129.99, 84],
            ["SKU-2002", "Studio Microphone", "Audio", 65.00, 159.00, 32],
            ["SKU-3001", "Mechanical Numpad", "Peripherals", 18.00, 49.99, 110],
            ["", "", "", "", "", ""],
            ["Order_ID", "Lookup_SKU", "Matched_Product", "Unit_Cost_Index", "Selling_Price_XLookup", ""],
            ["ORD-501", "SKU-2001", "=VLOOKUP(B8,A2:E6,2,FALSE)", "=INDEX(D2:D6,MATCH(B8,A2:A6,0))", "=XLOOKUP(B8,A2:A6,E2:E6,\"Not Found\")", ""],
            ["ORD-502", "SKU-1002", "=VLOOKUP(B9,A2:E6,2,FALSE)", "=INDEX(D2:D6,MATCH(B9,A2:A6,0))", "=XLOOKUP(B9,A2:A6,E2:E6,\"Not Found\")", ""],
            ["ORD-503", "SKU-3001", "=VLOOKUP(B10,A2:E6,2,FALSE)", "=INDEX(D2:D6,MATCH(B10,A2:A6,0))", "=XLOOKUP(B10,A2:A6,E2:E6,\"Not Found\")", ""]
        ],
        "steps": [
            "Review the catalog table in A1:F6 and the order reconciliation table in A8:E11.",
            "Click on cell C8: =VLOOKUP(B8,A2:E6,2,FALSE) searches column A for SKU-2001 and returns the second column ('Noise-Cancel Headset').",
            "Click on cell D8: =INDEX(D2:D6,MATCH(B8,A2:A6,0)) decouples the search: MATCH finds the row offset, and INDEX retrieves Unit Cost from column D.",
            "Click on cell E8: =XLOOKUP(B8,A2:A6,E2:E6,\"Not Found\") provides a modern, concise lookup without column index counting.",
            "Change Lookup_SKU in cell B8 to 'SKU-1001' and watch all three lookup methods simultaneously update to 'Ergonomic Chair', 120.00, and 249.99."
        ],
        "expected": "Relational lookups accurately map SKU identifiers across disparate table sections using VLOOKUP, INDEX/MATCH, and XLOOKUP.",
        "challenge": "Write an XLOOKUP in column F to retrieve the current Inventory_Qty from column F of the master catalog.",
        "lessons": [
            {
                "id": "excel-lookups-s1",
                "title": "VLOOKUP Mechanics, Approximate vs Exact Match & Column Fragility",
                "paragraphs": [
                    "VLOOKUP (Vertical Lookup) searches down the first column of a table array for a lookup key and returns a corresponding value from a specified column index: =VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup]). The fourth parameter, range_lookup, is critical: TRUE (or omitted) performs an approximate match, while FALSE (or 0) performs an exact match.",
                    "In 95% of business analytics workflows, exact matching (FALSE) is required. If FALSE is omitted, VLOOKUP assumes the first column is sorted alphabetically or numerically. If the list is unsorted, an approximate match returns silently incorrect results. Furthermore, VLOOKUP suffers from architectural fragility: if an analyst inserts a new column into the catalog, hardcoded column indices (e.g., 2) point to the wrong data."
                ],
                "pitfall": "Always pass FALSE as the 4th argument in VLOOKUP for exact lookups. Forgetting FALSE causes VLOOKUP to return wrong values if the table is unsorted.",
                "question": {
                    "id": "excel-lookups-q1",
                    "lessonId": "excel-lookups-s1",
                    "prompt": "What does '=VLOOKUP(\"SKU-100\", A2:D10, 3, FALSE)' do?",
                    "options": [
                        {"id": "a", "text": "Searches column A for 'SKU-100' exactly and returns the value from column C (the 3rd column)"},
                        {"id": "b", "text": "Searches column C for 'SKU-100' and returns column A"},
                        {"id": "c", "text": "Sorts the table and returns the 3rd row"}
                    ],
                    "answerId": "a",
                    "explanation": "VLOOKUP searches the 1st column of the range and extracts the value from column index 3 (Column C)."
                }
            },
            {
                "id": "excel-lookups-s2",
                "title": "Horizontal Lookups with HLOOKUP and Range Locking",
                "paragraphs": [
                    "While most datasets are arranged vertically in records (rows), financial projections and calendar schedules are frequently structured horizontally with dates or periods across columns. HLOOKUP (Horizontal Lookup) searches across the top row of a range and retrieves a value from a specified row index: =HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup]).",
                    "Like VLOOKUP, HLOOKUP requires locking the table array using absolute references (e.g., $B$1:$M$10) so the target grid does not shift when dragging formulas. While useful in legacy models, horizontal lookups share the same index-fragility and left-to-right limitations as VLOOKUP."
                ],
                "pitfall": "If table headers in row 1 are not locked ($B$1:$M$5), copying HLOOKUP downward causes the header search range to drift into data rows.",
                "question": {
                    "id": "excel-lookups-q2",
                    "lessonId": "excel-lookups-s2",
                    "prompt": "When is HLOOKUP preferred over VLOOKUP?",
                    "options": [
                        {"id": "a", "text": "When the lookup keys are arranged horizontally across columns rather than vertically down rows"},
                        {"id": "b", "text": "When comparing text strings instead of numbers"},
                        {"id": "c", "text": "When working on Macintosh computers"}
                    ],
                    "answerId": "a",
                    "explanation": "HLOOKUP operates on horizontally oriented tables where header categories run across columns."
                }
            },
            {
                "id": "excel-lookups-s3",
                "title": "Dynamic Two-Way Lookups with INDEX and MATCH",
                "paragraphs": [
                    "The combination of INDEX and MATCH is the professional standard for robust lookups in legacy and enterprise workbooks. MATCH locates the position of a lookup key within a 1D vector (row or column) and returns its relative index: =MATCH(lookup_value, lookup_array, 0). INDEX takes an array and returns the value at a specified row and column offset: =INDEX(array, row_num, [col_num]).",
                    "Combining them yields =INDEX(Return_Column, MATCH(Lookup_Val, Key_Column, 0)). This provides four major advantages over VLOOKUP: 1) It performs 'left lookups', retrieving data to the left of the key column; 2) It is immune to inserted or deleted columns; 3) It requires less memory because only two individual columns are loaded rather than an entire multi-column table; and 4) It supports two-way matrix lookups by supplying MATCH for both rows and columns."
                ],
                "pitfall": "Ensure the lookup array in MATCH and the return array in INDEX span the exact same row boundaries (e.g., A2:A100 and D2:D100), otherwise row offsets will misalign.",
                "question": {
                    "id": "excel-lookups-q3",
                    "lessonId": "excel-lookups-s3",
                    "prompt": "What does the MATCH function return when successful?",
                    "options": [
                        {"id": "a", "text": "The content value stored inside the cell"},
                        {"id": "b", "text": "The relative position index (1, 2, 3...) of the item within the lookup vector"},
                        {"id": "c", "text": "A TRUE/FALSE boolean flag"}
                    ],
                    "answerId": "b",
                    "explanation": "MATCH returns the relative numerical position of the found item within the specified vector."
                }
            },
            {
                "id": "excel-lookups-s4",
                "title": "Modern XLOOKUP: Defaults, Left-Lookups & Multi-Column Arrays",
                "paragraphs": [
                    "Introduced to replace both VLOOKUP and INDEX/MATCH, XLOOKUP provides an elegant, highly performant syntax: =XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode]). By default, XLOOKUP performs an exact match, eliminating the risk of accidental approximate matches.",
                    "XLOOKUP solves every classical lookup limitation: it looks left or right seamlessly; it features an integrated [if_not_found] argument, replacing cumbersome =IFERROR(VLOOKUP(...), 'Not Found'); and it can return entire multi-column ranges in a single formula. Furthermore, it supports bottom-up searching (search_mode = -1) to find the most recent transaction in a chronological ledger."
                ],
                "pitfall": "Ensure that lookup_array and return_array have identical dimensions (e.g., same number of rows), otherwise XLOOKUP returns a #VALUE! error.",
                "question": {
                    "id": "excel-lookups-q4",
                    "lessonId": "excel-lookups-s4",
                    "prompt": "What is the primary advantage of XLOOKUP over traditional VLOOKUP?",
                    "options": [
                        {"id": "a", "text": "XLOOKUP defaults to exact match, looks both left and right, and handles missing values directly"},
                        {"id": "b", "text": "XLOOKUP requires columns to be sorted alphabetically"},
                        {"id": "c", "text": "XLOOKUP only works with date values"}
                    ],
                    "answerId": "a",
                    "explanation": "XLOOKUP defaults to exact matching, looks left and right, and provides a built-in missing value fallback argument."
                }
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "excel-lookups-eq1",
                    "prompt": "Why will '=VLOOKUP(A2, B1:D10, 2, FALSE)' fail if the lookup key exists in column C?",
                    "options": [
                        {"id": "a", "text": "VLOOKUP can only search the very first column (column B) of the table array"},
                        {"id": "b", "text": "Column D is too small"},
                        {"id": "c", "text": "Exact match requires uppercase text"}
                    ],
                    "answerId": "a",
                    "explanation": "VLOOKUP strictly searches the first (leftmost) column of the declared table range."
                },
                {
                    "id": "excel-lookups-eq2",
                    "prompt": "What does a match_type of 0 specify in '=MATCH(C2, A1:A50, 0)'?",
                    "options": [
                        {"id": "a", "text": "Approximate match on descending data"},
                        {"id": "b", "text": "Exact match"},
                        {"id": "c", "text": "Wildcard-only match"}
                    ],
                    "answerId": "b",
                    "explanation": "A match type of 0 instructs MATCH to find the exact match."
                },
                {
                    "id": "excel-lookups-eq3",
                    "prompt": "What formula retrieves the Price from column A when the Product SKU matches cell E2 in column B?",
                    "options": [
                        {"id": "a", "text": "=VLOOKUP(E2, B:A, 1, FALSE)"},
                        {"id": "b", "text": "=INDEX(A:A, MATCH(E2, B:B, 0))"},
                        {"id": "c", "text": "=HLOOKUP(E2, A:B, 2, FALSE)"}
                    ],
                    "answerId": "b",
                    "explanation": "INDEX/MATCH easily performs 'left lookups', returning column A based on a match in column B."
                },
                {
                    "id": "excel-lookups-eq4",
                    "prompt": "In '=XLOOKUP(D2, Products!A:A, Products!C:C, \"Missing SKU\")', what is displayed if D2 is not found?",
                    "options": [
                        {"id": "a", "text": "#N/A"},
                        {"id": "b", "text": "\"Missing SKU\""},
                        {"id": "c", "text": "#VALUE!"}
                    ],
                    "answerId": "b",
                    "explanation": "The 4th argument of XLOOKUP is the custom [if_not_found] return value."
                },
                {
                    "id": "excel-lookups-eq5",
                    "prompt": "What error indicates that the return column index in VLOOKUP exceeds the number of columns in the table array?",
                    "options": [
                        {"id": "a", "text": "#REF!"},
                        {"id": "b", "text": "#NAME?"},
                        {"id": "c", "text": "#DIV/0!"}
                    ],
                    "answerId": "a",
                    "explanation": "A #REF! error occurs when a formula refers to a column or cell outside the valid range bounds."
                }
            ]
        }
    },
    {
        "id": "excel-conditional-aggregation",
        "version": 1,
        "order": 4,
        "title": "4. Conditional Math, Statistics & Summary Modeling",
        "summary": "Calculate filtered metrics using SUMIF, COUNTIF, SUMIFS, and AVERAGEIFS across multi-criteria business parameters, text wildcards, and numerical comparison thresholds.",
        "difficulty": "Intermediate",
        "minutes": 40,
        "codeExt": "csv",
        "code": """Department,Employee,Location,Status,Base_Salary,Overtime_Pay,Total_Comp
Engineering,Alex Rivera,Austin,Active,115000,12000,=E2+F2
Sales,Jordan Lee,New York,Active,85000,34000,=E3+F3
Engineering,Casey Chen,Austin,Active,128000,8500,=E4+F4
Marketing,Taylor Swift,New York,Contractor,72000,0,=E5+F5
Sales,Morgan Smith,Chicago,Active,92000,28000,=E6+F6
Engineering,Riley Vance,Chicago,Active,108000,15000,=E7+F7
,,,,,,
Metric_Name,Condition_1,Condition_2,Result,,,
Engineering_Total_Comp,Engineering,,=SUMIF(A2:A7,"Engineering",G2:G7),,,
Active_Austin_Engineers,Engineering,Austin,=COUNTIFS(A2:A7,"Engineering",C2:C7,"Austin",D2:D7,"Active"),,,
High_Overtime_Employees,Overtime > 10k,,=COUNTIF(F2:F7,">10000"),,,
Sales_Average_Comp,Sales,,=AVERAGEIF(A2:A7,"Sales",G2:G7),,,""",
        "dataset": [
            ["Department", "Employee", "Location", "Status", "Base_Salary", "Overtime_Pay", "Total_Comp"],
            ["Engineering", "Alex Rivera", "Austin", "Active", 115000, 12000, "=E2+F2"],
            ["Sales", "Jordan Lee", "New York", "Active", 85000, 34000, "=E3+F3"],
            ["Engineering", "Casey Chen", "Austin", "Active", 128000, 8500, "=E4+F4"],
            ["Marketing", "Taylor Swift", "New York", "Contractor", 72000, 0, "=E5+F5"],
            ["Sales", "Morgan Smith", "Chicago", "Active", 92000, 28000, "=E6+F6"],
            ["Engineering", "Riley Vance", "Chicago", "Active", 108000, 15000, "=E7+F7"],
            ["", "", "", "", "", "", ""],
            ["Metric_Name", "Condition_1", "Condition_2", "Result", "", "", ""],
            ["Engineering_Total_Comp", "Engineering", "", "=SUMIF(A2:A7,\"Engineering\",G2:G7)", "", "", ""],
            ["Active_Austin_Engineers", "Engineering", "Austin", "=COUNTIFS(A2:A7,\"Engineering\",C2:C7,\"Austin\",D2:D7,\"Active\")", "", "", ""],
            ["High_Overtime_Employees", "Overtime > 10k", "", "=COUNTIF(F2:F7,\">10000\")", "", "", ""],
            ["Sales_Average_Comp", "Sales", "", "=AVERAGEIF(A2:A7,\"Sales\",G2:G7)", "", "", ""]
        ],
        "steps": [
            "Examine the compensation table in rows 1 to 7 and the executive KPI summary metrics in rows 9 to 13.",
            "Click cell D10: =SUMIF(A2:A7,\"Engineering\",G2:G7) sums Total Compensation only where Department equals 'Engineering'.",
            "Click cell D11: =COUNTIFS(A2:A7,\"Engineering\",C2:C7,\"Austin\",D2:D7,\"Active\") applies three simultaneous criteria.",
            "Click cell D12: =COUNTIF(F2:F7,\">10000\") tallies employees earning over $10,000 in overtime.",
            "Click cell D13: =AVERAGEIF(A2:A7,\"Sales\",G2:G7) calculates the average compensation for Sales personnel."
        ],
        "expected": "Conditional formulas dynamically filter and summarize department headcount, payroll totals, and averages across multiple intersecting criteria.",
        "challenge": "Add cell D14 with a SUMIFS formula calculating total Overtime Pay for active Sales representatives in Chicago.",
        "lessons": [
            {
                "id": "excel-conditional-aggregation-s1",
                "title": "Single-Criteria Conditional Math: SUMIF and COUNTIF",
                "paragraphs": [
                    "Business analysts frequently need to summarize subsets of data based on a specific attribute: total revenue for the West region, count of pending support tickets, or average order value for wholesale clients. The SUMIF function adds values in a range that meet a specific condition: =SUMIF(range, criteria, [sum_range]). If sum_range is omitted, Excel sums the cells evaluated in range.",
                    "The COUNTIF function tallies the number of cells that satisfy a criterion: =COUNTIF(range, criteria). Criteria can be exact text strings (\"Closed\"), numerical values (100), or comparison expressions formatted as strings (\">500\", \"<=0\", \"<>Draft\")."
                ],
                "pitfall": "When authoring comparison criteria with operators, always wrap the operator and value in double quotes: \">50\" or \">\"&B1. Writing >50 unquoted generates a formula syntax error.",
                "question": {
                    "id": "excel-conditional-aggregation-q1",
                    "lessonId": "excel-conditional-aggregation-s1",
                    "prompt": "Which formula correctly sums column C when column B equals 'Retail'?",
                    "options": [
                        {"id": "a", "text": "=SUMIF(B:B, \"Retail\", C:C)"},
                        {"id": "b", "text": "=SUMIF(C:C, \"Retail\", B:B)"},
                        {"id": "c", "text": "=COUNTIF(B:B, \"Retail\", C:C)"}
                    ],
                    "answerId": "a",
                    "explanation": "SUMIF syntax is range (criteria evaluation range B:B), criteria (\"Retail\"), and sum_range (C:C)."
                }
            },
            {
                "id": "excel-conditional-aggregation-s2",
                "title": "Multi-Criteria Powerhouses: SUMIFS and AVERAGEIFS",
                "paragraphs": [
                    "While SUMIF handles single criteria, real analytics demands intersecting filters: total sales of laptops, in the East region, during Q3. The plural functions—SUMIFS, COUNTIFS, and AVERAGEIFS—support up to 127 condition pairs.",
                    "Notice a crucial syntax difference: in SUMIFS and AVERAGEIFS, the range to be summed or averaged comes first, followed by pairs of criteria_range and criteria: =SUMIFS(sum_range, criteria_range1, criteria1, criteria_range2, criteria2 …). In COUNTIFS, there is no sum range, only successive pairs of criteria ranges and conditions: =COUNTIFS(range1, crit1, range2, crit2)."
                ],
                "pitfall": "Mixing up the argument order between SUMIF (sum_range at the end) and SUMIFS (sum_range at the beginning) is one of the most common mistakes in Excel.",
                "question": {
                    "id": "excel-conditional-aggregation-q2",
                    "lessonId": "excel-conditional-aggregation-s2",
                    "prompt": "Where does the sum_range argument sit in the SUMIFS function?",
                    "options": [
                        {"id": "a", "text": "At the very end of the argument list"},
                        {"id": "b", "text": "As the very first argument, preceding all criteria ranges"},
                        {"id": "c", "text": "It is not specified because Excel detects it automatically"}
                    ],
                    "answerId": "b",
                    "explanation": "In SUMIFS, the sum_range is the first argument, followed by criteria range/value pairs."
                }
            },
            {
                "id": "excel-conditional-aggregation-s3",
                "title": "Wildcards and Pattern Matching with * and ? in Criteria",
                "paragraphs": [
                    "Conditional functions in Excel support powerful wildcard matching for text criteria. The asterisk (*) represents any sequence of zero or more characters. For example, =COUNTIF(A:A, 'East*') matches 'East', 'Eastern', 'East Coast', and 'East-Warehouse'. Placing asterisks at both ends, =SUMIF(A:A, '*Desk*', B:B), matches any cell containing 'Desk' anywhere in the string.",
                    "The question mark (?) represents exactly one single character. For instance, =COUNTIF(A:A, 'SKU-?9') matches 'SKU-A9' and 'SKU-B9', but not 'SKU-AB9'. If you need to search for an actual asterisk or question mark literal, precede it with a tilde (~* or ~?)."
                ],
                "pitfall": "Wildcards only operate on text strings. Using wildcards on numeric ranges (e.g. searching for numbers ending in 5 with '*5') will not match numeric cells.",
                "question": {
                    "id": "excel-conditional-aggregation-q3",
                    "lessonId": "excel-conditional-aggregation-s3",
                    "prompt": "What does '=COUNTIF(B:B, \"*Corp*\")' match?",
                    "options": [
                        {"id": "a", "text": "Only cells whose exact content is 'Corp'"},
                        {"id": "b", "text": "Any cell containing 'Corp' anywhere within the text string"},
                        {"id": "c", "text": "Cells that begin with an asterisk and end with 'Corp'"}
                    ],
                    "answerId": "b",
                    "explanation": "The asterisk wildcard before and after matches any sequence of characters surrounding 'Corp'."
                }
            },
            {
                "id": "excel-conditional-aggregation-s4",
                "title": "Date-Bounded Conditional Aggregations and Financial KPI Cards",
                "paragraphs": [
                    "Financial models constantly aggregate numbers within specific fiscal windows: revenues generated after January 1, 2026, or transactions occurring between two dates. To apply date bounds in SUMIFS or COUNTIFS, concatenate logical operators with cell references or date functions.",
                    "For example, to sum sales between dates in cells H1 and H2: =SUMIFS(C:C, A:A, '>='&H1, A:A, '<='&H2). Excel converts the date in H1 into its serial integer and concatenates it with '>=' to evaluate the range. This dynamic referencing allows dashboard users to change dates in input cells without editing formula syntax."
                ],
                "pitfall": "Hardcoding dates into criteria strings like \">=01/01/2026\" can cause regional date format bugs (DD/MM vs MM/DD). Referencing a cell containing a formatted date or using the DATE function avoids ambiguity.",
                "question": {
                    "id": "excel-conditional-aggregation-q4",
                    "lessonId": "excel-conditional-aggregation-s4",
                    "prompt": "How do you dynamically reference a date in cell K1 inside a COUNTIFS greater-than condition?",
                    "options": [
                        {"id": "a", "text": "\">K1\""},
                        {"id": "b", "text": "\">=\"&K1"},
                        {"id": "c", "text": "=GREATER(K1)"}
                    ],
                    "answerId": "b",
                    "explanation": "Concatenating the string operator with the cell reference (\">=\"&K1) evaluates the cell dynamically."
                }
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "excel-conditional-aggregation-eq1",
                    "prompt": "What is the result of '=COUNTIF(A1:A5, \">0\")' if the cells contain -5, 0, 10, 20, and 'N/A'?",
                    "options": [
                        {"id": "a", "text": "2"},
                        {"id": "b", "text": "3"},
                        {"id": "c", "text": "4"}
                    ],
                    "answerId": "a",
                    "explanation": "Only 10 and 20 are strictly greater than 0; 0 is not >0, -5 is negative, and 'N/A' is text."
                },
                {
                    "id": "excel-conditional-aggregation-eq2",
                    "prompt": "Which formula correctly averages salaries in column E for employees in 'Design' (column B) with status 'Active' (column D)?",
                    "options": [
                        {"id": "a", "text": "=AVERAGEIFS(E:E, B:B, \"Design\", D:D, \"Active\")"},
                        {"id": "b", "text": "=AVERAGEIF(B:B, \"Design\", D:D, \"Active\", E:E)"},
                        {"id": "c", "text": "=SUMIFS(E:E, B:B, \"Design\") / COUNTIFS(D:D, \"Active\")"}
                    ],
                    "answerId": "a",
                    "explanation": "AVERAGEIFS takes average_range first (E:E), followed by criteria pairs (B:B, \"Design\", D:D, \"Active\")."
                },
                {
                    "id": "excel-conditional-aggregation-eq3",
                    "prompt": "What does '=COUNTIF(C1:C100, \"???\")' count?",
                    "options": [
                        {"id": "a", "text": "Cells containing question marks"},
                        {"id": "b", "text": "Cells containing text strings of exactly three characters"},
                        {"id": "c", "text": "Cells with error codes"}
                    ],
                    "answerId": "b",
                    "explanation": "Three consecutive question mark wildcards match text strings of exactly three characters."
                },
                {
                    "id": "excel-conditional-aggregation-eq4",
                    "prompt": "If SUMIFS evaluates criteria where range 1 has 50 rows and range 2 has 40 rows, what happens?",
                    "options": [
                        {"id": "a", "text": "Excel truncates range 1 to 40 rows automatically"},
                        {"id": "b", "text": "Excel returns a #VALUE! error because criteria ranges must have identical dimensions"},
                        {"id": "c", "text": "Excel pads range 2 with zeroes"}
                    ],
                    "answerId": "b",
                    "explanation": "All criteria ranges in SUMIFS/COUNTIFS must share the exact same row and column dimensions."
                },
                {
                    "id": "excel-conditional-aggregation-eq5",
                    "prompt": "How does '=SUMIF(A1:A10, \"<>Draft\", B1:B10)' behave?",
                    "options": [
                        {"id": "a", "text": "It sums column B where column A is NOT equal to 'Draft'"},
                        {"id": "b", "text": "It throws an error because <> is invalid syntax"},
                        {"id": "c", "text": "It only sums cells containing the word 'Draft'"}
                    ],
                    "answerId": "a",
                    "explanation": "The <> operator represents 'not equal to'."
                }
            ]
        }
    },
    {
        "id": "excel-dates-times",
        "version": 1,
        "order": 5,
        "title": "5. Date, Time & Temporal Financial Analytics",
        "summary": "Understand Excel's serial date architecture, extract calendar components, calculate aging buckets using DATEDIF, compute business days, and project debt maturity schedules.",
        "difficulty": "Intermediate",
        "minutes": 45,
        "codeExt": "csv",
        "code": """Invoice_ID,Client_Name,Invoice_Date,Due_Date,Payment_Date,Invoice_Amount,Days_To_Pay,Aging_Bucket
INV-901,Apex Dynamics,2026-01-10,2026-02-09,2026-02-04,18500.00,=DATEDIF(C2,E2,"D"),=IF(DATEDIF(C2,E2,"D")<=30,"0-30 Days",IF(DATEDIF(C2,E2,"D")<=60,"31-60 Days","60+ Days"))
INV-902,Horizon Media,2026-01-15,2026-02-14,2026-03-02,7200.00,=DATEDIF(C3,E3,"D"),=IF(DATEDIF(C3,E3,"D")<=30,"0-30 Days",IF(DATEDIF(C3,E3,"D")<=60,"31-60 Days","60+ Days"))
INV-903,Solstice Labs,2026-01-20,2026-02-19,2026-04-10,34000.00,=DATEDIF(C4,E4,"D"),=IF(DATEDIF(C4,E4,"D")<=30,"0-30 Days",IF(DATEDIF(C4,E4,"D")<=60,"31-60 Days","60+ Days"))
INV-904,Vanguard Health,2026-02-01,2026-03-03,2026-02-18,12400.00,=DATEDIF(C5,E5,"D"),=IF(DATEDIF(C5,E5,"D")<=30,"0-30 Days",IF(DATEDIF(C5,E5,"D")<=60,"31-60 Days","60+ Days"))
INV-905,Pinnacle Group,2026-02-05,2026-03-07,2026-04-01,9800.00,=DATEDIF(C6,E6,"D"),=IF(DATEDIF(C6,E6,"D")<=30,"0-30 Days",IF(DATEDIF(C6,E6,"D")<=60,"31-60 Days","60+ Days"))""",
        "dataset": [
            ["Invoice_ID", "Client_Name", "Invoice_Date", "Due_Date", "Payment_Date", "Invoice_Amount", "Days_To_Pay", "Aging_Bucket"],
            ["INV-901", "Apex Dynamics", "2026-01-10", "2026-02-09", "2026-02-04", 18500.00, "=DATEDIF(C2,E2,\"D\")", "=IF(DATEDIF(C2,E2,\"D\")<=30,\"0-30 Days\",IF(DATEDIF(C2,E2,\"D\")<=60,\"31-60 Days\",\"60+ Days\"))"],
            ["INV-902", "Horizon Media", "2026-01-15", "2026-02-14", "2026-03-02", 7200.00, "=DATEDIF(C3,E3,\"D\")", "=IF(DATEDIF(C3,E3,\"D\")<=30,\"0-30 Days\",IF(DATEDIF(C3,E3,\"D\")<=60,\"31-60 Days\",\"60+ Days\"))"],
            ["INV-903", "Solstice Labs", "2026-01-20", "2026-02-19", "2026-04-10", 34000.00, "=DATEDIF(C4,E4,\"D\")", "=IF(DATEDIF(C4,E4,\"D\")<=30,\"0-30 Days\",IF(DATEDIF(C4,E4,\"D\")<=60,\"31-60 Days\",\"60+ Days\"))"],
            ["INV-904", "Vanguard Health", "2026-02-01", "2026-03-03", "2026-02-18", 12400.00, "=DATEDIF(C5,E5,\"D\")", "=IF(DATEDIF(C5,E5,\"D\")<=30,\"0-30 Days\",IF(DATEDIF(C5,E5,\"D\")<=60,\"31-60 Days\",\"60+ Days\"))"],
            ["INV-905", "Pinnacle Group", "2026-02-05", "2026-03-07", "2026-04-01", 9800.00, "=DATEDIF(C6,E6,\"D\")", "=IF(DATEDIF(C6,E6,\"D\")<=30,\"0-30 Days\",IF(DATEDIF(C6,E6,\"D\")<=60,\"31-60 Days\",\"60+ Days\"))"]
        ],
        "steps": [
            "Review the accounts receivable ledger in A1:H6. Notice dates stored in standard ISO format YYYY-MM-DD.",
            "Click cell G2: =DATEDIF(C2,E2,\"D\") calculates the elapsed calendar days between invoice issuance and client remittance.",
            "Click cell H2: examine the nested IF classification that bins payments into aging categories ('0-30 Days', '31-60 Days', '60+ Days').",
            "Notice how invoice INV-903 took 80 days to clear, landing automatically in the '60+ Days' delinquency bucket.",
            "Experiment with changing Payment_Date in cell E2 to 2026-03-15 and observe the Days_To_Pay and Aging_Bucket update immediately."
        ],
        "expected": "Temporal calculations accurately evaluate payment turnaround durations and group receivables into risk cohorts for cash flow forecasting.",
        "challenge": "Add column I titled 'Overdue_Penalty' that applies a 1.5% penalty (=F2*0.015) if Days_To_Pay exceeds 30, and $0 otherwise.",
        "lessons": [
            {
                "id": "excel-dates-times-s1",
                "title": "Excel Serial Date-Time Architecture and Integer Day Counting",
                "paragraphs": [
                    "Underneath user-facing date formatting, Excel treats all dates as continuous sequential serial integers, where day 1 corresponds to January 1, 1900. For example, July 4, 2026 corresponds to serial number 46207 because exactly 46,206 days have elapsed since January 1, 1900. Times of day are represented as decimal fractions of a 24-hour day: 12:00 PM (noon) is exactly 0.5, 6:00 AM is 0.25, and 6:00 PM is 0.75.",
                    "Because dates are numbers, calendar arithmetic is straightforward: subtracting an earlier date from a later date (=B2-A2) yields the exact number of days between them. Adding 30 to a date (=A2+30) projects exactly 30 calendar days into the future. Formatting the result as 'Short Date' or 'Long Date' translates the underlying integer into human-readable calendar text."
                ],
                "pitfall": "Subtracting dates formatted as text strings will result in a #VALUE! error. Ensure dates are recognized as true date serials rather than text labels.",
                "question": {
                    "id": "excel-dates-times-q1",
                    "lessonId": "excel-dates-times-s1",
                    "prompt": "How does Excel internally store the date January 1, 1900?",
                    "options": [
                        {"id": "a", "text": "As the integer 1"},
                        {"id": "b", "text": "As the text string '1900-01-01'"},
                        {"id": "c", "text": "As an epoch timestamp in milliseconds"}
                    ],
                    "answerId": "a",
                    "explanation": "Excel's date system starts on January 1, 1900, which has serial integer value 1."
                }
            },
            {
                "id": "excel-dates-times-s2",
                "title": "Date Extraction & Assembly: DATE, YEAR, MONTH, DAY, TODAY",
                "paragraphs": [
                    "Excel provides modular functions to break down and assemble dates. Given a date cell A2, =YEAR(A2) extracts the four-digit year (e.g., 2026), =MONTH(A2) returns the month number from 1 to 12, and =DAY(A2) extracts the day of the month from 1 to 31. To determine the day of the week, =WEEKDAY(A2) returns 1 for Sunday through 7 for Saturday.",
                    "To reconstruct a clean date from disparate numerical components, use =DATE(year, month, day). The DATE function is resilient against overflow: entering =DATE(2026, 13, 1) automatically increments into January 2027. To inject dynamic real-time dates into models, =TODAY() returns the current computer calendar date, while =NOW() returns the current date and time."
                ],
                "pitfall": "=TODAY() and =NOW() are volatile functions that recalculate whenever any cell in the workbook changes, which can impact performance in massive models.",
                "question": {
                    "id": "excel-dates-times-q2",
                    "lessonId": "excel-dates-times-s2",
                    "prompt": "What does '=DATE(2026, 3, 15)' construct?",
                    "options": [
                        {"id": "a", "text": "March 15, 2026"},
                        {"id": "b", "text": "A text string '2026/03/15'"},
                        {"id": "c", "text": "The number 2026.315"}
                    ],
                    "answerId": "a",
                    "explanation": "DATE(year, month, day) constructs the valid Excel serial date for March 15, 2026."
                }
            },
            {
                "id": "excel-dates-times-s3",
                "title": "Date Arithmetic, EDATE, EOMONTH, and Aging Buckets",
                "paragraphs": [
                    "When forecasting monthly recurring revenue (MRR) or loan amortization schedules, adding 30 days is inaccurate because months vary in length (28, 30, or 31 days). Excel solves this with =EDATE(start_date, months), which moves forward or backward by an exact number of calendar months. For example, =EDATE('2026-01-31', 1) outputs February 28, 2026.",
                    "To determine payment terms such as 'Net 30 from end of month', =EOMONTH(start_date, months) calculates the exact final day of the month. Setting months to 0 returns the end of the current month; setting months to 1 returns the end of the following month. For aging analysis, =DATEDIF(start_date, end_date, unit) calculates the difference in days ('D'), complete months ('M'), or complete years ('Y')."
                ],
                "pitfall": "DATEDIF requires that start_date is earlier than or equal to end_date. If start_date is after end_date, DATEDIF returns a #NUM! error.",
                "question": {
                    "id": "excel-dates-times-q3",
                    "lessonId": "excel-dates-times-s3",
                    "prompt": "What does '=EOMONTH(\"2026-02-10\", 0)' evaluate to?",
                    "options": [
                        {"id": "a", "text": "February 28, 2026"},
                        {"id": "b", "text": "March 31, 2026"},
                        {"id": "c", "text": "February 1, 2026"}
                    ],
                    "answerId": "a",
                    "explanation": "EOMONTH with 0 offset returns the last calendar day of February (the 28th in non-leap year 2026)."
                }
            },
            {
                "id": "excel-dates-times-s4",
                "title": "Business Day Calculations and Turnaround SLAs",
                "paragraphs": [
                    "Supply chain and project management workflows depend on working business days rather than raw calendar days. =NETWORKDAYS(start_date, end_date, [holidays]) calculates the total number of working days between two dates, automatically excluding Saturdays and Sundays. An optional third parameter accepts a range of corporate holiday dates to exclude.",
                    "To project delivery milestones, =WORKDAY(start_date, days, [holidays]) adds a specified number of working days to a start date. If an engineering sprint begins on Friday and takes 3 business days, WORKDAY skips Saturday and Sunday, returning Wednesday as the completion deadline."
                ],
                "pitfall": "Using simple subtraction (=End_Date - Start_Date) on project schedules counts weekends, artificially inflating project velocity metrics.",
                "question": {
                    "id": "excel-dates-times-q4",
                    "lessonId": "excel-dates-times-s4",
                    "prompt": "What does '=NETWORKDAYS(start_date, end_date)' automatically exclude?",
                    "options": [
                        {"id": "a", "text": "Saturdays and Sundays"},
                        {"id": "b", "text": "Federal holidays automatically without configuration"},
                        {"id": "c", "text": "Fridays"}
                    ],
                    "answerId": "a",
                    "explanation": "NETWORKDAYS automatically excludes standard weekend days (Saturday and Sunday)."
                }
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "excel-dates-times-eq1",
                    "prompt": "If cell A1 contains the serial date for today and cell A2 contains '=A1+7', what does A2 represent?",
                    "options": [
                        {"id": "a", "text": "Exactly 7 calendar days after today"},
                        {"id": "b", "text": "7 working business days after today"},
                        {"id": "c", "text": "7 months after today"}
                    ],
                    "answerId": "a",
                    "explanation": "Adding integers directly to date serials adds calendar days."
                },
                {
                    "id": "excel-dates-times-eq2",
                    "prompt": "What function calculates completed full years between a birthdate in A2 and today?",
                    "options": [
                        {"id": "a", "text": "=YEAR(TODAY()) - YEAR(A2)"},
                        {"id": "b", "text": "=DATEDIF(A2, TODAY(), \"Y\")"},
                        {"id": "c", "text": "=EDATE(A2, 12)"}
                    ],
                    "answerId": "b",
                    "explanation": "DATEDIF with unit 'Y' accurately calculates completed full years between two dates."
                },
                {
                    "id": "excel-dates-times-eq3",
                    "prompt": "What does '=EDATE(\"2026-05-15\", 3)' return?",
                    "options": [
                        {"id": "a", "text": "August 15, 2026"},
                        {"id": "b", "text": "May 18, 2026"},
                        {"id": "c", "text": "July 15, 2026"}
                    ],
                    "answerId": "a",
                    "explanation": "EDATE advances the month by 3 (from May to August) on the same day."
                },
                {
                    "id": "excel-dates-times-eq4",
                    "prompt": "What does a time serial value of 0.75 represent in Excel?",
                    "options": [
                        {"id": "a", "text": "6:00 PM (18:00)"},
                        {"id": "b", "text": "9:00 AM"},
                        {"id": "c", "text": "75 minutes past midnight"}
                    ],
                    "answerId": "a",
                    "explanation": "0.75 of a 24-hour day is 18 hours, which equals 6:00 PM."
                },
                {
                    "id": "excel-dates-times-eq5",
                    "prompt": "Why might a date display as a 5-digit number like '46207'?",
                    "options": [
                        {"id": "a", "text": "The cell format was changed from Date to General/Number, revealing the raw serial value"},
                        {"id": "b", "text": "A formula error corrupted the date"},
                        {"id": "c", "text": "The date exceeds the year 2099"}
                    ],
                    "answerId": "a",
                    "explanation": "Formatting as General exposes the underlying serial integer that Excel uses for date calculations."
                }
            ]
        }
    },
    {
        "id": "excel-data-wrangling",
        "version": 1,
        "order": 6,
        "title": "6. Data Wrangling, Validation & Deduplication",
        "summary": "Structure tidy tabular datasets, enforce data entry integrity with in-cell validation rules, eliminate duplicate records, and leverage dynamic arrays like UNIQUE, SORT, and FILTER.",
        "difficulty": "Intermediate",
        "minutes": 45,
        "codeExt": "csv",
        "code": """Record_ID,Product_SKU,Category,Warehouse_Zone,Stock_Qty,Reorder_Threshold,Status
REC-101,SKU-A10,Hardware,Zone-1,45,20,In Stock
REC-102,SKU-B20,Electronics,Zone-2,12,15,Low Stock
REC-103,SKU-C30,Furniture,Zone-1,85,30,In Stock
REC-104,SKU-A10,Hardware,Zone-1,45,20,Duplicate
REC-105,SKU-D40,Electronics,Zone-3,8,10,Low Stock
REC-106,SKU-E50,Hardware,Zone-2,64,25,In Stock""",
        "dataset": [
            ["Record_ID", "Product_SKU", "Category", "Warehouse_Zone", "Stock_Qty", "Reorder_Threshold", "Status"],
            ["REC-101", "SKU-A10", "Hardware", "Zone-1", 45, 20, "In Stock"],
            ["REC-102", "SKU-B20", "Electronics", "Zone-2", 12, 15, "Low Stock"],
            ["REC-103", "SKU-C30", "Furniture", "Zone-1", 85, 30, "In Stock"],
            ["REC-104", "SKU-A10", "Hardware", "Zone-1", 45, 20, "Duplicate"],
            ["REC-105", "SKU-D40", "Electronics", "Zone-3", 8, 10, "Low Stock"],
            ["REC-106", "SKU-E50", "Hardware", "Zone-2", 64, 25, "In Stock"]
        ],
        "steps": [
            "Review the warehouse inventory register in rows 1 to 7.",
            "Identify the duplicate entry in row 5: SKU-A10 repeats with identical attributes from row 2.",
            "Understand how Data Validation prevents faulty inputs by restricting column D to a fixed list: 'Zone-1, Zone-2, Zone-3'.",
            "Notice how column G uses a conditional test: if Stock_Qty is less than Reorder_Threshold, flag as 'Low Stock'.",
            "Use the Data tab to test sorting by Stock_Qty in ascending order."
        ],
        "expected": "The dataset adheres to tidy tabular structure with deduplicated keys, validated drop-down categories, and automated reorder triggers.",
        "challenge": "Extract the unique set of product categories from column C using deduplication or the =UNIQUE(C2:C7) dynamic array formula.",
        "lessons": [
            {
                "id": "excel-data-wrangling-s1",
                "title": "Tidy Data Principles, Header Hygiene, and Eliminating Merged Cells",
                "paragraphs": [
                    "The foundation of all advanced analytics and automated modeling in Excel is tidy data architecture. In a tidy dataset: 1) Each column represents a distinct variable; 2) Each row represents a single individual observation or transaction; and 3) Each cell contains a single atomic value. Datasets should have a single, concise header row with no blank columns or total rows interleaved in the middle of the data.",
                    "The single most destructive formatting feature in spreadsheets is merged cells. Merging cells (e.g., merging A1:C1 across columns) breaks formula cell references, blocks column sorting, disables AutoFilter, and causes VBA scripts to fail. Professional analysts use 'Center Across Selection' in cell alignment formatting rather than merging."
                ],
                "pitfall": "Never merge cells across table columns. Merging cells breaks sorting, filtering, and formula indexing.",
                "question": {
                    "id": "excel-data-wrangling-q1",
                    "lessonId": "excel-data-wrangling-s1",
                    "prompt": "Why are merged cells discouraged in analytical tables?",
                    "options": [
                        {"id": "a", "text": "They prevent sorting, break range referencing, and disable table filtering"},
                        {"id": "b", "text": "They double the file size on disk"},
                        {"id": "c", "text": "They convert numbers into text strings"}
                    ],
                    "answerId": "a",
                    "explanation": "Merged cells create irregular rectangular geometry that breaks core sorting, filtering, and indexing operations."
                }
            },
            {
                "id": "excel-data-wrangling-s2",
                "title": "Deduplication Workflows and Modern Dynamic Arrays (UNIQUE, SORT)",
                "paragraphs": [
                    "Duplicate records distort business analysis by double-counting revenues, inflating inventory valuations, and biasing customer attrition rates. Excel offers two approaches to deduplication: static elimination via Data > Remove Duplicates, and dynamic formula extraction using modern Dynamic Array formulas.",
                    "The =UNIQUE(array) function scans a range and outputs only distinct records into adjacent cells via formula spilling. Combining it with SORT, =SORT(UNIQUE(C2:C100)), produces a clean, alphabetically sorted list of unique categories that updates dynamically when new rows are added to the source data."
                ],
                "pitfall": "If a formula spills into cells that already contain data, Excel returns a #SPILL! error. Clear the destination cells to allow the dynamic array to expand.",
                "question": {
                    "id": "excel-data-wrangling-q2",
                    "lessonId": "excel-data-wrangling-s2",
                    "prompt": "What does '=UNIQUE(A2:A20)' return in modern Excel?",
                    "options": [
                        {"id": "a", "text": "A spilled dynamic list containing only the distinct non-duplicate entries from A2:A20"},
                        {"id": "b", "text": "The count of unique values"},
                        {"id": "c", "text": "A single text string with comma-separated values"}
                    ],
                    "answerId": "a",
                    "explanation": "UNIQUE returns a dynamic array of distinct values that spills down the worksheet."
                }
            },
            {
                "id": "excel-data-wrangling-s3",
                "title": "Data Validation: In-Cell Dropdown Lists and Numeric Constraints",
                "paragraphs": [
                    "The most effective way to maintain data hygiene is preventing dirty data entry at the source. Excel's Data Validation feature enforces strict input rules on designated cells. Common validation types include: List (providing an in-cell drop-down menu), Whole Number / Decimal (e.g., restricting discount rates between 0.0 and 0.5), Date (enforcing non-past dates), and Custom Formulas.",
                    "Configuring Input Messages guides users before typing, while custom Error Alerts (Stop, Warning, Information) reject invalid inputs. A 'Stop' alert completely prevents the user from committing an invalid entry, protecting downstream formulas from unexpected strings."
                ],
                "pitfall": "Copying and pasting a cell over a validated cell overwrites the validation rule. Use Paste Special > Values to protect data validation constraints.",
                "question": {
                    "id": "excel-data-wrangling-q3",
                    "lessonId": "excel-data-wrangling-s3",
                    "prompt": "How do you create an in-cell dropdown list restricted to 'North, South, East, West'?",
                    "options": [
                        {"id": "a", "text": "Select Data Validation > Allow: List > enter 'North, South, East, West' in the Source field"},
                        {"id": "b", "text": "Type '=DROPDOWN(\"North\",\"South\",\"East\",\"West\")' in the cell"},
                        {"id": "c", "text": "Format the cells as Text"}
                    ],
                    "answerId": "a",
                    "explanation": "Data Validation with Allow set to List and comma-separated entries generates a native dropdown menu."
                }
            },
            {
                "id": "excel-data-wrangling-s4",
                "title": "Conditional Formatting: Top 10%, Data Bars, and Formula Triggers",
                "paragraphs": [
                    "Conditional formatting applies dynamic styles (font colors, fills, borders, icons) based on cell values or custom formula evaluations. Prebuilt rules include Highlight Cells Rules (greater than, text contains, duplicates) and Top/Bottom Rules (top 10%, above average).",
                    "For advanced dashboards, custom formula rules provide granular control. For example, applying the rule =AND($D2='Overdue', $E2>1000) with a light red fill highlights high-priority overdue balances across the entire row. In multi-rule environments, the Conditional Formatting Rules Manager manages evaluation precedence and supports 'Stop If True' flags."
                ],
                "pitfall": "Applying conditional formatting across entire million-row columns (e.g. A:A) forces Excel to evaluate formatting on millions of empty cells, causing severe workbook lag.",
                "question": {
                    "id": "excel-data-wrangling-q4",
                    "lessonId": "excel-data-wrangling-s4",
                    "prompt": "Why is absolute column referencing ($) used in '=$C2>100' when formatting an entire row?",
                    "options": [
                        {"id": "a", "text": "It ensures every cell across columns A through F looks at column C to decide whether to highlight"},
                        {"id": "b", "text": "It locks the formula from being edited by unauthorized users"},
                        {"id": "c", "text": "It converts the evaluation into currency"}
                    ],
                    "answerId": "a",
                    "explanation": "Locking column C with $C2 forces every column in row 2 to evaluate column C's value for the rule."
                }
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "excel-data-wrangling-eq1",
                    "prompt": "What does a #SPILL! error signify in modern Excel?",
                    "options": [
                        {"id": "a", "text": "A dynamic array formula cannot expand because existing data is blocking the spill range"},
                        {"id": "b", "text": "The workbook file size has exceeded memory limits"},
                        {"id": "c", "text": "A formula contains an invalid mathematical operator"}
                    ],
                    "answerId": "a",
                    "explanation": "#SPILL! indicates that cells in the dynamic array's calculated output path are occupied."
                },
                {
                    "id": "excel-data-wrangling-eq2",
                    "prompt": "Which formatting feature provides the visual centering of merged cells without their destructive side effects?",
                    "options": [
                        {"id": "a", "text": "Center Across Selection in Horizontal Alignment"},
                        {"id": "b", "text": "Wrap Text"},
                        {"id": "c", "text": "AutoFit Column Width"}
                    ],
                    "answerId": "a",
                    "explanation": "Center Across Selection visually centers text across columns while leaving cells unmerged."
                },
                {
                    "id": "excel-data-wrangling-eq3",
                    "prompt": "What formula sorts the unique items in range B2:B50 in alphabetical order?",
                    "options": [
                        {"id": "a", "text": "=SORT(UNIQUE(B2:B50))"},
                        {"id": "b", "text": "=ORDER(DISTINCT(B2:B50))"},
                        {"id": "c", "text": "=ALPHABETIZE(B2:B50)"}
                    ],
                    "answerId": "a",
                    "explanation": "=SORT(UNIQUE(range)) extracts unique values and sorts them ascending."
                },
                {
                    "id": "excel-data-wrangling-eq4",
                    "prompt": "What Data Validation error alert style completely blocks a user from saving invalid data?",
                    "options": [
                        {"id": "a", "text": "Stop"},
                        {"id": "b", "text": "Warning"},
                        {"id": "c", "text": "Information"}
                    ],
                    "answerId": "a",
                    "explanation": "'Stop' rejects invalid entries and prevents the user from committing them to the cell."
                },
                {
                    "id": "excel-data-wrangling-eq5",
                    "prompt": "What is the primary characteristic of a 'tidy' dataset?",
                    "options": [
                        {"id": "a", "text": "Each variable forms a column, each observation forms a row, and each cell holds a single value"},
                        {"id": "b", "text": "All numbers are highlighted in green and borders are dark blue"},
                        {"id": "c", "text": "Summary total rows appear after every five data rows"}
                    ],
                    "answerId": "a",
                    "explanation": "Tidy data structure dictates one variable per column, one observation per row, and atomic values."
                }
            ]
        }
    },
    {
        "id": "excel-pivot-tables",
        "version": 1,
        "order": 7,
        "title": "7. Pivot Tables, Slicers & Multidimensional Summaries",
        "summary": "Build high-speed pivot tables, summarize multidimensional business datasets, group temporal dates into fiscal quarters, compute percentage distributions, and connect interactive slicers.",
        "difficulty": "Intermediate",
        "minutes": 45,
        "codeExt": "csv",
        "code": """Region,Channel,Category,Quarter,Sales_Revenue,Transaction_Count
North,Online,Electronics,Q1,45000.00,120
North,In-Store,Electronics,Q1,38000.00,95
South,Online,Furniture,Q1,29000.00,48
South,In-Store,Furniture,Q1,41000.00,72
East,Online,Electronics,Q1,52000.00,140
East,In-Store,Furniture,Q1,34000.00,60
West,Online,Furniture,Q1,48000.00,85
West,In-Store,Electronics,Q1,31000.00,78""",
        "dataset": [
            ["Region", "Channel", "Category", "Quarter", "Sales_Revenue", "Transaction_Count"],
            ["North", "Online", "Electronics", "Q1", 45000.00, 120],
            ["North", "In-Store", "Electronics", "Q1", 38000.00, 95],
            ["South", "Online", "Furniture", "Q1", 29000.00, 48],
            ["South", "In-Store", "Furniture", "Q1", 41000.00, 72],
            ["East", "Online", "Electronics", "Q1", 52000.00, 140],
            ["East", "In-Store", "Furniture", "Q1", 34000.00, 60],
            ["West", "Online", "Furniture", "Q1", 48000.00, 85],
            ["West", "In-Store", "Electronics", "Q1", 31000.00, 78]
        ],
        "steps": [
            "Review the multi-region omnichannel sales transaction dataset in A1:F9.",
            "Open the Pivot Table generator on the Insert tab or Analytics panel.",
            "Set 'Region' as the Row field, 'Sales_Revenue' as the Value field, and 'SUM' as the aggregation.",
            "Observe the resulting pivot matrix: East ($86,000), North ($83,000), South ($70,000), and West ($79,000) totaling $318,000.",
            "Switch the aggregation function to 'AVERAGE' to compare mean transaction revenue per region."
        ],
        "expected": "A multidimensional pivot summary groups raw records into clean regional and channel totals with grand totals.",
        "challenge": "Generate a pivot table grouping by Category (Row) and Channel (Column) with the sum of Sales_Revenue in the values zone.",
        "lessons": [
            {
                "id": "excel-pivot-tables-s1",
                "title": "Pivot Table Architecture, Source Data Range & The Pivot Cache",
                "paragraphs": [
                    "Pivot Tables are Excel's premier analytical tool for aggregating, summarizing, and exploring large datasets without writing complex multi-cell formulas. When you create a Pivot Table, Excel reads the tabular source range and builds an internal optimized memory index known as the Pivot Cache. All subsequent grouping, filtering, and aggregation operations query this memory cache instantaneously.",
                    "Because the Pivot Table reads from the cache rather than live cells, changes to underlying spreadsheet data are not immediately reflected in the Pivot Table. Analysts must click Refresh (or press Alt+F5) to reload the cache. Structuring source data as an official Excel Table (Insert > Table or Ctrl+T) ensures that newly appended rows are automatically encompassed by the Pivot Table when refreshed."
                ],
                "pitfall": "Modifying raw source cells does not automatically update a Pivot Table. Always refresh the Pivot Table to pull updated values from the cache.",
                "question": {
                    "id": "excel-pivot-tables-q1",
                    "lessonId": "excel-pivot-tables-s1",
                    "prompt": "Why doesn't a Pivot Table update immediately when you edit a number in the raw source data?",
                    "options": [
                        {"id": "a", "text": "Pivot Tables operate on an in-memory Pivot Cache that must be refreshed to capture changes"},
                        {"id": "b", "text": "Excel requires you to re-install Office to update tables"},
                        {"id": "c", "text": "Pivot Tables are permanently read-only once created"}
                    ],
                    "answerId": "a",
                    "explanation": "Pivot Tables query an internal Pivot Cache for high performance, requiring a Refresh action to sync updates."
                }
            },
            {
                "id": "excel-pivot-tables-s2",
                "title": "Field Placement: Rows, Columns, Values, and Filter Zones",
                "paragraphs": [
                    "The PivotTable Fields pane provides four interactive drop zones: Rows, Columns, Values, and Filters. Placing a field in Rows creates unique row labels down the left edge of the table (e.g., Sales Representatives). Placing a field in Columns creates unique column headers across the top (e.g., Quarters or Product Categories).",
                    "The Values zone performs mathematical summaries on fields. Numeric fields placed in Values default to SUM, whereas text fields default to COUNT. You can drag the same field into Values multiple times—for example, displaying both the SUM of Revenue and the AVERAGE of Revenue side-by-side. The Filters zone creates a top-level report dropdown filter to isolate specific segments."
                ],
                "pitfall": "Dragging a numeric column containing even a single blank or text cell into Values can cause Excel to default to COUNT rather than SUM.",
                "question": {
                    "id": "excel-pivot-tables-q2",
                    "lessonId": "excel-pivot-tables-s2",
                    "prompt": "What happens if a text column (like 'Employee Name') is dragged into the Values zone of a Pivot Table?",
                    "options": [
                        {"id": "a", "text": "Excel defaults to the COUNT aggregation function"},
                        {"id": "b", "text": "Excel displays a #VALUE! error"},
                        {"id": "c", "text": "Excel concatenates all names into a single cell"}
                    ],
                    "answerId": "a",
                    "explanation": "Non-numeric fields dragged into the Values zone automatically default to COUNT."
                }
            },
            {
                "id": "excel-pivot-tables-s3",
                "title": "Custom Value Field Summaries: % of Total, Running Totals, and Counts",
                "paragraphs": [
                    "By default, Pivot Tables summarize values as raw sums. However, business decisions often hinge on relative proportions rather than absolute magnitudes: What percentage of total company revenue does Europe generate? What is each product's contribution to category profit?",
                    "Through Value Field Settings > Show Values As, Excel offers advanced relational computations: '% of Grand Total', '% of Column Total', '% of Row Total', 'Difference From' (comparing periods), and 'Running Total In' (for cumulative cash flow curves). These calculations execute instantaneously within the Pivot Cache without authoring auxiliary formulas."
                ],
                "pitfall": "Renaming a Pivot Table value header to match an existing source column name exactly (e.g. naming the header 'Sales') causes an error. Add a trailing space ('Sales ') to resolve the conflict.",
                "question": {
                    "id": "excel-pivot-tables-q3",
                    "lessonId": "excel-pivot-tables-s3",
                    "prompt": "How do you display each regional sales figure as a percentage of overall company revenue in a Pivot Table?",
                    "options": [
                        {"id": "a", "text": "Right-click the value cell > Show Values As > % of Grand Total"},
                        {"id": "b", "text": "Type '=B2/SUM(B:B)' manually in an adjacent column"},
                        {"id": "c", "text": "Format the raw numbers as percentage"}
                    ],
                    "answerId": "a",
                    "explanation": "'Show Values As > % of Grand Total' dynamically computes contribution percentages."
                }
            },
            {
                "id": "excel-pivot-tables-s4",
                "title": "Interactive Slicers, Multi-Table Connections & Report Layouts",
                "paragraphs": [
                    "Slicers are visual interactive filter controls that replace clumsy drop-down filter menus with modern, clickable buttons. When you click a button in a Slicer (e.g., selecting 'West Region'), the connected Pivot Table immediately filters to that subset. Slicers can be styled with custom color palettes and arranged in multiple columns.",
                    "Crucially, a single Slicer can be connected to multiple Pivot Tables simultaneously via Slicer > Report Connections. This capability allows analysts to construct interactive executive dashboards where clicking a single year, channel, or division button synchronizes every chart, matrix, and KPI card across the entire sheet."
                ],
                "pitfall": "For Slicers to control multiple Pivot Tables via Report Connections, all connected Pivot Tables must share the same underlying Pivot Cache (source data).",
                "question": {
                    "id": "excel-pivot-tables-q4",
                    "lessonId": "excel-pivot-tables-s4",
                    "prompt": "What feature enables one Slicer button to filter three different Pivot Tables simultaneously?",
                    "options": [
                        {"id": "a", "text": "Slicer Report Connections"},
                        {"id": "b", "text": "VLOOKUP links"},
                        {"id": "c", "text": "Conditional Formatting Rules"}
                    ],
                    "answerId": "a",
                    "explanation": "Report Connections link a Slicer to multiple Pivot Tables sharing the same Pivot Cache."
                }
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "excel-pivot-tables-eq1",
                    "prompt": "What keyboard shortcut refreshes the active Pivot Table in Excel for Windows?",
                    "options": [
                        {"id": "a", "text": "Alt + F5"},
                        {"id": "b", "text": "Ctrl + P"},
                        {"id": "c", "text": "Shift + F11"}
                    ],
                    "answerId": "a",
                    "explanation": "Alt + F5 refreshes the current Pivot Table; Ctrl + Alt + F5 refreshes all tables in the workbook."
                },
                {
                    "id": "excel-pivot-tables-eq2",
                    "prompt": "What setting converts a Pivot Table layout from compact form to structured columns with repeating labels?",
                    "options": [
                        {"id": "a", "text": "Report Layout: Tabular Form"},
                        {"id": "b", "text": "Format Cells: Accounting"},
                        {"id": "c", "text": "Data > Text to Columns"}
                    ],
                    "answerId": "a",
                    "explanation": "Tabular Form presents each row field in its own separate column, ideal for exporting."
                },
                {
                    "id": "excel-pivot-tables-eq3",
                    "prompt": "What happens when you double-click any numeric aggregated value inside a Pivot Table?",
                    "options": [
                        {"id": "a", "text": "Excel generates a new sheet containing the exact underlying raw records that contribute to that value"},
                        {"id": "b", "text": "The entire Pivot Table is cleared"},
                        {"id": "c", "text": "The value is deleted from the source data"}
                    ],
                    "answerId": "a",
                    "explanation": "Double-clicking an aggregated cell triggers 'Drill Down', exporting contributing raw rows to a new tab."
                },
                {
                    "id": "excel-pivot-tables-eq4",
                    "prompt": "Where can you add a custom formula calculation (like Revenue - Cost) directly inside a Pivot Table?",
                    "options": [
                        {"id": "a", "text": "PivotTable Analyze > Fields, Items, & Sets > Calculated Field"},
                        {"id": "b", "text": "Formula Bar above the sheet"},
                        {"id": "c", "text": "Conditional Formatting Manager"}
                    ],
                    "answerId": "a",
                    "explanation": "Calculated Fields evaluate custom mathematical formulas within the Pivot Cache."
                },
                {
                    "id": "excel-pivot-tables-eq5",
                    "prompt": "Why is converting raw source data to an official Excel Table (Ctrl+T) recommended before inserting a Pivot Table?",
                    "options": [
                        {"id": "a", "text": "Dynamic table ranges automatically expand to include newly added rows when the Pivot Table is refreshed"},
                        {"id": "b", "text": "Excel Tables automatically translate text into French"},
                        {"id": "c", "text": "Tables encrypt the spreadsheet data"}
                    ],
                    "answerId": "a",
                    "explanation": "Excel Tables expand dynamically when rows are appended, preventing orphaned data on refresh."
                }
            ]
        }
    },
    {
        "id": "excel-charts-visualization",
        "version": 1,
        "order": 8,
        "title": "8. Data Visualization & Business Dashboards",
        "summary": "Design high-impact business visualizations: column and bar charts, time-series line trends, pie proportions, data-ink ratio principles, and clean executive KPI dashboards.",
        "difficulty": "Intermediate",
        "minutes": 45,
        "codeExt": "csv",
        "code": """Month,New_MRR,Expansion_MRR,Churned_MRR,Net_New_MRR,Total_ARR
Jan-2026,24500,8200,4100,=B2+C2-D2,343200
Feb-2026,28000,9400,3800,=B3+C3-D3,383600
Mar-2026,31200,11500,4500,=B4+C4-D4,429800
Apr-2026,29800,12100,5200,=B5+C5-D5,474100
May-2026,35400,14200,4900,=B6+C6-D6,527700
Jun-2026,41000,16500,5800,=B7+C7-D7,589700""",
        "dataset": [
            ["Month", "New_MRR", "Expansion_MRR", "Churned_MRR", "Net_New_MRR", "Total_ARR"],
            ["Jan-2026", 24500, 8200, 4100, "=B2+C2-D2", 343200],
            ["Feb-2026", 28000, 9400, 3800, "=B3+C3-D3", 383600],
            ["Mar-2026", 31200, 11500, 4500, "=B4+C4-D4", 429800],
            ["Apr-2026", 29800, 12100, 5200, "=B5+C5-D5", 474100],
            ["May-2026", 35400, 14200, 4900, "=B6+C6-D6", 527700],
            ["Jun-2026", 41000, 16500, 5800, "=B7+C7-D7", 589700]
        ],
        "steps": [
            "Review the monthly SaaS recurring revenue growth model in A1:F7.",
            "Inspect column E: Net_New_MRR is calculated as New_MRR + Expansion_MRR - Churned_MRR.",
            "Use the Insert tab or Analytics panel to generate a Column Chart comparing New MRR across the 6-month period.",
            "Switch chart view to a Line Chart to visualize the upward trajectory of Total ARR from $343k to $589k.",
            "Observe how clear axis labels, gridlines, and uncluttered legends maximize executive decision-making speed."
        ],
        "expected": "Visualizations accurately communicate monthly growth trajectories, cohort retention, and revenue expansion without clutter.",
        "challenge": "Generate a Pie Chart representing the proportion of New MRR versus Expansion MRR for the month of June.",
        "lessons": [
            {
                "id": "excel-charts-visualization-s1",
                "title": "Visual Communication Taxonomy: Matching Chart Type to Data Shape",
                "paragraphs": [
                    "Effective data visualization is not about aesthetic ornamentation; it is about communicating empirical truth with minimum cognitive friction. Choosing the wrong chart type distorts analysis and misleads stakeholders. Charts fall into five primary communication objectives: 1) Comparison (discrete categorical comparisons); 2) Trend (continuous changes over time); 3) Composition (parts of a whole); 4) Distribution (frequency histograms); and 5) Relationship (correlation between two numeric variables).",
                    "Column and Bar charts excel at categorical comparison. Line charts are the gold standard for continuous time series. Scatter plots reveal correlation and clustering between two continuous numeric variables. Treemaps and waterfall charts illustrate hierarchical composition and sequential variance."
                ],
                "pitfall": "Pie charts with more than 5 slices or similarly sized slices are nearly impossible for the human eye to compare accurately. Use horizontal bar charts instead.",
                "question": {
                    "id": "excel-charts-visualization-q1",
                    "lessonId": "excel-charts-visualization-s1",
                    "prompt": "Which chart type is best suited for showing monthly revenue growth over a continuous 24-month timeline?",
                    "options": [
                        {"id": "a", "text": "Line Chart"},
                        {"id": "b", "text": "Pie Chart"},
                        {"id": "c", "text": "Radar Chart"}
                    ],
                    "answerId": "a",
                    "explanation": "Line charts display continuous time-series trends effectively by connecting chronological intervals."
                }
            },
            {
                "id": "excel-charts-visualization-s2",
                "title": "Bar and Column Charts: Comparisons, Clustered Bars & Baseline Truth",
                "paragraphs": [
                    "Column charts display vertical bars, while Bar charts display horizontal bars. When category names are lengthy (such as department descriptions or product titles), horizontal bar charts are strongly preferred because labels read naturally from left to right without diagonal tilting.",
                    "A cardinal rule of ethical data visualization is that bar and column chart value axes must always start at zero. Truncating the vertical baseline (e.g., starting a y-axis at $950 rather than $0 to show values of $980 and $1,000) visually exaggerates a 2% difference into a 500% perceptual gap, misleading leadership."
                ],
                "pitfall": "Never truncate the value baseline of a bar or column chart; non-zero baselines visually distort proportionality.",
                "question": {
                    "id": "excel-charts-visualization-q2",
                    "lessonId": "excel-charts-visualization-s2",
                    "prompt": "Why must the numerical axis of a column or bar chart always start at zero?",
                    "options": [
                        {"id": "a", "text": "To preserve truthful visual proportions between bar heights"},
                        {"id": "b", "text": "Because Excel formulas fail if zero is omitted"},
                        {"id": "c", "text": "To allow negative numbers to render"}
                    ],
                    "answerId": "a",
                    "explanation": "The human brain judges bar size by total height; non-zero baselines distort visual truth."
                }
            },
            {
                "id": "excel-charts-visualization-s3",
                "title": "Time-Series Trends: Line Charts, Dual-Axis Risks, and Trendlines",
                "paragraphs": [
                    "Line charts visualize velocity and acceleration in key business metrics. Unlike bar charts, line charts do not require a zero baseline if the goal is detecting subtle rate-of-change fluctuations (e.g. stock index volatility), provided the axis range is clearly labeled.",
                    "Analysts often combine metrics with different units (e.g., Revenue in millions and Conversion Rate in percentages) on a Combo Chart with a secondary axis. However, dual-axis charts carry visual confusion risks because two separate vertical scales share the same plotting area. Clear color coordination between line series and their corresponding axis labels is essential."
                ],
                "pitfall": "Dual-axis charts can lead to false causal assumptions if the two scales are arbitrarily scaled. Always evaluate if two stacked separate charts communicate more clearly.",
                "question": {
                    "id": "excel-charts-visualization-q3",
                    "lessonId": "excel-charts-visualization-s3",
                    "prompt": "When is a secondary vertical axis appropriate on a Combo Chart?",
                    "options": [
                        {"id": "a", "text": "When comparing two series that have drastically different scales or units (e.g., Revenue in dollars and Margin in %)"},
                        {"id": "b", "text": "When plotting more than 10 categories"},
                        {"id": "c", "text": "To make the chart look more complex"}
                    ],
                    "answerId": "a",
                    "explanation": "A secondary axis accommodates two series measured in different units or orders of magnitude."
                }
            },
            {
                "id": "excel-charts-visualization-s4",
                "title": "Executive Dashboard Architecture: Visual Hierarchy & Grid Alignment",
                "paragraphs": [
                    "Edward Tufte's data-ink ratio principle states that the majority of ink (or pixels) on a graphic should present core data rather than decorative chrome. High-performing dashboards eliminate 3D effects, heavy dark gridlines, redundant legends, and drop shadows.",
                    "Professional dashboards follow a top-down visual hierarchy: 1) Executive Summary Header with filter dates; 2) High-level KPI Scorecards (Cards showing Net Revenue, Churn %, and Headcount with sparklines); 3) Primary Trend and Comparison Charts in the center; and 4) Detailed tabular breakdowns at the bottom. Aligning visual components to an underlying 12-column grid gives the layout polish and cohesion."
                ],
                "pitfall": "Avoid 3D charts entirely. 3D perspective distorts bar heights and slice angles, making objective measurement impossible.",
                "question": {
                    "id": "excel-charts-visualization-q4",
                    "lessonId": "excel-charts-visualization-s4",
                    "prompt": "What does Edward Tufte's 'data-ink ratio' recommend maximizing?",
                    "options": [
                        {"id": "a", "text": "The proportion of visual pixels dedicated directly to displaying core data rather than decorative clutter"},
                        {"id": "b", "text": "The use of bright neon background colors"},
                        {"id": "c", "text": "The number of 3D shadows and beveled edges"}
                    ],
                    "answerId": "a",
                    "explanation": "Maximizing data-ink means removing non-essential decoration so data stands out clearly."
                }
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "excel-charts-visualization-eq1",
                    "prompt": "Why are 3D pie and 3D bar charts considered poor practice in financial reporting?",
                    "options": [
                        {"id": "a", "text": "Perspective distortion makes slices in the foreground appear artificially larger than identical slices in the background"},
                        {"id": "b", "text": "They cannot be printed on paper"},
                        {"id": "c", "text": "They crash older versions of Windows"}
                    ],
                    "answerId": "a",
                    "explanation": "3D perspective skews geometric proportions, compromising objective data comprehension."
                },
                {
                    "id": "excel-charts-visualization-eq2",
                    "prompt": "What visual element displays a compact, in-cell micro-chart showing trend history alongside tabular data?",
                    "options": [
                        {"id": "a", "text": "Sparkline"},
                        {"id": "b", "text": "PivotTable"},
                        {"id": "c", "text": "Slicer"}
                    ],
                    "answerId": "a",
                    "explanation": "Sparklines are miniature word-sized charts embedded directly inside individual grid cells."
                },
                {
                    "id": "excel-charts-visualization-eq3",
                    "prompt": "Which chart type displays the distribution of a continuous variable grouped into frequency bins?",
                    "options": [
                        {"id": "a", "text": "Histogram"},
                        {"id": "b", "text": "Pie Chart"},
                        {"id": "c", "text": "Donut Chart"}
                    ],
                    "answerId": "a",
                    "explanation": "Histograms group continuous data into discrete numeric bins to illustrate distribution shape."
                },
                {
                    "id": "excel-charts-visualization-eq4",
                    "prompt": "How should category labels be formatted on a column chart if there are 15 categories with long names?",
                    "options": [
                        {"id": "a", "text": "Switch to a horizontal Bar Chart so names read cleanly from left to right"},
                        {"id": "b", "text": "Rotate the text vertically at a 90-degree angle"},
                        {"id": "c", "text": "Shrink font size to 4pt"}
                    ],
                    "answerId": "a",
                    "explanation": "Horizontal bar charts accommodate long category labels naturally without tilting text."
                },
                {
                    "id": "excel-charts-visualization-eq5",
                    "prompt": "What chart type plots data points on an X and Y coordinate plane to evaluate whether two variables correlate?",
                    "options": [
                        {"id": "a", "text": "Scatter Plot (XY)"},
                        {"id": "b", "text": "Stacked Area Chart"},
                        {"id": "c", "text": "Radar Chart"}
                    ],
                    "answerId": "a",
                    "explanation": "Scatter plots display pairs of numerical values to expose correlation, clusters, and outliers."
                }
            ]
        }
    },
    {
        "id": "excel-statistical-analysis",
        "version": 1,
        "order": 9,
        "title": "9. Descriptive Statistics & Exploratory Data Analysis (EDA)",
        "summary": "Master statistical profiling in Excel: calculate mean, median, and mode, quantify dispersion with variance and STDEV.S, identify outliers via IQR fences, and evaluate linear correlation with CORREL.",
        "difficulty": "Advanced",
        "minutes": 50,
        "codeExt": "csv",
        "code": """Ad_Campaign,Channel,Ad_Spend,Impressions,Clicks,Conversions,Revenue
Camp-01,Google Search,4200.00,125000,3800,190,14250.00
Camp-02,Meta Social,3100.00,280000,4200,126,8820.00
Camp-03,LinkedIn B2B,5800.00,64000,1850,92,18400.00
Camp-04,YouTube Video,4900.00,410000,2900,87,6960.00
Camp-05,Google Display,2400.00,350000,2100,63,4410.00
Camp-06,Meta Retargeting,1800.00,95000,2400,144,11520.00
Camp-07,Google Search,5100.00,148000,4600,230,17250.00
Camp-08,TikTok Viral,3600.00,620000,5100,102,7140.00""",
        "dataset": [
            ["Ad_Campaign", "Channel", "Ad_Spend", "Impressions", "Clicks", "Conversions", "Revenue"],
            ["Camp-01", "Google Search", 4200.00, 125000, 3800, 190, 14250.00],
            ["Camp-02", "Meta Social", 3100.00, 280000, 4200, 126, 8820.00],
            ["Camp-03", "LinkedIn B2B", 5800.00, 64000, 1850, 92, 18400.00],
            ["Camp-04", "YouTube Video", 4900.00, 410000, 2900, 87, 6960.00],
            ["Camp-05", "Google Display", 2400.00, 350000, 2100, 63, 4410.00],
            ["Camp-06", "Meta Retargeting", 1800.00, 95000, 2400, 144, 11520.00],
            ["Camp-07", "Google Search", 5100.00, 148000, 4600, 230, 17250.00],
            ["Camp-08", "TikTok Viral", 3600.00, 620000, 5100, 102, 7140.00]
        ],
        "steps": [
            "Review the multi-channel advertising performance dataset in A1:G9.",
            "Open the Descriptive Statistics generator on the Analytics panel and select Ad_Spend (C2:C9).",
            "Review the statistical profile: Mean ($3,862.50), Median ($3,900.00), Min ($1,800.00), Max ($5,800.00), and StdDev ($1,385.52).",
            "Calculate Pearson correlation in cell G11: =CORREL(C2:C9, G2:G9) to assess the linear association between Ad Spend and Revenue.",
            "Calculate Return on Ad Spend (ROAS) in a new column by dividing Revenue by Ad_Spend."
        ],
        "expected": "A comprehensive statistical profile detailing central tendency, sample variability, and bivariate linear correlation for campaign optimization.",
        "challenge": "Calculate the 75th percentile (Q3) and 25th percentile (Q1) of Revenue using =PERCENTILE.INC(G2:G9, 0.75) and find the Interquartile Range (IQR).",
        "lessons": [
            {
                "id": "excel-statistical-analysis-s1",
                "title": "Central Tendency: Mean, Median, Mode & The Impact of Skewness",
                "paragraphs": [
                    "Descriptive statistics summarizes the primary distributional properties of quantitative business metrics. Measures of central tendency identify the center or typical value of a distribution. The arithmetic mean, calculated with =AVERAGE(range), is the sum of observations divided by the sample size. While intuitive, the mean is highly sensitive to extreme outliers—a single multimillion-dollar executive salary distorts the average compensation of an entire company.",
                    "In skewed distributions, the median, calculated with =MEDIAN(range), provides a far more robust measure. The median is the physical middle value when data is sorted: 50% of observations fall below it and 50% fall above it. If the mean is significantly greater than the median, the distribution is right-skewed (positively skewed). The mode, calculated with =MODE.SNGL(range), represents the most frequently occurring value in the dataset."
                ],
                "pitfall": "Relying solely on the mean when analyzing customer order values or real estate prices can mislead stakeholders if outliers skew the average.",
                "question": {
                    "id": "excel-statistical-analysis-q1",
                    "lessonId": "excel-statistical-analysis-s1",
                    "prompt": "If a dataset has a median of $45,000 but a mean of $82,000, what does this indicate about the distribution?",
                    "options": [
                        {"id": "a", "text": "The data is right-skewed by high-value outliers pulling the mean upward"},
                        {"id": "b", "text": "The calculation contains an error because mean and median must match"},
                        {"id": "c", "text": "The data follows a symmetrical bell curve"}
                    ],
                    "answerId": "a",
                    "explanation": "When the mean exceeds the median, large positive outliers pull the average to the right."
                }
            },
            {
                "id": "excel-statistical-analysis-s2",
                "title": "Dispersion & Variability: Standard Deviation (STDEV.S) and Variance",
                "paragraphs": [
                    "Two datasets can share identical means while exhibiting vastly different risk profiles: one portfolio may fluctuate by 1% daily, while another swings by 25%. Measures of dispersion quantify the spread of data points around the mean. The sample variance, calculated with =VAR.S(range), measures the average squared deviation of observations from their sample mean.",
                    "Because variance is expressed in squared units (e.g. dollars squared), analysts take its square root to produce the sample standard deviation: =STDEV.S(range). Standard deviation is expressed in the original units of measurement. In a normal distribution, the Empirical Rule states that approximately 68% of observations fall within one standard deviation of the mean, and approximately 95% fall within two standard deviations."
                ],
                "pitfall": "Excel provides both STDEV.S (for sample data) and STDEV.P (for entire populations). In business analytics where analyzing a subset of transactions, always use STDEV.S.",
                "question": {
                    "id": "excel-statistical-analysis-q2",
                    "lessonId": "excel-statistical-analysis-s2",
                    "prompt": "Why is STDEV.S preferred over VAR.S when presenting risk metrics to business leadership?",
                    "options": [
                        {"id": "a", "text": "Standard deviation is expressed in the original units of the data (e.g. dollars) rather than squared units"},
                        {"id": "b", "text": "Variance is only supported on Mac"},
                        {"id": "c", "text": "STDEV.S ignores negative numbers"}
                    ],
                    "answerId": "a",
                    "explanation": "Standard deviation returns the metric to the original scale of measurement, making it interpretable."
                }
            },
            {
                "id": "excel-statistical-analysis-s3",
                "title": "Percentiles, Quartiles & Interquartile Range (IQR) Outlier Fences",
                "paragraphs": [
                    "Percentiles divide a sorted dataset into 100 equal parts. The p-th percentile is the value below which p percent of observations fall. =PERCENTILE.INC(array, k) computes the k-th percentile, where k ranges from 0 to 1. For example, k = 0.90 returns the 90th percentile threshold—a common benchmark for SLA latency compliance.",
                    "Quartiles divide data into four equal quarters. =QUARTILE.INC(array, 1) returns the 25th percentile (Q1), and =QUARTILE.INC(array, 3) returns the 75th percentile (Q3). The difference, Q3 - Q1, is the Interquartile Range (IQR), representing the spread of the middle 50% of the data. John Tukey's outlier detection rule flags any observation smaller than Q1 - 1.5*IQR or greater than Q3 + 1.5*IQR as a statistical outlier."
                ],
                "pitfall": "Excel provides both .INC (inclusive) and .EXC (exclusive) percentile functions. PERCENTILE.INC is the standard convention for general commercial analytics.",
                "question": {
                    "id": "excel-statistical-analysis-q3",
                    "lessonId": "excel-statistical-analysis-s3",
                    "prompt": "According to Tukey's rule, an observation is flagged as an upper outlier if it exceeds which formula?",
                    "options": [
                        {"id": "a", "text": "Q3 + (1.5 * IQR)"},
                        {"id": "b", "text": "Mean + 10"},
                        {"id": "c", "text": "Median * 2"}
                    ],
                    "answerId": "a",
                    "explanation": "Tukey's upper outlier fence is established at Q3 + 1.5 times the Interquartile Range (IQR)."
                }
            },
            {
                "id": "excel-statistical-analysis-s4",
                "title": "Bivariate Association: Pearson Correlation (CORREL) and Scatter Plots",
                "paragraphs": [
                    "Bivariate analysis investigates the empirical relationship between two continuous variables: Does increased ad spend drive higher sales revenue? Does customer support response time correlate with churn? The Pearson correlation coefficient, calculated with =CORREL(array1, array2), measures the strength and direction of linear association on a normalized scale from -1.0 to +1.0.",
                    "A correlation of +1.0 indicates a perfect positive linear relationship; -1.0 indicates a perfect negative (inverse) relationship; and 0.0 indicates no linear association. A general rule of thumb treats values between 0.7 and 1.0 as strong correlation. However, correlation does not imply causation: confounding variables or non-linear curves (e.g. U-shaped relationships) can exist even when Pearson correlation is near zero."
                ],
                "pitfall": "CORREL only measures linear relationships. If two variables share a strong quadratic or logarithmic relationship, CORREL may fail to capture the association.",
                "question": {
                    "id": "excel-statistical-analysis-q4",
                    "lessonId": "excel-statistical-analysis-s4",
                    "prompt": "What does a Pearson correlation coefficient (r) of -0.85 between Product Price and Sales Volume indicate?",
                    "options": [
                        {"id": "a", "text": "A strong negative linear relationship: as price increases, sales volume tends to decrease"},
                        {"id": "b", "text": "A calculation error because correlation cannot be negative"},
                        {"id": "c", "text": "No relationship between price and volume"}
                    ],
                    "answerId": "a",
                    "explanation": "Negative correlation near -1 indicates that when one variable increases, the other systematically decreases."
                }
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "excel-statistical-analysis-eq1",
                    "prompt": "Which Excel function calculates the sample standard deviation for a dataset in A1:A50?",
                    "options": [
                        {"id": "a", "text": "=STDEV.S(A1:A50)"},
                        {"id": "b", "text": "=STD.DEV(A1:A50)"},
                        {"id": "c", "text": "=VAR.S(A1:A50)"}
                    ],
                    "answerId": "a",
                    "explanation": "STDEV.S calculates sample standard deviation with n-1 degrees of freedom."
                },
                {
                    "id": "excel-statistical-analysis-eq2",
                    "prompt": "What is the Interquartile Range (IQR) if Q1 = 20 and Q3 = 65?",
                    "options": [
                        {"id": "a", "text": "45"},
                        {"id": "b", "text": "85"},
                        {"id": "c", "text": "42.5"}
                    ],
                    "answerId": "a",
                    "explanation": "IQR = Q3 - Q1 = 65 - 20 = 45."
                },
                {
                    "id": "excel-statistical-analysis-eq3",
                    "prompt": "What does '=CORREL(X_Range, Y_Range)' evaluate to if both variables are completely identical?",
                    "options": [
                        {"id": "a", "text": "1.0"},
                        {"id": "b", "text": "0.0"},
                        {"id": "c", "text": "100"}
                    ],
                    "answerId": "a",
                    "explanation": "A variable correlated with itself yields perfect positive correlation (+1.0)."
                },
                {
                    "id": "excel-statistical-analysis-eq4",
                    "prompt": "What does the 90th percentile of customer checkout times indicate?",
                    "options": [
                        {"id": "a", "text": "90% of customers completed checkout in that amount of time or less"},
                        {"id": "b", "text": "Only 10% of customers completed checkout successfully"},
                        {"id": "c", "text": "The average checkout time was 90 seconds"}
                    ],
                    "answerId": "a",
                    "explanation": "The 90th percentile is the threshold below which 90% of observations reside."
                },
                {
                    "id": "excel-statistical-analysis-eq5",
                    "prompt": "If arrays passed to CORREL have different counts of observations, what error is returned?",
                    "options": [
                        {"id": "a", "text": "#N/A or #DIV/0!"},
                        {"id": "b", "text": "#NAME?"},
                        {"id": "c", "text": "Excel automatically truncates the larger array"}
                    ],
                    "answerId": "a",
                    "explanation": "CORREL requires both coordinate arrays to have identical lengths, failing with an error if lengths differ."
                }
            ]
        }
    },
    {
        "id": "excel-analytics-capstone",
        "version": 1,
        "order": 10,
        "title": "10. Enterprise Data Analytics Capstone",
        "summary": "Execute an end-to-end commercial analytics engagement: clean raw transaction logs, connect relational catalogs via lookups, calculate gross margin and unit economics, synthesize pivot tables, and build an executive KPI dashboard.",
        "difficulty": "Advanced",
        "minutes": 60,
        "codeExt": "csv",
        "code": """Trans_ID,Date,Customer_ID,SKU,Units,Unit_Price,Gross_Revenue,Discount,Net_Revenue,COGS_Per_Unit,Total_COGS,Gross_Profit
TX-801,2026-06-01,CUST-10,SKU-A1,24,150.00,=E2*F2,0.05,=G2*(1-H2),85.00,=E2*J2,=I2-K2
TX-802,2026-06-02,CUST-22,SKU-B2,10,320.00,=E3*F3,0.10,=G3*(1-H3),190.00,=E3*J3,=I3-K3
TX-803,2026-06-03,CUST-10,SKU-C3,45,45.00,=E4*F4,0.00,=G4*(1-H4),22.00,=E4*J4,=I4-K4
TX-804,2026-06-04,CUST-35,SKU-A1,18,150.00,=E5*F5,0.05,=G5*(1-H5),85.00,=E5*J5,=I5-K5
TX-805,2026-06-05,CUST-41,SKU-D4,8,850.00,=E6*F6,0.15,=G6*(1-H6),510.00,=E6*J6,=I6-K6
Summary,,Total Volume,=SUM(E2:E6),,=SUM(G2:G6),,=SUM(I2:I6),,=SUM(K2:K6),=SUM(L2:L6)""",
        "dataset": [
            ["Trans_ID", "Date", "Customer_ID", "SKU", "Units", "Unit_Price", "Gross_Revenue", "Discount", "Net_Revenue", "COGS_Per_Unit", "Total_COGS", "Gross_Profit"],
            ["TX-801", "2026-06-01", "CUST-10", "SKU-A1", 24, 150.00, "=E2*F2", 0.05, "=G2*(1-H2)", 85.00, "=E2*J2", "=I2-K2"],
            ["TX-802", "2026-06-02", "CUST-22", "SKU-B2", 10, 320.00, "=E3*F3", 0.10, "=G3*(1-H3)", 190.00, "=E3*J3", "=I3-K3"],
            ["TX-803", "2026-06-03", "CUST-10", "SKU-C3", 45, 45.00, "=E4*F4", 0.00, "=G4*(1-H4)", 22.00, "=E4*J4", "=I4-K4"],
            ["TX-804", "2026-06-04", "CUST-35", "SKU-A1", 18, 150.00, "=E5*F5", 0.05, "=G5*(1-H5)", 85.00, "=E5*J5", "=I5-K5"],
            ["TX-805", "2026-06-05", "CUST-41", "SKU-D4", 8, 850.00, "=E6*F6", 0.15, "=G6*(1-H6)", 510.00, "=E6*J6", "=I6-K6"],
            ["Summary", "", "Total Volume", "=SUM(E2:E6)", "", "=SUM(G2:G6)", "", "=SUM(I2:I6)", "", "=SUM(K2:K6)", "", "=SUM(L2:L6)"]
        ],
        "steps": [
            "Review the comprehensive enterprise sales ledger spanning transaction IDs, order volumes, revenue, COGS, and profit.",
            "Verify the financial calculations: Gross Revenue (=Units*Unit_Price), Net Revenue after discount, and Gross Profit (=Net_Revenue - Total_COGS).",
            "Examine row 7: dynamic SUM aggregations evaluate total units sold (105), total Net Revenue ($18,805.00), and Gross Profit ($8,035.00).",
            "Generate a Pivot Table by Customer_ID to evaluate individual client profitability.",
            "Construct a Bar Chart representing Net Revenue per transaction to visually communicate revenue distribution to leadership."
        ],
        "expected": "A complete, decision-grade enterprise analytics model linking raw transactions, cost accounting, margin analysis, and visual synthesis.",
        "challenge": "Calculate the company-wide Gross Profit Margin percentage (=Total_Gross_Profit / Total_Net_Revenue) in cell L8 and format it as a percentage with one decimal place.",
        "lessons": [
            {
                "id": "excel-analytics-capstone-s1",
                "title": "Production Analytics Pipeline: Ingestion, Hygiene & Audit Trails",
                "paragraphs": [
                    "In production enterprise environments, business analysts do not simply receive clean tables; they ingest raw transactional extracts from ERP, CRM, and payment gateways. A professional analytics workbook must establish an auditable pipeline: 1) Raw Data Ingestion (untouched raw data preserved on a dedicated sheet); 2) Staging & Transformation (where TRIM, uppercase conversions, and date parsing occur); 3) Relational Modeling (where dimension tables connect via lookups); and 4) Presentation (Pivot Tables, executive charts, and KPI summary scorecards).",
                    "Documenting cell assumptions, data update frequencies, and version history in a dedicated 'ReadMe' or 'Documentation' sheet creates transparent governance. Formulas must be audited for consistency across rows, ensuring that no manual override numbers are hardcoded into formula columns."
                ],
                "pitfall": "Overwriting a formula cell with a hardcoded static number to 'fix' a temporary anomaly breaks model integrity and causes hidden errors during future refreshes.",
                "question": {
                    "id": "excel-analytics-capstone-q1",
                    "lessonId": "excel-analytics-capstone-s1",
                    "prompt": "Why is separating raw data tabs from presentation dashboard tabs considered a foundational best practice?",
                    "options": [
                        {"id": "a", "text": "It preserves raw data integrity for audits while allowing automated updates without breaking dashboard design"},
                        {"id": "b", "text": "Excel cannot display charts on the same sheet as raw data"},
                        {"id": "c", "text": "It compresses the workbook into a ZIP archive"}
                    ],
                    "answerId": "a",
                    "explanation": "Decoupling raw input layers from presentation dashboards guarantees auditability and maintainability."
                }
            },
            {
                "id": "excel-analytics-capstone-s2",
                "title": "Relational Data Modeling: Connecting Orders, Customers & Catalogs",
                "paragraphs": [
                    "Enterprise datasets rarely store all descriptive attributes in a single flat file. An e-commerce system stores orders in one table, customer demographic details in a second table, and SKU unit costs in a third table. Storing customer addresses repeatedly in every transaction row creates redundant data bloat and update anomalies.",
                    "Analysts use relational lookups—specifically XLOOKUP and INDEX/MATCH—to query dimension tables using foreign keys (e.g. Customer_ID, Product_SKU). This architecture mirrors relational database schemas (SQL star schema), keeping the fact table lightweight while enabling multi-dimensional slicing across customer tiers, geography, and product lines."
                ],
                "pitfall": "Ensure foreign key columns share identical data types across tables. A numerical customer ID (1001) will not match a text customer ID ('1001') in XLOOKUP, producing #N/A.",
                "question": {
                    "id": "excel-analytics-capstone-q2",
                    "lessonId": "excel-analytics-capstone-s2",
                    "prompt": "In relational star schema modeling, what role does a transaction log table serve?",
                    "options": [
                        {"id": "a", "text": "The central Fact table holding numerical metrics and foreign keys to dimension tables"},
                        {"id": "b", "text": "A static lookup dimension for product names"},
                        {"id": "c", "text": "A temporary scratchpad that is discarded after calculation"}
                    ],
                    "answerId": "a",
                    "explanation": "Transactional ledgers act as central Fact tables containing quantities, amounts, and relational keys."
                }
            },
            {
                "id": "excel-analytics-capstone-s3",
                "title": "Financial Unit Economics: Margin Analysis, CAC & Cohort LTV",
                "paragraphs": [
                    "Revenue alone is a vanity metric; a company generating $100M in revenue that spends $110M on cost of goods and customer acquisition is unprofitable. High-caliber analytics models quantify unit economics: Gross Profit = Net Revenue - Cost of Goods Sold (COGS); Gross Margin % = Gross Profit / Net Revenue; and Contribution Margin = Net Revenue - Variable Costs.",
                    "In subscription and recurring businesses, analysts evaluate Customer Acquisition Cost (CAC) and Customer Lifetime Value (LTV). Calculating LTV:CAC ratios and tracking cohort retention matrices identifies which customer segments justify aggressive sales expansion and which segments erode working capital."
                ],
                "pitfall": "Confusing Markup percentage with Margin percentage is a fatal commercial error: a product costing $50 sold for $100 has a 100% markup, but a 50% gross margin.",
                "question": {
                    "id": "excel-analytics-capstone-q3",
                    "lessonId": "excel-analytics-capstone-s3",
                    "prompt": "If Net Revenue is $200,000 and Cost of Goods Sold (COGS) is $120,000, what is the Gross Margin percentage?",
                    "options": [
                        {"id": "a", "text": "40.0%"},
                        {"id": "b", "text": "60.0%"},
                        {"id": "c", "text": "66.7%"}
                    ],
                    "answerId": "a",
                    "explanation": "Gross Profit = $200k - $120k = $80k. Gross Margin % = $80,000 / $200,000 = 40.0%."
                }
            },
            {
                "id": "excel-analytics-capstone-s4",
                "title": "Decision-Grade Executive Reporting: Synthesis and Actionable Recommendations",
                "paragraphs": [
                    "The ultimate objective of data analytics is driving high-conviction executive decisions. Dashboards and reports must answer three sequential questions for the C-suite: 1) What happened? (descriptive metrics: revenue dropped 8% in Q2); 2) Why did it happen? (diagnostic drill-downs: supplier delays triggered stockouts in high-margin hardware); and 3) What should we do now? (prescriptive recommendations: reorder buffer stock and shift ad spend to software).",
                    "Executive worksheets should feature dynamic summaries where high-level KPI cards sit at the top, supported by clean interactive charts, followed by an executive commentary text box outlining actionable next steps. Every number presented must be verifiable down to its underlying source transaction."
                ],
                "pitfall": "Delivering a dense grid of 50,000 raw numbers without visual synthesis or executive recommendations forces leadership to do their own analysis, defeating the analyst's role.",
                "question": {
                    "id": "excel-analytics-capstone-q4",
                    "lessonId": "excel-analytics-capstone-s4",
                    "prompt": "What should accompany high-level KPI scorecards on an executive analytics dashboard?",
                    "options": [
                        {"id": "a", "text": "Clear visual trend charts, filter controls, and concise executive commentary with actionable recommendations"},
                        {"id": "b", "text": "A raw CSV dump of every database transaction"},
                        {"id": "c", "text": "Animated clip art to entertain leadership"}
                    ],
                    "answerId": "a",
                    "explanation": "Executive dashboards combine visual trend clarity with actionable, decision-grade commentary."
                }
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "excel-analytics-capstone-eq1",
                    "prompt": "What formula calculates Gross Margin % in a model where Net Revenue is in cell I2 and Gross Profit is in cell L2?",
                    "options": [
                        {"id": "a", "text": "=L2 / I2"},
                        {"id": "b", "text": "=I2 / L2"},
                        {"id": "c", "text": "=L2 * I2"}
                    ],
                    "answerId": "a",
                    "explanation": "Margin % is calculated as Gross Profit divided by Net Revenue (=L2 / I2)."
                },
                {
                    "id": "excel-analytics-capstone-eq2",
                    "prompt": "Which tool provides the fastest way to segment total gross profit across customer cohorts and product categories simultaneously?",
                    "options": [
                        {"id": "a", "text": "Pivot Table with Customer in Rows and Category in Columns"},
                        {"id": "b", "text": "Multiple chained nested IF formulas"},
                        {"id": "c", "text": "Manual cell copying"}
                    ],
                    "answerId": "a",
                    "explanation": "Pivot Tables summarize multidimensional aggregations across intersecting row and column dimensions instantly."
                },
                {
                    "id": "excel-analytics-capstone-eq3",
                    "prompt": "Why is hardcoding values directly into formula cells (e.g. '=A2*1.0825' where 1.0825 is tax) discouraged?",
                    "options": [
                        {"id": "a", "text": "If tax rates change, analysts must manually find and update every formula rather than updating one central parameter cell"},
                        {"id": "b", "text": "Excel cannot multiply by decimals"},
                        {"id": "c", "text": "It deletes formatting"}
                    ],
                    "answerId": "a",
                    "explanation": "Hardcoded parameters in formulas are invisible and brittle; centralizing variables in locked parameter cells is required."
                },
                {
                    "id": "excel-analytics-capstone-eq4",
                    "prompt": "What does a high Customer Lifetime Value to Customer Acquisition Cost ratio (e.g. LTV:CAC = 5.2) signify?",
                    "options": [
                        {"id": "a", "text": "Strong commercial unit economics where customer value significantly outpaces acquisition costs"},
                        {"id": "b", "text": "Impending bankruptcy"},
                        {"id": "c", "text": "Customer churn is increasing"}
                    ],
                    "answerId": "a",
                    "explanation": "An LTV:CAC ratio above 3.0 indicates strong, sustainable unit economics."
                },
                {
                    "id": "excel-analytics-capstone-eq5",
                    "prompt": "In an audit of an enterprise financial workbook, what keyboard shortcut toggles formula auditing to show all formulas across the sheet?",
                    "options": [
                        {"id": "a", "text": "Ctrl + ` (grave accent / tilde)"},
                        {"id": "b", "text": "Ctrl + F"},
                        {"id": "c", "text": "Alt + F4"}
                    ],
                    "answerId": "a",
                    "explanation": "Ctrl + ` toggles between displaying calculated cell values and raw underlying formulas across the entire worksheet."
                }
            ]
        }
    }
]

def main():
    # Validation checks
    assert len(COURSES) == 10, f"Expected 10 courses, got {len(COURSES)}"
    all_question_ids = set()
    all_lesson_ids = set()

    for idx, c in enumerate(COURSES):
        assert c["order"] == idx + 1
        assert len(c["lessons"]) == 4, f"Course {c['id']} must have exactly 4 lessons"
        assert len(c["exam"]["questions"]) == 5, f"Course {c['id']} must have 5 exam questions"
        assert c["exam"]["passPercent"] == 80

        for l in c["lessons"]:
            assert l["id"] not in all_lesson_ids, f"Duplicate lesson ID: {l['id']}"
            all_lesson_ids.add(l["id"])
            q = l["question"]
            assert q["id"] not in all_question_ids, f"Duplicate question ID: {q['id']}"
            all_question_ids.add(q["id"])
            assert len(q["options"]) == 3, f"Question {q['id']} must have 3 options"
            assert q["answerId"] in [o["id"] for o in q["options"]]

        for eq in c["exam"]["questions"]:
            assert eq["id"] not in all_question_ids, f"Duplicate exam question ID: {eq['id']}"
            all_question_ids.add(eq["id"])
            assert len(eq["options"]) == 3, f"Exam question {eq['id']} must have 3 options"
            assert eq["answerId"] in [o["id"] for o in eq["options"]]

    print(f"Validated {len(COURSES)} courses, {len(all_lesson_ids)} lessons, and {len(all_question_ids)} unique questions.")

    output_path = CONTENT_DIR / "excel.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"courses": COURSES}, f, indent=2, ensure_ascii=False)
    print(f"Wrote content to {output_path}")

if __name__ == "__main__":
    main()

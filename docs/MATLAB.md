# MATLAB learning path and numeric sandbox

`/matlab` and `/matlab/:lessonId` provide eighteen ordered courses. Each course has four
substantive sections with an individual practice question, a worked example, a guided script,
an applied challenge and a five-question exam. Exams use the existing 80% threshold and
`vq.courses.v1` contract. Practice never changes exam attempts. All courses are open.

`/sandbox?bench=matlab&lesson=<courseId>` opens an independent editable numerical notebook.
Run executes the current script in a fresh browser Worker. The parser and real arithmetic live
in `engine/matlab/`, are deterministic and run in plain Node. There is no eval, JavaScript
bridge, network, filesystem, backend execution or MathWorks runtime. This is a MATLAB-style
teaching subset, not MATLAB or Simulink. Function signatures and limits appear in the searchable
reference alongside desktop-only functions and links to the full MathWorks documentation.

Supported syntax includes finite real scalar/matrix arithmetic, matrix and element-wise operators,
one-based column-major indexing, ranges, indexed assignment, for/while/if blocks, anonymous
functions and explicitly supported numerical functions. Matrices have at most 16,384 cells;
scripts have at most 32 KiB, with bounded tokens, nesting, operations and cumulative allocation.
Execution also has a five-second Worker deadline and a Stop action. Each run starts a new
workspace and deterministic random stream. `rng` uses a local teaching generator, not MATLAB's
random sequence. Unsupported syntax/functions fail explicitly. Complex values, general function
files/classes, toolbox execution, file access and actual GPU/parallel execution are not supported.

Results contain the exact executed source, printed output, numerical workspace and plot data.
Changing code cancels work and removes stale results. Late Worker messages cannot restore them.
Plots have accessible tabular data. The downloadable `.m` is the exact edited source, named as a
valid MATLAB script (`matlab-start` → `matlab_start.m`; companions `matlab_ode_desktop.m`). Desktop
companion examples are separately labelled with their required MATLAB products and are never
automatically substituted into the executable browser script.

Notebook format: `{format:'voltquest-matlab',version:1,lesson,code,notes}`. Save keys are
`vq.matlab.v1.<courseId>`. Imports are bounded to 64 KiB UTF-8; code to 32 KiB and notes to 10 KiB.
Unknown fields, including claimed results, are discarded. Load/import/reset/preset replacement
requires an in-app confirmation. Invalid files leave work intact. There is no account, CircuitDoc,
public course API, MCP or showcase extension. Notebook exports contain drafts; result exports
contain only actual results from the current script. Locale changes retain all notebook and
assessment state. Interface controls support Indonesian; course narratives and technical
references use a disclosed English fallback.

Content lives in `content/matlab.json`; numerical code, feature pages and curriculum load only
on MATLAB routes. Navigation cards import no curriculum. Sources are official MathWorks pages;
the function directory is a curated learning reference, not a claim to cover every MATLAB release
and optional toolbox. Desktop-only examples require local MATLAB and the stated products.

## Numerical compatibility details

The reference has 244 curated entries, of which 73 have executable browser signatures and examples.
Only those signatures are implemented, not every overload of their desktop counterparts. Arrays
use scalar expansion or identical dimensions; general singleton expansion is rejected. Indexed
assignment requires preallocation and preserves value semantics and captured anonymous inputs.
Reductions use the first nonsingleton dimension unless a supported dimension is supplied.
Full `conv` follows MATLAB R2026a: a column output only when both inputs are columns.

Small square solves use pivoted elimination; tall full-rank least squares uses reorthogonalized QR.
Dimensions for these solves are at most 128; ill-conditioned/singular cases fail explicitly.
`polyfit` supports degree 0–6 and at most 128 observations. `interp1` is linear with strictly
increasing coordinates and in-range queries. `fzero` requires an explicit sign-changing bracket
and uses at most 80 bisections with relative bracket tolerance 1e-10; continuity is the caller's
assumption. `rng` seeds a local 32-bit LCG, while `randn` uses a Box–Muller transform. Neither is
a promise of MATLAB's bitwise random sequence. Native parallel/GPU lessons contain no fabricated
benchmark results. Workspace previews are limited to 256 values per variable; output to 200 entries;
plots to eight series of at most 4096 samples. Exports disclose truncation.

## Verification

The full gate passes 1,416 frontend and 104 backend tests, lint, build and a 527.9 KiB initial gzip
payload. Final targeted tests (174) and rebuild pass after the convolution/reference refinement.
Tests run all eighteen scripts and all seventy-three supported reference examples, verify numerical
results and step refinement, reject unsupported or unbounded work, and check assessments,
replacement confirmation, worker cancellation and stale-result suppression.

Production Chromium with an isolated local SQLite backend verified every starter through an actual
Worker, exact edited outputs/plots and downloads, notebook save/load/import, section practice,
80% exam persistence, language-state retention, navigation and desktop/390 px overflow checks.
No browser application errors were observed. MATLAB is not installed in this workspace, so the
desktop/toolbox companions have not been executed in MATLAB. Cross-browser and real-device
performance are not certified by the local Chromium checks.

## Sandbox desktop (2026-09-28)

`/sandbox?bench=matlab` renders `MatlabIde.jsx`, a view in the classic MATLAB desktop layout: toolstrip
(HOME · PLOTS · EDITOR), address bar, Current Folder with Details, Editor documents, Command Window,
Workspace (Name · Value · Size · Class), docked Figures and Command History, and a status bar. The
course page keeps `MatlabLab.jsx`; both use `useMatlabNotebook.js`, so saving, confirmation, imports
and invalidation are identical. Only controls that work are shown; there are no APPS, Simulink,
Add-Ons or decorative menus. The status bar always states "MATLAB-style browser subset · not MATLAB".

- **Folder and files.** Each preset is a folder (`10_ode`) holding the script, `notes.txt`, a
  generated read-only `README.txt` (guided steps, expected result, challenge, Command Window rule)
  and the read-only desktop companion. Opening another folder asks for confirmation.
- **Editor.** Highlighting follows the lexer in `engine/matlab/parser.js` (`matlabSyntax.js`):
  only its ten keywords are blue; desktop-only keywords are underlined. The status-bar code check
  runs the actual parser (never executes) and flags desktop-only function calls from the reference.
  Comment/Uncomment/Indent/Outdent edit the selected lines; F5 or Ctrl/Cmd+Enter runs, Ctrl/Cmd+S saves.
- **Run** still executes the script in a fresh Worker and echoes `>> matlab_start` like MATLAB.
- **Command Window replay.** A command re-runs the last Run's source plus earlier successful
  commands in a fresh Worker and prints only the new output (`clc` clears the window). Failing
  commands are not kept. Limits (five seconds, 200 outputs, operations) apply to the whole session,
  and before the first Run commands start from an empty workspace. The rule is on the
  Command Window's "Session replay" disclosure and in README.txt. Editing the script clears the
  workspace and prints why; MATLAB would keep it, but results here never outlive their source.
- **Workspace and PLOTS.** Select one or two vectors, then PLOTS › plot runs `plot(x,y)` in the
  Command Window. Figures draw the engine's single figure at real pixel size in MATLAB's colour
  order, with click-to-place data tips, the sample slider and paginated data.
- **Help.** The toolstrip search filters the same 244-entry reference; browser examples can be
  sent to the Command Window (every shipped example is tested this way).

# Cybersecurity learning path

`/cybersecurity` offers ten courses from Fundamental through Intermediate to Advanced. Each
`/cybersecurity/:lessonId` has four theory sections, a four-step guided vulnerability tutorial,
an interactive lab, an applied challenge, three practice questions and a five-question exam.
Totals: **40 sections, 10 labs, 30 practice questions, 50 exam questions and 10 exams**.

Tutorials and Courses link to the path. The circuit Sandbox Project menu opens
`/sandbox?bench=cybersecurity`; optional `lesson=cyber-<lab>` selects a course preset. Course lab
links start a preset in a separate tab, preserving the original investigation and exam answers.
Notebook export/import transfers edits. Topics are open without unlock gates or installation.

## Curriculum and expected observations

| Course / lab | Vulnerable observation | Defended observation |
| --- | --- | --- |
| `cyber-http` / `http` | Anonymous `/debug` exposes internal structure | Debug 404; `/health` still 200 |
| `cyber-idor` / `idor` | Alice reads Bob's order 1002 | Cross-customer read 403; own order 200 |
| `cyber-auth` / `auth` | `x-role: admin` overrides a customer role | Customer 403; administrator 200 |
| `cyber-sql` / `sql` | A name changes the WHERE expression and returns Prototype | Literal parameter binding returns no hidden products |
| `cyber-xss` / `xss` | Query markup reaches an HTML text sink | Special text characters encoded |
| `cyber-path` / `path` | A filename escapes `/public/` | Normalized escape 403; public file 200 |
| `cyber-csrf` / `csrf` | Cross-origin request changes an email | Origin and session-token checks precede mutation |
| `cyber-ssrf` / `ssrf` | Preview returns internal inventory data | Parsed origin allowlist rejects the destination |
| `cyber-mass` / `mass` | Profile role write enables a later admin read | Atomic update rejection; customer role unchanged |
| `cyber-capstone` / `capstone` | Debug, ownership and profile weaknesses together | All 30 regression checks pass after three fixes |

Primary references are MDN HTTP and OWASP prevention guidance, checked on 2026-09-15. The course
teaches authorized scope, normal controls, reproduction, impact, source/sink reasoning and retesting;
it does not claim exhaustive coverage of all web vulnerabilities or a specific Top 10 edition.

Frontend-only `content/cybersecurity.json` uses
`{courses:[{id,version,order,lab,title,summary,difficulty,minutes,prerequisites,
lessons:[{id,title,paragraphs:[text,text],pitfall}],steps:[text],challenge,practice:[Question],
exam:{passPercent:80,questions:[Question]},sources:[{title,url}]}]}`.
Question shapes and grading follow [COURSES.md](COURSES.md). IDs are stable and globally unique.

## Runtime contract

This is a **local web application teaching model**, not a proxy, scanner, hosted vulnerable service
or assessment of VoltQuest. All accounts, files and services are fictional. No lab request causes
network traffic, host file access, shell commands, backend queries or JavaScript execution. The
app shell still uses its normal guest API; the cybersecurity model has no backend calls.

`engine/cybersecurity/model.js` runs in plain Node without DOM or timers:

- `CONTROLS` maps nine defense ids to labels; `secureControls()` enables all nine.
- `validateControls(value)` requires exactly those boolean values.
- `createState()` creates independent Alice/Bob/admin accounts and orders 1001/1002.
- `validateRequest({method,path,headers,body})` validates fields and normalizes header names.
- `executeRequest(request,controls,state?)` clones state and returns
  `{request,controls,status,headers,body,trace,findings:[{id,evidence}],state}`. Reuse its state for
  multi-request chains. Findings depend on observed data/mutations, with a disclosed HTML indicator.
- `sqlPredicate(source)` and `normalizeFilePath(name)` implement bounded transformations.

`engine/cybersecurity/scenarios.js` exports `LABS`, `ROUTES`, `labRequest`, `defaultControls` and
`verifyLab`. Presets disable only the relevant defense; capstone disables `debug`, `ownership` and
`fields`. All ten routes are available in every lab. Editable defenses change actual handler
branches. Displayed pseudocode is illustrative and read-only.

### Model limits

- **HTTP/session:** GET/POST/PATCH, local paths, headers/parsed bodies represented as JSON. Public
  cookies `sid=alice-session`, `sid=bob-session`, `sid=admin-session` select teaching identities.
  No login/expiry/cryptography, cookie flags, SameSite, cookie attachment, CORS or preflight emulation.
- **SQL:** in-memory Lamp/Cable/Prototype rows. Supports quoted strings with doubled apostrophes,
  numeric literals, `name/public/price`, `=`, `<>`, AND/OR, parentheses and `--` line comments.
  AND binds first; no dialect coercion. Maximum 4096 expression characters, 128 tokens and 16
  nested levels. No joins, UNION, writes, delays or database. Unsupported syntax returns 400.
  Defended mode treats the whole name as a literal bound value.
- **HTML/XSS:** generated markup always remains React text inside code blocks. The structural
  indicator isn't an HTML parser or proof of script execution. Encoding covers an HTML text node,
  not rich HTML or URL/CSS/script/attribute contexts. No raw-HTML sink, iframe, stored or DOM XSS.
- **Files:** URL-decode once; normalize POSIX dot segments; then check the `/public/` boundary.
  In-memory strings only; no symlinks, races, Windows paths or host filesystem. Backslashes/null
  bytes are rejected. Double encoding isn't decoded a second time.
- **CSRF:** explicit origin/cookie/body-token fields model the handler after receipt. Predictable
  tokens and strict origin policy are fixtures. The actual mutation and atomic rejection are
  implemented; browser transport is not. Tokens must match the selected session.
- **SSRF:** parsed URLs select only `https://news.vq.test/article` and
  `http://inventory.internal/status` objects. Fixed mode checks the public origin and rejects
  URL credentials. Unknown fixtures return 404. No DNS, redirects, sockets, fetch or egress model.
- **Mass assignment:** vulnerable mode explicitly copies name/role; fixed mode rejects non-name
  fields before mutation. The next admin request reads the changed role. No arbitrary object merge
  or prototype pollution model.

Request limits: path 2048 characters; 20 headers, each value up to 2048 characters; 20 scalar body
fields, string values up to 4096 characters; serialized request up to 12000 characters. Header
duplicates/control characters, nested body values and prototype-related keys are rejected. These
bounds and small fixture sets keep synchronous execution bounded.

## Evidence and persistence

Send captures the exact request, defenses, response, trace, findings and resulting state. Request
edits clear the current response. Defense edits reset accounts and invalidate verification while
keeping history. Reset shop accounts clears mutations without destroying notes/history. Full reset,
lab selection, load and import require replacement confirmation.

Regression cases start fresh; sequences retain state within the case. Passing requires the expected
status, no violation and relevant content/state invariants. The capstone runs **30 checks across
nine models**, with normal behavior, alternate inputs and the profile-to-admin chain. Checks leave
the active shop unchanged. Results belong to captured settings, independently of the unsent editor.
Four milestones summarize normal behavior, relevant issue ids observed, a passing matrix and notes
of at least 40 characters. These are self-study aids, not credentials or proof of report quality.

Latest **30** manual exchanges are retained. `voltquest-cybersecurity-report` exports include notes,
history, `totalRequests`, `historyTruncated`, current controls and full latest verification responses.

Notebook: `{format:'voltquest-cybersecurity',version:1,lab,
request:{method,path,headers:string,body:string},controls,notes}`.
`features/cybersecurity/project.js` exports create/validate/parse helpers and `parseRequestDraft`.
Notes allow 10000 characters, header/body drafts 12000 each, UTF-8 files 64 KiB. Unfinished drafts
can be saved; Send requires valid JSON/semantics. Imports strip unknown fields, including forged
history/verification. Courses accept their own lab; the free sandbox accepts any supported lab.

Manual storage: `vq.cybersecurity.v1.<lab>`. Load/import starts fresh shop data and clears history;
export a report to retain evidence. Reports aren't importable notebooks. Storage failure leaves the
visit usable and offers export. CircuitDoc, board ids, account projects, MCP and showcase are unchanged.

Exams/section checks reuse `vq.courses.v1`: complete answers, 80% pass, best/last scores, retries,
no duplicate attempts and separate practice. Unsubmitted choices last for the mounted course.
English is default; 133 new interface entries support Indonesian. Narratives/questions, pseudocode
and technical traces use English fallback with a visible notice. Locale changes retain drafts,
mutations, evidence, defenses, notes, section checks and exam answers.

## Verification

Adjacent tests cover all scenario pairs/matrices, alternate SQL and false controls, parser limits,
inert HTML, normalized/encoded paths, origin/token combinations, parsed URL tricks, invalid sessions,
ownership matrices, stateful privilege changes, atomic rejection and malformed inputs. Content/UI
tests cover ids, grading, real routing, filters, persistence, imports, reports and localization.
The sitemap derives the hub and all ten courses. Model/page chunks stay lazy and are forbidden in
the initial bundle by `scripts/check.sh`. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
for current full-gate/browser evidence. Other browsers and real devices remain release checks.

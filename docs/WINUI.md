# C++ / WinUI desktop app courses

`/winui` and `/winui/:lessonId` provide thirteen ordered courses about WinUI 3,
C++/WinRT and XAML. Courses, Tutorials and the home footer link to this path. The
shared header selects Tutorials. The curriculum and native text load only with
the WinUI route; navigation-only `WinuiPromo` imports neither.

## Curriculum and learning contracts

`content/winui.json` contains `reviewedAt`, three `stages` and thirteen `courses`.
Each course has a unique `winui-*` id, version, order, stage, difficulty, minutes,
recommended prerequisites, four `lessons`, four Windows lab steps, an expected
observation, an applied challenge, five exam questions and Microsoft references.
Each section has two explanatory paragraphs, a code/reasoning example, a common
mistake and an independently graded checkpoint. There are **52 sections, 52
checkpoints and 65 exam questions**. Prerequisites do not lock access.

The sequence covers setup, XAML layout, C++ validation/events, binding and observable
collections, navigation, dialogs, asynchronous work, files, HTTP API requests, accessibility and
localization, debugging/testing, deployment, and a task notebook capstone. The
binding course introduces custom properties and MVVM through an extension exercise;
its native sample implements element binding and an observable string collection.
The navigation sample implements destination selection; Frame/history is explicitly
an applied extension. Do not describe those extension exercises as shipped features.

`WinuiCourse` reuses `Assessment`, `vq.courses.v1`, learning rewards and the certificate
form. Incomplete/duplicate exams do not increase attempts; section checkpoints do not
affect exam scores. The pass mark is 80%. Server certificate grading includes every course in this
catalogue. The existing public `/api/courses` catalogue is
still the original 34-course catalogue. No new API or account data model is introduced.

Hub search/stage/difficulty filters use URL parameters. Locale changes retain filters,
reading checks, selected answers, lab checkboxes and the selected source file. Interface
labels support Indonesian; curriculum, questions and native source have a visible English
fallback notice. Native lab step checkboxes last for the visit and represent learner
observations, not programmatic execution or verification.

## Native source and execution boundary

`features/winui/samples.js` supplies the same complete replacement files displayed,
copied and downloaded by `WinuiSources`: `MainWindow.xaml`, `.xaml.h`, `.xaml.cpp`,
`MainWindow.idl`, `TaskRules.h`, its independent console test, `README.md` and a release
checklist. File and capstone packs also contain `TextFile.h`. ZIP bytes use stored
UTF-8 entries and CRC32, with no dependency or executable output. Downloads preserve
the displayed file exactly. Clipboard failure provides manual selection/download.

`winui-api` additionally supplies `ApiClient.h`, `api_server.py`, `test_api_server.py`
and `fetch-demo.mjs`. The C++ window performs real GET/POST requests when built on
Windows; the Python fixture and JavaScript comparison run in separate local terminals.
The fixture binds only to `127.0.0.1:8766`, has no authentication and stores disposable
tasks in memory. The Node companion demonstrates actual `fetch` GET, JSON POST and
GET readback. Neither companion is executed by the VoltQuest browser app.

Create a **packaged C++ WinUI desktop app named VoltQuestDesktop** with Visual Studio
on Windows, and build the unmodified template first. Keep its App, pch, project,
manifest, dependencies and assets. Follow the README to replace the MainWindow files
and include the header-only helpers. Do not put the console test in the WinUI project.
Use C++20 and UTF-8 source settings; record the actual stable Windows App SDK NuGet,
Windows SDK, Visual Studio and architecture versions. A pack is not a standalone
solution, precompiled EXE, signed MSIX or browser simulation. Template names and
prerequisites must be checked against the linked official Microsoft documentation.

The browser renders escaped source and runs the shared quiz logic. It does not execute
C++, XAML, WinUI, Windows APIs, arbitrary scripts, shell commands or filesystem calls.
There is no WinUI sandbox bench or fake native preview. No CircuitDoc, board, simulation,
project, assistant, MCP or showcase contract changes.

Native teaching boundaries:

- The HTTP course uses `Windows.Web.Http.HttpClient`, request headers, UTF-8 JSON
  content, status checks, a streamed 64 KiB body limit and whole-response schema
  validation before committing a collection. Redirects are disabled. A ten-second
  UI timer and a Cancel button propagate cancellation to pending WinRT operations;
  the timer is not a hard deadline and cancellation does not roll back a sent POST.
  Fixtures cover HTTP 401/404/503, malformed JSON/schema, wrong media type, oversized
  and slow responses. Authentication, HTTPS services and idempotency are explained
  extensions; no real sign-in, shared secret or automatic retry is implemented.
- `TaskRules.h` trims ASCII spaces/tabs, rejects empty/control-character titles and
  bounds titles to 80 `wchar_t` units (UTF-16 on Windows, not grapheme clusters).
  Length-aware string conversions preserve embedded NULs for validation. Selection
  checks reject negative and out-of-range indexes. The capstone holds at most 100 tasks.
- The async preview captures owned input, uses a request generation and explicitly
  returns to the UI apartment. Cancel invalidates results without stopping timers.
  A strong reference keeps the implementation alive; a separate closed-window guard
  prevents control updates after closure. This is a responsiveness example, not a
  native performance measurement.
- The file sample specifically uses `Windows.Storage.Pickers`, with `IWindowNative`
  and `IInitializeWithWindow` desktop ownership. Do not mix it with the newer
  `Microsoft.Windows.Storage.Pickers` API. Reads use a bounded DataReader request,
  UTF-8 policy and 64 KiB limit. Cancel or failure preserves the prior document view.
- The capstone writes version-1 JSON to `voltquest-tasks-v1.json` in the packaged
  app's local folder. Save snapshots data before awaiting and serializes operations.
  Load confirms replacement and validates the entire document/version/count/types/
  titles before committing. It loads only on request. Writes are a teaching persistence
  path, not a crash-proof database; a failed replacement can damage the old disk file.
  Keep in-memory tasks on failure and use a disposable profile for corruption tests.
- The accessibility sample toggles theme without discarding drafts and uses standard
  controls. Narrator, contrast modes and actual resource localization are native
  verification/exercise steps, not browser-proven accessibility claims.

## Verification

Adjacent tests cover content/question/section references, all thirteen XAML documents and
event/name pairings, exact UTF-8 ZIP extraction and CRCs with Python's standard ZIP reader,
search and filter behavior, reading/exam persistence, section isolation, rewards,
locale preservation, source downloads, clipboard fallback and storage failure.
`native.test.js` compiles and executes the actual downloadable `TaskRules.test.cpp`
with a standard C++ compiler: **18 behavioral checks**. This verifies the portable
rules only. `CXX` can select the compiler; frontend verification also needs Python 3
for the independent ZIP reader. Existing certificate tests issue and parse exact PDFs
for all 134 courses in the isolated verification snapshot, including the thirteen WinUI additions.

The exact downloaded Python fixture and Node `fetch` companion execute through twelve
independent regression cases with real loopback HTTP: creation/readback, escaped Unicode,
HTTP failures, media/JSON/schema fixtures, title/request/task bounds, a slow disconnected
client and continued server availability. This verifies the companion contract, not
Windows HTTP transport, native cancellation, UI threading or installed-app behavior.

Isolated full `make check` on 2026-09-20 passes **1,619 frontend tests in 93 files / 109 backend
tests**, lint and production build, with **555.1 KiB** initial gzip and 417 sitemap URLs.
This snapshot uses the completed baseline plus WinUI; concurrent Qt work in the shared
tree was still missing required files. Only the existing CampaignMap hook warnings and Node localStorage notice remain.
Production Chrome with isolated SQLite verifies all thirteen course routes and actual ZIP
downloads, exact displayed/downloaded C++ source, filters, independent checkpoints,
incomplete exam rejection, persisted 80% grading, and state retention across Indonesian
switching. Capstone certificate issuance, downloaded PDF hash and browser file verification
pass. Courses/Tutorials/home navigation, missing-course recovery and desktop/390 px layouts
pass without page overflow or application/console errors. Microsoft reference links were
checked on the review date; all twenty-four unique URLs returned HTTP 200.

Native Windows compilation, launch, UI Automation/Narrator, MSIX installation, update
behavior and real-device performance were **not executed** in this macOS environment.
Source structure checks and portable C++ tests are not evidence of a native WinUI build.
The course UI and every downloaded README state this limitation. Record actual Windows
results in the provided release checklist before making stronger compatibility claims.

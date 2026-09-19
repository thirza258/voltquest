# Self-study courses

**PDF certificates** are available for each of the 121 courses across all paths. The shared exam
form accepts a learner name and consent after an 80% pass; the server independently checks the
submitted answers and issues one immutable certificate per player/course/version. `/certificates`
recovers certificates and looks up public verification codes. PDFs include a QR/link, and the
verifier checks original-file SHA-256 locally. See [CERTIFICATES.md](CERTIFICATES.md). These are
unproctored self-study completion certificates, not accredited qualifications.

**Computer architecture and assembly** at `/computer-architecture` adds eighteen courses:
eight on gates and arithmetic, four on stored state and CPU control, and six on assembly.
Each has four substantial sections with independent checkpoints, a guided editable experiment,
a transferable Minecraft/redstone build challenge and a five-question exam. The gate simulator
and VQ4 teaching CPU run edited source at `/sandbox?bench=computer`. See
[COMPUTER_ARCHITECTURE.md](COMPUTER_ARCHITECTURE.md) for the curriculum and model limits.

**Learning rewards** are shared across this catalogue and every advanced course path: one-time
section/practice/exam XP, levels, seven badges, a three-step daily goal, current/best study streaks
and automatic freezes. Start with one freeze; earn another every seven active study days, holding
at most two. Frozen days preserve a streak without adding study days or XP. Existing undated
progress receives milestone XP without creating past activity. See [LEARNING_REWARDS.md](LEARNING_REWARDS.md)
for date handling, persistence and deduplication. This is separate from campaign/account XP.

**AI agents** at `/ai-agents` adds twenty courses, eighty sections with individual questions,
twenty standalone guided tutorials and twenty five-question exams. The JavaScript-first CLI
capstone has a runnable Python companion. Local experiments teach context/cost accounting,
tools, skills, MCP and integrations through actual bounded fixture execution. See
[AI_AGENTS.md](AI_AGENTS.md). This catalogue remains separate from the public course API.

**MATLAB** at `/matlab` adds eighteen courses, seventy-two detailed sections with an individual
question in every section, eighteen guided scripts and eighteen five-question exams. Its curated
244-entry function reference distinguishes 73 executable browser signatures from desktop/toolbox
guidance. `/sandbox?bench=matlab` executes an editable finite-real MATLAB-style subset, displays
workspace values and plots, and keeps independent notebooks. It shares local assessment progress
without changing the standard course API. See [MATLAB.md](MATLAB.md).

**Cybersecurity** at `/cybersecurity` adds a separate ten-course path with forty theory sections,
ten guided web vulnerability labs, thirty practice questions and ten five-question exams. It shares
the local progress/assessment contract and links from Courses/Tutorials. The independent request
sandbox and notebook format are documented in [CYBERSECURITY.md](CYBERSECURITY.md). The standard
public course API remains unchanged.

The **High-performance computing in C & C++** card links to `/hpc`, a separate ten-course path
with forty sections, twenty formula cards, ten browser experiments, thirty practice questions and
ten five-question exams. It shares browser-local assessment behavior and adds editable/downloadable
C17/C++17 programs with native testing guides. Its advanced CPU/MPI models and independent sandbox
format are documented in [HPC.md](HPC.md); it does not change the standard public course API.

`/courses` lists the curriculum and `/courses/:courseId` opens a course. The tutorial hub links to
the tracks. Courses complement the runnable tutorials; they do not award campaign XP or certification.

`content/courses.json` is shared by the frontend and public API. It contains `tracks: [{id,title,summary}]`
and `courses: [{id,version,track,order,title,summary,difficulty,minutes,prerequisites,lessons,workedExample,
application,lab,practice,exam,sources}]`. Lessons are `{id,title,text}`. Questions are
`{id,prompt,options:[{id,text}],answerId,explanation,lessonId}`. Each course has three lessons, one worked
example and application, two practice questions and a five-question exam with `passPercent:80`.
Every question has one correct option and a valid lesson review target. Prerequisites are recommendations,
not unlock gates. The frontend imports course content only from lazy course routes.

Both assessment forms require all answers before submission, preserve incomplete choices, and show
correct answers, explanations and lesson links after grading. Exams pass with four of five correct.
There is no timer or retry limit. Practice never affects exam results. A retry clears choices and
feedback, preserving the best score. Duplicate submissions do not increase the attempt count.

Browser-local progress uses `vq.courses.v1`, mapping course id to `{version,read:[lessonId],attempts,
bestPercent,lastPercent}`. It is shared by people using the browser profile, independent of account
identity. Invalid/different-version progress is ignored. Storage failure leaves the visit usable and
shows a notice. Unsubmitted choices and detailed reviews last only while the course remains mounted.
Language switching preserves choices and lesson checks. Content and assessments are translated into
Indonesian; identifiers and technical source titles retain their canonical form.

The public JSON contains answer keys: this is voluntary self-study, not a tamper-proof assessment.
Related labs open separately to preserve choices. Each lab task explains its scope: analytical RC,
battery charging, BLE/LoRa and real RF propagation are not added simulation models. Pi remains the
restricted GPIO/Python model. Hardware exercises use low-voltage circuits and verified part requirements.

The catalogue contains 10 electrical courses, 10 IoT parts courses, an IoT/Arduino foundation
course, a drone foundation course and 12 programming courses: 34 total, 102 theory sections,
238 questions and 34 exams.
`formulas` is an array of `{title,equation,symbols,assumptions,example}` cards with explicit units,
assumptions and worked calculations; there are 58 cards. A course may contain `extraLabs` alongside
its primary lab. IoT and drone foundations each link to three new runnable experiments.
Robotics and computer vision use dedicated catalogues and `StudyLesson`, reusing the same grading
and local progress behavior. Their ids are unique across catalogues. See ROBOTICS.md and VISION.md.

## Tutorial fundamentals (2026-09-14)

`content/tutorial-fundamentals.json` adds a frontend learning supplement with one guide for each of
the 41 firmware tutorials, five robotics tutorials and six vision labs. Its shape is
`{tutorials:[{tutorialId,topic,explanation,observation,readings:[{courseId,lessonId}]}]}`. Each explanation
connects a fundamental principle to the actual program, circuit or model, followed by a prediction or
observation to try. Reading references use canonical course/lesson ids from `courses.json`,
`robotics.json` or `vision.json`; titles and route paths are resolved from those catalogues.

Courses includes a grouped tutorial selector at `/courses?tutorial=<id>#tutorial-fundamentals`.
The selected guide links to exact theory sections and its runnable tutorial in separate tabs.
Course detail pages include expandable guides for all tutorials that reference that course;
`#fundamentals-<tutorialId>` opens and scrolls to an individual guide. Course search also matches the
associated tutorial titles and fundamental topics. The selector preserves other course URL filters.
Firmware tutorials and `StudyLesson` show the same explanation before the experiment and link to
the selected guide in Courses. All 52 new explanations and observations support English/Indonesian.

The guide supplement does not change assessment keys, course versions or stored progress.
It introduces no new route, runtime capability or tutorial completion state. Guide content loads with
the learning routes; tutorial pages do not import the combined course catalog to render it. Coverage
tests require exactly one guide per tutorial, real section targets and complete guide translations.

## C, C++ and Arduino / ESP32 programming (2026-09-14)

`/courses?track=programming` opens twelve ordered courses, starting at
`/courses/programming-start`. The first five are Fundamental and the next seven Intermediate.
They cover language/framework distinctions, sketch lifecycle, C numeric types and arithmetic,
conditions and digital input, loops/functions/scope, arrays/C strings/pointers/bit flags, C++ objects
and libraries, ADC/PWM portability, millis/debounce/rollover, serial framing/debugging, state machines,
ESP32 HTTP and an MQTT controller capstone. Preparation links recommend the preceding course without
locking access. Each has three substantive lessons, a worked example, an application exercise,
a formula/reasoning card, two practice questions and a five-question exam (80% pass).

Each new course has optional `codeExample: {title,code,output,explanation,exercise,tutorialId,boards}`.
`code` is a complete Arduino sketch and `output` is expected output, never a simulated/live result.
Narratives are translated at render time; source and output remain literal. The code walkthrough
supports copy (with a manual fallback), `.ino` download and a board-specific separate-tab lab link.
Opening a lab retains its authored example; the learner explicitly pastes the course sketch into its
editor. No course import, automatic code replacement, new language runtime or tutorial remount is added.
The first ten examples support all four C++ boards; the connected examples support ESP32/S3 only.

The existing tutorial guides gain canonical programming-section readings without dropping their
electrical/IoT readings. The tutorial count stays 41 and all 106 existing board variants remain valid.
API list/detail reads the same JSON; `track=programming` is an accepted filter. Older course ids,
versions and local assessment records are unchanged. All new prose, questions and feedback support
English and Indonesian. Official Arduino, Espressif, C++ draft, GCC and PubSubClient references are
linked from the relevant courses.

Boundaries are explicit: Arduino is a C++ framework, ESP32 is a chip family, and native ESP-IDF has
its own entry/build/runtime. Pointer lifetime, references, classes, templates and RAII are explained
without claiming arbitrary native-memory or complete C++ execution. Signed overflow is undefined in
native C/C++; the simulator's signed wrapping is a teaching approximation. ADC hardware calibration
and current versus legacy LEDC APIs are distinguished. Networking is virtual; the MQTT lease example
has bounded startup waiting but does not implement production reconnect or authentication.

`features/courses/programming.test.js` runs all 44 course-example/board pairs through the actual
inline simulation and prepared circuit, checking explained output and electrical damage. Additional
regressions cover fragmented/oversized serial frames, state durations, unsigned rollover, repeatable
HTTP commands and real LED state, exact MQTT topic/payload matching, renewal and expiry. Course/UI,
translation, API and sitemap tests cover discovery, supported lab boards and preserved progress.

Full verification: 1,127 frontend / 104 backend tests, production build and 516.7 KiB initial gzip
payload pass. Isolated production Chromium verifies incomplete-exam rejection, an 80% pass restored
on reload, retained answers/read checks/board across Indonesian switching, exact `.ino` download,
and the copied Nano sketch running in a real Worker. ESP32-S3 HTTP and ESP32 MQTT examples drive
the prepared LED with matching reported state and command expiry. Desktop/390 px views fit with
no browser application errors. Cross-browser and real-device verification remains a release check.

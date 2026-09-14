# C / C++ high-performance computing path

`/hpc` is an ordered, searchable path linked from Tutorials, Courses and the sandbox menu.
`/hpc/:lessonId` opens a complete course; `/sandbox?bench=hpc` opens the free experiment bench.
`?lesson=<courseId>` selects a course preset. Unknown course/preset ids show an explicit not-found
state. All courses are open without unlocking. No new controller board or firmware API is added.

The path contains ten courses, forty substantial theory sections, twenty formula cards with units,
assumptions and worked calculations, ten browser experiments, thirty practice questions, fifty exam
questions and ten applied challenges. Every course also includes a source walkthrough, native test
commands and expected outcomes. The sequence is:

1. C17/C++17 workflow, ownership, numerical contracts and independent correctness oracles.
2. Benchmark scope, monotonic timers, observable work, warm-up, distributions and profiling.
3. Row-major addresses, cache lines, working sets and data layout.
4. Dense multiplication, loop order, tiling and partial-edge correctness.
5. SIMD independence, compiler reports, tails, aliasing and floating-point semantics.
6. OpenMP data sharing, race interleavings, atomics, reductions and false sharing.
7. Static/cyclic/dynamic scheduling, chunk costs, locality, affinity and NUMA concepts.
8. Strong/weak scaling, Amdahl, Roofline, logical traffic and accelerator transfer costs.
9. MPI process memory, balanced partitions, Scatterv, reductions and timing scope.
10. A distributed three-point stencil with boundaries, fresh halos and a full-output oracle.

## Content and progress

`content/hpc.json` contains `courses:[{id,version,order,title,summary,difficulty,minutes,lab,outcomes,
prerequisites,lessons,formulas,steps,native,challenge,practice,exam,sources}]`. A section is
`{id,title,paragraphs:[string,string],pitfall}`. `native` supplies `walkthrough` and
`tests:[{command,expect}]`; `challenge` supplies `task` and `acceptance`. Formula and question
shapes use the existing course contracts. The frontend imports this catalogue only from HPC routes;
the standard `/api/courses` and firmware `/api/tutorials` catalogues retain their own contracts.

Assessments reuse `Assessment` and `vq.courses.v1`: three practice questions and a five-question,
80% exam per course. Every question has a canonical section review target. Only complete exam
submissions add an attempt; best scores survive retries, reloads and a lower later score. Section
checks persist. Unsubmitted answers remain in the mounted visit, including through locale changes.
Course identity resets transient answers. These are voluntary self-study scores, not campaign XP,
account credentials or certification. Opening a related lab in another tab preserves answers.

English is the authored curriculum language. New interface labels and experiment controls support
Indonesian; long HPC narratives, questions, technical diagnostics and native source use English
fallback. An Indonesian-locale notice identifies that scope. Locale changes retain both source
drafts, lab results, settings, notes, section checks and current answers.

## Browser experiment contracts

`engine/hpc/model.js` is pure Node-compatible code. `LABS`, `defaultParameters`,
`validateParameters`, and `runExperiment(lab,parameters)` describe bounded experiments.
The result is `{lab,parameters,metrics:[{label,value,unit}],checks:[{label,passed,detail}],
columns,rows,bars?,note}`. Results retain the exact settings that generated them.

| Experiment | Actual browser work and interpretation |
| --- | --- |
| `correctness` | Rounded float32/float64 accumulation of bounded data; compares to an exact integer reference. Small-first ordering is not guaranteed exact for every input. |
| `benchmark` | Statistics on supplied positive time samples, up to 100, after a declared warm-up. Initial samples are illustrative. This panel does not time native code. |
| `locality` | Actual row/column index traversal and checksum with a cold, fully associative LRU cache model. Lines are configurable; no hardware-counter claim. |
| `blocking` | Actual reference and tiled dense multiplication, every-output comparison and explicit cache traces. N≤40, tile≤32. Three loads and one store are counted per update; compiler/register behavior is not reconstructed. |
| `simd` | Actual grouped AXPY outputs and explicit scalar-tail/skip-tail behavior. Lane grouping does not claim emitted SIMD instructions or CPU throughput. |
| `reduction` | Deterministic read-before-write lost-update trace and synchronized arithmetic strategies. Native C/C++ data races are undefined behavior, not a prediction of this trace’s result. |
| `scheduling` | Explicit task costs, assignment, chunk dispatch charges and worker loads. It is not an OS/OpenMP runtime emulator. |
| `scaling` | Independent Amdahl and Roofline bounds from user assumptions; no inferred host measurements and no multiplication of the two models. |
| `mpi` | Local balanced counts, displacements, partial sums and a global oracle, including zero-count ranks. Tree latency is an illustrative cost, not an MPI measurement. |
| `stencil` | Serial and partitioned old/new-buffer recurrence with each-step or deliberately stale halos. N≤128, steps≤100, partitions≤16. All cells and boundaries are checked. |

The feature worker wrapper imports the pure model. Each Run creates one fresh worker, with a
five-second deadline and termination after success, error, cancellation, settings replacement or
page disposal. Generation checks ignore stale responses. In environments without Worker, the same
bounded algorithms run through a queued inline fallback. Editing a parameter immediately clears
old results and disables result export. Source edits do not change the browser algorithm; the
editor and Run explanation state this explicitly. No user source is evaluated by the browser,
backend or a remote service. This feature adds neither cloud compilation nor CUDA/GPU emulation.

## Independent experiment files

`features/hpc/project.js` validates this versioned format:

```json
{
  "format": "voltquest-hpc",
  "version": 1,
  "lab": "mpi",
  "language": "cpp",
  "parameters": { "n": 17, "ranks": 4, "partition": "balanced", "latency": 5 },
  "sources": { "c": "...", "cpp": "..." },
  "notes": "Prediction, commands, results and conclusion"
}
```

Limits: 200 KiB UTF-8 per file, 64 KiB per language source, 10 KiB notes, exact per-lab allowed
parameter names and bounded finite values. Unknown metadata is not persisted. Invalid files do
not mutate work. An embedded course rejects imports for another lab; the free sandbox can open
any valid HPC file. Import, load, reset and source restoration show replacement confirmation;
switching labs also confirms when changes are unsaved. Each lab saves separately at
`vq.hpc.v1.<lab>`. Loading is explicit. Storage failure leaves current work usable and exportable.

Source language switching retains both drafts. Download source uses the current edited draft and
the correct `.c` or `.cpp` extension. Export experiment preserves both drafts, settings and notes;
Export results creates a separately identified `voltquest-hpc-result` artifact with the current
result and notes. Result reports cannot be imported as projects. CircuitDoc, account saves, MCP,
showcase, circuit drafts and other sandbox storage are not extended by this format.

## Native programs and verification

`features/hpc/examples.js` constructs twenty standalone programs, one C17 and one C++17 version
per lab. C owns initialized calloc/free buffers; C++ uses std::vector and RAII. Serial timing uses
a POSIX monotonic clock in C and steady_clock in C++; OpenMP/MPI use runtime elapsed timers.
Numerical checks consume outputs and reject incorrect results, including non-finite matrix/stencil
outputs. Native source is editable/downloadable; these checks validate the authored examples only.

The first five examples need a C/C++ compiler. Reduction, scheduling and scaling also need OpenMP.
MPI and the stencil use an MPI installation’s `mpicc`/`mpicxx` wrappers and `mpiexec`. C++ uses MPI’s
C API, not legacy C++ bindings. The native stencil explicitly requires ranks≤interior cells; the
browser instead skips empty partitions. Both policies are explained in the course.

Build commands, Linux/macOS setup, Apple Clang/libomp flags, debug instrumentation and compiler
vectorization diagnostics are shown beside the editor. Single observations are not presented as
statistically established gains. Small timers can report `below-resolution,NA,NA`; increase the
workload before calculating rates. Logical bandwidth is labeled separately from measured DRAM
traffic. MPI tests on one host validate real communication behavior, not multi-node performance.

```sh
# Exact downloadable sources: compile and check core examples.
node scripts/check-hpc-native.mjs
node scripts/check-hpc-native.mjs --sanitize

# Include real OpenMP and MPI behavior at 1, 2 and 4 workers/processes.
make test-hpc-native

# Apple Clang with Homebrew libomp:
HPC_OMP_PREFIX="$(brew --prefix libomp)" make test-hpc-native

# Alternative compatible compiler commands:
HPC_CC=gcc HPC_CXX=g++ make test-hpc-native
```

The native gate creates temporary standalone files, compiles with warnings as errors, executes
odd sizes, tile edges, zero-count MPI partitions, multiple schedules and multi-step halo exchanges,
and removes its temporary directory. No learner file is executed automatically. Standard
`make check` covers model behavior, content/review targets, worker cancellation/failure, UI
grading and persistence, file boundaries, navigation, translations and the production build.
HPC model/content chunks remain lazy and are rejected if eagerly requested by the payload gate.

Verified 2026-09-14: the full shared-tree gate passes 1,181 frontend tests in 74 files, 104 backend
tests and the production build at 521.1 KiB initial gzip. Native verification passes 20 builds and
126 executions, plus 10 core builds/36 executions with ASan/UBSan. Production Chromium exercised all
ten real Worker experiments, state invalidation, stale-halo failure, exact edited downloads, saved
work/reload/import, 80% exam persistence, locale preservation, navigation and desktop/390 px fit.
No application errors were reported. The generated sitemap includes all eleven HPC routes (137
total). Cross-browser/touch testing and multi-node performance remain release verification work.

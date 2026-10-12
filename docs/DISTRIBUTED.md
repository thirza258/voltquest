# Distributed systems track

`/distributed` and `/distributed/:lessonId` provide ten reading-only distributed-systems courses
(`content/distributed.json`), rendered by the shared `features/courses/ReadingTrack.jsx` component and
configured by `features/distributed/DistributedPage.jsx`. Each course has four sections with a practice
question, a guided lab with an expected result, a complete self-contained `.py` program (copied or
downloaded), an applied challenge and a five-question 80% exam using the shared progress and certificate
systems.

## Courses

`ds-foundations`, `ds-clocks`, `ds-replication`, `ds-consistency`, `ds-consensus`, `ds-partitioning`,
`ds-faults`, `ds-transactions`, `ds-coordination`, `ds-capstone` — from partial failure, the fallacies and
exactly-once (idempotency + dedup) through logical/vector clocks, replication and quorums, consistency
models and CAP, Raft leader election, partitioning and consistent hashing, fault tolerance, distributed
transactions (2PC and sagas) and coordination (logs, offsets, fencing tokens), to a sharded, replicated,
quorum key-value store.

## Accuracy notes

The lessons state the subtleties correctly: R+W>N gives quorum overlap, **not** linearizability; last-writer-
wins can silently lose writes under clock skew; "CAP: pick two" is a myth (partition tolerance is mandatory,
and C means linearizability); the Raft example is **leader election only** and enforces the up-to-date-log
vote restriction; 2PC blocks if the coordinator crashes after prepare; "exactly-once" means idempotent
processing plus deduplication.

## Honesty and verification

The programs are small, deterministic teaching simulations (seeded RNG, in-process message passing; no
threads or wall-clock sleeps), not production systems, and they are not run in the browser. They use **only
the standard library**, and `backend/tests/test_distributed_content.py` **executes all ten** with
`python3 -I`, asserting a clean exit, standard-library-only imports and a deterministic final line — so
"runnable, deterministic, stdlib-only" is a verified claim, not prose. The hub disclosure says to run them
with `python3` locally. Lab checkboxes verify nothing.

## Wiring

Route in `App.jsx`, nav section in `AppHeader.jsx`, sitemap in `vite-sitemap.js`, directory card in
`coursesDirectory.js` (`systems` domain), certificate catalogue entry (`distributed.json`), Indonesian chrome
in `i18n/id.json`. `features/distributed/distributed.test.jsx` validates the content shape and the
hub/course/exam/download behaviour, and the backend test runs the programs.

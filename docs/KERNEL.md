# Linux kernel programming track

`/kernel` and `/kernel/:lessonId` provide eight reading-only Linux kernel courses (`content/kernel.json`),
rendered by the shared `features/courses/ReadingTrack.jsx` hub/course component and configured by
`features/kernel/KernelPage.jsx`. Each course has four sections with a practice question, a guided build/load
lab with an expected result, a complete `.c` kernel module (copied or downloaded), an applied challenge and
a five-question 80% exam using the shared `vq.courses.v1` progress and the certificate system (certificate
`CATALOGUES` in `backend/app/services/certificates.py`).

## Courses

`kern-intro`, `kern-params`, `kern-chardev`, `kern-memory`, `kern-concurrency`, `kern-interrupts`,
`kern-procfs`, `kern-capstone` — from kernel vs user space and a hello-world module through module
parameters, character devices (`register_chrdev`, `simple_read_from_buffer`), kernel memory (kmalloc/GFP),
concurrency (mutex vs spinlock, atomics), interrupts and workqueues, `/proc` with `proc_ops` (5.6+), to a
complete mutex-protected read/write character driver.

## Honesty and verification

Kernel modules cannot be built or run in a browser, and loading them needs a Linux machine/VM (not macOS or
Windows) with headers matching `uname -r`. The APIs target a 6.x LTS kernel (`register_chrdev`,
`simple_read_from_buffer`/`simple_write_to_buffer`, `proc_ops`, mutexes around `copy_*_user`, reverse-order
cleanup). During authoring, all eight modules were **compiled out-of-tree against Linux 6.8 headers
(`linux-headers-6.8.0-146-generic`) in an Ubuntu container**, producing eight `.ko` files with no errors;
CI does not re-compile them (no kernel toolchain in CI). The hub disclosure states the VM, headers, Secure
Boot and crash-risk caveats. Lab step checkboxes record the learner's own observations and verify nothing.

## Wiring

Route in `App.jsx` (`/kernel`, `/kernel/:lessonId`), nav section in `AppHeader.jsx`, sitemap in
`vite-sitemap.js` (guarded read + conditional inclusion), directory card in
`features/courses/coursesDirectory.js` (the `systems` domain), certificate catalogue entry (`kernel.json`),
and Indonesian chrome in `i18n/id.json`. `features/kernel/kernel.test.jsx` validates the content shape and
the hub/course/exam/download behaviour. See also `docs/LOADBALANCER.md` and `docs/DISTRIBUTED.md`, which
share the same `ReadingTrack` shell.

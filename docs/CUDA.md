# CUDA C++ GPU programming track

`/cuda` and `/cuda/:lessonId` provide ten reading-only CUDA C++ courses (`content/cuda.json`), rendered by
the shared `features/courses/ReadingTrack.jsx` hub/course component and configured by
`features/cuda/CudaPage.jsx`. Each course has four sections with a practice question, a guided lab with an
expected result, a complete self-contained `.cu` program (copy or download), an applied challenge and a
five-question 80% exam using the shared `vq.courses.v1` progress and the certificate system (added to the
certificate `CATALOGUES` in `backend/app/services/certificates.py`).

## Courses

`cuda-intro`, `cuda-threads`, `cuda-memory`, `cuda-vectoradd`, `cuda-shared`, `cuda-reduction`,
`cuda-streams`, `cuda-libraries`, `cuda-multigpu`, `cuda-capstone` — from the host/device model and the
thread hierarchy to device memory (coalescing, unified memory), a grid-stride vector add, shared-memory
tiled matmul, a tree reduction with warp shuffles and `atomicAdd`, streams with pinned memory, the Thrust
and cuBLAS libraries, multi-GPU scaling (device enumeration, peer-to-peer, NCCL), and a timed, CPU-verified
capstone. `cuda-libraries` (Thrust) and `cuda-multigpu` were added to match the PyTorch track's depth with
more advanced material.

## Honesty

CUDA is not run in the browser (there is no GPU in VoltQuest). Every `code` field is a complete program, and
during authoring all ten were **compiled with `nvcc` 12.6 in an `nvidia/cuda` devel container (10/10, no
errors)** — compilation needs no GPU, only running does, so they are not executed here. Each course states
the expected output. CI does not re-compile them (no CUDA toolchain in CI). Lab step checkboxes record the
learner's own observations and verify nothing. The hub disclosure states the NVIDIA GPU + CUDA Toolkit
(`nvcc`) requirement.

## Wiring

Route in `App.jsx` (`/cuda`, `/cuda/:lessonId`), nav section in `AppHeader.jsx`, sitemap in
`vite-sitemap.js` (guarded read + conditional inclusion), directory card in
`features/courses/coursesDirectory.js`, certificate catalogue entry (`cuda.json`), and Indonesian chrome in
`i18n/id.json`. `features/cuda/cuda.test.jsx` validates the content shape and the hub/course/exam/download
behaviour. The same `ReadingTrack` shell renders the PyTorch track (`docs/PYTORCH.md`).

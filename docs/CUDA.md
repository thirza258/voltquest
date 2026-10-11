# CUDA C++ GPU programming track

`/cuda` and `/cuda/:lessonId` provide eight reading-only CUDA C++ courses (`content/cuda.json`), rendered by
the shared `features/courses/ReadingTrack.jsx` hub/course component and configured by
`features/cuda/CudaPage.jsx`. Each course has four sections with a practice question, a guided lab with an
expected result, a complete self-contained `.cu` program (copy or download), an applied challenge and a
five-question 80% exam using the shared `vq.courses.v1` progress and the certificate system (added to the
certificate `CATALOGUES` in `backend/app/services/certificates.py`).

## Courses

`cuda-intro`, `cuda-threads`, `cuda-memory`, `cuda-vectoradd`, `cuda-shared`, `cuda-reduction`,
`cuda-streams`, `cuda-capstone` — from the host/device model and the thread hierarchy to device memory,
a grid-stride vector add, shared-memory tiled matmul, a tree reduction with `atomicAdd`, streams with
pinned memory, and a timed, CPU-verified SAXPY capstone.

## Honesty

CUDA is not compiled or run in the browser: there is no GPU in VoltQuest, and `nvcc` is not available in
this repo, so the programs are not compiled here. Every `code` field is a complete program authored and
structurally reviewed to compile with `nvcc` and run on an NVIDIA GPU, and the course states the expected
output. Lab step checkboxes record the learner's own observations and verify nothing. The hub disclosure
states the NVIDIA GPU + CUDA Toolkit (`nvcc`) requirement.

## Wiring

Route in `App.jsx` (`/cuda`, `/cuda/:lessonId`), nav section in `AppHeader.jsx`, sitemap in
`vite-sitemap.js` (guarded read + conditional inclusion), directory card in
`features/courses/coursesDirectory.js`, certificate catalogue entry (`cuda.json`), and Indonesian chrome in
`i18n/id.json`. `features/cuda/cuda.test.jsx` validates the content shape and the hub/course/exam/download
behaviour. The same `ReadingTrack` shell renders the PyTorch track (`docs/PYTORCH.md`).

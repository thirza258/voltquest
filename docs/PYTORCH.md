# PyTorch deep-learning track

`/pytorch` and `/pytorch/:lessonId` provide ten reading-only PyTorch courses (`content/pytorch.json`),
rendered by the shared `features/courses/ReadingTrack.jsx` hub/course component and configured by
`features/pytorch/PytorchPage.jsx`. Each course has four sections with a practice question, a guided lab
with an expected result, a complete self-contained `.py` program (copy or download), an applied challenge
and a five-question 80% exam using the shared `vq.courses.v1` progress and the certificate system (added to
the certificate `CATALOGUES` in `backend/app/services/certificates.py`).

## Courses

`torch-tensors`, `torch-autograd`, `torch-nn`, `torch-training`, `torch-data`, `torch-linreg`,
`torch-classification`, `torch-cnn`, `torch-eval`, `torch-capstone` — from tensors, autograd and
`nn.Module` through the training loop, datasets, linear regression, an MLP classifier, a CNN, evaluation
and saving, to a complete reproducible pipeline that trains, validates and saves the best model.

## Honesty

Python and PyTorch are not run in the browser, and torch is not installed in this repo, so the programs
are not executed anywhere here. Every `code` field is a self-contained program authored to run under
Python 3 with torch (seeded with `torch.manual_seed(0)` and its own synthetic data); the course states the
expected output. `backend/tests/test_pytorch_content.py` parses each program and checks it for undefined
names with `ast` + `symtable`, and `features/pytorch/pytorch.test.jsx` asserts each one imports torch. Lab
step checkboxes record the learner's own observations and verify nothing. The hub disclosure states the
Python 3 + `pip install torch` requirement.

## Wiring

Route in `App.jsx` (`/pytorch`, `/pytorch/:lessonId`), nav section in `AppHeader.jsx`, sitemap in
`vite-sitemap.js` (guarded read + conditional inclusion), directory card in
`features/courses/coursesDirectory.js`, certificate catalogue entry (`pytorch.json`), and Indonesian chrome
in `i18n/id.json`. The same `ReadingTrack` shell renders the CUDA track (`docs/CUDA.md`).

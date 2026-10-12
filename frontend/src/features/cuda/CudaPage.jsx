import content from '@content/cuda.json'
import ReadingTrack from '../courses/ReadingTrack.jsx'

export const CUDA_COURSES = content.courses

const track = {
  base: '/cuda',
  courses: CUDA_COURSES,
  reviewedAt: content.reviewedAt,
  tag: 'CUDA C++',
  codeExt: 'cu',
  difficulties: ['Fundamental', 'Intermediate', 'Advanced'],
  haystack: 'cuda c++ gpu nvidia kernel threads memory',
  eyebrow: 'CUDA C++ GPU programming',
  title: 'Program NVIDIA GPUs with CUDA C++',
  intro: 'Go from your first GPU kernel to a tuned, multi-GPU program. Learn the thread hierarchy, device memory, grid-stride loops, shared-memory tiling, parallel reduction, streams, the Thrust and cuBLAS libraries, and multi-GPU scaling, with a complete compilable program for every course.',
  metrics: '10 courses · 40 section checkpoints · 10 exams',
  continueLabel: 'Continue the CUDA path',
  capstoneId: 'cuda-capstone',
  capstoneLabel: 'Jump to the SAXPY capstone',
  allLabel: 'All CUDA C++ courses',
  searchLabel: 'Search CUDA courses',
  disclosure: 'Study and take exams in any browser. Compiling and running the examples needs an NVIDIA GPU and the CUDA Toolkit (nvcc). VoltQuest provides the source and expected results; it does not compile or run CUDA in the browser. Lab step checkboxes record your own observations and verify nothing.',
  langNote: 'CUDA course narratives, questions and example source are currently in English. Interface controls and learning rewards support Indonesian.',
  reviewedNote: 'NVIDIA CUDA C++ documentation reviewed on {date}. Match the CUDA Toolkit version to your GPU driver.',
}

export default function CudaPage() {
  return <ReadingTrack track={track} />
}

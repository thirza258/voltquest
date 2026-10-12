import content from '@content/pytorch.json'
import ReadingTrack from '../courses/ReadingTrack.jsx'

export const PYTORCH_COURSES = content.courses

const track = {
  base: '/pytorch',
  courses: PYTORCH_COURSES,
  reviewedAt: content.reviewedAt,
  tag: 'PyTorch',
  codeExt: 'py',
  difficulties: ['Fundamental', 'Intermediate', 'Advanced'],
  haystack: 'pytorch torch tensor autograd neural network training ml model',
  eyebrow: 'PyTorch deep learning',
  title: 'Build and train ML models with PyTorch',
  intro: 'Go from tensors and autograd to a complete, reproducible training pipeline. Learn nn.Module, the training loop, datasets, linear regression, an MLP classifier, a convolutional network, evaluation and saving — each with a runnable Python program.',
  metrics: '10 courses · 40 section checkpoints · 10 exams',
  continueLabel: 'Continue the PyTorch path',
  capstoneId: 'torch-capstone',
  capstoneLabel: 'Jump to the ML capstone',
  allLabel: 'All PyTorch courses',
  searchLabel: 'Search PyTorch courses',
  disclosure: 'Study and take exams in any browser. Running the examples needs your own Python 3 environment with PyTorch installed (pip install torch). VoltQuest provides the source and expected results; it does not run Python or PyTorch in the browser. Lab step checkboxes record your own observations and verify nothing.',
  langNote: 'PyTorch course narratives, questions and example source are currently in English. Interface controls and learning rewards support Indonesian.',
  reviewedNote: 'PyTorch documentation reviewed on {date}. Use the official install selector for your OS, package manager and CUDA version.',
}

export default function PytorchPage() {
  return <ReadingTrack track={track} />
}

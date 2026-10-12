import content from '@content/kernel.json'
import ReadingTrack from '../courses/ReadingTrack.jsx'

export const KERNEL_COURSES = content.courses

const track = {
  base: '/kernel',
  courses: KERNEL_COURSES,
  reviewedAt: content.reviewedAt,
  tag: 'Linux kernel (C)',
  codeExt: 'c',
  difficulties: ['Fundamental', 'Intermediate', 'Advanced'],
  haystack: 'linux kernel module driver char device c',
  eyebrow: 'Linux kernel programming',
  title: 'Write Linux kernel modules and drivers',
  intro: 'Go from your first loadable module to a complete character driver. Learn kernel vs user space, module parameters, char devices, kernel memory, concurrency with locks and atomics, interrupts and deferred work, and /proc — each with a real, compilable module.',
  metrics: '8 courses · 32 section checkpoints · 8 exams',
  continueLabel: 'Continue the kernel path',
  capstoneId: 'kern-capstone',
  capstoneLabel: 'Jump to the driver capstone',
  allLabel: 'All kernel courses',
  searchLabel: 'Search kernel courses',
  disclosure: 'Study and take exams in any browser. Building and loading a module needs a Linux machine or VM — you cannot load kernel modules on macOS or Windows — with kernel headers matching `uname -r` (a 6.x LTS such as 6.12 is assumed). Secure Boot rejects unsigned modules, and a buggy module can hang or crash the machine, so always use a throwaway VM. VoltQuest does not build or run kernel modules in the browser. Lab step checkboxes record your own observations and verify nothing.',
  codeNote: 'Read, copy or download this module source, then build it out-of-tree with a Makefile against your own kernel headers and load it with insmod. VoltQuest does not build or run kernel modules in the browser.',
  langNote: 'Kernel course narratives, questions and example source are currently in English. Interface controls and learning rewards support Indonesian.',
  reviewedNote: 'The Linux Kernel documentation and Module Programming Guide reviewed on {date}. APIs target a 6.x LTS kernel; some interfaces differ on older kernels.',
}

export default function KernelPage() {
  return <ReadingTrack track={track} />
}

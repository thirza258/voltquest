/**
 * Every sandbox bench, in rail order. `name` is the short label used by the rail and footer; `title`
 * is the page heading. Descriptions state only what the bench executes or models. The literal
 * counts are checked against the registry and content in sandboxNav.test.jsx, so they cannot drift
 * without a failing test (importing those modules here would add them to every bench bundle).
 * `values` fills `{count}` placeholders so translations survive a count change.
 * `saving` tells the rail how work persists: 'draft' benches autosave; 'manual' benches keep work
 * until the learner saves, so switching away asks first (see benchGuard.js).
 */
export const CIRCUIT_PART_TYPES = 37
export const MATLAB_BROWSER_FUNCTIONS = 73
export const CYBER_DEFENSES = 9
export const HPC_LABS = 10

export const ALL_SANDBOXES = [
  {
    id: 'circuit',
    name: 'Circuit & breadboard',
    title: 'Circuit sandbox',
    description: 'Uno, Nano, ESP32, ESP32-S3 and Raspberry Pi 4/5 on a breadboard with {count} part types, simulated firmware and a 2D/3D view.',
    values: { count: CIRCUIT_PART_TYPES },
    path: '/sandbox',
    bench: null,
    icon: 'Cpu',
    saving: 'draft',
  },
  {
    id: 'drone',
    name: 'Custom drone',
    title: 'Custom drone sandbox',
    description: 'Quad-X builder with typed ESC, IMU and barometer wiring, flight firmware, PID gains, blackbox plots and a 1 kHz rigid-body model.',
    path: '/sandbox?bench=drone',
    bench: 'drone',
    icon: 'Plane',
    saving: 'draft',
  },
  {
    id: 'computer',
    name: 'Computer architecture',
    title: 'Computer architecture sandbox',
    description: 'Editable gate circuits with truth tables, an SR latch and flip-flops, then VQ4 assembly stepped through registers and RAM.',
    path: '/sandbox?bench=computer',
    bench: 'computer',
    icon: 'Binary',
    saving: 'manual',
  },
  {
    id: 'avr',
    name: 'AVR assembler IDE',
    title: 'AVR assembler sandbox',
    description: 'A real AVR assembler IDE: edit AVR assembly, read opcode listings, and step or run the ATmega simulator with live registers, SREG flags and memory.',
    path: '/sandbox?bench=avr',
    bench: 'avr',
    icon: 'Terminal',
    saving: 'manual',
  },
  {
    id: 'ai-agents',
    name: 'AI agents',
    title: 'AI agent sandbox',
    description: 'Agent-first IDE with a scripted model: tool calls on fictional fixtures, approvals, questions, context and cost ledgers, skills and an MCP fixture.',
    path: '/sandbox?bench=ai-agents',
    bench: 'ai-agents',
    icon: 'Bot',
    saving: 'manual',
  },
  {
    id: 'matlab',
    name: 'MATLAB',
    title: 'MATLAB sandbox',
    description: 'MATLAB-style desktop for a {count}-function numerical subset: editor, Command Window, workspace and line plots. Desktop-only functions are listed, not run.',
    values: { count: MATLAB_BROWSER_FUNCTIONS },
    path: '/sandbox?bench=matlab',
    bench: 'matlab',
    icon: 'Activity',
    saving: 'manual',
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    title: 'Cybersecurity sandbox',
    description: 'A network topology, a curl terminal and a DevTools inspector over a fictional local shop. Toggle {count} defenses and rerun checks; no request leaves the browser.',
    values: { count: CYBER_DEFENSES },
    path: '/sandbox?bench=cybersecurity',
    bench: 'cybersecurity',
    icon: 'Shield',
    saving: 'manual',
  },
  {
    id: 'hpc',
    name: 'HPC (C/C++)',
    title: 'HPC sandbox',
    description: 'C17/C++17 IDE with generated build commands, plus {count} bounded browser models of precision, caches, SIMD, OpenMP scheduling and MPI partitions.',
    values: { count: HPC_LABS },
    path: '/sandbox?bench=hpc',
    bench: 'hpc',
    icon: 'Zap',
    saving: 'manual',
  },
  {
    id: 'vision',
    name: 'Computer vision',
    title: 'Computer vision sandbox',
    description: 'OpenCV 4.12 thresholds, HSV masks and Canny edges on generated 128 × 128 scenes, one fixed attention head and device integration.',
    path: '/sandbox?bench=vision',
    bench: 'vision',
    icon: 'Eye',
    saving: 'manual',
  },
  {
    id: 'robotics',
    name: 'Robotics & ROS 2',
    title: 'Robotics sandbox',
    description: 'A 2D differential-drive robot with ROS 2-style topics, one forward range ray, a reset service, parameters and waypoint actions.',
    path: '/sandbox?bench=robotics',
    bench: 'robotics',
    icon: 'Compass',
    saving: 'manual',
  },
]

export function getSandbox(id) {
  return ALL_SANDBOXES.find((s) => s.id === id) ?? ALL_SANDBOXES[0]
}

export function getSandboxByBench(bench) {
  if (!bench || bench === 'circuit') return ALL_SANDBOXES[0]
  return ALL_SANDBOXES.find((s) => s.bench === bench) ?? ALL_SANDBOXES[0]
}

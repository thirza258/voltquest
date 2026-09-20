/**
 * Directory of all available interactive sandboxes across VoltQuest.
 */

export const ALL_SANDBOXES = [
  {
    id: 'circuit',
    name: 'Circuit & Breadboard',
    category: 'Electronics & Firmware',
    description: 'Arduino Uno, Nano, ESP32, ESP32-S3, Raspberry Pi 4/5 with 37 components & 2D/3D view.',
    path: '/sandbox',
    bench: null,
    icon: 'Cpu',
    tag: 'Hardware',
    color: 'teal',
  },
  {
    id: 'drone',
    name: 'Custom Drone Bench',
    category: 'Avionics & Flight',
    description: 'Quad-X flight controller, ESC signals, gyro blackbox, PID tuning and motor telemetry.',
    path: '/sandbox?bench=drone',
    bench: 'drone',
    icon: 'Plane',
    tag: 'Flight',
    color: 'sky',
  },
  {
    id: 'computer',
    name: 'Computer Architecture',
    category: 'Digital Logic & CPU',
    description: 'Interactive gates, adders, ALU, registers, RAM, micro-architecture and VQ4 assembly stepping.',
    path: '/sandbox?bench=computer',
    bench: 'computer',
    icon: 'Binary',
    tag: 'Logic',
    color: 'indigo',
  },
  {
    id: 'ai-agents',
    name: 'AI Agent Workbench',
    category: 'Autonomous Systems',
    description: 'Agent harness, tool execution, MCP fixtures, approvals, context window and token budgeting.',
    path: '/sandbox?bench=ai-agents',
    bench: 'ai-agents',
    icon: 'Bot',
    tag: 'AI',
    color: 'purple',
  },
  {
    id: 'matlab',
    name: 'MATLAB Numerical Lab',
    category: 'Scientific Computing',
    description: 'Bounded numeric script interpreter, matrix math, ODE simulations, FFT and interactive 2D plots.',
    path: '/sandbox?bench=matlab',
    bench: 'matlab',
    icon: 'Activity',
    tag: 'Math',
    color: 'orange',
  },
  {
    id: 'cybersecurity',
    name: 'Web Security Sandbox',
    category: 'AppSec & Audit',
    description: 'Simulated online shop, request tamperer, OWASP vulnerability probing and 9 configurable defenses.',
    path: '/sandbox?bench=cybersecurity',
    bench: 'cybersecurity',
    icon: 'Shield',
    tag: 'Security',
    color: 'rose',
  },
  {
    id: 'hpc',
    name: 'HPC & Parallel Bench',
    category: 'High Performance C/C++',
    description: 'Performance model exploration, cache locality tests, OpenMP multithreading and MPI collectives.',
    path: '/sandbox?bench=hpc',
    bench: 'hpc',
    icon: 'Zap',
    tag: 'Parallel',
    color: 'amber',
  },
  {
    id: 'vision',
    name: 'Computer Vision Lab',
    category: 'Perception & OpenCV',
    description: 'Interactive image filters, edge and contour detection, ArUco tracking and vision transformers.',
    path: '/sandbox?bench=vision',
    bench: 'vision',
    icon: 'Eye',
    tag: 'Vision',
    color: 'blue',
  },
  {
    id: 'robotics',
    name: 'Robotics & ROS 2 Simulator',
    category: 'Robotics & Controls',
    description: 'Differential drive mobile robot simulator, ROS 2 pub/sub nodes, laser scans and waypoints.',
    path: '/sandbox?bench=robotics',
    bench: 'robotics',
    icon: 'Compass',
    tag: 'Robotics',
    color: 'cyan',
  },
]

export function getSandbox(id) {
  return ALL_SANDBOXES.find((s) => s.id === id) ?? ALL_SANDBOXES[0]
}

export function getSandboxByBench(bench) {
  if (!bench || bench === 'circuit') return ALL_SANDBOXES[0]
  return ALL_SANDBOXES.find((s) => s.bench === bench) ?? ALL_SANDBOXES[0]
}

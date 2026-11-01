import fs from 'node:fs'
import path from 'node:path'
import { SITE_ORIGIN, collectRoutes } from './vite-sitemap.js'

const readJsonSafe = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null)

export function loadContentCatalog(contentDir) {
  const read = (name) => readJsonSafe(path.join(contentDir, name))
  const questDir = path.join(contentDir, 'quests')
  const quests = {}
  if (fs.existsSync(questDir)) {
    for (const file of fs.readdirSync(questDir)) {
      if (file.endsWith('.json')) {
        const q = readJsonSafe(path.join(questDir, file))
        if (q?.id) quests[q.id] = q
      }
    }
  }

  const mapById = (list) => Object.fromEntries((list ?? []).filter(item => item?.id).map(item => [item.id, item]))

  return {
    tutorials: mapById(read('tutorials.json')?.tutorials),
    courses: mapById(read('courses.json')?.courses),
    qt: mapById(read('qt.json')?.courses),
    winui: mapById(read('winui.json')?.courses),
    matlab: mapById(read('matlab.json')?.courses),
    hpc: mapById(read('hpc.json')?.courses),
    cybersecurity: mapById(read('cybersecurity.json')?.courses),
    aiAgents: mapById(read('ai-agents.json')?.courses),
    computerArchitecture: mapById(read('computer-architecture.json')?.courses),
    robotics: mapById(read('robotics.json')?.tutorials),
    vision: mapById(read('vision.json')?.tutorials),
    cuda: mapById(read('cuda.json')?.courses),
    pytorch: mapById(read('pytorch.json')?.courses),
    kernel: mapById(read('kernel.json')?.courses),
    loadbalancer: mapById(read('loadbalancer.json')?.courses),
    distributed: mapById(read('distributed.json')?.courses),
    kubernetes: mapById(read('kubernetes.json')?.courses),
    gamemodding: mapById(read('gamemodding.json')?.courses),
    iotC: mapById(read('iot-c.json')?.courses),
    excel: mapById(read('excel.json')?.courses),
    avr: mapById(read('avr.json')?.courses),
    quests,
  }
}

const DEFAULT_TITLE = 'VoltQuest — learn electronics by playing'
const DEFAULT_DESCRIPTION = 'Interactive electronics simulator, breadboard circuits, and software engineering courses from Arduino and ESP32 to Qt, Robotics, and HPC.'

const STATIC_ROUTES = {
  '/': { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  '/campaign': { title: 'Campaign Mode — VoltQuest', description: 'Progress through worlds of electronic circuits, puzzles, and microcontroller challenges.' },
  '/certificates': { title: 'Certificates — VoltQuest', description: 'Earn and verify skill certificates in electronics, embedded programming, and systems engineering.' },
  '/tutorials': { title: 'Electronics Tutorials — VoltQuest', description: 'Interactive step-by-step breadboard, microcontroller, and sensor tutorials.' },
  '/courses': { title: 'Engineering Courses — VoltQuest', description: 'Hands-on courses in circuits, embedded systems, robotics, high performance computing, and desktop apps.' },
  '/sandbox': { title: 'Electronics & Systems Sandbox — VoltQuest', description: 'Freeform interactive circuit simulation, robotics testbench, and hardware experimentation.' },
  '/showcase': { title: 'Circuit Showcase — VoltQuest', description: 'Explore community electronics projects, circuits, and breadboard creations.' },
  '/community': { title: 'Community — VoltQuest', description: 'Join the electronics and hardware engineering discussion, showcase creations, and ask questions.' },
  '/leaderboard': { title: 'Player Leaderboard — VoltQuest', description: 'Top electronics players and engineers on VoltQuest.' },
  '/qt': { title: 'Build desktop apps with Qt and C++ — VoltQuest', description: 'Learn Qt Widgets, modern C++, model/view, files, SQLite, networking, and background work.' },
  '/winui': { title: 'WinUI 3 & C++ Desktop Apps — VoltQuest', description: 'Build modern Windows desktop apps with WinUI 3, XAML, and C++.' },
  '/matlab': { title: 'MATLAB & Numerical Computing — VoltQuest', description: 'Learn matrix mathematics, signal processing, and numerical algorithms.' },
  '/hpc': { title: 'High Performance Computing — VoltQuest', description: 'Master modern C++, OpenMP, MPI, and CPU performance optimization.' },
  '/cybersecurity': { title: 'Applied Cybersecurity — VoltQuest', description: 'Hardware security, embedded vulnerabilities, and network protocols.' },
  '/ai-agents': { title: 'AI Agents & Systems — VoltQuest', description: 'Build autonomous AI tools, agents, and tool calling harnesses.' },
  '/computer-architecture': { title: 'Computer Architecture & Assembly — VoltQuest', description: 'Learn CPU architecture, registers, logic gates, and assembly programming.' },
  '/vision': { title: 'Computer Vision & OpenCV — VoltQuest', description: 'Image processing, feature detection, and visual IoT sensors.' },
  '/robotics': { title: 'Robotics & ROS 2 — VoltQuest', description: 'Kinematics, differential drive, ROS 2 nodes, and robot control.' },
  '/cuda': { title: 'CUDA C++ & GPU Computing — VoltQuest', description: 'GPU architecture, CUDA kernels, memory hierarchies, and parallel algorithms.' },
  '/pytorch': { title: 'PyTorch Deep Learning — VoltQuest', description: 'Tensors, neural network layers, autograd, and training loops.' },
  '/kernel': { title: 'Linux Kernel & Drivers — VoltQuest', description: 'Kernel space programming, loadable modules, and character device drivers.' },
  '/loadbalancer': { title: 'Load Balancer Architecture — VoltQuest', description: 'L4 and L7 load balancing, health checks, and high availability.' },
  '/distributed': { title: 'Distributed Systems — VoltQuest', description: 'Consensus, replication, fault tolerance, and distributed architectures.' },
  '/kubernetes': { title: 'Kubernetes Architecture — VoltQuest', description: 'Control plane, pods, services, ingress, and container orchestration.' },
  '/game-modding': { title: 'Game Architecture & Modding — VoltQuest', description: 'Memory manipulation, reverse engineering, hooks, and game engines.' },
  '/iot-c': { title: 'Embedded C for IoT — VoltQuest', description: 'Low-level C programming, memory constraints, and IoT protocols.' },
  '/excel': { title: 'Microsoft Excel & Data Analytics — VoltQuest', description: 'Formulas, VLOOKUP/XLOOKUP, pivot tables, statistical EDA, and executive dashboards with an in-browser Excel simulator.' },
  '/avr': { title: 'AVR Assembly & Architecture — VoltQuest', description: 'AVR registers, assembly instructions, timers, and bare-metal programming.' },
}

const SECTION_PREFIXES = [
  { prefix: '/tutorials/', catalog: 'tutorials', suffix: ' — Tutorial — VoltQuest' },
  { prefix: '/courses/', catalog: 'courses', suffix: ' — Course — VoltQuest' },
  { prefix: '/qt/', catalog: 'qt', suffix: ' — Qt 6 & C++ — VoltQuest' },
  { prefix: '/winui/', catalog: 'winui', suffix: ' — WinUI 3 — VoltQuest' },
  { prefix: '/matlab/', catalog: 'matlab', suffix: ' — MATLAB — VoltQuest' },
  { prefix: '/hpc/', catalog: 'hpc', suffix: ' — HPC — VoltQuest' },
  { prefix: '/cybersecurity/', catalog: 'cybersecurity', suffix: ' — Cybersecurity — VoltQuest' },
  { prefix: '/ai-agents/', catalog: 'aiAgents', suffix: ' — AI Agents — VoltQuest' },
  { prefix: '/computer-architecture/', catalog: 'computerArchitecture', suffix: ' — Computer Architecture — VoltQuest' },
  { prefix: '/vision/', catalog: 'vision', suffix: ' — Computer Vision — VoltQuest' },
  { prefix: '/robotics/', catalog: 'robotics', suffix: ' — Robotics — VoltQuest' },
  { prefix: '/cuda/', catalog: 'cuda', suffix: ' — CUDA — VoltQuest' },
  { prefix: '/pytorch/', catalog: 'pytorch', suffix: ' — PyTorch — VoltQuest' },
  { prefix: '/kernel/', catalog: 'kernel', suffix: ' — Kernel — VoltQuest' },
  { prefix: '/loadbalancer/', catalog: 'loadbalancer', suffix: ' — Load Balancer — VoltQuest' },
  { prefix: '/distributed/', catalog: 'distributed', suffix: ' — Distributed Systems — VoltQuest' },
  { prefix: '/kubernetes/', catalog: 'kubernetes', suffix: ' — Kubernetes — VoltQuest' },
  { prefix: '/game-modding/', catalog: 'gamemodding', suffix: ' — Game Modding — VoltQuest' },
  { prefix: '/iot-c/', catalog: 'iotC', suffix: ' — Embedded C — VoltQuest' },
  { prefix: '/excel/', catalog: 'excel', suffix: ' — Microsoft Excel — VoltQuest' },
  { prefix: '/avr/', catalog: 'avr', suffix: ' — AVR — VoltQuest' },
]

export function getRouteMetadata(route, catalog, origin = SITE_ORIGIN) {
  const cleanPath = route.split('?')[0].replace(/\/+$/, '') || '/'
  const canonical = `${origin}${cleanPath}`

  if (STATIC_ROUTES[cleanPath]) {
    return {
      title: STATIC_ROUTES[cleanPath].title,
      description: STATIC_ROUTES[cleanPath].description,
      canonical,
    }
  }

  if (cleanPath.startsWith('/play/')) {
    const levelId = cleanPath.slice('/play/'.length)
    const quest = catalog?.quests?.[levelId]
    const title = quest?.title ? `${quest.title} — Level ${levelId} — VoltQuest` : `Level ${levelId} — VoltQuest`
    const description = quest?.description ?? quest?.summary ?? `Play level ${levelId} in the VoltQuest electronics simulator.`
    return { title, description, canonical }
  }

  for (const { prefix, catalog: key, suffix } of SECTION_PREFIXES) {
    if (cleanPath.startsWith(prefix)) {
      const rest = cleanPath.slice(prefix.length)
      const id = rest.split('/')[0]
      const item = catalog?.[key]?.[id]
      const title = item?.title ? `${item.title}${suffix}` : `${id}${suffix}`
      const description = item?.summary ?? item?.description ?? DEFAULT_DESCRIPTION
      return { title, description, canonical }
    }
  }

  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonical,
  }
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function injectHeadMetadata(templateHtml, metadata) {
  const metaTags = [
    `<title>${escapeHtml(metadata.title)}</title>`,
    `<meta name="description" content="${escapeHtml(metadata.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(metadata.canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(metadata.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(metadata.canonical)}" />`,
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`,
  ].join('\n    ')

  // If template already has a title tag, replace it and add meta
  if (templateHtml.includes('<title>')) {
    return templateHtml.replace(/<title>[\s\S]*?<\/title>/, metaTags)
  }
  // Otherwise inject right before </head>
  return templateHtml.replace('</head>', `    ${metaTags}\n  </head>`)
}

export function prerenderRoutes({ contentDir, distDir, origin = SITE_ORIGIN }) {
  const indexHtmlPath = path.join(distDir, 'index.html')
  if (!fs.existsSync(indexHtmlPath)) return { count: 0 }

  const templateHtml = fs.readFileSync(indexHtmlPath, 'utf8')
  const catalog = loadContentCatalog(contentDir)
  const allRoutes = collectRoutes(contentDir)

  // Deduplicate routes by clean path so /tutorials/uno-blink and /tutorials/uno-blink?board=uno
  // map to the exact same canonical static page
  const cleanPaths = [...new Set(allRoutes.map((r) => r.split('?')[0].replace(/\/+$/, '') || '/'))]

  let count = 0
  for (const pathname of cleanPaths) {
    const meta = getRouteMetadata(pathname, catalog, origin)
    const pageHtml = injectHeadMetadata(templateHtml, meta)

    if (pathname === '/') {
      fs.writeFileSync(indexHtmlPath, pageHtml, 'utf8')
      count++
      continue
    }

    const subPath = pathname.slice(1) // remove leading slash
    const dirPath = path.join(distDir, subPath)
    fs.mkdirSync(dirPath, { recursive: true })
    fs.writeFileSync(path.join(dirPath, 'index.html'), pageHtml, 'utf8')
    fs.writeFileSync(`${path.join(distDir, subPath)}.html`, pageHtml, 'utf8')
    count++
  }

  return { count }
}

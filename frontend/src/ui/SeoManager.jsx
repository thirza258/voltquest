import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export const SITE_ORIGIN = 'https://pcb.nevatal.id'

const HUB_TITLES = {
  '/': 'VoltQuest — learn electronics by playing',
  '/campaign': 'Campaign Mode — VoltQuest',
  '/certificates': 'Certificates — VoltQuest',
  '/tutorials': 'Electronics Tutorials — VoltQuest',
  '/courses': 'Engineering Courses — VoltQuest',
  '/sandbox': 'Electronics & Systems Sandbox — VoltQuest',
  '/showcase': 'Circuit Showcase — VoltQuest',
  '/community': 'Community — VoltQuest',
  '/leaderboard': 'Player Leaderboard — VoltQuest',
  '/qt': 'Build desktop apps with Qt and C++ — VoltQuest',
  '/winui': 'WinUI 3 & C++ Desktop Apps — VoltQuest',
  '/matlab': 'MATLAB & Numerical Computing — VoltQuest',
  '/hpc': 'High Performance Computing — VoltQuest',
  '/cybersecurity': 'Applied Cybersecurity — VoltQuest',
  '/ai-agents': 'AI Agents & Systems — VoltQuest',
  '/computer-architecture': 'Computer Architecture & Assembly — VoltQuest',
  '/vision': 'Computer Vision & OpenCV — VoltQuest',
  '/networking': 'Computer Networking & Network Simulator — VoltQuest',
  '/robotics': 'Robotics & ROS 2 — VoltQuest',
  '/cuda': 'CUDA C++ & GPU Computing — VoltQuest',
  '/pytorch': 'PyTorch Deep Learning — VoltQuest',
  '/kernel': 'Linux Kernel & Drivers — VoltQuest',
  '/loadbalancer': 'Load Balancer Architecture — VoltQuest',
  '/distributed': 'Distributed Systems — VoltQuest',
  '/kubernetes': 'Kubernetes Architecture — VoltQuest',
  '/game-modding': 'Game Architecture & Modding — VoltQuest',
  '/iot-c': 'Embedded C for IoT — VoltQuest',
  '/avr': 'AVR Assembly & Architecture — VoltQuest',
}

const SECTION_LABELS = {
  qt: 'Qt 6 & C++',
  winui: 'WinUI 3',
  tutorials: 'Tutorial',
  courses: 'Course',
  matlab: 'MATLAB',
  hpc: 'HPC',
  cybersecurity: 'Cybersecurity',
  'ai-agents': 'AI Agents',
  'computer-architecture': 'Computer Architecture',
  vision: 'Vision',
  robotics: 'Robotics',
  cuda: 'CUDA',
  pytorch: 'PyTorch',
  kernel: 'Kernel',
  loadbalancer: 'Load Balancer',
  distributed: 'Distributed Systems',
  kubernetes: 'Kubernetes',
  'game-modding': 'Game Modding',
  'iot-c': 'Embedded C',
  avr: 'AVR',
  networking: 'Networking',
}

function formatSlug(slug) {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function resolveClientCanonical(pathname) {
  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '') || '/'
  return `${SITE_ORIGIN}${cleanPath}`
}

export function resolveClientTitle(pathname) {
  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '') || '/'
  if (HUB_TITLES[cleanPath]) return HUB_TITLES[cleanPath]

  const parts = cleanPath.split('/').filter(Boolean)
  if (parts.length >= 2) {
    const section = parts[0]
    const slug = parts[1]
    const label = SECTION_LABELS[section]
    if (label) {
      return `${formatSlug(slug)} — ${label} — VoltQuest`
    }
    if (section === 'play') {
      return `Level ${slug.toUpperCase()} — VoltQuest`
    }
  }

  return 'VoltQuest — learn electronics by playing'
}

export function updateHeadSeo(pathname) {
  const canonicalUrl = resolveClientCanonical(pathname)
  const title = resolveClientTitle(pathname)

  if (title) {
    document.title = title
  }

  let canonicalEl = document.querySelector('link[rel="canonical"]')
  if (!canonicalEl) {
    canonicalEl = document.createElement('link')
    canonicalEl.setAttribute('rel', 'canonical')
    document.head.appendChild(canonicalEl)
  }
  canonicalEl.setAttribute('href', canonicalUrl)

  let ogUrl = document.querySelector('meta[property="og:url"]')
  if (!ogUrl) {
    ogUrl = document.createElement('meta')
    ogUrl.setAttribute('property', 'og:url')
    document.head.appendChild(ogUrl)
  }
  ogUrl.setAttribute('content', canonicalUrl)
}

export default function SeoManager() {
  const location = useLocation()

  useEffect(() => {
    updateHeadSeo(location.pathname)
  }, [location.pathname])

  return null
}

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { SITE_ORIGIN, collectRoutes, renderSitemap } from './vite-sitemap.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const contentDir = path.resolve(here, '../content')
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const routes = collectRoutes(contentDir)

describe('collectRoutes', () => {
  it('lists the public entry points', () => {
    expect(routes).toContain('/')
    expect(routes).toContain('/tutorials')
    expect(routes).toContain('/courses')
    expect(routes).toContain('/hpc')
    expect(routes).toContain('/sandbox')
    expect(routes).toContain('/showcase')
    expect(routes).toContain('/leaderboard')
  })

  it('covers every campaign level, in campaign order', () => {
    const expected = readJson(path.join(contentDir, 'worlds.json')).worlds
      .slice()
      .sort((a, b) => a.order - b.order)
      .flatMap((world) => world.levelIds)
      .map((id) => `/play/${id}`)
    expect(routes.filter((route) => route.startsWith('/play/'))).toEqual(expected)
  })

  it('covers every tutorial', () => {
    const expected = readJson(path.join(contentDir, 'tutorials.json')).tutorials.map((t) => `/tutorials/${t.id}`)
    expect(routes.filter((route) => route.startsWith('/tutorials/'))).toEqual(expected)
  })

  it('covers all course routes', () => {
    const expected = readJson(path.join(contentDir, 'courses.json')).courses.map(course => `/courses/${course.id}`)
    expect(expected).toHaveLength(34)
    expect(routes.filter(route => route.startsWith('/courses/'))).toEqual(expected)
  })

  it('omits per-player and user-generated routes', () => {
    expect(routes).not.toContain('/profile')
    expect(routes.some((route) => route.startsWith('/sandbox/'))).toBe(false)
    expect(routes.some((route) => route.startsWith('/showcase/'))).toBe(false)
  })

  it('includes all ten HPC courses', () => {
    const expected = readJson(path.join(contentDir, 'hpc.json')).courses.map(course => `/hpc/${course.id}`)
    expect(expected).toHaveLength(10)
    expect(routes.filter(route => route.startsWith('/hpc/'))).toEqual(expected)
  })

  it('includes the cybersecurity path and every authored course', () => {
    const expected = readJson(path.join(contentDir, 'cybersecurity.json')).courses.map(course => `/cybersecurity/${course.id}`)
    expect(expected).toHaveLength(10)
    expect(routes).toContain('/cybersecurity')
    expect(routes.filter(route => route.startsWith('/cybersecurity/'))).toEqual(expected)
    expect(new Set(routes).size).toBe(routes.length)
  })

  it('includes the MATLAB path and every course', () => {
    const expected = readJson(path.join(contentDir, 'matlab.json')).courses.map(course => `/matlab/${course.id}`)
    expect(expected).toHaveLength(18)
    expect(routes).toContain('/matlab')
    expect(routes.filter(route => route.startsWith('/matlab/'))).toEqual(expected)
  })

  it('skips level ids that no quest file backs', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voltquest-sitemap-'))
    try {
      fs.mkdirSync(path.join(dir, 'quests'))
      fs.writeFileSync(path.join(dir, 'quests/one.json'), JSON.stringify({ id: 'w1-l1' }))
      fs.writeFileSync(path.join(dir, 'quests/two.json'), JSON.stringify({ id: 'w2-l1' }))
      // Declared out of order, and with a level id that was planned but never authored.
      fs.writeFileSync(path.join(dir, 'worlds.json'), JSON.stringify({
        worlds: [{ order: 2, levelIds: ['w2-l1'] }, { order: 1, levelIds: ['w1-l1', 'w1-l9'] }],
      }))
      fs.writeFileSync(path.join(dir, 'tutorials.json'), JSON.stringify({ tutorials: [{ id: 'cpp-start' }] }))
      fs.writeFileSync(path.join(dir, 'courses.json'), JSON.stringify({ courses: [{ id: 'ee-circuits' }] }))
      fs.writeFileSync(path.join(dir, 'robotics.json'), JSON.stringify({ tutorials: [{ id: 'robot-motion' }] }))
      fs.writeFileSync(path.join(dir, 'vision.json'), JSON.stringify({ tutorials: [{ id: 'opencv-foundations' }] }))
      fs.writeFileSync(path.join(dir, 'hpc.json'), JSON.stringify({ courses: [{ id: 'hpc-correctness' }] }))
      fs.writeFileSync(path.join(dir, 'matlab.json'), JSON.stringify({ courses: [{ id: 'matlab-start' }] }))
      fs.writeFileSync(path.join(dir, 'cybersecurity.json'), JSON.stringify({ courses: [{ id: 'cyber-http' }] }))
      expect(collectRoutes(dir)).toEqual([
        '/', '/play/w1-l1', '/play/w2-l1', '/tutorials', '/tutorials/cpp-start', '/courses', '/courses/ee-circuits', '/vision', '/vision/opencv-foundations', '/robotics', '/robotics/robot-motion', '/hpc', '/hpc/hpc-correctness', '/matlab', '/matlab/matlab-start', '/cybersecurity', '/cybersecurity/cyber-http', '/sandbox', '/showcase', '/leaderboard',
      ])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('renderSitemap', () => {
  it('writes absolute URLs under the site origin', () => {
    const xml = renderSitemap(['/', '/play/w1-l1'], 'https://example.test')
    expect(xml).toContain('<loc>https://example.test/</loc>')
    expect(xml).toContain('<loc>https://example.test/play/w1-l1</loc>')
  })

  it('is well-formed XML with one absolute loc per route', () => {
    const xml = renderSitemap(routes)
    const { window } = new JSDOM()
    const parsed = new window.DOMParser().parseFromString(xml, 'application/xml')
    expect(parsed.querySelector('parsererror')).toBeNull()

    const locs = [...parsed.getElementsByTagName('loc')].map((node) => node.textContent)
    expect(locs).toHaveLength(routes.length)
    for (const loc of locs) expect(new URL(loc).origin).toBe(SITE_ORIGIN)
  })

  it('escapes characters that would break the document', () => {
    expect(renderSitemap(['/showcase/a&b'])).toContain('<loc>https://pcb.nevatal.id/showcase/a&amp;b</loc>')
  })
})

describe('robots.txt', () => {
  const robots = fs.readFileSync(path.join(here, 'public/robots.txt'), 'utf8')

  it('points crawlers at the generated sitemap', () => {
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)
  })

  it('hides private routes but keeps /sandbox and the app bundle crawlable', () => {
    expect(robots).toMatch(/^Disallow: \/profile$/m)
    expect(robots).toMatch(/^Disallow: \/sandbox\/$/m)
    expect(robots).toMatch(/^Disallow: \/api\/$/m)
    // A client-rendered app whose bundle is blocked renders empty for a crawler.
    expect(robots).not.toMatch(/Disallow:\s*\/assets/)
  })
})

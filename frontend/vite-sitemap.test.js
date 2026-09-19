import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { SITE_ORIGIN, collectRoutes, renderSitemap, sitemapPlugin } from './vite-sitemap.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const contentDir = path.resolve(here, '../content')
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const routes = collectRoutes(contentDir)

describe('collectRoutes', () => {
  it('lists the public entry points', () => {
    expect(routes).toContain('/')
    expect(routes).toContain('/campaign')
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

  it('covers every tutorial and board variant', () => {
    const tutorialList = readJson(path.join(contentDir, 'tutorials.json')).tutorials
    const expected = tutorialList.map((t) => `/tutorials/${t.id}`)
    expect(routes.filter((route) => route.startsWith('/tutorials/') && !route.includes('?'))).toEqual(expected)
    const expectedVariants = tutorialList.flatMap((t) => (t.boards ?? []).slice(1).map((board) => `/tutorials/${t.id}?board=${board}`))
    expect(routes.filter((route) => route.startsWith('/tutorials/') && route.includes('?'))).toEqual(expectedVariants)
  })

  it('covers all course routes and tracks', () => {
    const courseData = readJson(path.join(contentDir, 'courses.json'))
    const expected = courseData.courses.map(course => `/courses/${course.id}`)
    expect(expected).toHaveLength(34)
    expect(routes.filter(route => route.startsWith('/courses/'))).toEqual(expected)
    const expectedTracks = courseData.tracks.map(track => `/courses?track=${track.id}`)
    expect(expectedTracks).toHaveLength(5)
    expect(routes.filter(route => route.startsWith('/courses?track='))).toEqual(expectedTracks)
  })

  it('omits per-player and user-generated routes', () => {
    expect(routes).not.toContain('/profile')
    expect(routes.some((route) => route.startsWith('/sandbox/'))).toBe(false)
    expect(routes.some((route) => route.startsWith('/showcase/'))).toBe(false)
  })

  it('includes tutorial board and topic filters', () => {
    const tutorialList = readJson(path.join(contentDir, 'tutorials.json')).tutorials
    const boards = [...new Set(tutorialList.flatMap(t => t.boards ?? []))].map(board => `/tutorials?board=${board}`)
    expect(boards).toHaveLength(6)
    expect(routes.filter(route => route.startsWith('/tutorials?board='))).toEqual(boards)
    const topics = [...new Set(tutorialList.map(t => t.track).filter(Boolean))].map(topic => `/tutorials?topic=${topic}`)
    expect(topics).toHaveLength(2)
    expect(routes.filter(route => route.startsWith('/tutorials?topic='))).toEqual(topics)
  })

  it('includes dedicated sandbox benches and lesson presets', () => {
    const benches = ['matlab', 'cybersecurity', 'hpc', 'vision', 'robotics'].map(bench => `/sandbox?bench=${bench}`)
    for (const bench of benches) {
      expect(routes).toContain(bench)
    }
    expect(routes.filter(route => route.startsWith('/sandbox?bench=vision&lesson='))).toHaveLength(6)
    expect(routes.filter(route => route.startsWith('/sandbox?bench=robotics&lesson='))).toHaveLength(5)
    expect(routes.filter(route => route.startsWith('/sandbox?bench=hpc&lesson='))).toHaveLength(10)
    expect(routes.filter(route => route.startsWith('/sandbox?bench=matlab&lesson='))).toHaveLength(18)
    expect(routes.filter(route => route.startsWith('/sandbox?bench=cybersecurity&lesson='))).toHaveLength(10)
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
      fs.writeFileSync(path.join(dir, 'ai-agents.json'), JSON.stringify({ courses: [{ id: 'agents-cli' }] }))
      fs.writeFileSync(path.join(dir, 'computer-architecture.json'), JSON.stringify({ courses: [{ id: 'computer-bits' }] }))
      expect(collectRoutes(dir)).toEqual([
        '/',
        '/campaign',
        '/certificates',
        '/play/w1-l1',
        '/play/w2-l1',
        '/tutorials',
        '/tutorials/cpp-start',
        '/courses',
        '/courses/ee-circuits',
        '/vision',
        '/vision/opencv-foundations',
        '/robotics',
        '/robotics/robot-motion',
        '/hpc',
        '/hpc/hpc-correctness',
        '/matlab',
        '/matlab/matlab-start',
        '/cybersecurity',
        '/cybersecurity/cyber-http',
        '/ai-agents',
        '/ai-agents?view=tutorials',
        '/ai-agents/agents-cli',
        '/ai-agents/agents-cli/tutorial',
        '/computer-architecture',
        '/computer-architecture?stage=assembly',
        '/computer-architecture/computer-bits',
        '/sandbox',
        '/sandbox?bench=matlab',
        '/sandbox?bench=cybersecurity',
        '/sandbox?bench=hpc',
        '/sandbox?bench=vision',
        '/sandbox?bench=robotics',
        '/sandbox?bench=ai-agents',
        '/sandbox?bench=computer',
        '/sandbox?bench=vision&lesson=opencv-foundations',
        '/sandbox?bench=robotics&lesson=robot-motion',
        '/sandbox?bench=hpc&lesson=hpc-correctness',
        '/sandbox?bench=matlab&lesson=matlab-start',
        '/sandbox?bench=cybersecurity&lesson=cyber-http',
        '/sandbox?bench=ai-agents&lesson=agents-cli',
        '/sandbox?bench=computer&lesson=computer-bits',
        '/showcase',
        '/leaderboard',
      ])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

it('indexes every AI agent course, guided tutorial and sandbox preset', () => {
  const courses = readJson(path.join(contentDir, 'ai-agents.json')).courses
  for (const course of courses) {
    expect(routes).toContain(`/ai-agents/${course.id}`)
    expect(routes).toContain(`/ai-agents/${course.id}/tutorial`)
    expect(routes).toContain(`/sandbox?bench=ai-agents&lesson=${course.id}`)
  }
  expect(routes).toContain('/sandbox?bench=ai-agents')
  expect(new Set(routes).size).toBe(routes.length)
})

it('indexes every computer course, the assembly sequence and each runnable preset', () => {
  const courses = readJson(path.join(contentDir, 'computer-architecture.json')).courses
  expect(courses).toHaveLength(18)
  expect(routes).toContain('/computer-architecture?stage=assembly')
  expect(routes).toContain('/sandbox?bench=computer')
  for (const course of courses) {
    expect(routes).toContain(`/computer-architecture/${course.id}`)
    expect(routes).toContain(`/sandbox?bench=computer&lesson=${course.id}`)
  }
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
    expect(robots).toMatch(/^Disallow: \/showcase\/$/m)
    expect(robots).toMatch(/^Disallow: \/api\/$/m)
    // A client-rendered app whose bundle is blocked renders empty for a crawler.
    expect(robots).not.toMatch(/Disallow:\s*\/assets/)
  })
})

describe('sitemapPlugin and public/sitemap.xml', () => {
  it('serves dynamic sitemap.xml in dev mode via configureServer', () => {
    const plugin = sitemapPlugin({ contentDir })
    let handler
    const server = {
      middlewares: {
        use: (fn) => { handler = fn },
      },
    }
    plugin.configureServer(server)
    let header, body
    const res = {
      setHeader: (name, val) => { header = [name, val] },
      end: (val) => { body = val },
    }
    let nextCalled = false
    handler({ url: '/sitemap.xml' }, res, () => { nextCalled = true })
    expect(header).toEqual(['Content-Type', 'application/xml'])
    expect(body).toBe(renderSitemap(routes))
    expect(nextCalled).toBe(false)

    // Passes through non-matching routes
    nextCalled = false
    handler({ url: '/something-else' }, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
  })

  it('emits sitemap.xml asset on build', () => {
    const plugin = sitemapPlugin({ contentDir })
    let emitted
    plugin.generateBundle.call({
      emitFile: (asset) => { emitted = asset },
    })
    expect(emitted).toEqual({
      type: 'asset',
      fileName: 'sitemap.xml',
      source: renderSitemap(routes),
    })
  })

  it('keeps public/sitemap.xml matching the rendered routes', () => {
    const publicXml = fs.readFileSync(path.join(here, 'public/sitemap.xml'), 'utf8')
    expect(publicXml).toBe(renderSitemap(routes))
  })
})

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getRouteMetadata, injectHeadMetadata, loadContentCatalog, prerenderRoutes } from './vite-prerender.js'
import { SITE_ORIGIN } from './vite-sitemap.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const contentDir = path.resolve(here, '../content')

describe('vite-prerender', () => {
  const catalog = loadContentCatalog(contentDir)

  it('loads catalogs accurately', () => {
    expect(Object.keys(catalog.qt).length).toBeGreaterThan(0)
    expect(Object.keys(catalog.tutorials).length).toBeGreaterThan(0)
    expect(Object.keys(catalog.quests).length).toBeGreaterThan(0)
  })

  it('resolves canonical URLs stripped of query parameters', () => {
    const urls = [
      ['/tutorials/drone-esc-basics?board=esp32', `${SITE_ORIGIN}/tutorials/drone-esc-basics`],
      ['/tutorials/uno-blink?board=uno', `${SITE_ORIGIN}/tutorials/uno-blink`],
      ['/sandbox?bench=matlab&lesson=matlab-start', `${SITE_ORIGIN}/sandbox`],
      ['/courses?track=embedded', `${SITE_ORIGIN}/courses`],
      ['/qt/qt-async', `${SITE_ORIGIN}/qt/qt-async`],
      ['/qt/qt-async/', `${SITE_ORIGIN}/qt/qt-async`],
      ['/', `${SITE_ORIGIN}/`],
    ]

    for (const [input, expectedCanonical] of urls) {
      const meta = getRouteMetadata(input, catalog, SITE_ORIGIN)
      expect(meta.canonical).toBe(expectedCanonical)
    }
  })

  it('provides distinct, descriptive titles for Qt courses', () => {
    const qtAsync = getRouteMetadata('/qt/qt-async', catalog)
    const qtGraphics = getRouteMetadata('/qt/qt-graphics', catalog)
    const qtStart = getRouteMetadata('/qt/qt-start', catalog)

    expect(qtAsync.title).toContain('Qt')
    expect(qtGraphics.title).toContain('Qt')
    expect(qtStart.title).toContain('Qt')

    expect(qtAsync.title).not.toBe(qtGraphics.title)
    expect(qtAsync.title).not.toBe(qtStart.title)
  })

  it('injects meta tags into an HTML template', () => {
    const template = '<html><head><title>Old Title</title></head><body><div id="root"></div></body></html>'
    const meta = {
      title: 'Blink — Tutorial — VoltQuest',
      description: 'Learn Arduino blink circuit',
      canonical: `${SITE_ORIGIN}/tutorials/uno-blink`,
    }

    const html = injectHeadMetadata(template, meta)
    expect(html).toContain('<title>Blink — Tutorial — VoltQuest</title>')
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/tutorials/uno-blink" />`)
    expect(html).toContain('<meta name="description" content="Learn Arduino blink circuit" />')
    expect(html).not.toContain('<title>Old Title</title>')
  })

  it('prerenders route files into a dist directory', () => {
    const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'voltquest-prerender-'))
    try {
      fs.writeFileSync(path.join(tmpDist, 'index.html'), '<html><head><title>VoltQuest</title></head><body><div id="root"></div></body></html>')
      const result = prerenderRoutes({ contentDir, distDir: tmpDist, origin: SITE_ORIGIN })
      expect(result.count).toBeGreaterThan(50)

      // Check /qt/qt-async
      const qtAsyncFile = path.join(tmpDist, 'qt/qt-async/index.html')
      expect(fs.existsSync(qtAsyncFile)).toBe(true)
      const qtAsyncHtml = fs.readFileSync(qtAsyncFile, 'utf8')
      expect(qtAsyncHtml).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/qt/qt-async" />`)
      expect(qtAsyncHtml).toContain('Qt')

      // Check /tutorials/drone-esc-basics
      const droneFile = path.join(tmpDist, 'tutorials/drone-esc-basics/index.html')
      expect(fs.existsSync(droneFile)).toBe(true)
      const droneHtml = fs.readFileSync(droneFile, 'utf8')
      expect(droneHtml).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/tutorials/drone-esc-basics" />`)

      // Check /sandbox
      const sandboxFile = path.join(tmpDist, 'sandbox/index.html')
      expect(fs.existsSync(sandboxFile)).toBe(true)
      const sandboxHtml = fs.readFileSync(sandboxFile, 'utf8')
      expect(sandboxHtml).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/sandbox" />`)
    } finally {
      fs.rmSync(tmpDist, { recursive: true, force: true })
    }
  })
})

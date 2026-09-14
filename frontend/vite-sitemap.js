/**
 * Build-time sitemap for the public site at https://pcb.nevatal.id.
 *
 * The campaign and tutorial catalogues live in `../content` and grow between releases, so the URL
 * list is derived from those files during `vite build` rather than committed as a static document
 * that would silently go stale. Level order mirrors `src/content/index.js`: worlds.json `levelIds`
 * in world order, filtered to the quests that actually exist on disk.
 *
 * Per-player (`/profile`) and user-generated (`/sandbox/:projectId`, `/showcase/:slug`) routes are
 * deliberately absent — they are not enumerable from content — and are disallowed in
 * `public/robots.txt`, whose `Sitemap:` line must keep pointing at SITE_ORIGIN below.
 */
import fs from 'node:fs'
import path from 'node:path'

/** The one deployed origin. `public/robots.txt` repeats it; a test holds the two in step. */
export const SITE_ORIGIN = 'https://pcb.nevatal.id'

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

/** Campaign levels in campaign order, limited to the ids a quest file actually backs. */
function levelRoutes(contentDir) {
  const questDir = path.join(contentDir, 'quests')
  const authored = new Set(
    fs
      .readdirSync(questDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => readJson(path.join(questDir, file)).id)
      .filter(Boolean),
  )
  return (readJson(path.join(contentDir, 'worlds.json')).worlds ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((world) => world.levelIds ?? [])
    .filter((id) => authored.has(id))
    .map((id) => `/play/${id}`)
}

/** Every crawlable route, ordered the way a new player meets them. */
export function collectRoutes(contentDir) {
  const tutorials = (readJson(path.join(contentDir, 'tutorials.json')).tutorials ?? [])
    .map((tutorial) => tutorial.id)
    .filter(Boolean)
  const courses = (readJson(path.join(contentDir, 'courses.json')).courses ?? [])
    .map(course => course.id)
    .filter(Boolean)
  const robotics = (readJson(path.join(contentDir, 'robotics.json')).tutorials ?? []).map(item => `/robotics/${item.id}`)
  const vision = (readJson(path.join(contentDir, 'vision.json')).tutorials ?? []).map(item => `/vision/${item.id}`)
  const hpc = (readJson(path.join(contentDir, 'hpc.json')).courses ?? []).map(item => `/hpc/${item.id}`)
  return [
    '/',
    ...levelRoutes(contentDir),
    '/tutorials',
    ...tutorials.map((id) => `/tutorials/${id}`),
    '/courses',
    ...courses.map(id => `/courses/${id}`),
    '/vision',
    ...vision,
    '/robotics',
    ...robotics,
    '/hpc',
    ...hpc,
    '/sandbox',
    '/showcase',
    '/leaderboard',
  ]
}

const escapeXml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/**
 * A minimal sitemaps.org 0.9 document. `lastmod`, `changefreq` and `priority` are omitted on
 * purpose: search engines ignore the latter two, and a uniform build-date stamp on every URL
 * tells a crawler nothing about which page actually changed.
 */
export function renderSitemap(routes, origin = SITE_ORIGIN) {
  const body = routes.map((route) => `  <url><loc>${escapeXml(origin + route)}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

/** Emits `dist/sitemap.xml` alongside the static files Vite copies out of `public/`. */
export function sitemapPlugin({ contentDir, origin = SITE_ORIGIN }) {
  return {
    name: 'voltquest-sitemap',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: renderSitemap(collectRoutes(contentDir), origin),
      })
    },
  }
}

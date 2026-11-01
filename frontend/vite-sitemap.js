/**
 * Build-time sitemap for the public site at https://pcb.nevatal.id.
 *
 * The campaign and tutorial catalogues live in `../content` and grow between releases, so the URL
 * list is derived from those files during `vite build` rather than committed as a static document
 * that would silently go stale. Level order mirrors `src/content/index.js`: worlds.json `levelIds`
 * in world order, filtered to the quests that actually exist on disk.
 *
 * Per-player (`/profile`) and user-generated (`/sandbox/:projectId`, `/showcase/:slug`,
 * `/community/:threadId`) routes are deliberately absent — they are not enumerable from content — and are disallowed in
 * `public/robots.txt`, whose `Sitemap:` line must keep pointing at SITE_ORIGIN below.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prerenderRoutes } from './vite-prerender.js'

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
  const tutorialsData = readJson(path.join(contentDir, 'tutorials.json'))
  const tutorialList = tutorialsData.tutorials ?? []
  const tutorials = tutorialList
    .map((tutorial) => tutorial.id)
    .filter(Boolean)
  const tutorialBoards = [...new Set(tutorialList.flatMap((t) => t.boards ?? []))]
    .map((board) => `/tutorials?board=${board}`)
  const tutorialTopics = [...new Set(tutorialList.map((t) => t.track).filter(Boolean))]
    .map((topic) => `/tutorials?topic=${topic}`)
  const tutorialVariants = tutorialList.flatMap((t) =>
    (t.boards ?? []).slice(1).map((board) => `/tutorials/${t.id}?board=${board}`)
  )

  const coursesData = readJson(path.join(contentDir, 'courses.json'))
  const courses = (coursesData.courses ?? [])
    .map(course => course.id)
    .filter(Boolean)
  const courseTracks = (coursesData.tracks ?? [])
    .map(track => track.id)
    .filter(Boolean)
    .map(id => `/courses?track=${id}`)

  const roboticsData = readJson(path.join(contentDir, 'robotics.json')).tutorials ?? []
  const robotics = roboticsData.map(item => `/robotics/${item.id}`)
  const roboticsLessons = roboticsData.map(item => item.id).filter(Boolean)

  const visionData = readJson(path.join(contentDir, 'vision.json')).tutorials ?? []
  const vision = visionData.map(item => `/vision/${item.id}`)
  const visionLessons = visionData.map(item => item.id).filter(Boolean)

  const hpcData = readJson(path.join(contentDir, 'hpc.json')).courses ?? []
  const hpc = hpcData.map(item => `/hpc/${item.id}`)
  const hpcCourses = hpcData.map(item => item.id).filter(Boolean)

  const matlabData = readJson(path.join(contentDir, 'matlab.json')).courses ?? []
  const matlab = matlabData.map(item => `/matlab/${item.id}`)
  const matlabCourses = matlabData.map(item => item.id).filter(Boolean)

  const cybersecurityData = readJson(path.join(contentDir, 'cybersecurity.json')).courses ?? []
  const cybersecurity = cybersecurityData.map(item => `/cybersecurity/${item.id}`)
  const cyberCourses = cybersecurityData.map(item => item.id).filter(Boolean)

  const agentCourses = (readJson(path.join(contentDir, 'ai-agents.json')).courses ?? []).map(item => item.id)
  const computerCourses = (readJson(path.join(contentDir, 'computer-architecture.json')).courses ?? []).map(item => item.id)
  const avrCourses = (fs.existsSync(path.join(contentDir, 'avr.json')) ? readJson(path.join(contentDir, 'avr.json')).courses ?? [] : []).map(item => item.id)
  const qtCourses = (readJson(path.join(contentDir, 'qt.json')).courses ?? []).map(item => item.id)
  const winuiCourses = (readJson(path.join(contentDir, 'winui.json')).courses ?? []).map(item => item.id)
  const cudaCourses = (fs.existsSync(path.join(contentDir, 'cuda.json')) ? readJson(path.join(contentDir, 'cuda.json')).courses ?? [] : []).map(item => item.id)
  const pytorchCourses = (fs.existsSync(path.join(contentDir, 'pytorch.json')) ? readJson(path.join(contentDir, 'pytorch.json')).courses ?? [] : []).map(item => item.id)
  const kernelCourses = (fs.existsSync(path.join(contentDir, 'kernel.json')) ? readJson(path.join(contentDir, 'kernel.json')).courses ?? [] : []).map(item => item.id)
  const loadbalancerCourses = (fs.existsSync(path.join(contentDir, 'loadbalancer.json')) ? readJson(path.join(contentDir, 'loadbalancer.json')).courses ?? [] : []).map(item => item.id)
  const distributedCourses = (fs.existsSync(path.join(contentDir, 'distributed.json')) ? readJson(path.join(contentDir, 'distributed.json')).courses ?? [] : []).map(item => item.id)
  const kubernetesCourses = (fs.existsSync(path.join(contentDir, 'kubernetes.json')) ? readJson(path.join(contentDir, 'kubernetes.json')).courses ?? [] : []).map(item => item.id)
  const gamemoddingCourses = (fs.existsSync(path.join(contentDir, 'gamemodding.json')) ? readJson(path.join(contentDir, 'gamemodding.json')).courses ?? [] : []).map(item => item.id)
  const iotCCourses = (fs.existsSync(path.join(contentDir, 'iot-c.json')) ? readJson(path.join(contentDir, 'iot-c.json')).courses ?? [] : []).map(item => item.id)
  const excelCourses = (fs.existsSync(path.join(contentDir, 'excel.json')) ? readJson(path.join(contentDir, 'excel.json')).courses ?? [] : []).map(item => item.id)

  const sandboxBenches = ['matlab', 'cybersecurity', 'hpc', 'vision', 'robotics', 'ai-agents', 'computer', 'excel'].map(bench => `/sandbox?bench=${bench}`)
  const sandboxPresets = [
    ...visionLessons.map(id => `/sandbox?bench=vision&lesson=${id}`),
    ...roboticsLessons.map(id => `/sandbox?bench=robotics&lesson=${id}`),
    ...hpcCourses.map(id => `/sandbox?bench=hpc&lesson=${id}`),
    ...matlabCourses.map(id => `/sandbox?bench=matlab&lesson=${id}`),
    ...cyberCourses.map(id => `/sandbox?bench=cybersecurity&lesson=${id}`),
    ...agentCourses.map(id => `/sandbox?bench=ai-agents&lesson=${id}`),
    ...computerCourses.map(id => `/sandbox?bench=computer&lesson=${id}`),
    ...excelCourses.map(id => `/sandbox?bench=excel&lesson=${id}`),
  ]

  return [
    '/',
    '/campaign',
    '/certificates',
    ...levelRoutes(contentDir),
    '/tutorials',
    ...tutorialBoards,
    ...tutorialTopics,
    ...tutorials.map((id) => `/tutorials/${id}`),
    ...tutorialVariants,
    '/courses',
    ...courseTracks,
    ...courses.map(id => `/courses/${id}`),
    '/vision',
    ...vision,
    '/robotics',
    ...robotics,
    '/hpc',
    ...hpc,
    '/matlab',
    ...matlab,
    '/cybersecurity',
    ...cybersecurity,
    '/ai-agents',
    '/ai-agents?view=tutorials',
    ...agentCourses.map(id => `/ai-agents/${id}`),
    ...agentCourses.map(id => `/ai-agents/${id}/tutorial`),
    '/computer-architecture',
    '/computer-architecture?stage=assembly',
    ...computerCourses.map(id => `/computer-architecture/${id}`),
    ...(avrCourses.length ? ['/avr', ...avrCourses.map(id => `/avr/${id}`)] : []),
    '/qt',
    ...qtCourses.map(id => `/qt/${id}`),
    '/winui',
    ...winuiCourses.map(id => `/winui/${id}`),
    ...(cudaCourses.length ? ['/cuda', ...cudaCourses.map(id => `/cuda/${id}`)] : []),
    ...(pytorchCourses.length ? ['/pytorch', ...pytorchCourses.map(id => `/pytorch/${id}`)] : []),
    ...(kernelCourses.length ? ['/kernel', ...kernelCourses.map(id => `/kernel/${id}`)] : []),
    ...(loadbalancerCourses.length ? ['/loadbalancer', ...loadbalancerCourses.map(id => `/loadbalancer/${id}`)] : []),
    ...(distributedCourses.length ? ['/distributed', ...distributedCourses.map(id => `/distributed/${id}`)] : []),
    ...(kubernetesCourses.length ? ['/kubernetes', ...kubernetesCourses.map(id => `/kubernetes/${id}`)] : []),
    ...(gamemoddingCourses.length ? ['/game-modding', ...gamemoddingCourses.map(id => `/game-modding/${id}`)] : []),
    ...(iotCCourses.length ? ['/iot-c', ...iotCCourses.map(id => `/iot-c/${id}`)] : []),
    ...(excelCourses.length ? ['/excel', ...excelCourses.map(id => `/excel/${id}`)] : []),
    '/sandbox',
    ...sandboxBenches,
    ...sandboxPresets,
    '/showcase',
    '/community',
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
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/sitemap.xml') {
          res.setHeader('Content-Type', 'application/xml')
          res.end(renderSitemap(collectRoutes(contentDir), origin))
          return
        }
        next()
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: renderSitemap(collectRoutes(contentDir), origin),
      })
    },
    closeBundle() {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const distDir = path.resolve(here, 'dist')
      if (fs.existsSync(path.join(distDir, 'index.html'))) {
        prerenderRoutes({ contentDir, distDir, origin })
      }
    },
  }
}

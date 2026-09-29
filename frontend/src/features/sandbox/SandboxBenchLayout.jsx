import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { Badge, ProgressBar, Switch } from '../../ui/index.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { getSandboxByBench } from './sandboxDirectory.js'
import SandboxNavSidebar from './SandboxNavSidebar.jsx'
// The shell's viewport-height and header rules; imported here so a directly opened bench matches one reached from the circuit workspace.
import '../workspace/workspace.css'

/**
 * Shared shell for every non-circuit sandbox bench: header, bench rail, body and status footer.
 * `variant="page"` scrolls a readable column; `variant="app"` gives the body the remaining
 * viewport height so an IDE-style bench (MATLAB, AI agents) can lay out its own panes.
 */
export default function SandboxBenchLayout({
  bench,
  description,
  courseLink,
  courseLinkLabel,
  localeNotice,
  actions = null,
  variant = 'page',
  children,
}) {
  const { t } = useI18n()
  const player = usePlayerStore((s) => s.player)
  const settings = usePlayerStore((s) => s.settings)
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const benchInfo = getSandboxByBench(bench)
  // One canonical title per bench, shared with the rail (sandboxDirectory.js).
  const title = t(benchInfo.title)
  const app = variant === 'app'

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const courseAnchor = courseLink && (
    <Link
      to={courseLink}
      className="inline-block rounded text-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      {courseLinkLabel || t('Back to the course')}
    </Link>
  )

  return (
    <div className={`vq-workspace ${app ? 'vq-bench-app' : ''} flex min-h-screen flex-col bg-surface-page text-ink`}>
      <AppHeader
        className="vq-workspace-header"
        center={
          <div className="flex items-center gap-2">
            <span className="truncate text-xs sm:text-sm font-semibold text-ink">
              {title}
            </span>
            <Badge tone="brand">{t('Sandbox')}</Badge>
          </div>
        }
        actions={actions}
      />

      <main className="vq-workbench flex min-h-0 flex-1 flex-col xl:flex-row">
        <SandboxNavSidebar currentBench={bench} className="vq-sandbox-sidebar" />

        {app ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-page">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-white px-3 py-2 sm:px-4">
              <h1 className="sr-only">{title}</h1>
              {description && <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-5 text-ink-secondary sm:line-clamp-none">{description}</p>}
              {localeNotice && <p className="w-full text-xs text-slate-600 sm:w-auto">{localeNotice}</p>}
              {courseAnchor}
            </div>
            <div className="vq-bench-app-body min-h-0 min-w-0 flex-1 p-2 sm:p-3">{children}</div>
          </div>
        ) : (
          <div className="min-w-0 min-h-0 flex-1 overflow-y-auto bg-surface-page">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
              <div>
                {courseAnchor && <div className="mb-4">{courseAnchor}</div>}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
                      {title}
                    </h1>
                    {description && (
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">
                        {description}
                      </p>
                    )}
                  </div>
                </div>

                {localeNotice && (
                  <p className="mt-3 text-sm text-slate-600">
                    {localeNotice}
                  </p>
                )}
              </div>

              {children}
            </div>
          </div>
        )}
      </main>

      <footer className="flex min-h-8 flex-wrap items-center gap-3 border-t border-line bg-white px-3 py-1 text-xs text-slate-600">
        <span>
          {t('Level ')}{player?.level ?? 1} · {player?.xp ?? 0}{t(' XP')}
        </span>
        <ProgressBar
          className="w-28"
          value={player?.xp_into_level ?? 0}
          max={player?.xp_for_next ?? 100}
          label={t('Level progress')}
          size="sm"
        />
        <Switch
          label={t('Audio')}
          checked={settings?.audio !== false}
          onChange={(audio) => usePlayerStore.getState().setSettings({ audio })}
        />
        {!online && <Badge tone="warning">{t('Offline — saving on this device')}</Badge>}
        <span className="ml-auto text-xs text-slate-600">
          {t(benchInfo.name)} · {t(benchInfo.saving === 'draft' ? 'Drafts save automatically' : 'Stored in this browser only when you save')}
        </span>
      </footer>
    </div>
  )
}

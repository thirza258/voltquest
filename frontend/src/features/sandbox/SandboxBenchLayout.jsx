import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { Badge, ProgressBar, Switch } from '../../ui/index.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { getSandboxByBench } from './sandboxDirectory.js'
import SandboxNavSidebar from './SandboxNavSidebar.jsx'

export default function SandboxBenchLayout({
  bench,
  title,
  description,
  courseLink,
  courseLinkLabel,
  localeNotice,
  actions = null,
  children,
}) {
  const { t } = useI18n()
  const player = usePlayerStore((s) => s.player)
  const settings = usePlayerStore((s) => s.settings)
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const benchInfo = getSandboxByBench(bench)

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

  return (
    <div className="vq-workspace flex min-h-screen flex-col bg-surface-page text-ink">
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

        <div className="min-w-0 min-h-0 flex-1 overflow-y-auto bg-surface-page">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
            <div>
              {courseLink && (
                <div className="mb-4">
                  <Link
                    to={courseLink}
                    className="inline-block text-sm font-semibold text-brand-700 underline hover:text-brand-800"
                  >
                    {courseLinkLabel || t('Back to the course')}
                  </Link>
                </div>
              )}

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
        <span className="ml-auto text-xs text-slate-500">
          {benchInfo?.name ? t(benchInfo.name) : t('Sandbox')} · {t('Saved locally')}
        </span>
      </footer>
    </div>
  )
}

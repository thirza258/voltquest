import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Binary,
  BookOpen,
  Bot,
  Boxes,
  Compass,
  Cpu,
  Eye,
  Layers,
  Network,
  Plane,
  Shield,
  Sparkles,
  Table,
  Terminal,
  Zap,
} from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { TUTORIALS } from '../../content/index.js'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { CampaignMap } from './CampaignMap.jsx'
import AllCoursesSection from '../courses/AllCoursesSection.jsx'
import { ALL_SANDBOXES } from '../sandbox/sandboxDirectory.js'
import { ALL_COURSES } from '../courses/coursesDirectory.js'

const BENCH_ICONS = {
  Cpu,
  Plane,
  Binary,
  Terminal,
  Bot,
  Activity,
  Shield,
  Zap,
  Eye,
  Compass,
  Network,
  Table,
}

export function CampaignPage() {
  const { t } = useI18n()

  return (
    <div className="flex h-full min-h-screen flex-col bg-surface-page">
      <AppHeader />
      <main className="min-h-0 flex-1 overflow-y-auto">
        {/* Navigation & Highlights Banner */}
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
          <div className="mb-6 flex flex-col md:flex-row items-start justify-between gap-4 rounded-xl border border-brand-200 bg-white p-5 shadow-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-100 text-brand-700">
                  <Sparkles size={13} />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                  {t('VoltQuest Learning Platform')}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                {t('From Breadboards to Supercomputers & Networks')}
              </h2>
              <p className="max-w-2xl text-xs sm:text-sm text-ink-secondary leading-relaxed">
                {t('Explore 32 campaign quests, 41 guided circuit tutorials, and 21 comprehensive engineering course tracks covering 270+ lessons across hardware, systems, AI, and cybersecurity.')}
              </p>
              {/* Quick Jump Anchor Tabs */}
              <div className="flex flex-wrap gap-2 pt-2">
                <a
                  href="#campaign-map-anchor"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-subtle px-3 py-1 text-xs font-medium text-ink hover:border-brand-500 hover:text-brand-700 transition-colors"
                >
                  <Boxes size={13} className="text-brand-700" />
                  {t('Campaign Quests (32)')}
                </a>
                <a
                  href="#all-courses-catalog-title"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-subtle px-3 py-1 text-xs font-medium text-ink hover:border-brand-500 hover:text-brand-700 transition-colors"
                >
                  <BookOpen size={13} className="text-brand-700" />
                  {t('All Courses & Curricula ({count})', { count: ALL_COURSES.length })}
                </a>
                <a
                  href="#sandbox-benches-section"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-subtle px-3 py-1 text-xs font-medium text-ink hover:border-brand-500 hover:text-brand-700 transition-colors"
                >
                  <Cpu size={13} className="text-brand-700" />
                  {t('Interactive Sandboxes (12)')}
                </a>
                <Link
                  to="/tutorials"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100 transition-colors"
                >
                  <Layers size={13} className="text-brand-700" />
                  {t('Tutorial Lab ({count})', { count: TUTORIALS.length })} →
                </Link>
              </div>
            </div>

            {/* Tutorial shortcut box */}
            <div className="hidden lg:block w-72 shrink-0">
              <Link
                to="/tutorials"
                className="block rounded-lg border border-brand-200 bg-brand-50/80 p-3.5 text-xs text-brand-900 transition-all hover:bg-brand-100/70 hover:shadow-xs"
              >
                <strong className="font-semibold text-brand-800 flex items-center justify-between">
                  {t('Start learning in the tutorial lab →')}
                </strong>
                <span className="mt-1.5 block text-slate-600 leading-normal">
                  {TUTORIALS.length}
                  {t(' guided circuits for Arduino, ESP32 and Raspberry Pi, from Easy to Hard.')}
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* 1. The Interactive Campaign Map */}
        <div id="campaign-map-anchor">
          <CampaignMap />
        </div>

        {/* 2. All Courses & Learning Tracks Catalog (All 21 courses) */}
        <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          <div className="border-t border-line pt-8">
            <AllCoursesSection />
          </div>
        </div>

        {/* 3. Specialized Interactive Sandbox Benches (12 Benches) */}
        <section
          id="sandbox-benches-section"
          className="mx-auto max-w-6xl px-4 py-12 sm:px-6"
          aria-labelledby="sandbox-benches-heading"
        >
          <div className="border-t border-line pt-8">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100 text-brand-700">
                    <Boxes size={14} />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
                    {t('Engineering Workbenches')}
                  </p>
                </div>
                <h2 id="sandbox-benches-heading" className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  {t('Specialized Sandbox IDEs & Benches')}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">
                  {t('Freeform engineering workspaces with real simulation, packet routing, assembly execution, numerical modeling, and circuit design.')}
                </p>
              </div>
              <Link
                to="/sandbox"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
              >
                {t('Open default sandbox')} →
              </Link>
            </div>

            {/* Benches Grid */}
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ALL_SANDBOXES.map(bench => {
                const IconComponent = BENCH_ICONS[bench.icon] ?? Boxes
                return (
                  <Link
                    key={bench.id}
                    to={bench.path}
                    className="group flex flex-col justify-between rounded-xl border border-line bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md"
                  >
                    <div>
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-sunken text-slate-700 group-hover:bg-brand-100 group-hover:text-brand-700 transition-colors">
                          <IconComponent size={15} />
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-wide text-slate-400">
                          {bench.saving === 'draft' ? t('Autosave') : t('Manual Save')}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm text-ink group-hover:text-brand-700 transition-colors">
                        {t(bench.name)}
                      </h3>
                      <p className="mt-1 text-xs text-ink-secondary leading-relaxed line-clamp-3">
                        {t(bench.description, bench.values ?? {})}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-[11px] font-medium text-brand-700">
                      <span>{t('Launch bench')}</span>
                      <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default CampaignPage

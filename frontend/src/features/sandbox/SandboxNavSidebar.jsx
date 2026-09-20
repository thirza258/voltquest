import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { ALL_SANDBOXES } from './sandboxDirectory.js'
import {
  Activity,
  Binary,
  Bot,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Compass,
  Cpu,
  Eye,
  Plane,
  Shield,
  Zap,
} from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspaceStore.js'

const ICONS = {
  Cpu,
  Plane,
  Binary,
  Bot,
  Activity,
  Shield,
  Zap,
  Eye,
  Compass,
}

const TONE_CLASSES = {
  teal: 'bg-teal-50 text-teal-700 border-teal-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
}

export default function SandboxNavSidebar({ currentBench = 'circuit', className = '' }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeBench = searchParams.get('bench') || currentBench || 'circuit'
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleSelect(sandbox, event) {
    event.preventDefault()
    // Save draft if in workspace
    try {
      useWorkspaceStore.getState().saveDraft()
    } catch {
      // Ignore if not in workspace context
    }
    navigate(sandbox.path)
    setMobileOpen(false)
  }

  return (
    <>
      {/* Mobile Drawer Trigger (screens below xl) */}
      <div className="xl:hidden flex items-center justify-between border-b border-line bg-surface-subtle px-3 py-2 text-xs">
        <button
          onClick={() => setMobileOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:text-brand-800"
          aria-expanded={mobileOpen}
        >
          <Boxes size={14} />
          <span>{t("All Sandboxes")} ({ALL_SANDBOXES.length})</span>
          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-800">
            {ALL_SANDBOXES.find((s) => (s.bench || 'circuit') === activeBench)?.name ?? t('Sandbox')}
          </span>
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className="xl:hidden border-b border-line bg-white p-3 space-y-1 max-h-64 overflow-y-auto z-20">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {t("Switch Sandbox Bench")}
          </p>
          {ALL_SANDBOXES.map((item) => {
            const isActive = (item.bench || 'circuit') === activeBench
            const Icon = ICONS[item.icon] ?? Cpu
            return (
              <button
                key={item.id}
                onClick={(e) => handleSelect(item, e)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-900 font-semibold border border-brand-200'
                    : 'text-ink-secondary hover:bg-slate-50 hover:text-ink'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-brand-700' : 'text-slate-500'} />
                <span className="flex-1 truncate">{t(item.name)}</span>
                {isActive && (
                  <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">
                    {t("Active")}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Desktop Sidebar (screens xl and above) */}
      <aside
        aria-label={t("All available sandboxes")}
        className={`hidden xl:flex flex-col border-r border-line bg-white transition-all duration-200 flex-shrink-0 z-10 ${
          collapsed ? 'w-14' : 'w-60'
        } ${className}`}
      >
        {/* Sidebar Header */}
        <div className="flex h-10 items-center justify-between border-b border-line px-3 bg-surface-subtle">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <Boxes size={16} className="text-brand-700" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink">
                {t("Sandboxes")}
              </span>
              <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-medium text-slate-700">
                {ALL_SANDBOXES.length}
              </span>
            </div>
          ) : (
            <div className="mx-auto">
              <Boxes size={16} className="text-brand-700" />
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? t("Expand sandboxes sidebar") : t("Collapse sandboxes sidebar")}
            aria-label={collapsed ? t("Expand sandboxes sidebar") : t("Collapse sandboxes sidebar")}
            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-ink focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Sandboxes List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {ALL_SANDBOXES.map((item) => {
            const isActive = (item.bench || 'circuit') === activeBench
            const Icon = ICONS[item.icon] ?? Cpu
            const toneClass = TONE_CLASSES[item.color] ?? 'bg-slate-50 text-slate-700 border-slate-200'

            return (
              <a
                key={item.id}
                href={item.path}
                onClick={(e) => handleSelect(item, e)}
                title={collapsed ? `${t(item.name)} — ${t(item.description)}` : undefined}
                className={`group relative flex items-center gap-2.5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  collapsed ? 'justify-center p-2' : 'p-2'
                } ${
                  isActive
                    ? 'bg-brand-50/90 text-brand-900 border border-brand-300 shadow-xs'
                    : 'text-ink-secondary hover:bg-slate-50 hover:text-ink border border-transparent'
                }`}
              >
                {/* Icon */}
                <span
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border text-xs transition-colors ${
                    isActive ? 'bg-brand-600 text-white border-brand-700' : toneClass
                  }`}
                >
                  <Icon size={14} />
                </span>

                {/* Title & Tag */}
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`truncate text-xs font-medium ${isActive ? 'text-brand-900 font-semibold' : 'text-ink'}`}>
                        {t(item.name)}
                      </p>
                      {isActive ? (
                        <span className="rounded bg-brand-600 px-1 py-0.2 text-[9px] font-semibold text-white">
                          {t("Active")}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono">
                          {t(item.tag)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-slate-600">
                      {t(item.description)}
                    </p>
                  </div>
                )}
              </a>
            )
          })}
        </div>

        {/* Sidebar Footer info when expanded */}
        {!collapsed && (
          <div className="border-t border-line p-2 text-[10px] text-slate-600 text-center">
            {t("Switch benches anytime. Local work is saved.")}
          </div>
        )}
      </aside>
    </>
  )
}

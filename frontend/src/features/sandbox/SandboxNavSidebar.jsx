import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { ALL_SANDBOXES } from './sandboxDirectory.js'
import { unsavedBenchWork } from './benchGuard.js'
import { Activity, Binary, Bot, Boxes, ChevronDown, ChevronLeft, ChevronRight, Compass, Cpu, Eye, Plane, Shield, Zap } from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspaceStore.js'
import { Button, Modal } from '../../ui/index.js'

const ICONS = { Cpu, Plane, Binary, Bot, Activity, Shield, Zap, Eye, Compass }

/**
 * The one navigation rail between sandbox benches (desktop rail at xl, a disclosure list below).
 * Leaving the circuit or drone workspace saves its draft; leaving a bench with unsaved explicit-save
 * work asks first, because that work is not stored until its Save action runs.
 */
export default function SandboxNavSidebar({ currentBench = 'circuit', className = '' }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeBench = searchParams.get('bench') || currentBench || 'circuit'
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [leaving, setLeaving] = useState(null)
  const active = ALL_SANDBOXES.find((s) => (s.bench || 'circuit') === activeBench) ?? ALL_SANDBOXES[0]

  function go(sandbox) {
    // Only the circuit/drone workspace owns the draft slot; other benches must not overwrite it.
    if (['circuit', 'drone'].includes(currentBench)) {
      try { useWorkspaceStore.getState().saveDraft() } catch { /* The workspace may already be unmounted. */ }
    }
    setLeaving(null)
    setMobileOpen(false)
    navigate(sandbox.path)
  }
  function handleSelect(sandbox, event) {
    event.preventDefault()
    if ((sandbox.bench || 'circuit') === activeBench) { setMobileOpen(false); return }
    if (unsavedBenchWork()) setLeaving(sandbox)
    else go(sandbox)
  }

  const item = (sandbox, compact) => {
    const isActive = sandbox === active
    const Icon = ICONS[sandbox.icon] ?? Cpu
    return <a
      key={sandbox.id}
      href={sandbox.path}
      onClick={(e) => handleSelect(sandbox, e)}
      aria-current={isActive ? 'page' : undefined}
      title={compact ? `${t(sandbox.name)} — ${t(sandbox.description, sandbox.values)}` : t(sandbox.description, sandbox.values)}
      className={`flex items-start gap-2.5 rounded-lg border p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${compact ? 'justify-center' : ''} ${isActive ? 'border-brand-300 bg-brand-50 text-brand-900' : 'border-transparent text-ink-secondary hover:bg-surface-sunken hover:text-ink'}`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isActive ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-slate-600'}`}>
        <Icon size={15} aria-hidden="true" />
      </span>
      {!compact && <span className="min-w-0 flex-1">
        <span className={`block text-[13px] leading-5 ${isActive ? 'font-semibold' : 'font-medium text-ink'}`}>{t(sandbox.name)}</span>
        <span className="line-clamp-2 text-xxs leading-4 text-slate-600">{t(sandbox.description, sandbox.values)}</span>
      </span>}
    </a>
  }

  return (
    <>
      <div className="xl:hidden border-b border-line bg-surface-sunken px-3 py-2">
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="inline-flex items-center gap-1.5 rounded text-xs font-semibold text-brand-700 hover:text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-expanded={mobileOpen}
        >
          <Boxes size={14} aria-hidden="true" />
          <span>{t('Sandboxes')} ({ALL_SANDBOXES.length})</span>
          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xxs text-brand-800">{t(active.name)}</span>
          <ChevronDown size={14} aria-hidden="true" className={mobileOpen ? 'rotate-180' : ''} />
        </button>
      </div>

      {mobileOpen && (
        <nav aria-label={t('All available sandboxes')} className="xl:hidden max-h-80 space-y-1 overflow-y-auto border-b border-line bg-white p-2">
          {ALL_SANDBOXES.map((sandbox) => item(sandbox, false))}
        </nav>
      )}

      <aside
        aria-label={t('All available sandboxes')}
        className={`hidden xl:flex flex-shrink-0 flex-col border-r border-line bg-white transition-[width] duration-150 ${collapsed ? 'w-14' : 'w-64'} ${className}`}
      >
        <div className="flex h-10 items-center justify-between border-b border-line bg-surface-sunken px-3">
          {!collapsed && (
            <p className="flex items-center gap-2 text-xxs font-semibold uppercase tracking-wide text-slate-600">
              <Boxes size={15} className="text-brand-700" aria-hidden="true" />
              {t('Sandboxes')}
              <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-xxs font-medium text-slate-700">{ALL_SANDBOXES.length}</span>
            </p>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? t('Expand sandboxes sidebar') : t('Collapse sandboxes sidebar')}
            aria-label={collapsed ? t('Expand sandboxes sidebar') : t('Collapse sandboxes sidebar')}
            className={`rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand-500 ${collapsed ? 'mx-auto' : ''}`}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
        <nav aria-label={t('Sandbox benches')} className="flex-1 space-y-1 overflow-y-auto p-2">
          {ALL_SANDBOXES.map((sandbox) => item(sandbox, collapsed))}
        </nav>
        {!collapsed && (
          <p className="border-t border-line p-3 text-xxs leading-4 text-slate-600">
            {t('Circuit and drone drafts save automatically. Other benches store work only when you save; this rail asks before leaving unsaved changes.')}
          </p>
        )}
      </aside>

      <Modal
        open={Boolean(leaving)}
        onClose={() => setLeaving(null)}
        title={t('Leave with unsaved changes?')}
        description={t('{what} has changes that are not saved in this browser. Save or export them first to keep them.', { what: t(unsavedBenchWork()?.what ?? active.name) })}
        footer={<><Button variant="secondary" onClick={() => setLeaving(null)}>{t('Stay on this bench')}</Button><Button variant="danger" onClick={() => go(leaving)}>{t('Leave without saving')}</Button></>}
      />
    </>
  )
}

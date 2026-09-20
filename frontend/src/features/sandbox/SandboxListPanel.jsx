import { useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { ALL_SANDBOXES } from './sandboxDirectory.js'
import {
  Activity,
  ArrowRight,
  Binary,
  Bot,
  Boxes,
  Compass,
  Cpu,
  Eye,
  Plane,
  Shield,
  Zap,
} from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspaceStore.js'
import { Badge } from '../../ui/index.js'

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

export default function SandboxListPanel({ currentBench = 'circuit' }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeBench = searchParams.get('bench') || currentBench || 'circuit'

  function handleSelect(sandbox) {
    try {
      useWorkspaceStore.getState().saveDraft()
    } catch {
      // Ignore if outside workspace
    }
    navigate(sandbox.path)
  }

  return (
    <div className="p-3 space-y-3" role="region" aria-label={t("All available sandboxes")}>
      <div className="flex items-center justify-between pb-1 border-b border-line">
        <div className="flex items-center gap-1.5">
          <Boxes size={15} className="text-brand-700" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">
            {t("All Available Sandboxes")}
          </h2>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          {ALL_SANDBOXES.length} {t("benches")}
        </span>
      </div>

      <p className="text-xs text-ink-secondary leading-relaxed">
        {t("Switch to another dedicated sandbox. Your breadboard draft and saved sketches remain available.")}
      </p>

      <div className="space-y-2 pt-1">
        {ALL_SANDBOXES.map((item) => {
          const isActive = (item.bench || 'circuit') === activeBench
          const Icon = ICONS[item.icon] ?? Cpu

          return (
            <div
              key={item.id}
              className={`rounded-lg border p-3 transition-all ${
                isActive
                  ? 'border-brand-500 bg-brand-50/70 shadow-xs'
                  : 'border-line bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-md border ${
                    isActive ? 'bg-brand-600 text-white border-brand-700' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}>
                    <Icon size={14} />
                  </span>
                  <div>
                    <h3 className="text-xs font-semibold text-ink">
                      {t(item.name)}
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      {t(item.category)}
                    </p>
                  </div>
                </div>
                {isActive ? (
                  <Badge tone="brand">{t("Current")}</Badge>
                ) : (
                  <button
                    onClick={() => handleSelect(item)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                  >
                    {t("Open")}
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>

              <p className="mt-2 text-[11px] text-ink-secondary leading-relaxed">
                {t(item.description)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

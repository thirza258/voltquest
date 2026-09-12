import { useI18n } from '../../i18n/index.jsx'
/**
 * One level tile on the campaign map. Three states — locked, available, completed — each stated in
 * words as well as colour (DESIGN.md "Campaign map").
 */
import { Clock, Lock, Play, RotateCcw } from 'lucide-react'
import { Badge, Stars, cx } from '../../ui/index.js'

/**
 * @param {object} props
 * @param {object} props.level LevelSummary-ish: { id, codeName, title, summary, estimatedMinutes }
 * @param {number} props.stars 0..3
 * @param {boolean} props.locked
 * @param {object|null} props.blocker the level that must be finished first
 * @param {(levelId: string) => void} props.onOpen
 */
export function LevelCard({ level, stars = 0, locked = false, blocker = null, onOpen }) {
  const { t } = useI18n()
  const completed = stars > 0
  const state = locked ? 'Locked' : completed ? 'Completed' : 'Available'

  return (
    <div
      className={cx(
        'flex flex-col gap-2 rounded-lg border bg-surface-panel p-3 transition-colors duration-150',
        locked ? 'border-line bg-surface-sunken' : 'border-line hover:border-brand-300',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xxs font-semibold uppercase tracking-wide text-slate-500">{level.codeName}</p>
          <h3 className={cx('truncate text-sm font-semibold', locked ? 'text-ink-secondary' : 'text-ink')}>
            {t(level.title)}
          </h3>
        </div>
        {locked ? (
          <Badge tone="neutral">
            <Lock size={11} className="mr-1 inline align-[-1px]" aria-hidden="true" />
            {t(state)}
          </Badge>
        ) : (
          <Badge tone={completed ? 'success' : 'brand'}>{t(state)}</Badge>
        )}
      </div>

      <p className="line-clamp-3 text-xxs leading-relaxed text-slate-500">{t(level.summary)}</p>

      <div className="flex items-center justify-between gap-2">
        <Stars value={stars} max={3} size="sm" />
        <span className="inline-flex items-center gap-1 text-xxs text-slate-500">
          <Clock size={11} aria-hidden="true" />
          {level.estimatedMinutes ?? 5}{t(" min")}</span>
      </div>

      {locked ? (
        <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
          <span className="text-xxs text-slate-500">{t("Finish ")}{blocker?.codeName ?? t("the previous level")}{t(" first")}</span>
          <button
            type="button"
            onClick={() => onOpen?.(level.id)}
            className="rounded-md px-1.5 py-1 text-xxs font-medium text-brand-700 ring-brand-500 ring-offset-1 hover:bg-brand-50 focus:outline-none focus-visible:ring-2"
          >{t("Skip ahead")}</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpen?.(level.id)}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-brand-600 bg-brand-600 text-xxs font-medium text-white ring-brand-500 ring-offset-1 transition-colors duration-150 hover:bg-brand-700 focus:outline-none focus-visible:ring-2"
        >
          {completed ? <RotateCcw size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
          {completed ? `Replay ${level.codeName}` : `Start ${level.codeName}`}
        </button>
      )}
    </div>
  )
}

export default LevelCard

import { useI18n } from '../i18n/index.jsx'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, Star, XCircle, Zap } from 'lucide-react'
import { clamp, cx, LABEL_CLASS, prefersReducedMotion, TONE_FILL, TONE_ICON, TONE_SOFT } from './tokens.js'

const BAR_SIZE = { sm: 'h-1', md: 'h-2', lg: 'h-3' }

/**
 * Determinate progress bar (XP, supply-current budget, quest completion).
 * Values outside [0, max] are clamped; a non-positive `max` renders empty.
 */
export function ProgressBar({
  value = 0,
  max = 100,
  tone = 'brand',
  label,
  showValue = false,
  size = 'md',
  className = '',
  ...rest
}) {
  const { t } = useI18n()
  const top = Number(max) > 0 ? Number(max) : 0
  const current = top > 0 ? clamp(value, 0, top) : 0
  const pct = top > 0 ? (current / top) * 100 : 0
  return (
    <div className={cx('min-w-0', className)} {...rest}>
      {(label || showValue) && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          {label && <span className={LABEL_CLASS}>{t(label)}</span>}
          {showValue && (
            <span className="tabular text-xxs text-slate-500">
              {current} / {top}
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={top}
        aria-label={typeof label === 'string' ? t(label) : undefined}
        className={cx('w-full overflow-hidden rounded-full bg-surface-sunken', BAR_SIZE[size] || BAR_SIZE.md)}
      >
        <div
          className={cx('h-full rounded-full transition-[width] duration-[250ms]', TONE_FILL[tone] || TONE_FILL.brand)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const CALLOUT_ICON = {
  neutral: Info,
  brand: Zap,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  volt: Zap,
  info: Info,
}

/**
 * Inline explanatory box. Warnings should always state cause and fix; `action`
 * is rendered at the bottom (typically a small Button).
 */
export function Callout({ tone = 'info', title, children, icon, action, className = '', ...rest }) {
  const { t } = useI18n()
  const Fallback = CALLOUT_ICON[tone] || Info
  return (
    <div
      className={cx('flex gap-2 rounded-lg border p-3', TONE_SOFT[tone] || TONE_SOFT.info, className)}
      {...rest}
    >
      <span className={cx('mt-0.5 shrink-0', TONE_ICON[tone] || TONE_ICON.info)}>
        {icon || <Fallback aria-hidden="true" className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        {title && <div className="text-sm font-semibold">{t(title)}</div>}
        {children && <div className={cx('text-xxs leading-relaxed', title && 'mt-0.5')}>{children}</div>}
        {action && <div className="mt-2 flex flex-wrap gap-1.5">{action}</div>}
      </div>
    </div>
  )
}

/** Friendly placeholder for empty lists and unselected inspectors. */
export function EmptyState({ icon, title, description, action, className = '', ...rest }) {
  const { t } = useI18n()
  return (
    <div
      className={cx('flex flex-col items-center justify-center gap-2 px-4 py-8 text-center', className)}
      {...rest}
    >
      {icon && <span className="text-ink-muted">{icon}</span>}
      {title && <h3 className="text-sm font-semibold text-ink">{t(title)}</h3>}
      {description && <p className="max-w-xs text-xxs leading-relaxed text-slate-500">{t(description)}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

const STAR_SIZE = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-6 w-6' }

/**
 * Earned-stars row. `value` stars are filled amber, the rest are outlined.
 * Exposes an aria-label of the form "2 of 3 stars".
 */
export function Stars({ value = 0, max = 3, size = 'md', animated = false, className = '', ...rest }) {
  const { t } = useI18n()
  const total = Number.isFinite(max) && max > 0 ? Math.floor(max) : 3
  const earned = clamp(Math.floor(Number(value) || 0), 0, total)
  const pop = animated && !prefersReducedMotion()
  return (
    <span
      role="img"
      aria-label={t('{earned} of {total} stars', { earned, total })}
      className={cx('inline-flex items-center gap-0.5', className)}
      {...rest}
    >
      {Array.from({ length: total }, (_, i) => {
        const filled = i < earned
        const star = (
          <Star
            aria-hidden="true"
            className={cx(
              STAR_SIZE[size] || STAR_SIZE.md,
              filled ? 'fill-volt-400 text-volt-500' : 'fill-none text-ink-muted',
            )}
          />
        )
        if (!pop || !filled) return <span key={i} className="inline-flex">{star}</span>
        return (
          <motion.span
            key={i}
            className="inline-flex"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, delay: i * 0.18, ease: 'easeOut' }}
          >
            {star}
          </motion.span>
        )
      })}
    </span>
  )
}

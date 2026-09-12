import { useI18n } from '../i18n/index.jsx'
import { forwardRef } from 'react'
import {
  cx,
  CONTROL_SIZE,
  FOCUS_RING,
  TRANSITION,
  TONE_SOFT,
  TONE_FILL,
  TONE_TEXT,
  LABEL_CLASS,
} from './tokens.js'

/** Button variant -> literal Tailwind classes. */
const BUTTON_VARIANT = {
  primary: 'bg-brand-600 text-white border border-brand-600 hover:bg-brand-700 hover:border-brand-700',
  secondary: 'bg-surface-panel text-ink border border-line-strong hover:bg-surface-sunken',
  ghost: 'bg-transparent text-ink-secondary border border-transparent hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-rose-600 text-white border border-rose-600 hover:bg-rose-700 hover:border-rose-700',
  success: 'bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700 hover:border-emerald-700',
}

const ICON_SIZE = { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-10 w-10' }

/**
 * Primary action button. Renders `icon` before and `iconRight` after the label;
 * while `loading` it shows a spinner, keeps its width and is not clickable.
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    disabled = false,
    block = false,
    type = 'button',
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium select-none',
        CONTROL_SIZE[size] || CONTROL_SIZE.md,
        BUTTON_VARIANT[variant] || BUTTON_VARIANT.primary,
        block && 'w-full',
        isDisabled && 'opacity-50 cursor-not-allowed',
        FOCUS_RING,
        TRANSITION,
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 'md' : 'sm'} /> : icon}
      {children != null && children !== false && <span className="truncate">{children}</span>}
      {!loading && iconRight}
    </button>
  )
})

/**
 * Square icon-only button. `label` is required — it becomes the accessible name
 * and the native tooltip.
 */
export const IconButton = forwardRef(function IconButton(
  { icon, label, size = 'md', variant = 'ghost', active = false, disabled = false, className = '', ...rest },
  ref,
) {
  const { t } = useI18n()
  return (
    <button
      ref={ref}
      type="button"
      title={t(label)}
      aria-label={t(label)}
      aria-pressed={active || undefined}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center rounded-md',
        ICON_SIZE[size] || ICON_SIZE.md,
        active
          ? 'bg-brand-50 text-brand-700 border border-brand-200'
          : BUTTON_VARIANT[variant] || BUTTON_VARIANT.ghost,
        disabled && 'opacity-50 cursor-not-allowed',
        FOCUS_RING,
        TRANSITION,
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  )
})

/** Small status pill. `dot` prefixes a filled tone dot. */
export function Badge({ tone = 'neutral', children, dot = false, className = '', ...rest }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xxs font-medium whitespace-nowrap',
        TONE_SOFT[tone] || TONE_SOFT.neutral,
        className,
      )}
      {...rest}
    >
      {dot && <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', TONE_FILL[tone] || TONE_FILL.neutral)} />}
      {children}
    </span>
  )
}

/** Keyboard key hint, e.g. `<Kbd>Ctrl</Kbd>`. */
export function Kbd({ children, className = '', ...rest }) {
  return (
    <kbd
      className={cx(
        'inline-flex min-w-[1.5rem] items-center justify-center rounded border border-line-strong',
        'bg-surface-sunken px-1.5 py-0.5 font-mono text-xxs text-ink-secondary',
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  )
}

const SPINNER_SIZE = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-6 w-6' }

/** Indeterminate loading spinner. Decorative: the surrounding control names it. */
export function Spinner({ size = 'md', className = '', ...rest }) {
  return (
    <span
      role="presentation"
      className={cx(
        'inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70',
        SPINNER_SIZE[size] || SPINNER_SIZE.md,
        className,
      )}
      {...rest}
    />
  )
}

/** Horizontal (or vertical) hairline rule. */
export function Divider({ vertical = false, className = '', ...rest }) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cx(vertical ? 'w-px self-stretch bg-line' : 'h-px w-full bg-line', className)}
      {...rest}
    />
  )
}

/**
 * Flat content card. With `onClick` it becomes a real button so it is
 * keyboard-reachable; `hover` adds a border/background hover affordance.
 */
export function Card({ children, className = '', hover = false, onClick, ...rest }) {
  const base = cx(
    'rounded-lg border border-line bg-surface-panel text-left',
    (hover || onClick) && 'hover:border-brand-300 hover:bg-brand-50/40',
    TRANSITION,
    className,
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cx(base, FOCUS_RING)} {...rest}>
        {children}
      </button>
    )
  }
  return (
    <div className={base} {...rest}>
      {children}
    </div>
  )
}

/** Labelled readout: big tabular value with an optional unit and hint line. */
export function Stat({ label, value, unit, hint, tone = 'neutral', className = '', ...rest }) {
  const { t } = useI18n()
  return (
    <div className={cx('min-w-0', className)} {...rest}>
      <div className={LABEL_CLASS}>{t(label)}</div>
      <div className={cx('tabular flex items-baseline gap-1 text-base font-semibold', TONE_TEXT[tone] || TONE_TEXT.neutral)}>
        <span className="truncate">{value}</span>
        {unit && <span className="text-xxs font-medium text-slate-500">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-xxs text-slate-500">{hint}</div>}
    </div>
  )
}

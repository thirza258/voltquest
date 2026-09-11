import { forwardRef, useId } from 'react'
import { clamp, CONTROL_SIZE, cx, FOCUS_RING, LABEL_CLASS, TRANSITION } from './tokens.js'

const INPUT_BASE =
  'w-full rounded-md border border-line-strong bg-surface-panel text-ink placeholder:text-ink-muted ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted'

/**
 * Label / hint / error wrapper around one control.
 *
 * Pass a render function to receive `{ id, describedBy }` and wire them onto
 * your control — that is the only form in which the label can point at the
 * control. With plain children the label is rendered without `htmlFor` (a
 * dangling IDREF is worse than none), so give the child its own accessible
 * name. Never combine `Field label` with a control's own `label` prop: that
 * would produce two labels for one control.
 */
export function Field({ label, hint, error, children, className = '', ...rest }) {
  const id = useId()
  const controlId = `${id}-control`
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const isRenderProp = typeof children === 'function'
  return (
    <div className={cx('flex flex-col gap-1', className)} {...rest}>
      {label &&
        (isRenderProp ? (
          <label htmlFor={controlId} className={LABEL_CLASS}>
            {label}
          </label>
        ) : (
          <span className={LABEL_CLASS}>{label}</span>
        ))}
      {isRenderProp ? children({ id: controlId, describedBy }) : children}
      {error ? (
        <p id={`${id}-error`} className="text-xxs text-rose-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xxs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

/** Single-line text input. `onChange` receives the raw change event. */
export const TextInput = forwardRef(function TextInput(
  { size = 'md', label, className = '', id, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id || autoId
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={inputId} className={LABEL_CLASS}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type="text"
        className={cx(INPUT_BASE, CONTROL_SIZE[size] || CONTROL_SIZE.md, FOCUS_RING, TRANSITION)}
        {...rest}
      />
    </div>
  )
})

/**
 * Native select. `onChange` receives the selected option value (a string), not
 * the event, matching every other control in this kit.
 */
export const Select = forwardRef(function Select(
  { value, onChange, options = [], label, size = 'md', disabled = false, className = '', id, ...rest },
  ref,
) {
  const autoId = useId()
  const selectId = id || autoId
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={selectId} className={LABEL_CLASS}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className={cx(INPUT_BASE, CONTROL_SIZE[size] || CONTROL_SIZE.md, 'pr-7', FOCUS_RING, TRANSITION)}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
})

/**
 * Numeric input with an optional unit suffix. `onChange` receives a number,
 * clamped to [min, max]; an empty or unparsable field does not fire.
 */
export const NumberField = forwardRef(function NumberField(
  {
    value,
    onChange,
    min,
    max,
    step = 1,
    unit,
    label,
    size = 'md',
    disabled = false,
    className = '',
    id,
    ...rest
  },
  ref,
) {
  const autoId = useId()
  const inputId = id || autoId
  const lo = Number.isFinite(min) ? min : -Infinity
  const hi = Number.isFinite(max) ? max : Infinity

  function handleChange(e) {
    const raw = e.target.value
    if (raw === '') return
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    onChange?.(clamp(n, lo, hi))
  }

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={inputId} className={LABEL_CLASS}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={handleChange}
          className={cx(
            INPUT_BASE,
            'tabular',
            CONTROL_SIZE[size] || CONTROL_SIZE.md,
            unit && 'pr-9',
            FOCUS_RING,
            TRANSITION,
          )}
          {...rest}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xxs text-slate-500">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
})

/** Accessible on/off switch backed by a real checkbox with `role="switch"`. */
export function Switch({ checked = false, onChange, label, disabled = false, className = '', id, ...rest }) {
  const autoId = useId()
  const inputId = id || autoId
  return (
    <label
      htmlFor={inputId}
      className={cx(
        'inline-flex min-h-[28px] cursor-pointer items-center gap-2 select-none',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="peer sr-only"
        {...rest}
      />
      <span
        aria-hidden="true"
        className={cx(
          'relative h-4 w-7 shrink-0 rounded-full border transition-colors duration-150',
          checked ? 'border-brand-600 bg-brand-600' : 'border-line-strong bg-surface-sunken',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-1',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all duration-150',
            checked ? 'left-3.5' : 'left-0.5',
          )}
        />
      </span>
      {label && <span className="text-sm text-ink-secondary">{label}</span>}
    </label>
  )
}

/**
 * Range slider. `onChange` receives a number. `marks` may be an array of
 * numbers or of `{ value, label }` and renders tick labels underneath.
 */
export function Slider({
  value = 0,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit,
  marks,
  disabled = false,
  className = '',
  id,
  ...rest
}) {
  const autoId = useId()
  const inputId = id || autoId
  const current = clamp(value, min, max)
  const ticks = (marks || []).map((m) => (typeof m === 'object' && m !== null ? m : { value: m, label: String(m) }))

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {(label || unit) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <label htmlFor={inputId} className={LABEL_CLASS}>
              {label}
            </label>
          )}
          <span className="tabular text-xxs text-slate-500">
            {current}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>
      )}
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        disabled={disabled}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className={cx(
          'h-4 w-full cursor-pointer accent-brand-600 disabled:cursor-not-allowed disabled:opacity-50',
          FOCUS_RING,
        )}
        {...rest}
      />
      {ticks.length > 0 && (
        <div className="flex justify-between text-xxs text-slate-500">
          {ticks.map((t) => (
            <span key={t.value} className="tabular">
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const SEGMENT_SIZE = { sm: 'h-7 text-xxs px-2', md: 'h-8 text-sm px-3', lg: 'h-10 text-sm px-4' }

/**
 * Mutually exclusive choice row (nav modes, Text|Blocks, breadboard layout).
 * `onChange` receives the selected option value.
 */
export function SegmentedControl({ options = [], value, onChange, size = 'md', className = '', ...rest }) {
  return (
    <div
      role="group"
      className={cx('inline-flex items-center gap-0.5 rounded-md border border-line bg-surface-sunken p-0.5', className)}
      {...rest}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            disabled={opt.disabled}
            onClick={() => onChange?.(opt.value)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-[4px] font-medium',
              SEGMENT_SIZE[size] || SEGMENT_SIZE.md,
              active ? 'bg-surface-panel text-brand-700 shadow-sm' : 'text-ink-secondary hover:text-ink',
              opt.disabled && 'cursor-not-allowed opacity-50',
              FOCUS_RING,
              TRANSITION,
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

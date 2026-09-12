import { useI18n } from '../i18n/index.jsx'
import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx, FOCUS_RING, LABEL_CLASS, TRANSITION } from './tokens.js'

/**
 * Titled surface used for every workspace region.
 *
 * When `collapsible` the header becomes a button that toggles the body; the
 * open state is uncontrolled and seeded from `defaultOpen`.
 */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
  padded = true,
  collapsible = false,
  defaultOpen = true,
  footer,
  ...rest
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  const shown = collapsible ? open : true
  const hasHeader = Boolean(title || subtitle || actions || collapsible)

  const heading = (
    <>
      <span className={LABEL_CLASS}>{t(title)}</span>
      {subtitle && <span className="mt-0.5 block text-xxs normal-case tracking-normal text-slate-500">{t(subtitle)}</span>}
    </>
  )

  return (
    <section
      className={cx('flex min-h-0 min-w-0 flex-col rounded-lg border border-line bg-surface-panel', className)}
      {...rest}
    >
      {hasHeader && (
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <div className="min-w-0 flex-1">
            {collapsible ? (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls={bodyId}
                className={cx('flex w-full items-center gap-1.5 rounded-md text-left', FOCUS_RING, TRANSITION)}
              >
                <ChevronDown
                  aria-hidden="true"
                  className={cx('h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-150', !open && '-rotate-90')}
                />
                <span className="min-w-0">{heading}</span>
              </button>
            ) : (
              <div className="min-w-0">{heading}</div>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      )}
      <div id={bodyId} hidden={!shown} className={cx('min-h-0 flex-1 overflow-auto', padded && 'p-3')}>
        {children}
      </div>
      {footer && shown && <div className="border-t border-line px-3 py-2">{footer}</div>}
    </section>
  )
}

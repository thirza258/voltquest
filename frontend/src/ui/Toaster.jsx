import { X } from 'lucide-react'
import { IconButton } from './primitives.jsx'
import { cx, TONE_FILL } from './tokens.js'
import { dismiss, useToastStore } from './toast.js'

/**
 * Bottom-right toast stack. Mount once, near the app root. The live region is
 * always present (even when empty) so screen readers announce later insertions.
 */
export function Toaster({ className = '' }) {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div
      role="status"
      aria-live="polite"
      aria-relevant="additions text"
      className={cx('pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2', className)}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-2 rounded-lg border border-line bg-surface-panel p-3 shadow-sm"
        >
          <span
            aria-hidden="true"
            className={cx('mt-1 h-2 w-2 shrink-0 rounded-full', TONE_FILL[t.tone] || TONE_FILL.neutral)}
          />
          <div className="min-w-0 flex-1">
            {t.title && <div className="text-sm font-semibold text-ink">{t.title}</div>}
            {t.message && <div className="mt-0.5 text-xxs leading-relaxed text-slate-500">{t.message}</div>}
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  dismiss(t.id)
                  t.action.onClick?.()
                }}
                className="mt-1.5 rounded-md text-xxs font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
              >
                {t.action.label}
              </button>
            )}
          </div>
          <IconButton
            icon={<X aria-hidden="true" className="h-3.5 w-3.5" />}
            label="Dismiss notification"
            size="sm"
            onClick={() => dismiss(t.id)}
          />
        </div>
      ))}
    </div>
  )
}

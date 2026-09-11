import { useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { IconButton } from './primitives.jsx'
import { cx, prefersReducedMotion } from './tokens.js'

const MODAL_SIZE = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Centred dialog. Traps Tab focus inside the panel, closes on Escape, restores
 * focus to the element that opened it and labels itself with `title` via
 * aria-labelledby (omitted when there is no title).
 */
export function Modal({
  open = false,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  closeOnOverlay = true,
  className = '',
  ...rest
}) {
  const panelRef = useRef(null)
  const openerRef = useRef(null)
  const baseId = useId()
  const titleId = `${baseId}-title`
  const descId = `${baseId}-desc`

  /** All tabbable nodes currently inside the panel. */
  const focusables = useCallback(() => {
    const root = panelRef.current
    if (!root) return []
    // No layout probing (offsetParent is always null under jsdom): rely on the
    // attributes that actually remove a node from the tab order.
    return Array.from(root.querySelectorAll(FOCUSABLE)).filter(
      (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true',
    )
  }, [])

  // Remember the opener and move focus into the dialog.
  useEffect(() => {
    if (!open) return undefined
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const first = focusables()[0]
    if (first) first.focus()
    else panelRef.current?.focus()
    return () => {
      const opener = openerRef.current
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus()
    }
  }, [open, focusables])

  // Escape to close, Tab cycled inside the panel.
  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        panelRef.current?.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose, focusables])

  if (!open) return null

  const reduced = prefersReducedMotion()
  // Portaled to <body>: a transformed or overflow-hidden ancestor (the pan/zoom
  // canvas, a resizable column) would otherwise clip or re-anchor `fixed`.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        data-testid="modal-overlay"
        className="absolute inset-0 bg-slate-900/40"
        onMouseDown={closeOnOverlay ? () => onClose?.() : undefined}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        initial={reduced ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-full w-full flex-col overflow-hidden rounded-lg border border-line',
          'bg-surface-panel shadow-sm',
          MODAL_SIZE[size] || MODAL_SIZE.md,
          className,
        )}
        {...rest}
      >
        {(title || onClose) && (
          <div className="flex items-start gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="text-sm font-semibold text-ink">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-0.5 text-xxs leading-relaxed text-slate-500">
                  {description}
                </p>
              )}
            </div>
            {onClose && <IconButton icon={<X aria-hidden="true" className="h-4 w-4" />} label="Close" size="sm" onClick={() => onClose()} />}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </motion.div>
    </div>,
    document.body,
  )
}

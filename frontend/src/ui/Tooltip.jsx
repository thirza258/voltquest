import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react'
import { cx } from './tokens.js'

const SIDE_CLASS = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
}

const OPEN_DELAY_MS = 200

/**
 * Text tooltip shown on hover and on keyboard focus after a short delay.
 * The trigger is linked to the bubble with `aria-describedby`, so the content
 * must stay purely supplementary (never the only name of a control).
 *
 * @param {{ content: React.ReactNode, children: React.ReactNode, side?: 'top'|'bottom'|'left'|'right', className?: string }} props
 */
export function Tooltip({ content, children, side = 'top', className = '', ...rest }) {
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const id = useId()

  useEffect(() => () => clearTimeout(timer.current), [])

  function show() {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS)
  }
  function hide() {
    clearTimeout(timer.current)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Describe the real trigger element when it can accept props.
  const child = isValidElement(children)
    ? cloneElement(children, { 'aria-describedby': content ? id : undefined })
    : children

  if (!content) return <>{children}</>

  return (
    <span
      className={cx('relative inline-flex', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
      {...rest}
    >
      {child}
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className={cx(
          'pointer-events-none absolute z-50 w-max max-w-xs rounded-md border border-line bg-surface-panel',
          'px-2 py-1 text-xxs text-ink shadow-sm',
          SIDE_CLASS[side] || SIDE_CLASS.top,
        )}
      >
        {content}
      </span>
    </span>
  )
}

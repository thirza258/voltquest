import { useEffect, useId, useRef, useState } from 'react'
import { cx, FOCUS_RING, TRANSITION } from './tokens.js'

/**
 * Dropdown menu. `trigger` is rendered *inside* the button this component owns
 * (pass a label and/or an icon, never a `<button>`).
 *
 * Opens on click, closes on Escape, outside click and after a selection;
 * ArrowUp/ArrowDown/Home/End move between items.
 *
 * @param {{ trigger: React.ReactNode,
 *          items: Array<{label:React.ReactNode, icon?:React.ReactNode, onSelect?:()=>void, danger?:boolean, disabled?:boolean}>,
 *          align?: 'left'|'right', label?: string, className?: string }} props
 */
export function Menu({ trigger, items = [], align = 'left', label = 'Menu', className = '', ...rest }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const triggerRef = useRef(null)
  const menuId = useId()

  // Outside click / Escape while open.
  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Focus the first item when the menu opens.
  useEffect(() => {
    if (!open) return
    const first = menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')
    first?.focus()
  }, [open])

  /** Move focus between enabled menu items, wrapping at both ends. */
  function focusItem(delta, absolute) {
    const nodes = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])
    if (nodes.length === 0) return
    const current = nodes.indexOf(document.activeElement)
    const index =
      absolute === 'first' ? 0 : absolute === 'last' ? nodes.length - 1 : (current + delta + nodes.length) % nodes.length
    nodes[index].focus()
  }

  function onMenuKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusItem(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusItem(-1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusItem(0, 'first')
    } else if (e.key === 'End') {
      e.preventDefault()
      focusItem(0, 'last')
    }
  }

  function select(item) {
    if (item.disabled) return
    setOpen(false)
    triggerRef.current?.focus()
    item.onSelect?.()
  }

  return (
    <div ref={rootRef} className={cx('relative inline-block', className)} {...rest}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={typeof trigger === 'string' ? undefined : label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={cx(
          'inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface-panel px-3 text-sm',
          'text-ink hover:bg-surface-sunken',
          FOCUS_RING,
          TRANSITION,
        )}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={cx(
            'absolute z-40 mt-1 min-w-[11rem] rounded-lg border border-line bg-surface-panel p-1 shadow-sm',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, i) => (
            <button
              key={typeof item.label === 'string' ? item.label : i}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => select(item)}
              className={cx(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-ink hover:bg-surface-sunken',
                item.disabled && 'cursor-not-allowed opacity-50',
                FOCUS_RING,
                TRANSITION,
              )}
            >
              {item.icon && <span className="shrink-0 text-slate-500">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

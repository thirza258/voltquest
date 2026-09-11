import { useRef } from 'react'
import { Badge } from './primitives.jsx'
import { cx, FOCUS_RING, TRANSITION } from './tokens.js'

const TAB_SIZE = { sm: 'h-7 px-2 text-xxs', md: 'h-8 px-3 text-sm', lg: 'h-10 px-4 text-sm' }

/**
 * Underlined tab strip with roving tabindex and automatic activation:
 * ArrowLeft/Right (and Home/End) move focus and select in one step.
 *
 * The panel itself belongs to the consumer. Give a tab an optional `panelId`
 * and it is wired up with `aria-controls` for you.
 *
 * @param {{ tabs: Array<{id:string,label:React.ReactNode,icon?:React.ReactNode,badge?:React.ReactNode,panelId?:string,disabled?:boolean}>,
 *          value: string, onChange?: (id:string)=>void, size?: 'sm'|'md'|'lg', className?: string }} props
 */
export function Tabs({ tabs = [], value, onChange, size = 'md', className = '', ...rest }) {
  const listRef = useRef(null)
  const enabled = tabs.filter((t) => !t.disabled)
  const activeIndex = Math.max(0, enabled.findIndex((t) => t.id === value))

  /** Focus and select the enabled tab at `index` (wrapping). */
  function move(index) {
    if (enabled.length === 0) return
    const next = enabled[(index + enabled.length) % enabled.length]
    onChange?.(next.id)
    const node = listRef.current?.querySelector(`[data-tab-id="${next.id}"]`)
    if (node && typeof node.focus === 'function') node.focus()
  }

  function onKeyDown(e) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        move(activeIndex + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        move(activeIndex - 1)
        break
      case 'Home':
        e.preventDefault()
        move(0)
        break
      case 'End':
        e.preventDefault()
        move(enabled.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cx('flex items-stretch gap-0.5 border-b border-line', className)}
      {...rest}
    >
      {tabs.map((tab) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            id={`tab-${tab.id}`}
            aria-selected={active}
            aria-controls={tab.panelId}
            tabIndex={active ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange?.(tab.id)}
            className={cx(
              'inline-flex items-center gap-1.5 -mb-px border-b-2 font-medium',
              TAB_SIZE[size] || TAB_SIZE.md,
              active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-secondary hover:border-line-strong hover:text-ink',
              tab.disabled && 'cursor-not-allowed opacity-50',
              FOCUS_RING,
              TRANSITION,
            )}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
            {tab.badge != null && tab.badge !== false && (
              <Badge tone={active ? 'brand' : 'neutral'}>{tab.badge}</Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}

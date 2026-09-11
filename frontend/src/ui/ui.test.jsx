// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { useState } from 'react'
import { Button, Modal, Tabs, Menu, Toaster, Stars, Switch, Slider, Badge, ProgressBar, Select } from './index.js'
import { push, dismiss, dismissAll } from './toast.js'

afterEach(() => {
  cleanup()
  dismissAll()
})

describe('Button', () => {
  it('renders its label and fires onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Run</Button>)
    const btn = screen.getByRole('button', { name: 'Run' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire while disabled', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Run
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'Run' })
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('marks itself busy and disabled while loading', () => {
    render(<Button loading>Run</Button>)
    const btn = screen.getByRole('button', { name: 'Run' })
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')
  })
})

describe('Modal', () => {
  function Harness({ closeOnOverlay = true } = {}) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Briefing"
          closeOnOverlay={closeOnOverlay}
          footer={<button type="button">Start</button>}
        >
          <p>Wire the LED.</p>
        </Modal>
      </>
    )
  }

  it('opens, labels itself with the title and traps focus inside', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    const titleId = dialog.getAttribute('aria-labelledby')
    expect(document.getElementById(titleId).textContent).toBe('Briefing')
    // Focus moved into the dialog.
    expect(dialog.contains(document.activeElement)).toBe(true)
    // Tab from the last focusable wraps to the first.
    const focusables = dialog.querySelectorAll('button')
    const last = focusables[focusables.length - 1]
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(focusables[0])
  })

  it('closes on Escape and restores focus to the opener', () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open' })
    // jsdom does not focus on click the way a browser does.
    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBe(null)
    expect(document.activeElement).toBe(opener)
  })

  it('closes on overlay click only when closeOnOverlay', () => {
    const { unmount } = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.mouseDown(screen.getByTestId('modal-overlay'))
    expect(screen.queryByRole('dialog')).toBe(null)
    unmount()

    render(<Harness closeOnOverlay={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.mouseDown(screen.getByTestId('modal-overlay'))
    expect(screen.queryByRole('dialog')).toBeTruthy()
  })
})

describe('Tabs', () => {
  const TABS = [
    { id: 'objectives', label: 'Objectives' },
    { id: 'parts', label: 'Parts' },
    { id: 'inspect', label: 'Inspect' },
  ]

  function Harness() {
    const [value, setValue] = useState('objectives')
    return <Tabs tabs={TABS} value={value} onChange={setValue} />
  }

  it('switches on click', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('tab', { name: 'Parts' }))
    expect(screen.getByRole('tab', { name: 'Parts' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Objectives' }).getAttribute('aria-selected')).toBe('false')
  })

  it('uses roving tabindex and arrow keys with automatic activation', () => {
    render(<Harness />)
    const first = screen.getByRole('tab', { name: 'Objectives' })
    expect(first.tabIndex).toBe(0)
    expect(screen.getByRole('tab', { name: 'Parts' }).tabIndex).toBe(-1)

    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Parts' }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Parts' }))

    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Inspect' }).getAttribute('aria-selected')).toBe('true')

    // Wraps past the end.
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Objectives' }).getAttribute('aria-selected')).toBe('true')
  })
})

describe('Menu', () => {
  const items = (onSelect) => [
    { label: 'Restart level', onSelect },
    { label: 'Shortcuts' },
    { label: 'Delete', danger: true },
  ]

  it('opens on click, fires onSelect and closes', () => {
    const onSelect = vi.fn()
    render(<Menu trigger="More" items={items(onSelect)} />)
    const trigger = screen.getByRole('button', { name: 'More' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Restart level' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBe(null)
    expect(document.activeElement).toBe(trigger)
  })

  it('navigates with arrow keys and closes on Escape', () => {
    render(<Menu trigger="More" items={items(vi.fn())} />)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const menu = screen.getByRole('menu')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Restart level' }))
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Shortcuts' }))
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Restart level' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBe(null)
  })

  it('closes on an outside click', () => {
    render(<Menu trigger="More" items={items(vi.fn())} />)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBe(null)
  })
})

describe('Toaster', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders a pushed toast inside a polite live region and dismisses it', () => {
    render(<Toaster />)
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')

    let id
    act(() => {
      id = push({ title: 'Saved', message: 'Sketch stored locally', tone: 'success' })
    })
    expect(screen.getByText('Saved')).toBeTruthy()
    expect(screen.getByText('Sketch stored locally')).toBeTruthy()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    })
    expect(screen.queryByText('Saved')).toBe(null)
    expect(typeof id).toBe('string')
  })

  it('auto-dismisses after timeoutMs', () => {
    render(<Toaster />)
    act(() => {
      push({ title: 'Compiling', timeoutMs: 1000 })
    })
    expect(screen.getByText('Compiling')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(1100)
    })
    expect(screen.queryByText('Compiling')).toBe(null)
  })

  it('keeps a toast with timeoutMs 0 until dismissed', () => {
    render(<Toaster />)
    let id
    act(() => {
      id = push({ title: 'Sticky', timeoutMs: 0 })
    })
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(screen.getByText('Sticky')).toBeTruthy()
    act(() => {
      dismiss(id)
    })
    expect(screen.queryByText('Sticky')).toBe(null)
    expect(id.startsWith('t_')).toBe(true)
  })
})

describe('Stars', () => {
  it('renders max icons with the earned count in its label', () => {
    const { container } = render(<Stars value={2} max={3} />)
    expect(screen.getByRole('img', { name: '2 of 3 stars' })).toBeTruthy()
    expect(container.querySelectorAll('svg').length).toBe(3)
  })

  it('clamps out-of-range values', () => {
    render(<Stars value={9} max={3} />)
    expect(screen.getByRole('img', { name: '3 of 3 stars' })).toBeTruthy()
    cleanup()
    render(<Stars value={-2} max={3} />)
    expect(screen.getByRole('img', { name: '0 of 3 stars' })).toBeTruthy()
  })
})

describe('Switch', () => {
  it('is a controlled switch reporting the next checked state', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Switch checked={false} onChange={onChange} label="Audio" />)
    const input = screen.getByRole('switch', { name: 'Audio' })
    expect(input.checked).toBe(false)
    fireEvent.click(input)
    expect(onChange).toHaveBeenCalledWith(true)
    // Still false until the parent re-renders with the new value.
    expect(screen.getByRole('switch', { name: 'Audio' }).checked).toBe(false)
    rerender(<Switch checked onChange={onChange} label="Audio" />)
    expect(screen.getByRole('switch', { name: 'Audio' }).checked).toBe(true)
  })
})

describe('Slider', () => {
  it('reports a number and clamps the rendered value', () => {
    const onChange = vi.fn()
    render(<Slider value={50} onChange={onChange} min={0} max={100} step={5} label="Light" unit="%" />)
    const input = screen.getByRole('slider', { name: 'Light' })
    expect(input.value).toBe('50')
    fireEvent.change(input, { target: { value: '75' } })
    expect(onChange).toHaveBeenCalledWith(75)
    cleanup()
    render(<Slider value={999} onChange={onChange} min={0} max={100} label="Light" />)
    expect(screen.getByRole('slider', { name: 'Light' }).value).toBe('100')
  })
})

describe('Select', () => {
  it('reports the chosen option value', () => {
    const onChange = vi.fn()
    render(
      <Select
        label="Baud"
        value="9600"
        onChange={onChange}
        options={[
          { value: '9600', label: '9600' },
          { value: '115200', label: '115200' },
        ]}
      />,
    )
    fireEvent.change(screen.getByRole('combobox', { name: 'Baud' }), { target: { value: '115200' } })
    expect(onChange).toHaveBeenCalledWith('115200')
  })
})

describe('misc primitives', () => {
  it('Badge renders its tone dot and children', () => {
    render(<Badge tone="danger" dot>Short circuit</Badge>)
    expect(screen.getByText('Short circuit')).toBeTruthy()
  })

  it('ProgressBar exposes clamped aria values', () => {
    render(<ProgressBar value={150} max={100} label="XP" />)
    const bar = screen.getByRole('progressbar', { name: 'XP' })
    expect(bar.getAttribute('aria-valuenow')).toBe('100')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
  })
})

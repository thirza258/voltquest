// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  Callout,
  Card,
  ChipMascot,
  Divider,
  EmptyState,
  Field,
  IconButton,
  Kbd,
  NumberField,
  Panel,
  SegmentedControl,
  SpeechBubble,
  Spinner,
  Stat,
  TextInput,
  Tooltip,
} from './index.js'

afterEach(cleanup)

describe('Panel', () => {
  it('renders a title and body', () => {
    render(
      <Panel title="Inspect" subtitle="LED 1" footer={<span>footer</span>}>
        <p>body</p>
      </Panel>,
    )
    expect(screen.getByText('Inspect')).toBeTruthy()
    expect(screen.getByText('body')).toBeTruthy()
    expect(screen.getByText('footer')).toBeTruthy()
  })

  it('collapses and expands from the header button', () => {
    render(
      <Panel title="Serial" collapsible defaultOpen>
        <p>lines</p>
      </Panel>,
    )
    const toggle = screen.getByRole('button', { expanded: true })
    const bodyId = toggle.getAttribute('aria-controls')
    expect(document.getElementById(bodyId).hasAttribute('hidden')).toBe(false)
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { expanded: false })).toBeTruthy()
    expect(document.getElementById(bodyId).hasAttribute('hidden')).toBe(true)
  })
})

describe('Tooltip', () => {
  it('shows after a delay on hover and links aria-describedby', () => {
    vi.useFakeTimers()
    render(
      <Tooltip content="4.8 V">
        <button type="button">Pin 13</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'Pin 13' })
    const tipId = trigger.getAttribute('aria-describedby')
    expect(tipId).toBeTruthy()
    expect(document.getElementById(tipId).hasAttribute('hidden')).toBe(true)
    fireEvent.mouseOver(trigger.parentElement)
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(document.getElementById(tipId).hasAttribute('hidden')).toBe(false)
    fireEvent.mouseOut(trigger.parentElement)
    expect(document.getElementById(tipId).hasAttribute('hidden')).toBe(true)
    vi.useRealTimers()
  })

  it('passes children through when there is no content', () => {
    render(
      <Tooltip content={null}>
        <button type="button">Bare</button>
      </Tooltip>,
    )
    expect(screen.queryByRole('tooltip')).toBe(null)
    expect(screen.getByRole('button', { name: 'Bare' })).toBeTruthy()
  })
})

describe('ChipMascot', () => {
  it('renders every mood with an accessible name', () => {
    for (const mood of ['happy', 'thinking', 'alert', 'celebrate', 'sleepy']) {
      const { unmount } = render(<ChipMascot mood={mood} size={48} />)
      expect(screen.getByRole('img', { name: `Chip the robot, ${mood}` })).toBeTruthy()
      unmount()
    }
  })

  it('falls back to happy for an unknown mood', () => {
    render(<ChipMascot mood="grumpy" />)
    expect(screen.getByRole('img', { name: 'Chip the robot, grumpy' })).toBeTruthy()
  })
})

describe('NumberField', () => {
  it('clamps to min/max and ignores an empty field', () => {
    const onChange = vi.fn()
    render(<NumberField label="Ohms" value={220} onChange={onChange} min={0} max={1000} />)
    const input = screen.getByRole('spinbutton', { name: 'Ohms' })
    fireEvent.change(input, { target: { value: '5000' } })
    expect(onChange).toHaveBeenCalledWith(1000)
    onChange.mockClear()
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('SegmentedControl', () => {
  it('marks the active option pressed and reports selections', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        value="text"
        onChange={onChange}
        options={[
          { value: 'text', label: 'Text' },
          { value: 'blocks', label: 'Blocks' },
        ]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Text' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Blocks' }))
    expect(onChange).toHaveBeenCalledWith('blocks')
  })
})

describe('Field', () => {
  it('wires the render-prop id and prefers error over hint', () => {
    render(
      <Field label="Baud" hint="matches Serial.begin" error="Mismatch">
        {({ id, describedBy }) => <input id={id} aria-describedby={describedBy} />}
      </Field>,
    )
    const input = screen.getByLabelText('Baud')
    expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toBe('Mismatch')
    expect(screen.queryByText('matches Serial.begin')).toBe(null)
  })

  it('renders plain children without a dangling label IDREF', () => {
    const { container } = render(
      <Field label="Board" hint="5 V logic">
        <button type="button">Uno</button>
      </Field>,
    )
    expect(container.querySelector('label')).toBe(null)
    expect(screen.getByText('Board')).toBeTruthy()
    expect(screen.getByText('5 V logic')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Uno' })).toBeTruthy()
  })
})

describe('assorted leaves', () => {
  it('render without crashing', () => {
    const onClick = vi.fn()
    render(
      <div>
        <Card hover onClick={onClick}>
          card
        </Card>
        <Callout tone="warning" title="Warning" action={<button type="button">Fix</button>}>
          cause and fix
        </Callout>
        <EmptyState title="Nothing here" description="Select a part to see live values" />
        <Stat label="Voltage" value="4.98" unit="V" hint="net n_gnd" tone="success" />
        <Kbd>Esc</Kbd>
        <Spinner size="lg" />
        <Divider />
        <SpeechBubble tone="brand">Hello</SpeechBubble>
        <IconButton icon={<span>x</span>} label="Zoom in" />
        <TextInput label="Project" defaultValue="Blink" />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'card' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy()
    expect(screen.getByLabelText('Project').value).toBe('Blink')
    expect(screen.getByText('cause and fix')).toBeTruthy()
    expect(screen.getByText('Voltage')).toBeTruthy()
  })
})

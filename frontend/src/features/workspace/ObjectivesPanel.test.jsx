// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ObjectivesPanel, progressSentence } from './ObjectivesPanel.jsx'

afterEach(cleanup)

const LEVEL = {
  id: 'w1-l4',
  chipOnSmoke: 'Whoa! That LED had no resistor.',
  starCriteria: { damageExpected: false, threeText: 'Blink it in 14 lines or fewer' },
  objectives: [
    { id: 'wire', text: 'Wire the LED to D13', hints: { tier1: 'Current needs a loop back to GND' } },
    { id: 'blink', text: 'Make it blink once a second', hints: { tier1: 'delay(1000) between the writes' } },
  ],
}

const report = (passedIds, extra = {}) => ({
  objectives: LEVEL.objectives.map((o) => ({ id: o.id, text: o.text, passed: passedIds.includes(o.id), rules: [] })),
  allPassed: passedIds.length === LEVEL.objectives.length,
  stars: passedIds.length === LEVEL.objectives.length ? 2 : 0,
  starReasons: [],
  efficiency: { codeLines: 8, componentCount: 3 },
  ...extra,
})

describe('ObjectivesPanel', () => {
  it('ticks objectives with an icon and the word Done, not colour alone', () => {
    const { rerender } = render(<ObjectivesPanel level={LEVEL} report={report([])} />)
    expect(screen.getAllByText('To do')).toHaveLength(2)
    expect(screen.queryByText('Done')).toBeNull()

    rerender(<ObjectivesPanel level={LEVEL} report={report(['wire'])} />)
    expect(screen.getAllByText('Done')).toHaveLength(1)
    expect(screen.getAllByText('To do')).toHaveLength(1)
  })

  it('announces progress in a polite live region', () => {
    const { rerender } = render(<ObjectivesPanel level={LEVEL} report={report([])} />)
    const live = screen.getByRole('status')
    expect(live).toHaveProperty('ariaLive', 'polite')
    expect(live.textContent).toBe('Step 0 of 2 complete')

    rerender(<ObjectivesPanel level={LEVEL} report={report(['wire'])} />)
    expect(screen.getByRole('status').textContent).toBe('Step 1 of 2 complete')
  })

  it('shows the tier-1 hint bubble only for objectives whose tier has been reached', () => {
    render(<ObjectivesPanel level={LEVEL} report={report([])} hintTier={{ wire: 1 }} />)
    expect(screen.getByText('Current needs a loop back to GND')).toBeTruthy()
    expect(screen.queryByText('delay(1000) between the writes')).toBeNull()
  })

  it('renders the three star criteria with the level threeText', () => {
    render(<ObjectivesPanel level={LEVEL} report={report(['wire', 'blink'])} />)
    expect(screen.getByText('Complete all steps')).toBeTruthy()
    expect(screen.getByText('No smoke or shorts')).toBeTruthy()
    expect(screen.getByText('Blink it in 14 lines or fewer')).toBeTruthy()
    expect(screen.getByRole('img', { name: '2 of 3 stars' })).toBeTruthy()
  })

  it('shows the smoke callout with chipOnSmoke and both repair actions', () => {
    const onShowWhy = vi.fn()
    const onReplacePart = vi.fn()
    render(
      <ObjectivesPanel
        level={LEVEL}
        report={report([])}
        smoke={{ hint: 'Add a 220 Ω resistor', componentIds: ['c_led1'] }}
        onShowWhy={onShowWhy}
        onReplacePart={onReplacePart}
      />,
    )
    expect(screen.getByText('Whoa! That LED had no resistor.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show me why' }))
    fireEvent.click(screen.getByRole('button', { name: 'Replace part' }))
    expect(onShowWhy).toHaveBeenCalledTimes(1)
    expect(onReplacePart).toHaveBeenCalledTimes(1)
  })

  it('falls back to the warning hint when the level has no chipOnSmoke', () => {
    render(<ObjectivesPanel level={{ ...LEVEL, chipOnSmoke: undefined }} report={report([])} smoke={{ hint: 'Add a 220 Ω resistor' }} />)
    expect(screen.getByText('Add a 220 Ω resistor')).toBeTruthy()
  })

  it('renders the level checklist before the validator has reported', () => {
    render(<ObjectivesPanel level={LEVEL} report={null} />)
    expect(screen.getByText('Wire the LED to D13')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Step 0 of 2 complete')
  })
})

describe('progressSentence', () => {
  it('handles an empty list', () => {
    expect(progressSentence([])).toBe('No steps yet')
  })
})

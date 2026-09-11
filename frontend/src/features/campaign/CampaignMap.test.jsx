// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { CampaignMap } from './CampaignMap.jsx'
import { campaignTotals, isAvailable, nextUpLevelId } from './gating.js'

afterEach(cleanup)

const WORLDS = [
  {
    id: 'w1',
    order: 1,
    title: 'The Spark of Life',
    subtitle: 'Power, LEDs, resistors, buttons',
    theme: 'amber',
    board: 'uno',
    intro: 'Welcome to the bench!',
    levelIds: ['w1-l1', 'w1-l2'],
  },
  {
    id: 'w2',
    order: 2,
    title: 'The Connected World',
    subtitle: 'ESP32 IoT Academy',
    theme: 'indigo',
    board: 'esp32',
    intro: 'Your circuits get an antenna.',
    levelIds: ['w2-l1'],
  },
]

const LEVELS = {
  'w1-l1': { id: 'w1-l1', codeName: 'Level 1-1', title: 'First Glow', summary: 'Light an LED.', estimatedMinutes: 4 },
  'w1-l2': { id: 'w1-l2', codeName: 'Level 1-2', title: 'The Shield', summary: 'Add a resistor.', estimatedMinutes: 6 },
  'w2-l1': { id: 'w2-l1', codeName: 'Level 2-1', title: 'Touch Lamp', summary: 'Touch a pin.', estimatedMinutes: 8 },
}

const ORDER = ['w1-l1', 'w1-l2', 'w2-l1']

function renderMap(props = {}) {
  return render(
    <MemoryRouter>
      <CampaignMap worlds={WORLDS} levels={LEVELS} order={ORDER} progress={{}} {...props} />
    </MemoryRouter>,
  )
}

describe('CampaignMap', () => {
  beforeEach(() => {
    installMemoryStorage()
    // The player store is a module singleton: without this, the first render marks every world
    // intro as seen and the "shown only once" test can never observe the first showing.
    usePlayerStore.setState({ seenWorlds: [], seenLevels: [] })
  })

  it('renders every world with its board badge and levels', () => {
    renderMap()
    expect(screen.getByRole('heading', { name: 'The Spark of Life' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'The Connected World' })).toBeTruthy()
    expect(screen.getByText('Arduino Uno R3 · 5 V')).toBeTruthy() // BoardProfile.name, not the short label
    expect(screen.getByText('First Glow')).toBeTruthy()
    expect(screen.getByText('Touch Lamp')).toBeTruthy()
  })

  it('unlocks only the first level until a star is earned', () => {
    renderMap()
    expect(screen.getByRole('button', { name: 'Start Level 1-1' })).toBeTruthy()
    // Level 1-2 is gated on 1-1 and says so in words, not colour.
    expect(screen.getByText('Finish Level 1-1 first')).toBeTruthy()
    expect(screen.getAllByText('Locked')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Start Level 1-2' })).toBeNull()
  })

  it('unlocks the next level once the previous one has a star', () => {
    renderMap({ progress: { 'w1-l1': { stars: 1 } } })
    expect(screen.getByRole('button', { name: 'Start Level 1-2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Replay Level 1-1' })).toBeTruthy()
    expect(screen.getAllByText('Locked')).toHaveLength(1)
  })

  it('offers Skip ahead on a locked level', () => {
    const onOpenLevel = vi.fn()
    renderMap({ onOpenLevel })
    fireEvent.click(screen.getAllByRole('button', { name: 'Skip ahead' })[0])
    expect(onOpenLevel).toHaveBeenCalledWith('w1-l2')
  })

  it('points Continue at the first level without stars', () => {
    const onOpenLevel = vi.fn()
    renderMap({ progress: { 'w1-l1': { stars: 2 } }, onOpenLevel })
    fireEvent.click(screen.getByRole('button', { name: /Continue → Level 1-2 The Shield/ }))
    expect(onOpenLevel).toHaveBeenCalledWith('w1-l2')
  })

  it('always shows the sandbox card', () => {
    const onOpenSandbox = vi.fn()
    renderMap({ onOpenSandbox })
    fireEvent.click(screen.getByRole('button', { name: 'Open the sandbox' }))
    expect(onOpenSandbox).toHaveBeenCalled()
  })

  it('shows a world intro only the first time it is seen', () => {
    const { unmount } = renderMap()
    expect(screen.getByText('Welcome to the bench!')).toBeTruthy()
    unmount()

    renderMap()
    expect(screen.queryByText('Welcome to the bench!')).toBeNull()
  })

  it('shows an empty state when no content is bundled', () => {
    render(
      <MemoryRouter>
        <CampaignMap worlds={[]} levels={{}} order={[]} progress={{}} />
      </MemoryRouter>,
    )
    expect(screen.getByText('No quests are bundled yet')).toBeTruthy()
  })

  it('summarises stars and completed levels', () => {
    renderMap({ progress: { 'w1-l1': { stars: 3 }, 'w1-l2': { stars: 2 } } })
    const summary = screen.getByText('Your bench').closest('div').parentElement
    expect(within(summary).getByText('5 / 9 stars')).toBeTruthy()
    expect(within(summary).getByText('2 / 3 levels')).toBeTruthy()
  })
})

describe('gating', () => {
  it('follows the LEVEL_ORDER chain', () => {
    expect(isAvailable('w1-l1', ORDER, {})).toBe(true)
    expect(isAvailable('w1-l2', ORDER, {})).toBe(false)
    expect(isAvailable('w1-l2', ORDER, { 'w1-l1': { stars: 1 } })).toBe(true)
    expect(isAvailable('unknown', ORDER, {})).toBe(false)
  })

  it('falls back to the last level when the campaign is finished', () => {
    const done = Object.fromEntries(ORDER.map((id) => [id, { stars: 3 }]))
    expect(nextUpLevelId(ORDER, done)).toBe('w2-l1')
    expect(campaignTotals(ORDER, done)).toEqual({ stars: 9, completed: 3, total: 3, maxStars: 9 })
  })
})

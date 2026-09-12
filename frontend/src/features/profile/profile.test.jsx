// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from './ProfilePage.jsx'
import LeaderboardPage from './LeaderboardPage.jsx'
import { usePlayerStore } from '../../store/playerStore.js'
import { api } from '../../api/client.js'
import { installMemoryStorage } from '../../test-utils/localStorage.js'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('shows earned progress and only lets players select unlocked cosmetics', () => {
  installMemoryStorage()
  usePlayerStore.setState({ token: null, player: { display_name: 'Test cadet', xp: 150, level: 2 }, progress: { 'w1-l1': { stars: 3 } }, pendingOps: [] })
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Campaign progress · 1/20' })).toBeTruthy()
  const locked = screen.getByRole('button', { name: /Mint Lab/ })
  expect(locked.disabled).toBe(true)
  fireEvent.click(locked)
  expect(usePlayerStore.getState().settings.skin).toBe('classic')
})
it('renders leaderboard ranks from the public response', async () => {
  vi.spyOn(api, 'leaderboard').mockResolvedValue({ items: [{ display_name: 'Ada', xp: 300, level: 3, total_stars: 6, levels_completed: 2 }] })
  render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)
  await screen.findByRole('rowheader', { name: 'Ada' })
  expect(screen.getByRole('table').textContent).toContain('300')
})

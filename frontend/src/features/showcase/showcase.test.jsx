// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ShowcasePage from './ShowcasePage.jsx'
import { api } from '../../api/client.js'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('filters the public gallery through the real API helper contract', async () => {
  const fetch = vi.spyOn(api.showcase, 'list').mockResolvedValue({ total: 1, items: [{ id: 'p', name: 'Lamp', board: 'esp32', share_slug: 'lamp1234', owner_name: 'Cadet', views: 3, forks: 1 }] })
  render(<MemoryRouter><ShowcasePage /></MemoryRouter>)
  expect((await screen.findByRole('link', { name: /Lamp/ })).getAttribute('href')).toBe('/showcase/lamp1234')
  fireEvent.change(screen.getByLabelText('Board filter'), { target: { value: 'raspberrypi5' } })
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ board: 'raspberrypi5', offset: 0 })))
  fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: 'weather' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'weather', board: 'raspberrypi5' })))
})
it('recovers from a gallery request error', async () => {
  vi.spyOn(api.showcase, 'list').mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ total: 0, items: [] })
  render(<MemoryRouter><ShowcasePage /></MemoryRouter>)
  expect((await screen.findByRole('alert')).textContent).toBe('Offline')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('heading', { name: 'No projects found' })
})

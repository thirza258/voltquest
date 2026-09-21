// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CommunityPage from './CommunityPage.jsx'
import ThreadPage from './ThreadPage.jsx'
import { PostBody, safeHref } from './PostBody.jsx'
import { timeAgo, parseTimestamp } from './timeAgo.js'
import { navSectionFor } from '../workspace/AppHeader.jsx'
import { api } from '../../api/client.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { installMemoryStorage } from '../../test-utils/localStorage.js'

const CATEGORIES = [
  { id: 'help', label: 'Get help', threads: 2 },
  { id: 'builds', label: 'Show your build', threads: 1 },
  { id: 'hardware', label: 'Hardware and wiring', threads: 0 },
  { id: 'firmware', label: 'Code and firmware', threads: 0 },
  { id: 'courses', label: 'Courses and tutorials', threads: 0 },
  { id: 'ideas', label: 'Ideas and feedback', threads: 0 },
]
const AUTHOR = { id: 'player-1', display_name: 'Cadet-4f3a', level: 3 }
const HELPER = { id: 'player-2', display_name: 'Cadet-91bc', level: 7 }

const THREAD = {
  id: 'thread-1',
  author: AUTHOR,
  category: 'help',
  title: 'My LED will not light',
  excerpt: 'I wired D13 through 220 ohm and nothing happens.',
  body: 'I wired D13 through 220 ohm and nothing happens.\n\n```cpp\ndigitalWrite(13, HIGH);\n```',
  board: 'uno',
  project_slug: null,
  views: 4,
  reply_count: 1,
  is_solved: false,
  is_deleted: false,
  edited_at: null,
  created_at: '2026-09-21T10:00:00Z',
  last_activity_at: '2026-09-21T10:30:00Z',
  posts: [{
    id: 'post-1', thread_id: 'thread-1', author: HELPER, body: 'Check the LED polarity.',
    is_answer: false, is_deleted: false, edited_at: null, created_at: '2026-09-21T10:30:00Z',
  }],
}

beforeEach(() => {
  installMemoryStorage()
  usePlayerStore.setState({ player: { ...AUTHOR, xp: 300 }, token: 'test-token' })
  vi.spyOn(usePlayerStore.getState(), 'ensureGuest').mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function renderThread() {
  return render(<MemoryRouter initialEntries={['/community/thread-1']}>
    <Routes><Route path="/community/:threadId" element={<ThreadPage />} /></Routes>
  </MemoryRouter>)
}

it('browses discussions through the real API helper contract', async () => {
  const list = vi.spyOn(api.community, 'list').mockResolvedValue({
    total: 1, categories: CATEGORIES,
    items: [{ ...THREAD, posts: undefined }],
  })
  render(<MemoryRouter><CommunityPage /></MemoryRouter>)

  const link = await screen.findByRole('link', { name: /My LED will not light/ })
  expect(link.getAttribute('href')).toBe('/community/thread-1')
  expect(list).toHaveBeenCalledWith(expect.objectContaining({ sort: 'active', offset: 0, limit: 20 }))

  // Category chips carry the server's facet counts and filter the list.
  fireEvent.click(screen.getByRole('button', { name: /Get help 2/ }))
  await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'help', offset: 0 })))

  fireEvent.change(screen.getByLabelText('Board filter'), { target: { value: 'esp32' } })
  await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ board: 'esp32' })))

  fireEvent.change(screen.getByLabelText('Sort discussions'), { target: { value: 'popular' } })
  await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'popular' })))

  fireEvent.change(screen.getByLabelText('Search discussions'), { target: { value: 'led' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'led' })))
})

it('recovers from a failed listing and reports an empty result', async () => {
  vi.spyOn(api.community, 'list').mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ total: 0, items: [], categories: CATEGORIES })
  render(<MemoryRouter><CommunityPage /></MemoryRouter>)
  expect((await screen.findByRole('alert')).textContent).toBe('Offline')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('heading', { name: 'No discussions yet' })
})

it('posts a new discussion with the section, board and project it was opened for', async () => {
  vi.spyOn(api.community, 'list').mockResolvedValue({ total: 0, items: [], categories: CATEGORIES })
  const create = vi.spyOn(api.community, 'create').mockResolvedValue(THREAD)
  render(<MemoryRouter initialEntries={['/community?project=abcd2345']}><CommunityPage /></MemoryRouter>)

  fireEvent.click(await screen.findByRole('button', { name: /New discussion/ }))
  fireEvent.change(screen.getByLabelText('Discussion title'), { target: { value: 'Feedback on my blinker' } })
  fireEvent.change(screen.getByLabelText('Your question or update'), { target: { value: 'How would you tidy the wiring?' } })
  fireEvent.change(screen.getByLabelText('Board (optional)'), { target: { value: 'uno' } })
  // A project-scoped discussion defaults to the builds section.
  expect(screen.getByLabelText('Discussion section').value).toBe('builds')
  fireEvent.click(screen.getByRole('button', { name: 'Post discussion' }))

  await waitFor(() => expect(create).toHaveBeenCalledWith({
    title: 'Feedback on my blinker',
    body: 'How would you tidy the wiring?',
    category: 'builds',
    board: 'uno',
    project_slug: 'abcd2345',
  }))
})

it('shows a discussion, its code block and its replies', async () => {
  vi.spyOn(api.community, 'get').mockResolvedValue(THREAD)
  renderThread()
  expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('My LED will not light')
  expect(screen.getByText('digitalWrite(13, HIGH);').tagName).toBe('CODE')
  expect(screen.getByText('Check the LED polarity.')).toBeTruthy()
  expect(screen.getByRole('heading', { name: /1 replies/ })).toBeTruthy()
})

it('posts a reply and reloads the discussion', async () => {
  const get = vi.spyOn(api.community, 'get').mockResolvedValue(THREAD)
  const reply = vi.spyOn(api.community, 'reply').mockResolvedValue({ id: 'post-2' })
  renderThread()
  fireEvent.change(await screen.findByLabelText('Your reply'), { target: { value: 'Swapped the legs, it works.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Post reply' }))
  await waitFor(() => expect(reply).toHaveBeenCalledWith('thread-1', 'Swapped the legs, it works.'))
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
})

it('lets the person who asked accept an answer, and nobody else', async () => {
  vi.spyOn(api.community, 'get').mockResolvedValue(THREAD)
  const mark = vi.spyOn(api.community, 'markAnswer').mockResolvedValue(THREAD)
  const view = renderThread()
  fireEvent.click(await screen.findByRole('button', { name: /Accept as answer/ }))
  await waitFor(() => expect(mark).toHaveBeenCalledWith('thread-1', 'post-1', true))

  // A reader who did not ask the question gets no accept or edit control.
  view.unmount()
  usePlayerStore.setState({ player: { id: 'someone-else', display_name: 'Visitor', level: 1 } })
  renderThread()
  await screen.findByRole('heading', { level: 1 })
  expect(screen.queryByRole('button', { name: /Accept as answer/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
})

it('edits and withdraws your own post', async () => {
  const get = vi.spyOn(api.community, 'get').mockResolvedValue(THREAD)
  const update = vi.spyOn(api.community, 'update').mockResolvedValue(THREAD)
  const remove = vi.spyOn(api.community, 'remove').mockResolvedValue(null)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderThread()

  const openingPost = async () => (await screen.findByRole('heading', { level: 1 })).closest('article')
  fireEvent.click(within(await openingPost()).getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Edit your discussion'), { target: { value: 'Rewritten question body.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save discussion' }))
  await waitFor(() => expect(update).toHaveBeenCalledWith('thread-1', { body: 'Rewritten question body.' }))

  // Saving reloads the thread, so the earlier article node is detached: look it up again.
  fireEvent.click(within(await openingPost()).getByRole('button', { name: 'Withdraw' }))
  await waitFor(() => expect(remove).toHaveBeenCalledWith('thread-1'))
  // It had a reply, so the page reloads rather than navigating away.
  await waitFor(() => expect(get).toHaveBeenCalledTimes(3))
})

it('keeps a withdrawn question readable and closed to new replies', async () => {
  vi.spyOn(api.community, 'get').mockResolvedValue({ ...THREAD, is_deleted: true, body: '', excerpt: '' })
  renderThread()
  expect(await screen.findByText(/The author removed this post/)).toBeTruthy()
  expect(screen.getByText('Check the LED polarity.')).toBeTruthy()
  expect(screen.queryByLabelText('Your reply')).toBeNull()
  expect(screen.getByText('This discussion is closed to new replies.')).toBeTruthy()
})

it('renders post bodies as text, never as markup', () => {
  const hostile = 'Look: <img src=x onerror="alert(1)"> and <b>bold</b>\n\n```\n<script>alert(2)</script>\n```'
  const { container } = render(<PostBody body={hostile} />)
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('b')).toBeNull()
  expect(container.querySelector('script')).toBeNull()
  expect(container.textContent).toContain('<img src=x onerror="alert(1)">')
  expect(container.querySelector('pre code').textContent).toBe('<script>alert(2)</script>')

  // Only absolute http(s) URLs become links, and they carry the safe rel attributes.
  const { container: linked } = render(<PostBody body='See https://example.test/guide and javascript:alert(1) too' />)
  const anchors = [...linked.querySelectorAll('a')]
  expect(anchors.map(a => a.getAttribute('href'))).toEqual(['https://example.test/guide'])
  expect(anchors[0].getAttribute('rel')).toBe('nofollow noopener noreferrer')
  expect(safeHref('javascript:alert(1)')).toBeNull()
  expect(safeHref('/relative/path')).toBeNull()
})

it('reads bare backend timestamps as UTC', () => {
  const now = Date.parse('2026-09-21T12:00:00Z')
  expect(parseTimestamp('2026-09-21T11:59:30').toISOString()).toBe('2026-09-21T11:59:30.000Z')
  expect(timeAgo('2026-09-21T11:59:30Z', m => m, now)).toBe('just now')
  expect(timeAgo('2026-09-21T11:30:00', m => m, now)).toBe('{count}m ago')
  expect(timeAgo('2026-09-20T12:00:00Z', (m, v) => `${v.count}d`, now)).toBe('1d')
  expect(timeAgo('2026-01-01T12:00:00Z', m => m, now)).toBe('2026-01-01')
  expect(timeAgo(null)).toBe('')
})

it('marks the community section in the shared header nav', () => {
  expect(navSectionFor('/community')).toBe('community')
  expect(navSectionFor('/community/thread-1')).toBe('community')
  expect(navSectionFor('/showcase/abcd2345')).toBe('showcase')
})

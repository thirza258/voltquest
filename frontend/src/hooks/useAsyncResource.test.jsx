// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useAsyncResource } from './useAsyncResource.js'
afterEach(cleanup)
it('never exposes the previous project while loading a different route', async () => {
  const first = vi.fn(async () => ({ id: 'first' }))
  let resolveSecond
  const second = vi.fn(() => new Promise(resolve => { resolveSecond = resolve }))
  const { result, rerender } = renderHook(({ fetcher }) => useAsyncResource(fetcher), { initialProps: { fetcher: first } })
  await waitFor(() => expect(result.current.data?.id).toBe('first'))
  rerender({ fetcher: second })
  expect(result.current.loading).toBe(true)
  expect(result.current.data).toBeNull()
  await waitFor(() => expect(second).toHaveBeenCalled())
  await act(async () => { resolveSecond({ id: 'second' }) })
  expect(result.current.data.id).toBe('second')
})
it('ignores a late response from the previous route', async () => {
  let resolveFirst
  const first = () => new Promise(resolve => { resolveFirst = resolve })
  const second = async () => 'new'
  const { result, rerender } = renderHook(({ fetcher }) => useAsyncResource(fetcher), { initialProps: { fetcher: first } })
  await waitFor(() => expect(resolveFirst).toBeTypeOf('function'))
  rerender({ fetcher: second })
  await waitFor(() => expect(result.current.data).toBe('new'))
  await act(async () => { resolveFirst('old') })
  expect(result.current.data).toBe('new')
})

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { createWorkspace, demoProvider, executeTool, liveProvider, requestJson, runAgent, selfTest } from './companions/agent.mjs'

const env = () => ({ workspace: createWorkspace(), approve: async () => true, ask: async () => 'A verified draft', github: false })
it('executes the exact downloadable JavaScript CLI and its offline loop', async () => {
  expect(await selfTest()).toContain('PASS')
  const result = await runAgent({ task: 'Draft', provider: demoProvider(), env: env() })
  expect(result.files['draft.md']).toContain('A verified draft')
  const path = fileURLToPath(new URL('./companions/agent.mjs', import.meta.url))
  expect(execFileSync(process.execPath, [path, '--self-test'], { encoding: 'utf8' })).toContain('PASS')
})
it('executes the exact Python companion and its provider/integration contract tests', () => {
  const script = fileURLToPath(new URL('../../../../scripts/check-agent-cli.py', import.meta.url))
  expect(execFileSync('python3', [script], { encoding: 'utf8' })).toContain('Python companion checks passed')
})
it('honors denied writes and enforces a model turn limit', async () => {
  const context = env(); context.approve = async () => false
  const result = await runAgent({ task: 'Draft', provider: demoProvider(), env: context })
  expect(result.files['draft.md']).toBeUndefined()
  await expect(runAgent({ task: 'Draft', provider: demoProvider(), env: env(), maxTurns: 1 })).rejects.toThrow('Turn limit')
})
it('uses the Responses call id and actual usage through a mocked live transport', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce({ status: 'completed', usage: { input_tokens: 200, output_tokens: 20 }, output: [{ type: 'function_call', call_id: 'call_123', name: 'read_file', arguments: '{"path":"report.txt"}' }] })
    .mockResolvedValueOnce({ status: 'completed', usage: { input_tokens: 260, output_tokens: 12 }, output: [{ type: 'message', content: [{ type: 'output_text', text: 'Evidence read.' }] }] })
  const logs = [], provider = liveProvider({ apiKey: 'test-key-not-real', model: 'chosen-model', request })
  const result = await runAgent({ task: 'Read evidence', provider, env: env(), log: value => logs.push(value) })
  expect(result.usage[0].input_tokens).toBe(200)
  const payload = JSON.parse(request.mock.calls[1][1].body)
  expect(payload.input.at(-1)).toMatchObject({ type: 'function_call_output', call_id: 'call_123' })
  expect(payload.input.at(-1).output).toContain('before email verification')
  expect(payload.store).toBe(false); expect(payload.max_output_tokens).toBe(800)
  expect(JSON.stringify(logs)).not.toContain('test-key-not-real')
  expect(request.mock.calls.every(call => call[0] === 'https://api.openai.com/v1/responses')).toBe(true)
})
it('rejects incomplete provider responses and duplicate call identities before any side effect', async () => {
  const context = env()
  const provider = liveProvider({ apiKey: 'test', model: 'test', request: async () => ({ status: 'incomplete', output: [] }) })
  await expect(runAgent({ task: 'Read', provider, env: context })).rejects.toThrow('incomplete')
  const call = { type: 'function_call', call_id: 'duplicate', name: 'write_file', arguments: '{"path":"draft.md","text":"x"}' }
  await expect(runAgent({ task: 'Read', provider: async () => ({ output: [call, call] }), env: context })).rejects.toThrow('duplicate call')
  expect(context.workspace.files['draft.md']).toBeUndefined()
})
it('requires an explicit GitHub opt-in and returns a bounded selection from the fixed host', async () => {
  const context = { ...env(), repository: 'example/demo', githubToken: 'private-test-token', request: vi.fn(async () => Array.from({ length: 9 }, (_, i) => ({ number: i, title: 'x'.repeat(900), html_url: 'https://github.com/example/demo/issues/1', body: 'omit private body' }))) }
  await expect(executeTool('github_issues', {}, context)).rejects.toThrow('requires --github')
  expect(context.request).not.toHaveBeenCalled()
  context.github = true
  const output = await executeTool('github_issues', {}, context)
  expect(output).toHaveLength(5); expect(output[0].title).toHaveLength(500)
  expect(JSON.stringify(output)).not.toContain('private')
  expect(context.request.mock.calls[0][0]).toBe('https://api.github.com/repos/example/demo/issues?state=open&per_page=5')
  context.repository = 'example/demo/../secrets'
  await expect(executeTool('github_issues', {}, context)).rejects.toThrow('requires --github')
})
describe('bounded native HTTP transport', () => {
  it('rejects HTTP errors without exposing provider bodies', async () => {
    const fetcher = vi.fn(async () => new Response('sensitive-provider-detail', { status: 401 }))
    await expect(requestJson('https://example.invalid', {}, fetcher)).rejects.toThrow('HTTP 401')
    expect(fetcher.mock.calls[0][1].redirect).toBe('error')
  })
  it('bounds downloaded response bytes', async () => {
    await expect(requestJson('https://example.invalid', {}, async () => new Response('x'.repeat(262145)))).rejects.toThrow('256 KiB')
  })
  it('retains the abort signal while consuming the body', async () => {
    vi.useFakeTimers()
    try {
      const fetcher = async (_url, options) => ({ ok: true, body: { getReader: () => ({ read: () => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))) }) } })
      const pending = expect(requestJson('https://example.invalid', {}, fetcher)).rejects.toThrow('timed out')
      await vi.advanceTimersByTimeAsync(30001); await pending
    } finally { vi.useRealTimers() }
  })
})

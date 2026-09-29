import { describe, expect, it } from 'vitest'
import { executeRequest } from '../../engine/cybersecurity/model.js'
import { LABS, defaultControls } from '../../engine/cybersecurity/scenarios.js'
import { parseRequestDraft } from './project.js'
import { formatCurl, parseCurl, tokenizeCommand } from './curl.js'
import { NODES, requestTopology } from './topology.js'
import { inspectSummary, isEventAttr, parseInertHtml } from './inspectHtml.js'

const run = draft => executeRequest(parseRequestDraft(draft))

describe('security terminal curl', () => {
  it('tokenizes quotes and escapes', () => {
    expect(tokenizeCommand(`curl -H 'Cookie: sid=a' -d "{\\"x\\":1}" /p`)).toEqual(['curl', '-H', 'Cookie: sid=a', '-d', '{"x":1}', '/p'])
    expect(() => tokenizeCommand("curl 'unterminated")).toThrow(/Close the quote/)
  })
  it('parses methods, headers, cookies, bodies and targets into a runnable draft', () => {
    const draft = parseCurl(`curl -X POST http://shop.vq.test/account/email -b sid=alice-session -H 'Origin: https://shop.vq.test' -d '{"email":"a@vq.test","csrf":"csrf-alice"}'`)
    expect(draft.method).toBe('POST')
    expect(draft.path).toBe('/account/email')
    expect(JSON.parse(draft.headers)).toEqual({ Cookie: 'sid=alice-session', Origin: 'https://shop.vq.test' })
    expect(run(draft).status).toBe(200)
    expect(parseCurl('/health').method).toBe('GET')
    expect(parseCurl('curl -d \'{"a":1}\' /x').method).toBe('POST')
  })
  it('rejects other hosts, unknown flags and non-object bodies', () => {
    expect(() => parseCurl('curl https://evil.test/x')).toThrow(/local shop/)
    expect(() => parseCurl('curl --proxy x /y')).toThrow(/does not support/)
    expect(() => parseCurl('curl -d "not json" /y')).toThrow(/JSON object/)
    expect(() => parseCurl('curl')).toThrow(/target/)
  })
  it('round-trips every lab baseline and probe through curl', () => {
    for (const lab of Object.values(LABS)) for (const request of [lab.baseline, lab.probe]) {
      const validated = parseRequestDraft({ ...request, headers: JSON.stringify(request.headers), body: JSON.stringify(request.body) })
      const draft = parseCurl(formatCurl(validated))
      expect(parseRequestDraft(draft)).toEqual(validated)
    }
  })
})

describe('request topology', () => {
  it('exposes a fixed set of honest nodes', () => {
    expect(NODES.map(node => node.id)).toEqual(['client', 'server', 'sessions', 'products', 'files', 'news', 'internal'])
  })
  it('routes a product query to the SQL node and marks the SQL finding', () => {
    const topo = requestTopology(executeRequest(parseRequestDraft({ method: 'GET', path: `/products?name=${encodeURIComponent("' OR 1=1 -- ")}`, headers: '{}', body: '{}' }), defaultControls('sql')))
    expect(topo.hops).toEqual(['client', 'server', 'products'])
    expect(topo.findingNodes).toContain('products')
  })
  it('reaches the internal service on a successful SSRF and stops at the server when blocked', () => {
    const draft = { method: 'GET', path: `/preview?url=${encodeURIComponent('http://inventory.internal/status')}`, headers: '{}', body: '{}' }
    const leaked = executeRequest(parseRequestDraft(draft), defaultControls('ssrf'))
    expect(requestTopology(leaked)).toMatchObject({ backend: 'internal', blocked: false, findingNodes: ['internal'] })
    const secure = executeRequest(parseRequestDraft(draft))
    expect(requestTopology(secure)).toMatchObject({ backend: 'internal', blocked: true })
    expect(requestTopology(secure).hops).toEqual(['client', 'server'])
  })
  it('stops a denied order read at the server', () => {
    const denied = executeRequest(parseRequestDraft({ method: 'GET', path: '/orders/1002', headers: JSON.stringify({ cookie: 'sid=alice-session' }), body: '{}' }))
    expect(denied.status).toBe(403)
    expect(requestTopology(denied)).toMatchObject({ backend: 'sessions', blocked: true, hops: ['client', 'server'] })
  })
})

describe('inert HTML inspector', () => {
  it('parses unencoded markup into element nodes with attributes, never executing them', () => {
    const body = executeRequest(parseRequestDraft({ method: 'GET', path: `/search?q=${encodeURIComponent('<img src=x onerror="alert(1)">')}`, headers: '{}', body: '{}' }), defaultControls('xss')).body
    const tree = parseInertHtml(body)
    const h2 = tree.find(node => node.tag === 'h2')
    const img = h2.children.find(node => node.tag === 'img')
    expect(img.type).toBe('element')
    expect(img.attrs).toContainEqual(['onerror', 'alert(1)'])
    expect(img.attrs.some(([name]) => isEventAttr(name))).toBe(true)
    expect(inspectSummary(tree)).toEqual({ elements: 2, handlers: 1 })
  })
  it('keeps encoded output as a single text node with no elements', () => {
    const body = executeRequest(parseRequestDraft({ method: 'GET', path: `/search?q=${encodeURIComponent('<img src=x>')}`, headers: '{}', body: '{}' })).body
    const h2 = parseInertHtml(body).find(node => node.tag === 'h2')
    expect(h2.children.every(node => node.type === 'text')).toBe(true)
    expect(inspectSummary(parseInertHtml(body))).toEqual({ elements: 1, handlers: 0 })
  })
  it('shows script contents as inert text', () => {
    const tree = parseInertHtml('<div>hi</div><script>alert(1)</script>')
    const script = tree.find(node => node.tag === 'script')
    expect(script.children[0]).toEqual({ type: 'text', value: 'alert(1)' })
  })
})

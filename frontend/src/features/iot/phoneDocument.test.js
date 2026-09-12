// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { describe, expect, it } from 'vitest'
import { phoneDocument, virtualRequest } from './phoneDocument.js'

describe('virtual phone boundary', () => {
  it('resolves relative routes and preserves query parameters', () => {
    expect(virtualRequest('on?value=1', '/controls/')).toBe('/controls/on?value=1')
    expect(virtualRequest('/off')).toBe('/off')
  })
  it.each(['https://example.com/', '//example.com/', 'javascript:alert(1)', 'data:text/html,test', 'http://192.168.4.1.evil/'])('rejects external navigation: %s', path => {
    expect(() => virtualRequest(path)).toThrow(/virtual server/)
  })
  it('keeps server links and forms while removing scripts and active embedded content', () => {
    const html = phoneDocument('<script>alert(1)</script><a href="/on" onclick="alert(2)">On</a><iframe src="https://example.com"></iframe><form action="/set" method="post"><input name="v" value="1"></form><svg onload="alert(3)"></svg>', 'text/html', 'test-channel')
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect(doc.querySelector('a').getAttribute('href')).toBe('/on')
    expect(doc.querySelector('a').hasAttribute('onclick')).toBe(false)
    expect(doc.querySelector('form').getAttribute('action')).toBe('/set')
    expect(doc.querySelector('iframe, svg')).toBeNull()
    expect(doc.querySelectorAll('script')).toHaveLength(1)
    expect(doc.querySelector('script').textContent).toContain('test-channel')
    expect(doc.querySelector('script').textContent).not.toContain('alert(')
    expect(doc.querySelector('[http-equiv]').content).toContain("default-src 'none'")
  })
  it('treats plain text responses literally', () => {
    const doc = new DOMParser().parseFromString(phoneDocument('<img src=x onerror=alert(1)>', 'text/plain', 'c'), 'text/html')
    expect(doc.querySelector('img')).toBeNull()
    expect(doc.querySelector('pre').textContent).toContain('<img')
  })
})

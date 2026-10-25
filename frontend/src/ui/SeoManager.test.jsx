// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { resolveClientCanonical, resolveClientTitle, updateHeadSeo, SITE_ORIGIN } from './SeoManager.jsx'

describe('SeoManager', () => {
  it('strips query parameters from canonical URLs', () => {
    expect(resolveClientCanonical('/tutorials/drone-esc-basics?board=esp32')).toBe(`${SITE_ORIGIN}/tutorials/drone-esc-basics`)
    expect(resolveClientCanonical('/tutorials/uno-blink?board=uno')).toBe(`${SITE_ORIGIN}/tutorials/uno-blink`)
    expect(resolveClientCanonical('/sandbox?bench=matlab&lesson=matlab-start')).toBe(`${SITE_ORIGIN}/sandbox`)
    expect(resolveClientCanonical('/courses?track=embedded')).toBe(`${SITE_ORIGIN}/courses`)
  })

  it('generates proper title for hub and section pages', () => {
    expect(resolveClientTitle('/qt')).toBe('Build desktop apps with Qt and C++ — VoltQuest')
    expect(resolveClientTitle('/qt/qt-async')).toContain('Qt')
    expect(resolveClientTitle('/tutorials/uno-blink')).toContain('VoltQuest')
  })

  it('updates the DOM link canonical and document title', () => {
    document.head.innerHTML = '<title>Default Title</title>'
    updateHeadSeo('/tutorials/uno-blink?board=uno')

    expect(document.title).toContain('VoltQuest')
    const canonical = document.querySelector('link[rel="canonical"]')
    expect(canonical).not.toBeNull()
    expect(canonical?.getAttribute('href')).toBe(`${SITE_ORIGIN}/tutorials/uno-blink`)

    // Change route to /qt/qt-async
    updateHeadSeo('/qt/qt-async')
    expect(canonical?.getAttribute('href')).toBe(`${SITE_ORIGIN}/qt/qt-async`)
    expect(document.title).toContain('Qt')
  })
})

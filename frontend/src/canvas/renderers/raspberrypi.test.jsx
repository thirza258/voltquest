// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { getDef } from '../../engine/components/registry.js'
import { getRenderer } from './index.js'

afterEach(cleanup)

describe('Raspberry Pi teaching diagram', () => {
  it.each(['raspberrypi4', 'raspberrypi5'])('labels all 40 physical pins for %s', (type) => {
    const Renderer = getRenderer(type)
    const { container } = render(<svg><Renderer comp={{ id: 'controller', type }} def={getDef(type)} powered burntPins={{ GPIO17: true }} /></svg>)
    expect(container.querySelectorAll('[data-physical-pin]')).toHaveLength(40)
    expect(container.querySelector('[data-pin="GPIO17"] title').textContent).toContain('Physical pin 11')
    expect(container.querySelector('[data-pin="GPIO17"]').getAttribute('data-burnt')).toBe('true')
    expect(container.querySelector('[data-mcu-board]').getAttribute('data-mcu-board')).toBe(type)
    expect(container.querySelector('[data-power-led]').getAttribute('data-power-led')).toBe('on')
    expect(container.textContent).toContain('not a Linux emulator')
  })
})

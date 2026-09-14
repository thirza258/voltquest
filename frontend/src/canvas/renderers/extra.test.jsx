// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createComponent, getDef } from '../../engine/components/registry.js'
import { ExtraPartRenderer } from './extra.jsx'

afterEach(cleanup)
it.each(['slide_switch', 'reed_switch', 'tilt_switch'])('%s can toggle with the keyboard in a read-only preview', type => {
  const def = getDef(type), onControl = vi.fn()
  const comp = createComponent(type, { anchor: { board: 'bb1', hole: 'a1' } })
  render(<svg><ExtraPartRenderer comp={comp} def={def} selected interactive onControl={onControl} /></svg>)
  fireEvent.keyDown(screen.getByRole('button', { name: def.control.label }), { key: 'Enter' })
  expect(onControl).toHaveBeenCalledWith({ [def.control.field]: true })
})
it('sensor adjustments emit actual bounded control values and ghost parts stay inert', () => {
  const def = getDef('thermistor_ntc'), onControl = vi.fn()
  const comp = createComponent(def.type, { anchor: { board: 'bb1', hole: 'a1' } })
  const view = render(<svg><ExtraPartRenderer comp={comp} def={def} selected onControl={onControl} /></svg>)
  fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
  expect(onControl).toHaveBeenCalledWith({ temperatureC: 26 })
  onControl.mockClear()
  view.rerender(<svg><ExtraPartRenderer comp={comp} def={def} selected ghost onControl={onControl} /></svg>)
  fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
  expect(onControl).not.toHaveBeenCalled()
})

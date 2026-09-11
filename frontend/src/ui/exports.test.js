// Guards the binding export list of CONTRACTS.md §12. Node environment: this
// only inspects the module namespace, it renders nothing.
import { describe, expect, it } from 'vitest'
import * as ui from './index.js'

const CONTRACT_EXPORTS = [
  'Button',
  'IconButton',
  'Panel',
  'Tabs',
  'Modal',
  'Tooltip',
  'Badge',
  'ProgressBar',
  'Toaster',
  'useToast',
  'Kbd',
  'Stat',
  'EmptyState',
  'Spinner',
  'Switch',
  'Select',
  'NumberField',
  'Slider',
  'TextInput',
  'Field',
  'Stars',
  'ChipMascot',
  'SpeechBubble',
  'Card',
  'Divider',
  'SegmentedControl',
  'Callout',
  'Menu',
]

describe('ui barrel', () => {
  // forwardRef components are objects, plain components are functions.
  it.each(CONTRACT_EXPORTS)('exports %s as a renderable component', (name) => {
    const exported = ui[name]
    expect(exported == null).toBe(false)
    expect(['function', 'object']).toContain(typeof exported)
  })

  it('exposes the toast store API', () => {
    const api = ui.useToast()
    expect(typeof api.push).toBe('function')
    expect(typeof api.dismiss).toBe('function')
    expect(ui.useToast()).toBe(api)
  })

  it('push returns an id and dismiss removes the toast', () => {
    const id = ui.pushToast({ title: 'Hi', timeoutMs: 0 })
    expect(typeof id).toBe('string')
    expect(ui.useToastStore.getState().toasts.map((t) => t.id)).toContain(id)
    ui.dismissToast(id)
    expect(ui.useToastStore.getState().toasts.map((t) => t.id)).not.toContain(id)
  })
})

// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LocaleProvider, LanguageSelect, useI18n, translate } from './index.jsx'
import { installMemoryStorage } from '../test-utils/localStorage.js'
import dictionary from './id.json'
import { TUTORIALS, LEVELS, WORLDS } from '../content/index.js'
import { listDefs } from '../engine/components/registry.js'

beforeEach(() => installMemoryStorage())
afterEach(cleanup)
function Probe() {
  const { t } = useI18n()
  return <><LanguageSelect /><h1>{t('Your circuit')}</h1><textarea aria-label="Sketch" defaultValue="digitalWrite(9, HIGH);" /></>
}
it('defaults to English, persists Indonesian and keeps editor contents through changes', () => {
  const view = render(<LocaleProvider><Probe /></LocaleProvider>)
  expect(screen.getByRole('heading').textContent).toBe('Your circuit')
  fireEvent.change(screen.getByLabelText('Sketch'), { target: { value: '// unsaved code' } })
  fireEvent.change(screen.getByLabelText('Language / Bahasa'), { target: { value: 'id' } })
  expect(document.documentElement.lang).toBe('id')
  expect(screen.getByRole('heading').textContent).toBe('Rangkaian Anda')
  expect(screen.getByLabelText('Sketch').value).toBe('// unsaved code')
  view.unmount()
  render(<LocaleProvider><Probe /></LocaleProvider>)
  expect(screen.getByLabelText('Language / Bahasa').value).toBe('id')
})
it('preserves whitespace and interpolated identifiers with English fallback', () => {
  expect(translate('id', ' Run ')).toBe(' Jalankan ')
  expect(translate('id', 'Add {name}', { name: 'GPIO17' })).toBe('Tambah GPIO17')
  expect(translate('id', 'untranslated error')).toBe('untranslated error')
  expect(translate('id', 'constructor')).toBe('constructor')
})
it('covers every tutorial narrative and campaign objective without translating code', () => {
  const strings = []
  for (const tutorial of TUTORIALS) {
    strings.push(tutorial.title, tutorial.summary, tutorial.challenge)
    for (const item of [...tutorial.steps, ...tutorial.hardwareConcepts, ...tutorial.programConcepts]) strings.push(item.title, item.text)
    expect(translate('id', tutorial.code)).toBe(tutorial.code)
  }
  for (const level of Object.values(LEVELS)) strings.push(level.title, level.summary, level.learn.body, level.successText, ...level.objectives.flatMap(o => [o.text, o.hints.tier1]))
  for (const world of WORLDS) strings.push(world.title, world.intro)
  for (const def of listDefs()) strings.push(def.name, def.learn.summary, ...def.learn.tips, ...def.learn.pitfalls)
  expect([...new Set(strings)].filter(text => !dictionary[text])).toEqual([])
})

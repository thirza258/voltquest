// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { TUTORIALS } from '../../content/index.js'
import TutorialsPage from './TutorialsPage.jsx'
import TutorialPage from './TutorialPage.jsx'
import { LocaleProvider, translate } from '../../i18n/index.jsx'
import { getTutorialFundamentals } from '../courses/fundamentals.js'

vi.mock('../../canvas/BreadboardCanvas.jsx', () => ({ BreadboardCanvas: ({ highlights }) => <div data-testid="circuit" data-highlight={highlights?.terminals?.join(',') ?? ''}>Interactive circuit</div> }))

beforeEach(() => { installMemoryStorage(); vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers() })

function page(path) {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/tutorials" element={<TutorialsPage />} /><Route path="/tutorials/:tutorialId" element={<TutorialPage />} /></Routes></MemoryRouter></LocaleProvider>)
}

describe('tutorial pages', () => {
  it('translates lesson challenges and preserves unsaved code and step checks while switching languages', () => {
    page('/tutorials/uno-blink')
    const guide = getTutorialFundamentals('uno-blink')
    expect(screen.getByRole('heading', { name: 'Fundamentals behind this tutorial' })).toBeTruthy()
    expect(screen.getByText(guide.explanation)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Study related course sections' }).getAttribute('href')).toBe('/courses?tutorial=uno-blink#tutorial-fundamentals')
    expect(screen.getByRole('link', { name: 'Study related course sections' }).getAttribute('target')).toBe('_blank')
    fireEvent.change(screen.getByLabelText('Example code'), { target: { value: '// my unsaved experiment' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mark step 1 complete' }))
    fireEvent.change(screen.getByLabelText('Language / Bahasa'), { target: { value: 'id' } })
    const lesson = TUTORIALS.find(t => t.id === 'uno-blink')
    expect(screen.getByText(translate('id', lesson.challenge))).toBeTruthy()
    expect(screen.getByText(translate('id', guide.explanation))).toBeTruthy()
    expect(screen.getByLabelText('Kode contoh').value).toBe('// my unsaved experiment')
    expect(screen.getByRole('button', { name: 'Tandai langkah 1 selesai' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('filters by board, difficulty and topic in learning-path order', () => {
    page('/tutorials')
    expect(screen.getByRole('status').textContent).toContain(`${TUTORIALS.length} tutorials`)
    fireEvent.change(screen.getByLabelText('Filter by board'), { target: { value: 'raspberrypi4' } })
    expect(screen.getByRole('status').textContent).toContain('7 tutorials')
    fireEvent.click(screen.getByRole('button', { name: '3. Hard' }))
    expect(screen.getByRole('status').textContent).toContain('2 tutorials')
    fireEvent.change(screen.getByLabelText('Search tutorials'), { target: { value: 'dimmer' } })
    expect(screen.getByRole('heading', { name: 'Build a smooth button-controlled dimmer' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('1 tutorials')
  })

  it('opens an easy-to-hard programming path for Arduino and ESP32', () => {
    page('/tutorials?board=raspberrypi4&difficulty=Hard')
    fireEvent.click(screen.getByRole('button', { name: 'Explore Arduino / ESP32 code lessons' }))
    expect(screen.getByRole('status').textContent).toContain('10 tutorials')
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent).filter(title => TUTORIALS.some(tutorial => tutorial.title === title))
    expect(headings[0]).toBe('C++ basics: setup, loop and your first message')
    expect(headings.at(-1)).toBe('C++ state machines: build a two-flash beacon')
    fireEvent.click(screen.getByRole('button', { name: '3. Hard' }))
    expect(screen.getByRole('status').textContent).toContain('3 tutorials')
  })

  it('shows concepts, precise breadboard locations and cable highlighting', () => {
    page('/tutorials/pi-blink')
    expect(screen.getByRole('heading', { name: 'Hardware concepts' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Program concepts' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Where to put every component and cable' })).toBeTruthy()
    expect(screen.getAllByText('bb1:a20').length).toBeGreaterThan(0)
    expect(screen.getByText('bb1:b20')).toBeTruthy()
    expect(screen.getByText(/GPIO17 · physical pin 11/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show cable 1' }))
    expect(screen.getByTestId('circuit').getAttribute('data-highlight')).toBe('c_raspberrypi4:GPIO17,bb1:b20')
    fireEvent.click(screen.getByRole('button', { name: 'Mark step 1 complete' }))
    expect(screen.getByRole('button', { name: 'Mark step 1 complete' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('runs editable Python, resets the simulation and switches board models', async () => {
    page('/tutorials/pi-blink')
    fireEvent.change(screen.getByLabelText('Example code'), { target: { value: 'print("Hello from Pi")' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run example' })); await vi.advanceTimersByTimeAsync(150) })
    expect(screen.getByLabelText('Program output').textContent).toContain('Hello from Pi')
    fireEvent.click(screen.getByRole('button', { name: 'Reset sim' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(20) })
    expect(screen.getByLabelText('Program output').textContent).not.toContain('Hello from Pi')
    fireEvent.change(screen.getByLabelText('Tutorial board'), { target: { value: 'raspberrypi5' } })
    expect(screen.getByLabelText('Example code').value).toContain('from gpiozero import LED')
  })

  it('reports compilation errors and unknown tutorial URLs', async () => {
    const view = page('/tutorials/pi-blink')
    fireEvent.change(screen.getByLabelText('Example code'), { target: { value: 'import os' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run example' })); await vi.advanceTimersByTimeAsync(30) })
    expect(screen.getByRole('alert').textContent).toContain('Only gpiozero')
    view.unmount()
    page('/tutorials/missing')
    expect(screen.getByRole('heading', { name: 'Tutorial not found' })).toBeTruthy()
  })
})
